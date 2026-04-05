const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SKS_DB_PATH = path.join(process.cwd(), "data", "sks.db");
const SKS_KEY_PATH = path.join(process.cwd(), "data", "sks.key");
const SLOW_THRESHOLD_MS = 1500;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ERROR_MESSAGE_LENGTH = 300;

function ensureAbsoluteUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeApiBaseUrl(value) {
  const absolute = ensureAbsoluteUrl(value);
  if (!absolute) return "";

  try {
    const url = new URL(absolute);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    let pathname = url.pathname.replace(/\/(chat\/completions|responses|models)\/?$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return absolute.replace(/\/(chat\/completions|responses|models)\/?$/i, "").replace(/\/+$/, "");
  }
}

function buildOpenAiUrl(baseUrl, resourcePath) {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBase) return "";

  const cleanResourcePath = String(resourcePath || "").replace(/^\/+/, "");
  const url = new URL(normalizedBase);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (!pathname || pathname === "/") {
    url.pathname = `/v1/${cleanResourcePath}`;
  } else if (/\/v\d+$/i.test(pathname)) {
    url.pathname = `${pathname}/${cleanResourcePath}`;
  } else {
    url.pathname = `${pathname}/v1/${cleanResourcePath}`;
  }

  return url.toString();
}

function normalizeHostname(value) {
  const normalized = ensureAbsoluteUrl(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "");
  }
}

function toDbTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function truncateText(value, limit = MAX_ERROR_MESSAGE_LENGTH) {
  if (!value) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function safeParseJson(value) {
  if (!String(value || "").trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractErrorMessage(payload, fallback) {
  if (payload && typeof payload === "object") {
    const record = payload;
    const direct = typeof record.message === "string" ? record.message : null;
    if (direct) return truncateText(direct) || fallback;

    if (record.error && typeof record.error === "object") {
      const nested = record.error;
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

function normalizeFailureStatus(httpStatus, errorMessage, modelName) {
  if (httpStatus === 401 || httpStatus === 403) return "auth_error";
  if (httpStatus === 408) return "timeout";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus !== null && httpStatus >= 500) return "network_error";
  if (httpStatus !== null && httpStatus >= 400) {
    return modelName ? "model_error" : "unknown";
  }

  const normalized = String(errorMessage || "").toLowerCase();
  if (normalized.includes("timeout") || normalized.includes("abort")) return "timeout";
  if (normalized.includes("unauthorized") || normalized.includes("forbidden") || normalized.includes("invalid api key")) {
    return "auth_error";
  }
  if (normalized.includes("rate") && normalized.includes("limit")) return "rate_limited";
  if (normalized.includes("model")) return modelName ? "model_error" : "unknown";
  if (normalized) return "network_error";
  return "unknown";
}

function getInternalStatusFromTiming(totalMs) {
  if (typeof totalMs !== "number" || Number.isNaN(totalMs)) return "unknown";
  return totalMs > SLOW_THRESHOLD_MS ? "slow" : "ok";
}

function dedupeStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const trimmed = String(value || "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function inferProviderFamily(modelName) {
  const normalized = String(modelName || "").toLowerCase();
  if (normalized.includes("gpt") || normalized.includes("o1") || normalized.includes("o3") || normalized.includes("o4")) return "openai";
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("glm")) return "glm";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("command")) return "cohere";
  return null;
}

function getModelPriority(modelName) {
  const normalized = String(modelName || "").toLowerCase();

  if (/(embedding|bge|rerank|whisper|tts|speech|image|sdxl|stable-diffusion|midjourney|mj)/i.test(normalized)) {
    return 50;
  }
  if (/gpt-4\.1|gpt-4o|claude-3\.7|claude-3\.5|gemini-2\.5|gemini-2\.0|deepseek-r1|deepseek-v3/i.test(normalized)) {
    return 0;
  }
  if (/gpt|claude|gemini|deepseek|qwen|glm|llama|o1|o3|o4/i.test(normalized)) {
    return 10;
  }
  return 20;
}

function chooseHotModels(modelNames, limit = 6) {
  return dedupeStrings(modelNames)
    .map((modelName, index) => ({ modelName, index, priority: getModelPriority(modelName) }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map((item) => item.modelName);
}

function extractModelNames(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return dedupeStrings(
      payload.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof item.id === "string") return item.id;
        return "";
      })
    );
  }

  if (typeof payload === "object") {
    const record = payload;
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
          if (typeof item.id === "string") return item.id;
          if (typeof item.model === "string") return item.model;
          if (typeof item.name === "string") return item.name;
        }
        return "";
      })
    );
  }

  return [];
}

function getEncryptionKey() {
  const envKey = String(process.env.SKS_ENCRYPTION_KEY || "").trim();
  if (envKey) {
    return crypto.createHash("sha256").update(envKey).digest();
  }

  fs.mkdirSync(path.dirname(SKS_KEY_PATH), { recursive: true });
  if (!fs.existsSync(SKS_KEY_PATH)) {
    fs.writeFileSync(SKS_KEY_PATH, crypto.randomBytes(32).toString("base64"), "utf8");
  }

  const persisted = fs.readFileSync(SKS_KEY_PATH, "utf8").trim();
  if (!persisted) {
    const fallback = crypto.randomBytes(32).toString("base64");
    fs.writeFileSync(SKS_KEY_PATH, fallback, "utf8");
    return Buffer.from(fallback, "base64");
  }

  return Buffer.from(persisted, "base64");
}

function encryptApiKey(apiKey) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(apiKey || "").trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  })).toString("base64");
}

function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(String(apiKey || "").trim()).digest("hex");
}

function getApiKeyPreview(apiKey) {
  const trimmed = String(apiKey || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

async function timedFetch(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
    const isTimeout = error instanceof Error && (error.name === "AbortError" || message.toLowerCase().includes("abort"));
    return {
      response: null,
      ttfbMs: null,
      totalMs,
      responseText: "",
      responseJson: null,
      errorMessage: truncateText(isTimeout ? `请求超时（${REQUEST_TIMEOUT_MS / 1000}s）` : message),
      errorType: isTimeout ? "timeout" : "network_error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getSitesInput() {
  const raw = String(process.env.SKS_IMPORT_SITES_JSON || "").trim();
  if (!raw) {
    throw new Error("缺少环境变量 SKS_IMPORT_SITES_JSON");
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("SKS_IMPORT_SITES_JSON 必须是非空数组");
  }

  return parsed.map((item, index) => {
    const apiBaseUrl = normalizeApiBaseUrl(item.apiBaseUrl || item.url || item.homepageUrl);
    const apiKey = String(item.apiKey || "").trim();
    if (!apiBaseUrl || !apiKey) {
      throw new Error(`第 ${index + 1} 个站点缺少 apiBaseUrl 或 apiKey`);
    }

    return {
      displayName: String(item.displayName || normalizeHostname(apiBaseUrl) || `site-${index + 1}`).trim(),
      homepageUrl: normalizeApiBaseUrl(item.homepageUrl || apiBaseUrl),
      apiBaseUrl,
      apiKey,
      statusVisibility: item.statusVisibility || "public",
      ownershipStatus: item.ownershipStatus || "observed",
      sourceType: item.sourceType || "system",
      label: item.label || "real-debug-key",
      priorityScore: Number.isFinite(Number(item.priorityScore)) ? Number(item.priorityScore) : 100,
      modelLimit: Math.max(1, Math.floor(Number(item.modelLimit || 3))),
      forceModels: Array.isArray(item.forceModels) ? dedupeStrings(item.forceModels) : [],
    };
  });
}

function openDb() {
  fs.mkdirSync(path.dirname(SKS_DB_PATH), { recursive: true });
  const db = new Database(SKS_DB_PATH);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

function upsertSite(db, input) {
  const hostname = normalizeHostname(input.apiBaseUrl);
  const now = toDbTimestamp();
  const existing = db.prepare("SELECT id FROM sks_sites WHERE normalizedHostname = ?").get(hostname);

  if (existing) {
    db.prepare(`UPDATE sks_sites SET
      hostname = ?,
      normalizedHostname = ?,
      displayName = ?,
      homepageUrl = ?,
      apiBaseUrl = ?,
      platformType = ?,
      ownerUserId = NULL,
      ownershipStatus = ?,
      statusVisibility = ?,
      createdByUserId = NULL,
      updatedAt = ?
      WHERE id = ?`).run(
      hostname,
      hostname,
      input.displayName,
      input.homepageUrl || null,
      input.apiBaseUrl,
      "openai-compatible",
      input.ownershipStatus,
      input.statusVisibility,
      now,
      existing.id
    );
    return existing.id;
  }

  db.prepare(`INSERT INTO sks_sites (
    id, hostname, normalizedHostname, displayName, homepageUrl, apiBaseUrl,
    platformType, ownerUserId, ownershipStatus, statusVisibility, createdByUserId, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?)`)
    .run(
      hostname,
      hostname,
      hostname,
      input.displayName,
      input.homepageUrl || null,
      input.apiBaseUrl,
      "openai-compatible",
      input.ownershipStatus,
      input.statusVisibility,
      now,
      now
    );

  return hostname;
}

function upsertCredential(db, siteId, input) {
  const apiKeyHash = hashApiKey(input.apiKey);
  const now = toDbTimestamp();
  const existing = db.prepare("SELECT id, sourceType, submittedByUserId, label, priorityScore FROM sks_credentials WHERE siteId = ? AND apiKeyHash = ?").get(siteId, apiKeyHash);

  if (existing) {
    db.prepare(`UPDATE sks_credentials SET
      sourceType = ?,
      submittedByUserId = NULL,
      apiKeyEncrypted = ?,
      apiKeyPreview = ?,
      apiBaseUrl = ?,
      label = ?,
      isEnabled = 1,
      priorityScore = ?,
      updatedAt = ?
      WHERE id = ?`).run(
      input.sourceType || existing.sourceType || "system",
      encryptApiKey(input.apiKey),
      getApiKeyPreview(input.apiKey),
      input.apiBaseUrl,
      input.label || existing.label || null,
      input.priorityScore,
      now,
      existing.id
    );
    return existing.id;
  }

  const credentialId = crypto.randomUUID();
  db.prepare(`INSERT INTO sks_credentials (
    id, siteId, sourceType, submittedByUserId, apiKeyEncrypted, apiKeyHash, apiKeyPreview,
    apiBaseUrl, label, isEnabled, priorityScore, stabilityScore, successCount, failureCount, createdAt, updatedAt
  ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, 0, 0, 0, ?, ?)`)
    .run(
      credentialId,
      siteId,
      input.sourceType || "system",
      encryptApiKey(input.apiKey),
      apiKeyHash,
      getApiKeyPreview(input.apiKey),
      input.apiBaseUrl,
      input.label || null,
      input.priorityScore,
      now,
      now
    );
  return credentialId;
}

function getCredentialStats(db, credentialId) {
  return db.prepare("SELECT successCount, failureCount, lastSuccessAt, lastFailureAt FROM sks_credentials WHERE id = ?").get(credentialId);
}

function markCredentialResult(db, credentialId, success, checkedAt) {
  const current = getCredentialStats(db, credentialId);
  if (!current) return;

  const successCount = Number(current.successCount || 0) + (success ? 1 : 0);
  const failureCount = Number(current.failureCount || 0) + (success ? 0 : 1);
  const total = successCount + failureCount;
  const stabilityScore = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

  db.prepare(`UPDATE sks_credentials SET
    firstVerifiedAt = COALESCE(firstVerifiedAt, ?),
    lastVerifiedAt = ?,
    lastSuccessAt = ?,
    lastFailureAt = ?,
    successCount = ?,
    failureCount = ?,
    stabilityScore = ?,
    updatedAt = ?
    WHERE id = ?`).run(
      checkedAt,
      checkedAt,
      success ? checkedAt : current.lastSuccessAt,
      success ? current.lastFailureAt : checkedAt,
      successCount,
      failureCount,
      stabilityScore,
      checkedAt,
      credentialId
    );
}

function saveProbeResult(db, input) {
  const checkedAt = input.checkedAt || toDbTimestamp();
  const result = db.prepare(`INSERT INTO sks_probe_results (
    siteId, credentialId, probeType, modelName, status, httpStatus,
    ttfbMs, totalMs, responseChars, errorType, errorMessage, checkedAt, createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      input.siteId,
      input.credentialId || null,
      input.probeType,
      input.modelName || null,
      input.status,
      input.httpStatus ?? null,
      input.ttfbMs ?? null,
      input.totalMs ?? null,
      input.responseChars ?? null,
      input.errorType ?? null,
      input.errorMessage ?? null,
      checkedAt,
      checkedAt
    );

  return db.prepare("SELECT * FROM sks_probe_results WHERE id = ?").get(result.lastInsertRowid);
}

function upsertSiteModels(db, siteId, modelNames) {
  const normalized = dedupeStrings(modelNames);
  const hotSet = new Set(chooseHotModels(normalized));
  const now = toDbTimestamp();

  const tx = db.transaction(() => {
    db.prepare("UPDATE sks_site_models SET isCurrentlyListed = 0, isHot = 0, updatedAt = ? WHERE siteId = ?").run(now, siteId);
    for (const modelName of normalized) {
      db.prepare(`INSERT INTO sks_site_models (
        id, siteId, modelName, providerFamily, firstSeenAt, lastSeenAt,
        isCurrentlyListed, isTestTarget, isHot, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
      ON CONFLICT(siteId, modelName) DO UPDATE SET
        providerFamily = excluded.providerFamily,
        lastSeenAt = excluded.lastSeenAt,
        isCurrentlyListed = 1,
        isHot = excluded.isHot,
        updatedAt = excluded.updatedAt`).run(
        crypto.randomUUID(),
        siteId,
        modelName,
        inferProviderFamily(modelName),
        now,
        now,
        hotSet.has(modelName) ? 1 : 0,
        now,
        now
      );
    }
  });

  tx();
}

function listCurrentModels(db, siteId) {
  return db.prepare("SELECT modelName FROM sks_site_models WHERE siteId = ? AND isCurrentlyListed = 1 ORDER BY isHot DESC, modelName COLLATE NOCASE ASC").all(siteId).map((row) => row.modelName);
}

function recordCredentialOutcome(db, payload) {
  const checkedAt = toDbTimestamp();
  const probe = saveProbeResult(db, {
    ...payload,
    checkedAt,
    errorMessage: truncateText(payload.errorMessage),
  });
  markCredentialResult(db, payload.credentialId, payload.status === "ok" || payload.status === "slow", checkedAt);
  return probe;
}

async function syncModelsForSite(db, site, credentialId, apiKey) {
  const modelsUrl = buildOpenAiUrl(site.apiBaseUrl, "models");
  const fetchResult = await timedFetch(modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (fetchResult.response && fetchResult.response.ok) {
    const modelNames = extractModelNames(fetchResult.responseJson);
    upsertSiteModels(db, site.id, modelNames);
    const probe = recordCredentialOutcome(db, {
      siteId: site.id,
      credentialId,
      probeType: "model_list",
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
      errorMessage: modelNames.length === 0 ? "模型列表返回为空" : null,
    });
    return { probe, models: modelNames };
  }

  const httpStatus = fetchResult.response ? fetchResult.response.status : null;
  const errorMessage = extractErrorMessage(
    fetchResult.responseJson,
    fetchResult.errorMessage || (fetchResult.response && fetchResult.response.statusText) || "模型列表请求失败"
  );
  const probe = recordCredentialOutcome(db, {
    siteId: site.id,
    credentialId,
    probeType: "model_list",
    status: normalizeFailureStatus(httpStatus, errorMessage),
    httpStatus,
    ttfbMs: fetchResult.ttfbMs,
    totalMs: fetchResult.totalMs,
    responseChars: fetchResult.responseText.length,
    errorType: fetchResult.errorType,
    errorMessage,
  });
  return { probe, models: [] };
}

async function testModelForSite(db, site, credentialId, apiKey, modelName) {
  const chatUrl = buildOpenAiUrl(site.apiBaseUrl, "chat/completions");
  const fetchResult = await timedFetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
      stream: false,
    }),
  });

  if (fetchResult.response && fetchResult.response.ok) {
    return recordCredentialOutcome(db, {
      siteId: site.id,
      credentialId,
      probeType: "model_inference",
      modelName,
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
    });
  }

  const httpStatus = fetchResult.response ? fetchResult.response.status : null;
  const errorMessage = extractErrorMessage(
    fetchResult.responseJson,
    fetchResult.errorMessage || (fetchResult.response && fetchResult.response.statusText) || "模型测试失败"
  );
  return recordCredentialOutcome(db, {
    siteId: site.id,
    credentialId,
    probeType: "model_inference",
    modelName,
    status: normalizeFailureStatus(httpStatus, errorMessage, modelName),
    httpStatus,
    ttfbMs: fetchResult.ttfbMs,
    totalMs: fetchResult.totalMs,
    responseChars: fetchResult.responseText.length,
    errorType: fetchResult.errorType,
    errorMessage,
  });
}

async function importSite(db, input) {
  const siteId = upsertSite(db, input);
  const credentialId = upsertCredential(db, siteId, input);
  const site = db.prepare("SELECT id, hostname, normalizedHostname, displayName, homepageUrl, apiBaseUrl, statusVisibility FROM sks_sites WHERE id = ?").get(siteId);

  const modelSync = await syncModelsForSite(db, site, credentialId, input.apiKey);
  const fallbackModels = listCurrentModels(db, siteId);
  const modelsToTest = chooseHotModels(
    input.forceModels.length > 0 ? input.forceModels : (modelSync.models.length > 0 ? modelSync.models : fallbackModels),
    input.modelLimit
  );

  const testedModels = [];
  for (const modelName of modelsToTest) {
    const probe = await testModelForSite(db, site, credentialId, input.apiKey, modelName);
    testedModels.push({
      modelName,
      status: probe.status,
      httpStatus: probe.httpStatus,
      totalMs: probe.totalMs,
      errorMessage: probe.errorMessage,
    });
  }

  return {
    site: {
      id: site.id,
      hostname: site.hostname,
      displayName: site.displayName,
      apiBaseUrl: site.apiBaseUrl,
      statusVisibility: site.statusVisibility,
    },
    credentialId,
    modelList: {
      status: modelSync.probe.status,
      httpStatus: modelSync.probe.httpStatus,
      totalMs: modelSync.probe.totalMs,
      modelCount: modelSync.models.length,
      topModels: modelSync.models.slice(0, 12),
      errorMessage: modelSync.probe.errorMessage,
    },
    testedModels,
  };
}

(async () => {
  const db = openDb();
  try {
    const sites = getSitesInput();
    const results = [];
    for (const site of sites) {
      results.push(await importSite(db, site));
    }
    console.log(JSON.stringify({ success: true, imported: results }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
