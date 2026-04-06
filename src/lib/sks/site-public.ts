import { normalizeApiBaseUrl, normalizeHostname } from "@/lib/sks/utils";

const SITE_PUBLIC_TIMEOUT_MS = 12_000;

export type DetectedSiteSystem = "newapi" | "sub2api" | "unknown";

export interface SksDetectedSitePublicMeta {
  displayName: string | null;
  displayNameSource: "system_name" | "site_name" | null;
  siteSystem: DetectedSiteSystem;
}

interface JsonFetchResult {
  status: number | null;
  json: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function safeParseJson(value: string) {
  if (!value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function buildPublicUrl(baseUrl: string, pathname: string) {
  return new URL(pathname, `${baseUrl.replace(/\/+$/, "")}/`).toString();
}

async function fetchJson(url: string): Promise<JsonFetchResult> {
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
      status: response.status,
      json: safeParseJson(await response.text()),
    };
  } catch {
    return {
      status: null,
      json: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeNewApiStatus(payload: unknown) {
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

function looksLikeSub2ApiPublicSettings(payload: unknown) {
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

function extractNewApiSystemName(payload: unknown) {
  if (!looksLikeNewApiStatus(payload)) return null;
  const record = payload as { data: Record<string, unknown> };
  return toNonEmptyString(record.data.system_name);
}

function extractSub2ApiSiteName(payload: unknown) {
  if (!looksLikeSub2ApiPublicSettings(payload)) return null;
  const record = payload as { data: Record<string, unknown> };
  return toNonEmptyString(record.data.site_name);
}

export async function detectSksSitePublicMeta(apiBaseUrl: string): Promise<SksDetectedSitePublicMeta> {
  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  if (!normalizedBaseUrl) {
    return {
      displayName: null,
      displayNameSource: null,
      siteSystem: "unknown",
    };
  }

  const [statusResult, settingsResult] = await Promise.all([
    fetchJson(buildPublicUrl(normalizedBaseUrl, "/api/status")),
    fetchJson(buildPublicUrl(normalizedBaseUrl, "/api/v1/settings/public")),
  ]);

  const systemName = extractNewApiSystemName(statusResult.json);
  if (systemName) {
    return {
      displayName: systemName,
      displayNameSource: "system_name",
      siteSystem: "newapi",
    };
  }

  const siteName = extractSub2ApiSiteName(settingsResult.json);
  if (siteName) {
    return {
      displayName: siteName,
      displayNameSource: "site_name",
      siteSystem: "sub2api",
    };
  }

  return {
    displayName: null,
    displayNameSource: null,
    siteSystem: looksLikeNewApiStatus(statusResult.json)
      ? "newapi"
      : looksLikeSub2ApiPublicSettings(settingsResult.json)
        ? "sub2api"
        : "unknown",
  };
}

export function isHostnameLikeDisplayName(displayName: string | null | undefined, apiBaseUrl: string) {
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

export function resolveImportedSiteDisplayName(input: {
  displayName?: string | null;
  detectedDisplayName?: string | null;
  apiBaseUrl: string;
}) {
  const manualDisplayName = toNonEmptyString(input.displayName);
  if (manualDisplayName && !isHostnameLikeDisplayName(manualDisplayName, input.apiBaseUrl)) {
    return manualDisplayName;
  }

  return (
    toNonEmptyString(input.detectedDisplayName) ||
    manualDisplayName ||
    normalizeHostname(input.apiBaseUrl) ||
    normalizeApiBaseUrl(input.apiBaseUrl) ||
    String(input.apiBaseUrl || "").trim()
  );
}
