const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SKS_DB_PATH = path.join(process.cwd(), "data", "sks.db");
const SKS_KEY_PATH = path.join(process.cwd(), "data", "sks.key");
const SLOW_THRESHOLD_MS = 1500;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ERROR_MESSAGE_LENGTH = 300;
const RETENTION_DAYS = 7;

function printUsage() {
  console.log(`用法：
  node scripts/sks-site-action.cjs sync-models <siteKey> [credentialId]
  node scripts/sks-site-action.cjs test-model <siteKey> <modelName> [credentialId]

示例：
  node scripts/sks-site-action.cjs sync-models newapi.577000.xyz
  node scripts/sks-site-action.cjs test-model sub2api.577000.xyz claude-opus-4-6
  npm run sks:sync-models -- newapi.577000.xyz
  npm run sks:test-model -- sub2api.577000.xyz claude-opus-4-6
`);
}

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

  if (!fs.existsSync(SKS_KEY_PATH)) {
    throw new Error(`缺少加密密钥文件: ${SKS_KEY_PATH}`);
  }

  const persisted = fs.readFileSync(SKS_KEY_PATH, "utf8").trim();
  if (!persisted) {
    throw new Error(`加密密钥文件为空: ${SKS_KEY_PATH}`);
  }

  return Buffer.from(persisted, "base64");
}

function decryptApiKey(payload) {
  const key = getEncryptionKey();
  const parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function openDb() {
  if (!fs.existsSync(SKS_DB_PATH)) {
    throw new Error(`SKS 数据库不存在: ${SKS_DB_PATH}`);
  }

  const db = new Database(SKS_DB_PATH);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  return db;
}

function resolveSite(db, siteKey) {
  const raw = decodeURIComponent(String(siteKey || "").trim());
  if (!raw) {
    throw new Error("缺少 siteKey");
  }

  const normalized = normalizeHostname(raw) || raw.toLowerCase();
  const row = db
    .prepare(`SELECT * FROM sks_sites WHERE id = ? OR normalizedHostname = ? OR hostname = ?`)
    .get(raw, normalized, normalized);

  if (!row) {
    throw new Error(`未找到站点: ${siteKey}`);
  }

  return row;
}

function resolveCredential(db, siteId, credentialId) {
  if (credentialId) {
    const row = db.prepare(`SELECT * FROM sks_credentials WHERE id = ?`).get(String(credentialId));
    if (!row) {
      throw new Error(`未找到凭据: ${credentialId}`);
    }
    if (row.siteId !== siteId) {
      throw new Error("指定凭据与站点不匹配");
    }
    return row;
  }

  const row = db.prepare(`
    SELECT *
    FROM sks_credentials
    WHERE siteId = ? AND isEnabled = 1
    ORDER BY priorityScore DESC, stabilityScore DESC, datetime(lastSuccessAt) DESC, datetime(createdAt) ASC
    LIMIT 1
  `).get(siteId);

  if (!row) {
    throw new Error("站点没有可用的已启用凭据");
  }

  return row;
}

function getCredentialStats(db, credentialId) {
  return db.prepare(`SELECT successCount, failureCount, lastSuccessAt, lastFailureAt FROM sks_credentials WHERE id = ?`).get(credentialId);
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
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
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
    truncateText(input.errorMessage),
    checkedAt,
    checkedAt
  );

  return db.prepare(`SELECT * FROM sks_probe_results WHERE id = ?`).get(result.lastInsertRowid);
}

function cleanOldSksProbeResults(db, retentionDays = RETENTION_DAYS) {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  db.prepare(`DELETE FROM sks_probe_results WHERE datetime(checkedAt) < datetime('now', ?)`).run(`-${safeDays} days`);
}

function upsertSiteModels(db, siteId, modelNames) {
  const normalized = dedupeStrings(modelNames);
  const now = toDbTimestamp();

  const tx = db.transaction(() => {
    db.prepare(`UPDATE sks_site_models SET isCurrentlyListed = 0, isHot = 0, updatedAt = ? WHERE siteId = ?`).run(now, siteId);
    for (const modelName of normalized) {
      db.prepare(`INSERT INTO sks_site_models (
        id, siteId, modelName, providerFamily, firstSeenAt, lastSeenAt,
        isCurrentlyListed, isTestTarget, isHot, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?)
      ON CONFLICT(siteId, modelName) DO UPDATE SET
        providerFamily = excluded.providerFamily,
        lastSeenAt = excluded.lastSeenAt,
        isCurrentlyListed = 1,
        updatedAt = excluded.updatedAt`).run(
        crypto.randomUUID(),
        siteId,
        modelName,
        inferProviderFamily(modelName),
        now,
        now,
        now,
        now
      );
    }
  });

  tx();
}

function listCurrentModels(db, siteId) {
  return db
    .prepare(`SELECT modelName FROM sks_site_models WHERE siteId = ? AND isCurrentlyListed = 1 ORDER BY modelName COLLATE NOCASE ASC`)
    .all(siteId)
    .map((row) => row.modelName);
}

function toSafeCredentialView(credential) {
  return {
    id: credential.id,
    sourceType: credential.sourceType,
    apiKeyPreview: credential.apiKeyPreview,
    label: credential.label,
    isEnabled: Boolean(credential.isEnabled),
    priorityScore: credential.priorityScore,
    stabilityScore: credential.stabilityScore,
    successCount: credential.successCount,
    failureCount: credential.failureCount,
    lastVerifiedAt: credential.lastVerifiedAt,
    lastSuccessAt: credential.lastSuccessAt,
    lastFailureAt: credential.lastFailureAt,
  };
}

function toSafeSiteView(site) {
  return {
    id: site.id,
    hostname: site.hostname,
    normalizedHostname: site.normalizedHostname,
    displayName: site.displayName,
    homepageUrl: site.homepageUrl,
    apiBaseUrl: site.apiBaseUrl,
    statusVisibility: site.statusVisibility,
  };
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

function saveProbeAndCredentialOutcome(db, payload) {
  const checkedAt = toDbTimestamp();
  const probe = saveProbeResult(db, {
    ...payload,
    checkedAt,
  });
  markCredentialResult(db, payload.credentialId, payload.status === "ok" || payload.status === "slow", checkedAt);
  cleanOldSksProbeResults(db);
  return probe;
}

async function syncModelsForSite(db, site, credential) {
  const apiKey = decryptApiKey(credential.apiKeyEncrypted);
  const modelsUrl = buildOpenAiUrl(credential.apiBaseUrl, "models");
  const fetchResult = await timedFetch(modelsUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let modelNames = [];
  let probe;

  if (fetchResult.response && fetchResult.response.ok) {
    modelNames = extractModelNames(fetchResult.responseJson);
    upsertSiteModels(db, site.id, modelNames);
    probe = saveProbeAndCredentialOutcome(db, {
      siteId: site.id,
      credentialId: credential.id,
      probeType: "model_list",
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
      errorMessage: modelNames.length === 0 ? "模型列表返回为空" : null,
    });
  } else {
    const httpStatus = fetchResult.response ? fetchResult.response.status : null;
    const errorMessage = extractErrorMessage(
      fetchResult.responseJson,
      fetchResult.errorMessage || (fetchResult.response && fetchResult.response.statusText) || "模型列表请求失败"
    );
    probe = saveProbeAndCredentialOutcome(db, {
      siteId: site.id,
      credentialId: credential.id,
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
    success: true,
    action: "sync-models",
    site: toSafeSiteView(site),
    credential: toSafeCredentialView(credential),
    probe,
    modelCount: modelNames.length,
    models: modelNames,
  };
}

async function testModelForSite(db, site, credential, modelName) {
  const normalizedModelName = String(modelName || "").trim();
  if (!normalizedModelName) {
    throw new Error("模型名称不能为空");
  }

  const currentModels = listCurrentModels(db, site.id);
  upsertSiteModels(db, site.id, [...currentModels, normalizedModelName]);

  const apiKey = decryptApiKey(credential.apiKeyEncrypted);
  const chatUrl = buildOpenAiUrl(credential.apiBaseUrl, "chat/completions");
  const fetchResult = await timedFetch(chatUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: normalizedModelName,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
      temperature: 0,
      stream: false,
    }),
  });

  let probe;

  if (fetchResult.response && fetchResult.response.ok) {
    probe = saveProbeAndCredentialOutcome(db, {
      siteId: site.id,
      credentialId: credential.id,
      probeType: "model_inference",
      modelName: normalizedModelName,
      status: getInternalStatusFromTiming(fetchResult.totalMs),
      httpStatus: fetchResult.response.status,
      ttfbMs: fetchResult.ttfbMs,
      totalMs: fetchResult.totalMs,
      responseChars: fetchResult.responseText.length,
    });
  } else {
    const httpStatus = fetchResult.response ? fetchResult.response.status : null;
    const errorMessage = extractErrorMessage(
      fetchResult.responseJson,
      fetchResult.errorMessage || (fetchResult.response && fetchResult.response.statusText) || "模型测试失败"
    );
    probe = saveProbeAndCredentialOutcome(db, {
      siteId: site.id,
      credentialId: credential.id,
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
    success: true,
    action: "test-model",
    site: toSafeSiteView(site),
    credential: toSafeCredentialView(credential),
    modelName: normalizedModelName,
    probe,
  };
}

(async () => {
  const [action, siteKey, arg3, arg4] = process.argv.slice(2);

  if (!action || action === "-h" || action === "--help") {
    printUsage();
    process.exit(0);
  }

  const db = openDb();

  try {
    if (action === "sync-models") {
      if (!siteKey) {
        throw new Error("sync-models 需要提供 siteKey");
      }
      const site = resolveSite(db, siteKey);
      const credential = resolveCredential(db, site.id, arg3);
      const result = await syncModelsForSite(db, site, credential);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (action === "test-model") {
      if (!siteKey || !arg3) {
        throw new Error("test-model 需要提供 siteKey 与 modelName");
      }
      const site = resolveSite(db, siteKey);
      const credential = resolveCredential(db, site.id, arg4);
      const result = await testModelForSite(db, site, credential, arg3);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    throw new Error(`不支持的 action: ${action}`);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      action,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
