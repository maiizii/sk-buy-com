import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { getAppSetting, setAppSetting } from "@/lib/db";
import { buildOpenAiUrl, normalizeApiBaseUrl } from "@/lib/sks/utils";

const PROXY_POOLS_SETTING_KEY = "proxy.pools.v1";
const SKS_PROXY_ENABLED_SETTING_KEY = "proxy.sks.enabled";
const DEFAULT_TIMEOUT_MS = 15_000;

export type ProxyPoolType = "static" | "residential";
export type ProxyProtocol = "http" | "https" | "socks5";

export interface ProxyPoolEntry {
  id: string;
  poolType: ProxyPoolType;
  name: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  priority: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProxyPoolsState {
  version: 1;
  entries: ProxyPoolEntry[];
}

export interface ProxyPoolEntrySafeView extends Omit<ProxyPoolEntry, "username" | "password"> {
  hasUsername: boolean;
  hasPassword: boolean;
  maskedUrl: string;
}

export interface ProxyHttpResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  text: string;
  finalUrl: string;
}

export interface ProxyConnectivityTestInput {
  entryId?: string;
  poolType?: ProxyPoolType;
  targetUrl?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface ProxyConnectivityTestResult {
  proxy: ProxyPoolEntrySafeView;
  targetUrl: string | null;
  ipEcho: {
    ok: boolean;
    status: number | null;
    bodyPreview: string | null;
  };
  models: {
    ok: boolean;
    status: number | null;
    modelCount: number | null;
    bodyPreview: string | null;
  } | null;
  inference: {
    ok: boolean;
    status: number | null;
    bodyPreview: string | null;
  } | null;
}

export interface SksProxyConfig {
  enabled: boolean;
  selected: ProxyPoolEntrySafeView | null;
}

function toDbTimestamp(date: Date = new Date()) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toNonEmptyString(value: unknown) {
  return String(value ?? "").trim();
}

function sanitizeHost(value: unknown) {
  return toNonEmptyString(value).replace(/^https?:\/\//i, "").replace(/^socks5:\/\//i, "").replace(/\/.*$/, "");
}

function sanitizePort(value: unknown) {
  const port = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("代理端口无效");
  }
  return port;
}

function sanitizeProtocol(value: unknown): ProxyProtocol {
  const protocol = toNonEmptyString(value).toLowerCase();
  if (protocol === "http" || protocol === "https" || protocol === "socks5") {
    return protocol;
  }
  throw new Error("代理协议仅支持 http / https / socks5");
}

function sanitizePoolType(value: unknown): ProxyPoolType {
  const poolType = toNonEmptyString(value).toLowerCase();
  if (poolType === "static" || poolType === "residential") {
    return poolType;
  }
  throw new Error("代理池类型仅支持 static / residential");
}

function encodeCredentialPart(value: string) {
  return encodeURIComponent(value).replace(/%3A/gi, ":");
}

export function buildProxyUrl(entry: Pick<ProxyPoolEntry, "protocol" | "host" | "port" | "username" | "password">) {
  const auth = entry.username
    ? `${encodeCredentialPart(entry.username)}:${encodeCredentialPart(entry.password)}@`
    : "";
  return `${entry.protocol}://${auth}${entry.host}:${entry.port}`;
}

function buildAgentProxyUrl(entry: Pick<ProxyPoolEntry, "protocol" | "host" | "port" | "username" | "password">) {
  const proxyUrl = buildProxyUrl(entry);
  if (entry.protocol !== "socks5") {
    return proxyUrl;
  }
  return proxyUrl.replace(/^socks5:\/\//i, "socks5h://");
}

export function maskProxyUrl(proxyUrl: string) {
  try {
    const parsed = new URL(proxyUrl);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return proxyUrl.replace(/:\/\/([^:@/]+):([^@/]+)@/, "://***:***@");
  }
}

function toSafeView(entry: ProxyPoolEntry): ProxyPoolEntrySafeView {
  return {
    id: entry.id,
    poolType: entry.poolType,
    name: entry.name,
    protocol: entry.protocol,
    host: entry.host,
    port: entry.port,
    enabled: entry.enabled,
    priority: entry.priority,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    hasUsername: Boolean(entry.username),
    hasPassword: Boolean(entry.password),
    maskedUrl: maskProxyUrl(buildProxyUrl(entry)),
  };
}

function normalizeState(raw: unknown): ProxyPoolsState {
  if (!raw || typeof raw !== "object") {
    return { version: 1, entries: [] };
  }

  const record = raw as { version?: unknown; entries?: unknown };
  const entries = Array.isArray(record.entries) ? record.entries : [];

  return {
    version: 1,
    entries: entries
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const value = item as Record<string, unknown>;
        try {
          return normalizeEntry(value);
        } catch {
          return null;
        }
      })
      .filter((item): item is ProxyPoolEntry => Boolean(item)),
  };
}

function normalizeEntry(input: Record<string, unknown>): ProxyPoolEntry {
  const now = toDbTimestamp();
  return {
    id: toNonEmptyString(input.id) || crypto.randomUUID(),
    poolType: sanitizePoolType(input.poolType),
    name: toNonEmptyString(input.name) || sanitizeHost(input.host),
    protocol: sanitizeProtocol(input.protocol),
    host: sanitizeHost(input.host),
    port: sanitizePort(input.port),
    username: toNonEmptyString(input.username),
    password: String(input.password ?? ""),
    enabled: input.enabled !== false,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 100,
    notes: toNonEmptyString(input.notes),
    createdAt: toNonEmptyString(input.createdAt) || now,
    updatedAt: toNonEmptyString(input.updatedAt) || now,
  };
}

function saveState(state: ProxyPoolsState) {
  setAppSetting(PROXY_POOLS_SETTING_KEY, JSON.stringify(state));
  return state;
}

export function getProxyPoolsState(): ProxyPoolsState {
  const raw = getAppSetting(PROXY_POOLS_SETTING_KEY);
  if (!raw) {
    return { version: 1, entries: [] };
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return { version: 1, entries: [] };
  }
}

export function listProxyPoolEntries(poolType?: ProxyPoolType) {
  const entries = getProxyPoolsState().entries
    .filter((entry) => !poolType || entry.poolType === poolType)
    .sort((a, b) => {
      if (a.poolType !== b.poolType) return a.poolType.localeCompare(b.poolType);
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });
  return entries.map(toSafeView);
}

export function getProxyPoolEntryById(entryId: string) {
  return getProxyPoolsState().entries.find((entry) => entry.id === entryId) || null;
}

export function createProxyPoolEntry(input: Record<string, unknown>) {
  const state = getProxyPoolsState();
  const entry = normalizeEntry({
    ...input,
    id: crypto.randomUUID(),
    createdAt: toDbTimestamp(),
    updatedAt: toDbTimestamp(),
  });

  if (state.entries.some((item) => item.poolType === entry.poolType && item.name === entry.name)) {
    throw new Error("同一代理池下已存在同名代理");
  }

  state.entries.push(entry);
  saveState(state);
  return toSafeView(entry);
}

export function updateProxyPoolEntry(entryId: string, input: Record<string, unknown>) {
  const state = getProxyPoolsState();
  const index = state.entries.findIndex((entry) => entry.id === entryId);
  if (index < 0) {
    return null;
  }

  const current = state.entries[index];
  const next = normalizeEntry({
    ...current,
    ...input,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: toDbTimestamp(),
  });

  if (state.entries.some((item, itemIndex) => itemIndex !== index && item.poolType === next.poolType && item.name === next.name)) {
    throw new Error("同一代理池下已存在同名代理");
  }

  state.entries[index] = next;
  saveState(state);
  return toSafeView(next);
}

export function deleteProxyPoolEntry(entryId: string) {
  const state = getProxyPoolsState();
  const nextEntries = state.entries.filter((entry) => entry.id !== entryId);
  if (nextEntries.length === state.entries.length) {
    return false;
  }
  saveState({ version: 1, entries: nextEntries });
  return true;
}

export function selectProxyPoolEntry(poolType: ProxyPoolType) {
  const candidates = getProxyPoolsState().entries
    .filter((entry) => entry.poolType === poolType && entry.enabled)
    .sort((a, b) => a.priority - b.priority);
  return candidates[0] || null;
}

export function getSksProxyEnabled() {
  return getAppSetting(SKS_PROXY_ENABLED_SETTING_KEY) === "1";
}

export function setSksProxyEnabled(enabled: boolean) {
  setAppSetting(SKS_PROXY_ENABLED_SETTING_KEY, enabled ? "1" : "0");
  return getSksProxyConfig();
}

export function getSksProxyConfig(): SksProxyConfig {
  const enabled = getSksProxyEnabled();
  const selected = enabled ? selectProxyPoolEntry("static") : null;
  return {
    enabled,
    selected: selected ? toSafeView(selected) : null,
  };
}

export function getSksProxyAgent() {
  const config = getSksProxyConfig();
  if (!config.enabled || !config.selected) {
    return null;
  }

  const selected = selectProxyPoolEntry("static");
  return selected ? createProxyAgent(selected) : null;
}

export function getSelectedSksProxyMaskedUrl() {
  const config = getSksProxyConfig();
  return config.selected?.maskedUrl || null;
}

function resolveTransport(url: URL) {
  return url.protocol === "https:" ? https : http;
}

export function createProxyAgent(entry: ProxyPoolEntry) {
  const proxyUrl = buildAgentProxyUrl(entry);
  if (entry.protocol === "socks5") {
    return new SocksProxyAgent(proxyUrl);
  }
  if (entry.protocol === "http") {
    return new HttpProxyAgent(proxyUrl);
  }
  return new HttpsProxyAgent(proxyUrl);
}

export async function requestViaProxyEntry(
  entry: ProxyPoolEntry,
  inputUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<ProxyHttpResponse> {
  const maxRedirects = Math.max(0, init.maxRedirects ?? 5);
  const proxyMaskedUrl = maskProxyUrl(buildAgentProxyUrl(entry));

  async function send(currentUrl: string, redirectCount: number, method: string, body?: string): Promise<ProxyHttpResponse> {
    const url = new URL(currentUrl);
    const transport = resolveTransport(url);
    const agent = createProxyAgent(entry);

    const response = await new Promise<ProxyHttpResponse>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method,
          headers: init.headers,
          agent,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            resolve({
              status: response.statusCode || 0,
              statusText: response.statusMessage || "",
              headers: response.headers,
              text: Buffer.concat(chunks).toString("utf8"),
              finalUrl: url.toString(),
            });
          });
        }
      );

      request.on("error", (error) => {
        const detail = [
          `url=${url.toString()}`,
          `host=${url.host}`,
          `protocol=${url.protocol}`,
          `proxy=${proxyMaskedUrl}`,
          error instanceof Error ? `message=${error.message}` : `message=${String(error)}`,
        ].join(" | ");
        reject(new Error(detail, { cause: error instanceof Error ? error : undefined }));
      });

      request.setTimeout(Math.max(1, init.timeoutMs || DEFAULT_TIMEOUT_MS), () => {
        request.destroy(new Error("代理请求超时"));
      });

      if (body) {
        request.write(body);
      }

      request.end();
    });

    const locationHeader = response.headers.location;
    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
    const shouldRedirect = [301, 302, 303, 307, 308].includes(response.status) && Boolean(location);
    if (!shouldRedirect || !location) {
      return response;
    }

    if (redirectCount >= maxRedirects) {
      return response;
    }

    const nextUrl = new URL(location, url).toString();
    const nextMethod = response.status === 307 || response.status === 308 ? method : "GET";
    const nextBody = nextMethod === method ? body : undefined;
    return send(nextUrl, redirectCount + 1, nextMethod, nextBody);
  }

  return send(inputUrl, 0, init.method || "GET", init.body);
}

function truncateText(value: string | null | undefined, limit: number = 220) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 1)}…`;
}

function parseModelsCount(text: string) {
  try {
    const payload = JSON.parse(text) as { data?: Array<unknown>; models?: Array<unknown> };
    if (Array.isArray(payload.data)) return payload.data.length;
    if (Array.isArray(payload.models)) return payload.models.length;
    return 0;
  } catch {
    return null;
  }
}

function ensureTargetUrl(input: ProxyConnectivityTestInput) {
  if (input.targetUrl) {
    return input.targetUrl;
  }
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl || "");
  if (!apiBaseUrl) {
    return null;
  }
  return buildOpenAiUrl(apiBaseUrl, "models");
}

export async function runProxyConnectivityTest(input: ProxyConnectivityTestInput): Promise<ProxyConnectivityTestResult> {
  const entry = input.entryId
    ? getProxyPoolEntryById(input.entryId)
    : input.poolType
      ? selectProxyPoolEntry(input.poolType)
      : null;

  if (!entry) {
    throw new Error("未找到可用代理");
  }

  const timeoutMs = Math.max(1000, input.timeoutMs || DEFAULT_TIMEOUT_MS);
  const targetUrl = ensureTargetUrl(input);

  const ipEchoResponse = await requestViaProxyEntry(entry, input.targetUrl || "https://api64.ipify.org?format=json", {
    timeoutMs,
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "sk-buy-proxy-test/1.0",
    },
  });

  let models: ProxyConnectivityTestResult["models"] = null;
  let inference: ProxyConnectivityTestResult["inference"] = null;

  if (targetUrl && input.apiKey) {
    const modelUrl = buildOpenAiUrl(input.apiBaseUrl || targetUrl, "models") || targetUrl;
    const modelsResponse = await requestViaProxyEntry(entry, modelUrl, {
      timeoutMs,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.apiKey}`,
        "User-Agent": "sk-buy-proxy-test/1.0",
      },
    });

    models = {
      ok: modelsResponse.status >= 200 && modelsResponse.status < 300,
      status: modelsResponse.status,
      modelCount: parseModelsCount(modelsResponse.text),
      bodyPreview: truncateText(modelsResponse.text),
    };

    if (input.model) {
      const inferenceUrl = buildOpenAiUrl(input.apiBaseUrl || targetUrl, "chat/completions");
      const inferenceResponse = await requestViaProxyEntry(entry, inferenceUrl, {
        method: "POST",
        timeoutMs,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "sk-buy-proxy-test/1.0",
        },
        body: JSON.stringify({
          model: input.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
        }),
      });

      inference = {
        ok: inferenceResponse.status >= 200 && inferenceResponse.status < 300,
        status: inferenceResponse.status,
        bodyPreview: truncateText(inferenceResponse.text),
      };
    }
  }

  return {
    proxy: toSafeView(entry),
    targetUrl,
    ipEcho: {
      ok: ipEchoResponse.status >= 200 && ipEchoResponse.status < 300,
      status: ipEchoResponse.status,
      bodyPreview: truncateText(ipEchoResponse.text),
    },
    models,
    inference,
  };
}

export function getProxyPoolsSettingKey() {
  return PROXY_POOLS_SETTING_KEY;
}

export function getSksProxyEnabledSettingKey() {
  return SKS_PROXY_ENABLED_SETTING_KEY;
}
