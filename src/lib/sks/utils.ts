import type { SksDisplayStatus, SksInternalStatus } from "@/lib/sks/types";

export const SKS_GRID_HOURS = 24;
export const SKS_RETENTION_DAYS = 30;
export const SKS_RETENTION_HOURS = SKS_RETENTION_DAYS * 24;
export const SKS_SLOW_THRESHOLD_MS = 1500;

function isIpAddress(hostname: string) {
  const normalized = hostname.trim().replace(/^\[/, "").replace(/\]$/, "");
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(normalized) || normalized.includes(":");
}

function isSupportedSiteHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "localhost" || normalized.includes(".") || isIpAddress(normalized);
}

export function ensureAbsoluteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function normalizeApiBaseUrl(value: string) {
  const absolute = ensureAbsoluteUrl(value);
  if (!absolute) return "";

  try {
    const url = new URL(absolute);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }
    if (!isSupportedSiteHostname(url.hostname)) {
      return "";
    }

    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    let pathname = url.pathname.replace(/\/(chat\/completions|responses|models)\/?$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";

    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function buildOpenAiUrl(baseUrl: string, resourcePath: string) {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBase) return "";

  const cleanResourcePath = resourcePath.replace(/^\/+/, "");
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

export function normalizeHostname(value: string) {
  const normalized = ensureAbsoluteUrl(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "");
  }
}

export function parseDbTimestamp(value: string | null) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toDbTimestamp(date: Date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function formatHourLabel(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function toBucketKey(date: Date) {
  return date.toISOString().slice(0, 13);
}

export function floorToUtcHour(date: Date) {
  const copy = new Date(date);
  copy.setUTCMinutes(0, 0, 0);
  return copy;
}

export function floorToUtcDay(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function addUtcHours(date: Date, hours: number) {
  const copy = new Date(date);
  copy.setUTCHours(copy.getUTCHours() + hours);
  return copy;
}

export function addUtcDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function formatDayLabel(date: Date) {
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  });
}

export function toDayBucketKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function inferProviderFamily(modelName: string) {
  const normalized = modelName.toLowerCase();
  if (normalized.includes("gpt") || normalized.includes("o1") || normalized.includes("o3") || normalized.includes("o4")) {
    return "openai";
  }
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gemini")) return "google";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("glm")) return "glm";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("command")) return "cohere";
  return null;
}

export function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

function normalizeModelNameForMatching(modelName: string) {
  return modelName
    .toLowerCase()
    .replace(/[_.:/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getModelPriority(modelName: string) {
  const raw = modelName.toLowerCase();
  const normalized = normalizeModelNameForMatching(modelName);
  const padded = ` ${normalized} `;

  if (/\b(embedding|bge|rerank|whisper|tts|speech|transcription|sdxl|stable diffusion|midjourney|mj|moderation)\b/i.test(padded)) {
    return 60;
  }

  if (/\b(haiku|mini|nano|lite)\b/i.test(padded)) {
    return 25;
  }

  if (
    /\bgpt[-_. ]?5\b|\bgpt[-_. ]?4o\b|\bgpt[-_. ]?4\.1\b|\bo1\b|\bo3\b|\bo4\b/i.test(raw) ||
    (/\bcodex\b/i.test(raw) && /\bgpt\b/i.test(raw))
  ) {
    return 0;
  }

  if (/\bclaude\b/i.test(raw) && /\b(opus|sonnet)\b/i.test(padded)) {
    return 0;
  }

  if (
    /\bgemini[-_. ]?2(?:[-_. ]?5|[-_. ]?0)?\b/i.test(raw) &&
    /\b(pro|flash|exp|thinking)\b/i.test(padded)
  ) {
    return 0;
  }

  if (/\bdeepseek\b/i.test(raw) && /\b(r1|v3)\b/i.test(padded)) {
    return 0;
  }

  if (/\bqwen\b/i.test(raw) && /\b(max|coder|reasoner|qwq|3|2 5)\b/i.test(padded)) {
    return 5;
  }

  if (/\bglm\b/i.test(raw) && /\b4\b/i.test(padded)) {
    return 5;
  }

  if (/\bllama\b/i.test(raw) && /\b(4|405b|90b|70b)\b/i.test(padded)) {
    return 5;
  }

  if (/\b(gpt|claude|gemini|deepseek|qwen|glm|llama|o1|o3|o4)\b/i.test(padded)) {
    return 10;
  }

  return 20;
}

export function chooseHotModels(modelNames: string[], limit: number = 6) {
  return dedupeStrings(modelNames)
    .map((modelName, index) => ({ modelName, index, priority: getModelPriority(modelName) }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    })
    .slice(0, limit)
    .map((item) => item.modelName);
}

export function getDisplayStatusFromInternal(status: SksInternalStatus | null | undefined): SksDisplayStatus {
  if (!status) return "unknown";
  if (status === "ok") return "ok";
  if (status === "slow") return "slow";
  return "failed";
}

export function getInternalStatusFromTiming(totalMs: number | null | undefined): SksInternalStatus {
  if (typeof totalMs !== "number" || Number.isNaN(totalMs)) return "unknown";
  return totalMs > SKS_SLOW_THRESHOLD_MS ? "slow" : "ok";
}
