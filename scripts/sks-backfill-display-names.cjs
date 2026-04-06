const Database = require("better-sqlite3");
const path = require("path");

const SITE_PUBLIC_TIMEOUT_MS = 12_000;
const SKS_DB_PATH = path.join(process.cwd(), "data", "sks.db");
const SITE_CATALOG_DB_PATH = path.join(process.cwd(), "data", "site-catalog.db");
const DEFAULT_TARGETS = [
  "https://newapi.577000.xyz",
  "https://sub2api.577000.xyz",
];

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

function buildPublicUrl(baseUrl, pathname) {
  return new URL(pathname, `${String(baseUrl || "").replace(/\/+$/, "")}/`).toString();
}

function toDbTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function safeParseJson(value) {
  if (!String(value || "").trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITE_PUBLIC_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      json: safeParseJson(await response.text()),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      json: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeNewApiStatus(payload) {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    return false;
  }

  const data = payload.data;
  return (
    data.system_name !== undefined ||
    data.email_verification !== undefined ||
    data.demo_site_enabled !== undefined ||
    data.self_use_mode_enabled !== undefined
  );
}

function looksLikeSub2ApiPublicSettings(payload) {
  if (!isRecord(payload) || payload.code !== 0 || !isRecord(payload.data)) {
    return false;
  }

  const data = payload.data;
  return (
    data.site_name !== undefined ||
    data.registration_enabled !== undefined ||
    data.email_verify_enabled !== undefined
  );
}

function extractNewApiSystemName(payload) {
  if (!looksLikeNewApiStatus(payload)) return null;
  return toNonEmptyString(payload.data.system_name);
}

function extractSub2ApiSiteName(payload) {
  if (!looksLikeSub2ApiPublicSettings(payload)) return null;
  return toNonEmptyString(payload.data.site_name);
}

async function detectSitePublicMeta(apiBaseUrl) {
  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  if (!normalizedBaseUrl) {
    return {
      apiBaseUrl: normalizedBaseUrl,
      hostname: normalizeHostname(apiBaseUrl),
      displayName: null,
      displayNameSource: null,
      siteSystem: "unknown",
      requests: [],
    };
  }

  const statusUrl = buildPublicUrl(normalizedBaseUrl, "/api/status");
  const settingsUrl = buildPublicUrl(normalizedBaseUrl, "/api/v1/settings/public");
  const [statusResult, settingsResult] = await Promise.all([
    fetchJson(statusUrl),
    fetchJson(settingsUrl),
  ]);

  const systemName = extractNewApiSystemName(statusResult.json);
  if (systemName) {
    return {
      apiBaseUrl: normalizedBaseUrl,
      hostname: normalizeHostname(normalizedBaseUrl),
      displayName: systemName,
      displayNameSource: "system_name",
      siteSystem: "newapi",
      requests: [
        { url: statusUrl, status: statusResult.status, ok: statusResult.ok, error: statusResult.error || null },
        { url: settingsUrl, status: settingsResult.status, ok: settingsResult.ok, error: settingsResult.error || null },
      ],
    };
  }

  const siteName = extractSub2ApiSiteName(settingsResult.json);
  if (siteName) {
    return {
      apiBaseUrl: normalizedBaseUrl,
      hostname: normalizeHostname(normalizedBaseUrl),
      displayName: siteName,
      displayNameSource: "site_name",
      siteSystem: "sub2api",
      requests: [
        { url: statusUrl, status: statusResult.status, ok: statusResult.ok, error: statusResult.error || null },
        { url: settingsUrl, status: settingsResult.status, ok: settingsResult.ok, error: settingsResult.error || null },
      ],
    };
  }

  return {
    apiBaseUrl: normalizedBaseUrl,
    hostname: normalizeHostname(normalizedBaseUrl),
    displayName: null,
    displayNameSource: null,
    siteSystem: looksLikeNewApiStatus(statusResult.json)
      ? "newapi"
      : looksLikeSub2ApiPublicSettings(settingsResult.json)
        ? "sub2api"
        : "unknown",
    requests: [
      { url: statusUrl, status: statusResult.status, ok: statusResult.ok, error: statusResult.error || null },
      { url: settingsUrl, status: settingsResult.status, ok: settingsResult.ok, error: settingsResult.error || null },
    ],
  };
}

function isHostnameLikeDisplayName(displayName, apiBaseUrl) {
  const normalizedDisplayName = toNonEmptyString(displayName);
  if (!normalizedDisplayName) return true;

  const hostname = normalizeHostname(apiBaseUrl).toLowerCase();
  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl).toLowerCase();
  const loweredDisplayName = normalizedDisplayName.toLowerCase();

  if (loweredDisplayName === hostname || loweredDisplayName === normalizedBaseUrl) {
    return true;
  }

  const displayHostname = normalizeHostname(normalizedDisplayName).toLowerCase();
  if (displayHostname === hostname) {
    return true;
  }

  const displayUrl = normalizeApiBaseUrl(normalizedDisplayName).toLowerCase();
  return Boolean(displayUrl) && displayUrl === normalizedBaseUrl;
}

function readRow(db, table, hostname) {
  const sql = `SELECT hostname, normalizedHostname, displayName, apiBaseUrl, homepageUrl, updatedAt FROM ${table} WHERE normalizedHostname = ? OR hostname = ? LIMIT 1`;
  return db.prepare(sql).get(hostname, hostname) || null;
}

function updateRow(db, table, hostname, displayName) {
  const now = toDbTimestamp();
  const sql = `UPDATE ${table} SET displayName = ?, updatedAt = ? WHERE normalizedHostname = ? OR hostname = ?`;
  const result = db.prepare(sql).run(displayName, now, hostname, hostname);
  return {
    changes: result.changes,
    updatedAt: now,
  };
}

function processTable(dbPath, table, meta, apply) {
  const db = new Database(dbPath);
  try {
    const before = readRow(db, table, meta.hostname);
    if (!before) {
      return {
        table,
        found: false,
        before: null,
        after: null,
        changed: false,
        reason: "record_not_found",
      };
    }

    if (!meta.displayName) {
      return {
        table,
        found: true,
        before,
        after: before,
        changed: false,
        reason: "detected_display_name_missing",
      };
    }

    if (!isHostnameLikeDisplayName(before.displayName, before.apiBaseUrl || meta.apiBaseUrl)) {
      return {
        table,
        found: true,
        before,
        after: before,
        changed: false,
        reason: "current_display_name_already_real",
      };
    }

    if (!apply) {
      return {
        table,
        found: true,
        before,
        after: {
          ...before,
          displayName: meta.displayName,
        },
        changed: before.displayName !== meta.displayName,
        reason: before.displayName === meta.displayName ? "already_synced" : "dry_run",
      };
    }

    const updateResult = updateRow(db, table, meta.hostname, meta.displayName);
    const after = readRow(db, table, meta.hostname);
    return {
      table,
      found: true,
      before,
      after,
      changed: updateResult.changes > 0 && before.displayName !== (after && after.displayName),
      reason: updateResult.changes > 0 ? "updated" : "no_change",
    };
  } finally {
    db.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const targets = args.filter((item) => item !== "--apply");
  const apiBaseUrls = (targets.length > 0 ? targets : DEFAULT_TARGETS)
    .map((item) => normalizeApiBaseUrl(item))
    .filter(Boolean);

  if (apiBaseUrls.length === 0) {
    throw new Error("未提供有效站点地址");
  }

  const results = [];
  for (const apiBaseUrl of apiBaseUrls) {
    const meta = await detectSitePublicMeta(apiBaseUrl);
    const tables = [
      processTable(SKS_DB_PATH, "sks_sites", meta, apply),
      processTable(SITE_CATALOG_DB_PATH, "site_catalog_sites", meta, apply),
    ];

    results.push({
      target: apiBaseUrl,
      detected: meta,
      tables,
    });
  }

  console.log(JSON.stringify({
    success: true,
    apply,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
