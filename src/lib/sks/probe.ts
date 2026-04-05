import {
  cleanOldSksProbeResults,
  getSafeSksCredentialView,
  getSksSiteRecordByKey,
  getPreferredResolvedSksCredential,
  getResolvedSksCredentialById,
  listSksSiteModels,
  markSksCredentialResult,
  saveSksProbeResult,
  upsertSksSiteModels,
} from "@/lib/sks/db";
import type {
  SksFullProbeResult,
  SksInternalStatus,
  SksModelTestResult,
  SksProbeResultRecord,
  SksSyncModelsResult,
} from "@/lib/sks/types";
import {
  buildOpenAiUrl,
  chooseHotModels,
  dedupeStrings,
  getInternalStatusFromTiming,
  toDbTimestamp,
} from "@/lib/sks/utils";

const SKS_REQUEST_TIMEOUT_MS = 20_000;
const MAX_ERROR_MESSAGE_LENGTH = 300;

interface TimedFetchResult {
  response: Response | null;
  ttfbMs: number | null;
  totalMs: number;
  responseText: string;
  responseJson: unknown;
  errorMessage: string | null;
  errorType: string | null;
}

function truncateText(value: string | null | undefined, limit: number = MAX_ERROR_MESSAGE_LENGTH) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function safeParseJson(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const direct = typeof record.message === "string" ? record.message : null;
    if (direct) return truncateText(direct) || fallback;

    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string") {
        return truncateText(nested.message) || fallback;
      }
      if (typeof nested.code === "string") {
        return truncateText(nested.code) || fallback;
      }
    }
  }

  return truncateText(fallback) || fallback;
}

function normalizeFailureStatus(
  httpStatus: number | null,
  errorMessage: string | null,
  modelName?: string | null
): SksInternalStatus {
  if (httpStatus === 401 || httpStatus === 403) return "auth_error";
  if (httpStatus === 408) return "timeout";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus !== null && httpStatus >= 500) return "network_error";
  if (httpStatus !== null && httpStatus >= 400) {
    return modelName ? "model_error" : "unknown";
  }

  const normalized = (errorMessage || "").toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("abort")) return "timeout";
  if (normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("invalid api key")) {
    return "auth_error";
  }
  if (normalized.includes("rate") && normalized.includes("limit")) return "rate_limited";
  if (normalized.includes("model")) return modelName ? "model_error" : "unknown";
  if (normalized) return "network_error";
  return "unknown";
}

async function timedFetch(url: string, init: RequestInit): Promise<TimedFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SKS_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const ttfbMs = Date.now() - startedAt;
    const responseText = await response.text();
    const totalMs = Date.now() - startedAt;

    return {
      response,
      ttfbMs,
      totalMs,
      responseText,
      responseJson: safeParseJson(responseText),
      errorMessage: null,
      errorType: null,
    };
  } catch (error) {
    const totalMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || message.toLowerCase().includes("abort"));

    return {
      response: null,
      ttfbMs: null,
      totalMs,
      responseText: "",
      responseJson: null,
      errorMessage: truncateText(isTimeout ? `请求超时（${SKS_REQUEST_TIMEOUT_MS / 1000}s）` : message),
      errorType: isTimeout ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractModelNames(payload: unknown) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return dedupeStrings(
      payload.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string") {
          return (item as { id: string }).id;
        }
        return "";
      })
    );
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const data = Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.models)
        ? record.models
        : Array.isArray(record.items)
          ? record.items
          : [];

    return dedupeStrings(
      data.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const candidate = item as { id?: unknown; model?: unknown; name?: unknown };
          if (typeof candidate.id === "string") return candidate.id;
          if (typeof candidate.model === "string") return candidate.model;
          if (typeof candidate.name === "string") return candidate.name;
        }
        return "";
      })
    );
  }

  return [];
}

function resolveSiteAndCredential(siteKey: string, credentialId?: string | null) {
  const site = getSksSiteRecordByKey(siteKey);
  if (!site) {
    throw new Error("站点不存在");
  }

  const resolvedCredential = credentialId
    ? getResolvedSksCredentialById(credentialId)
    : getPreferredResolvedSksCredential(site.id);

  if (!resolvedCredential) {
    throw new Error("站点没有可用的已启用凭据");
  }

  if (resolvedCredential.record.siteId !== site.id) {
    throw new Error("凭据与站点不匹配");
  }

  return { site, resolvedCredential };
}

function saveProbeAndCredentialOutcome(input: {
  siteId: string;
  credentialId: string;
  probeType: "model_list" | "model_inference";
  modelName?: string | null;
  httpStatus?: number | null;
  ttfbMs?: number | null;
  totalMs?: number | null;
  responseChars?: number | null;
  errorType?: string | null;
  errorMessage?: string | null;
  status: SksInternalStatus;
}) {
  const checkedAt = toDbTimestamp();
  const probe = saveSksProbeResult({
    siteId: input.siteId,
    credentialId: input.credentialId,
    probeType: input.probeType,
    modelName: input.modelName ?? null,
    status: input.status,
    httpStatus: input.httpStatus ?? null,
    ttfbMs: input.ttfbMs ?? null,
    totalMs: input.totalMs ?? null,
    responseChars: input.responseChars ?? null,
    errorType: input.errorType ?? null,
    errorMessage: truncateText(input.errorMessage),
    checkedAt,
  });

  if (!probe) {
    throw new Error("保存探测结果失败");
  }

  markSksCredentialResult(
    input.credentialId,
    input.status === "ok" || input.status === "slow",
    checkedAt
  );
  cleanOldSksProbeResults();

  return probe;
}

export async function syncSksSiteModels(
  siteKey: string,
  options: { credentialId?: string | null } = {}
): Promise<SksSyncModelsResult> {
  const { site, resolvedCredential } = resolveSiteAndCredential(siteKey, options.credentialId);
  const modelsUrl = buildOpenAiUrl(resolvedCredential.record.apiBaseUrl, "models");

  const fetchResult = await timedFetch(modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${resolvedCredential.apiKey}`,
    },
  });

  let modelNames: string[] = [];
  let probe: SksProbeResultRecord;

  if (fetchResult.response?.ok) {
    modelNames = extractModelNames(fetchResult.responseJson);
    upsertSksSiteModels(site.id, modelNames);

    probe = saveProbeAndCredentialOutcome({
      siteId: site.id,
      credentialId: resolvedCredential.record.id,
      probeType: "model_list",
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
      errorMessage: modelNames.length === 0 ? "模型列表返回为空" : null,
    });
  } else {
    const httpStatus = fetchResult.response?.status ?? null;
    const errorMessage = extractErrorMessage(
      fetchResult.responseJson,
      fetchResult.errorMessage || fetchResult.response?.statusText || "模型列表请求失败"
    );

    probe = saveProbeAndCredentialOutcome({
      siteId: site.id,
      credentialId: resolvedCredential.record.id,
      probeType: "model_list",
      status: normalizeFailureStatus(httpStatus, errorMessage),
      httpStatus,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
      errorType: fetchResult.errorType,
      errorMessage,
    });
  }

  return {
    site,
    credential: getSafeSksCredentialView(resolvedCredential.record.id)!,
    probe,
    models: modelNames,
  };
}

export async function testSksModel(
  siteKey: string,
  modelName: string,
  options: { credentialId?: string | null } = {}
): Promise<SksModelTestResult> {
  const normalizedModelName = modelName.trim();
  if (!normalizedModelName) {
    throw new Error("模型名称不能为空");
  }

  const { site, resolvedCredential } = resolveSiteAndCredential(siteKey, options.credentialId);
  const existingModels = listSksSiteModels(site.id, { currentlyListedOnly: true }).map(
    (item) => item.modelName
  );
  upsertSksSiteModels(site.id, [...existingModels, normalizedModelName]);

  const chatUrl = buildOpenAiUrl(resolvedCredential.record.apiBaseUrl, "chat/completions");
  const fetchResult = await timedFetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedCredential.apiKey}`,
    },
    body: JSON.stringify({
      model: normalizedModelName,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
      stream: false,
    }),
  });

  let probe: SksProbeResultRecord;

  if (fetchResult.response?.ok) {
    probe = saveProbeAndCredentialOutcome({
      siteId: site.id,
      credentialId: resolvedCredential.record.id,
      probeType: "model_inference",
      modelName: normalizedModelName,
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
    });
  } else {
    const httpStatus = fetchResult.response?.status ?? null;
    const errorMessage = extractErrorMessage(
      fetchResult.responseJson,
      fetchResult.errorMessage || fetchResult.response?.statusText || "模型测试失败"
    );

    probe = saveProbeAndCredentialOutcome({
      siteId: site.id,
      credentialId: resolvedCredential.record.id,
      probeType: "model_inference",
      modelName: normalizedModelName,
      status: normalizeFailureStatus(httpStatus, errorMessage, normalizedModelName),
      httpStatus,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
      errorType: fetchResult.errorType,
      errorMessage,
    });
  }

  return {
    site,
    credential: getSafeSksCredentialView(resolvedCredential.record.id)!,
    probe,
  };
}

export async function runSksFullProbe(
  siteKey: string,
  options: {
    credentialId?: string | null;
    modelLimit?: number;
    forceModels?: string[];
  } = {}
): Promise<SksFullProbeResult> {
  const syncResult = await syncSksSiteModels(siteKey, {
    credentialId: options.credentialId,
  });

  const fallbackModels = listSksSiteModels(syncResult.site.id, {
    currentlyListedOnly: true,
  }).map((item) => item.modelName);

  const candidateModels = dedupeStrings(
    options.forceModels?.length
      ? options.forceModels
      : syncResult.models.length > 0
        ? syncResult.models
        : fallbackModels
  );

  const modelLimit = Math.max(1, Math.floor(options.modelLimit ?? 3));
  const modelsToTest = chooseHotModels(candidateModels, modelLimit);
  const testedModels: SksProbeResultRecord[] = [];

  for (const modelName of modelsToTest) {
    const result = await testSksModel(siteKey, modelName, {
      credentialId: options.credentialId,
    });
    testedModels.push(result.probe);
  }

  return {
    site: syncResult.site,
    credential: syncResult.credential,
    modelListProbe: syncResult.probe,
    syncedModels: syncResult.models,
    testedModels,
  };
}
