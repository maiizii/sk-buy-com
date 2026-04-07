import { SocksProxyAgent } from "socks-proxy-agent";
import { getAppSetting, setAppSetting } from "@/lib/db";

const DETECTION_PROXY_LEGACY_KEY = "detection.proxy.url";
const DETECTION_PROXY_LIST_KEY = "proxy.pool.detection";
const DEFAULT_DETECTION_PROXY_RAW = "socks5://rKHJBadWPn:qgSWncTfNL@142.171.148.74:37501";

export interface ProxyEntry {
  raw: string;
  normalizedUrl: string;
  maskedUrl: string;
}

export interface DetectionProxyConfig {
  enabled: boolean;
  entries: ProxyEntry[];
  selected: ProxyEntry | null;
}

function toNonEmptyString(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function encodeCredentialPart(value: string) {
  return encodeURIComponent(value).replace(/%3A/gi, ":");
}

export function normalizeProxyUrl(rawValue: string): string {
  const raw = toNonEmptyString(rawValue);
  if (!raw) return "";

  try {
    const direct = new URL(raw);
    return direct.toString();
  } catch {
    const match = raw.match(/^([a-z][a-z0-9+.-]*):\/\/([^:\/]+):(\d+):([^:]+):(.+)$/i);
    if (!match) {
      throw new Error("代理地址格式无效");
    }

    const [, protocol, host, port, username, password] = match;
    return `${protocol}://${encodeCredentialPart(username)}:${encodeCredentialPart(password)}@${host}:${port}`;
  }
}

function maskProxyUrl(proxyUrl: string) {
  if (!proxyUrl) return "";

  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return proxyUrl.replace(/:\/\/([^:@/]+):([^@/]+)@/, "://***:***@");
  }
}

function splitProxyLines(rawValue: string | null | undefined) {
  return String(rawValue || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function buildProxyEntries(lines: string[]): ProxyEntry[] {
  return dedupeStrings(lines).map((raw) => {
    const normalizedUrl = normalizeProxyUrl(raw);
    return {
      raw,
      normalizedUrl,
      maskedUrl: maskProxyUrl(normalizedUrl),
    };
  });
}

function chooseRandomEntry(entries: ProxyEntry[]) {
  if (entries.length === 0) return null;
  const index = Math.floor(Math.random() * entries.length);
  return entries[index] || null;
}

export function ensureDefaultDetectionProxySetting() {
  const poolRaw = toNonEmptyString(getAppSetting(DETECTION_PROXY_LIST_KEY));
  const legacyRaw = toNonEmptyString(getAppSetting(DETECTION_PROXY_LEGACY_KEY));

  if (poolRaw) {
    const normalizedPool = dedupeStrings(splitProxyLines(poolRaw))
      .map((line) => normalizeProxyUrl(line))
      .join("\n");
    if (normalizedPool !== poolRaw) {
      setAppSetting(DETECTION_PROXY_LIST_KEY, normalizedPool);
    }
    return;
  }

  if (legacyRaw) {
    const normalizedLegacy = dedupeStrings(splitProxyLines(legacyRaw))
      .map((line) => normalizeProxyUrl(line))
      .join("\n");
    setAppSetting(DETECTION_PROXY_LIST_KEY, normalizedLegacy);
    return;
  }

  setAppSetting(DETECTION_PROXY_LIST_KEY, DEFAULT_DETECTION_PROXY_RAW);
}

export function getDetectionProxyConfig(): DetectionProxyConfig {
  ensureDefaultDetectionProxySetting();
  const raw = toNonEmptyString(getAppSetting(DETECTION_PROXY_LIST_KEY));
  const entries = buildProxyEntries(splitProxyLines(raw));

  return {
    enabled: entries.length > 0,
    entries,
    selected: chooseRandomEntry(entries),
  };
}

export function getDetectionProxyAgent() {
  const config = getDetectionProxyConfig();
  if (!config.enabled || !config.selected?.normalizedUrl) {
    return null;
  }

  return new SocksProxyAgent(config.selected.normalizedUrl);
}

export function getSelectedDetectionProxyMaskedUrl() {
  const config = getDetectionProxyConfig();
  return config.selected?.maskedUrl || null;
}

export function setDetectionProxy(rawProxyUrl: string | null | undefined) {
  const lines = splitProxyLines(rawProxyUrl);
  if (lines.length === 0) {
    setAppSetting(DETECTION_PROXY_LIST_KEY, "");
    return getDetectionProxyConfig();
  }

  const normalizedLines = dedupeStrings(lines).map((line) => normalizeProxyUrl(line));
  setAppSetting(DETECTION_PROXY_LIST_KEY, normalizedLines.join("\n"));
  return getDetectionProxyConfig();
}

export function getDetectionProxySettingKey() {
  return DETECTION_PROXY_LIST_KEY;
}
