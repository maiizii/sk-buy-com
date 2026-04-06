import type { SiteCatalogSiteCardView } from "@/lib/site-catalog/types";
import type { SksDisplayStatus, SksGridCell } from "@/lib/sks/types";

export const DEFAULT_TAG_COLOR = "#737373";
const PRIORITY_PROVIDER_ORDER = ["anthropic", "openai", "gemini"] as const;
const SHANGHAI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface TrackerBlockView {
  key: string;
  color: string;
  tooltip: string;
}

export type SiteRegistrationMode = "open" | "invite" | "closed" | "unknown";

export interface SiteCatalogDiscoverRecord {
  id: string;
  siteKey: string;
  name: string;
  hostname: string;
  description: string;
  displayUrl: string;
  visitUrl: string | null;
  reviewUrl: string;
  sksUrl: string | null;
  displayStatus: SksDisplayStatus;
  operationalStatusLabel: string;
  recommendationTags: string[];
  providerFamilies: string[];
  providerLabels: string[];
  models: string[];
  hotModels: string[];
  trackerGrid: SksGridCell[];
  hasMonitoring: boolean;
  hasCredential: boolean;
  hasSks: boolean;
  registrationMode: SiteRegistrationMode;
  registrationOpen: boolean | null;
  emailVerificationRequired: boolean | null;
  inviteCodeRequired: boolean | null;
  hasInitialQuota: boolean | null;
  uptimeRate: number | null;
  currentLatencyMs: number | null;
  todayAverageLatencyMs: number | null;
  searchText: string;
}

export function makeSoftTagStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}1A`, borderColor: `${safeColor}33` };
}

export function makeBadgeStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}14`, borderColor: `${safeColor}33` };
}

export function normalizeExternalUrl(url?: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function getStatusColor(status: SksDisplayStatus) {
  if (status === "ok") return "#10b981";
  if (status === "slow") return "#f59e0b";
  if (status === "failed") return "#f43f5e";
  return "#737373";
}

export function getDisplayStatusSortValue(status: SksDisplayStatus) {
  if (status === "ok") return 3;
  if (status === "slow") return 2;
  if (status === "unknown") return 1;
  return 0;
}

export function getTrackerColor(status: SksDisplayStatus) {
  if (status === "ok") return "bg-emerald-500";
  if (status === "slow") return "bg-amber-400";
  if (status === "failed") return "bg-rose-500";
  return "bg-slate-300/80 dark:bg-slate-700/80";
}

export function normalizeProviderFamilyKey(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "google") return "gemini";
  if (normalized === "claude") return "anthropic";
  if (normalized === "llama") return "meta";
  return normalized;
}

function getProviderPriority(value: string) {
  const normalized = normalizeProviderFamilyKey(value);
  const index = PRIORITY_PROVIDER_ORDER.indexOf(normalized as (typeof PRIORITY_PROVIDER_ORDER)[number]);
  return index === -1 ? PRIORITY_PROVIDER_ORDER.length : index;
}

export function formatProviderFamily(value: string) {
  const normalized = normalizeProviderFamilyKey(value);
  if (!normalized) return "";
  if (normalized === "openai") return "OpenAI";
  if (normalized === "anthropic") return "Claude";
  if (normalized === "gemini") return "Gemini";
  if (normalized === "xai") return "xAI";
  if (normalized === "deepseek") return "DeepSeek";
  if (normalized === "qwen") return "Qwen";
  if (normalized === "glm") return "GLM";
  if (normalized === "meta") return "Meta Llama";
  if (normalized === "cohere") return "Cohere";
  if (normalized === "minimax") return "MiniMax";
  if (normalized === "moonshot") return "Moonshot";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function inferProviderFamilyFromModelName(modelName: string) {
  const normalized = String(modelName || "").trim().toLowerCase();
  if (!normalized) return "";
  if (
    normalized.includes("gpt") ||
    normalized.includes("o1") ||
    normalized.includes("o3") ||
    normalized.includes("o4") ||
    normalized.includes("o5")
  ) {
    return "openai";
  }
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gemini") || normalized.includes("gemma")) return "gemini";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("glm")) return "glm";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("command")) return "cohere";
  if (normalized.includes("grok")) return "xai";
  if (normalized.includes("minimax")) return "minimax";
  if (normalized.includes("moonshot") || normalized.includes("kimi")) return "moonshot";
  return "";
}

function sortProviderFamilies(families: Iterable<string>) {
  return Array.from(
    new Set(
      Array.from(families)
        .map((family) => normalizeProviderFamilyKey(family))
        .filter(Boolean)
    )
  ).sort((a, b) => {
    const priorityDiff = getProviderPriority(a) - getProviderPriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return formatProviderFamily(a).localeCompare(formatProviderFamily(b), "en");
  });
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function formatShanghaiDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return SHANGHAI_DATE_FORMATTER.format(date);
}

function getLatencyValue(input: { totalMs: number | null; ttfbMs: number | null }) {
  if (typeof input.totalMs === "number" && Number.isFinite(input.totalMs)) return input.totalMs;
  if (typeof input.ttfbMs === "number" && Number.isFinite(input.ttfbMs)) return input.ttfbMs;
  return null;
}

function computeTodayAverageLatency(grid: SksGridCell[]) {
  const todayKey = formatShanghaiDateKey(new Date());
  const latencyValues = grid
    .filter((cell) => formatShanghaiDateKey(cell.checkedAt || cell.bucketStart) === todayKey)
    .map((cell) => getLatencyValue(cell))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (latencyValues.length === 0) return null;
  return Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length);
}

export function getRegistrationMode(input: {
  registrationOpen: boolean | null;
  inviteCodeRequired: boolean | null;
}): SiteRegistrationMode {
  if (input.registrationOpen === true && input.inviteCodeRequired !== true) return "open";
  if (input.inviteCodeRequired === true) return "invite";
  if (input.registrationOpen === false) return "closed";
  return "unknown";
}

export function getEffectiveLatencyMs(input: {
  todayAverageLatencyMs: number | null;
  currentLatencyMs: number | null;
}) {
  return input.todayAverageLatencyMs ?? input.currentLatencyMs;
}

function buildGridTooltip(cell: SksGridCell, noDataText: string, connectionFailedText: string) {
  if (!cell.checkedAt) return `${cell.label} · ${noDataText}`;
  if (cell.status === "failed") {
    return `${cell.label} · ${cell.errorMessage || connectionFailedText}`;
  }
  return `${cell.label} · ${cell.totalMs ?? cell.ttfbMs ?? 0}ms`;
}

export function gridToTrackerData(
  grid: SksGridCell[] | null | undefined,
  noDataText: string,
  connectionFailedText: string,
  nodeCount: number = 24
): TrackerBlockView[] {
  const recentCells = Array.isArray(grid) ? grid.slice(-nodeCount) : [];
  const emptyCount = Math.max(0, nodeCount - recentCells.length);

  return [
    ...Array.from({ length: emptyCount }, (_, index) => ({
      key: `empty-${index}`,
      color: "bg-slate-300/80 dark:bg-slate-700/80",
      tooltip: noDataText,
    })),
    ...recentCells.map((cell, index) => ({
      key: `${cell.bucketStart}-${index}`,
      color: getTrackerColor(cell.status),
      tooltip: buildGridTooltip(cell, noDataText, connectionFailedText),
    })),
  ];
}

export function generateGreyTrackerData(monitoringDisabledText: string, nodeCount: number = 24): TrackerBlockView[] {
  return Array.from({ length: nodeCount }, (_, index) => ({
    key: `disabled-${index}`,
    color: "bg-slate-200 dark:bg-slate-700/70",
    tooltip: monitoringDisabledText,
  }));
}

export function clampTags<T>(items: T[], max: number) {
  if (items.length <= max) return { visible: items, hiddenCount: 0 };
  return { visible: items.slice(0, max), hiddenCount: items.length - max };
}

export function adaptSiteCatalogRecord(site: SiteCatalogSiteCardView): SiteCatalogDiscoverRecord {
  const siteKey = site.catalogSite.normalizedHostname || site.catalogSite.hostname;
  const allModels = dedupeStrings(site.sks?.models.all || site.sks?.models.hot || []);
  const hotModels = dedupeStrings(site.sks?.models.hot || allModels).slice(0, 10);
  const providerFamilies = sortProviderFamilies([
    ...site.computed.providerFamilies,
    ...allModels.map((modelName) => inferProviderFamilyFromModelName(modelName)),
  ]);
  const providerLabels = providerFamilies.map((family) => formatProviderFamily(family)).filter(Boolean);
  const description = String(site.catalogSite.description || site.catalogSite.summary || "").trim();
  const displayUrl = site.catalogSite.homepageUrl || site.catalogSite.apiBaseUrl || site.catalogSite.hostname;
  const recommendationTags = dedupeStrings(site.computed.recommendationTags);
  const currentLatencyMs = site.sks ? getLatencyValue(site.sks.current) : null;
  const trackerGrid = site.sks?.grid || [];
  const uptimeRate = site.computed.stats7d && site.computed.stats7d.total > 0 ? site.computed.stats7d.successRate : null;

  return {
    id: siteKey,
    siteKey,
    name: site.catalogSite.displayName || site.catalogSite.hostname,
    hostname: site.catalogSite.hostname,
    description,
    displayUrl,
    visitUrl: normalizeExternalUrl(site.catalogSite.homepageUrl || site.catalogSite.apiBaseUrl),
    reviewUrl: `/review/site/${encodeURIComponent(siteKey)}`,
    sksUrl: site.sks ? `/sks/site/${encodeURIComponent(siteKey)}` : null,
    displayStatus: site.computed.displayStatus,
    operationalStatusLabel: site.computed.operationalStatusLabel || "正常运营",
    recommendationTags,
    providerFamilies,
    providerLabels,
    models: allModels,
    hotModels,
    trackerGrid,
    hasMonitoring: Boolean(site.sks),
    hasCredential: Boolean(site.catalogSite.hasCredential),
    hasSks: Boolean(site.sks),
    registrationMode: getRegistrationMode({
      registrationOpen: site.catalogSite.registrationOpen,
      inviteCodeRequired: site.catalogSite.inviteCodeRequired,
    }),
    registrationOpen: site.catalogSite.registrationOpen,
    emailVerificationRequired: site.catalogSite.emailVerificationRequired,
    inviteCodeRequired: site.catalogSite.inviteCodeRequired,
    hasInitialQuota: site.catalogSite.hasInitialQuota,
    uptimeRate,
    currentLatencyMs,
    todayAverageLatencyMs: computeTodayAverageLatency(trackerGrid),
    searchText: [
      site.catalogSite.displayName,
      site.catalogSite.hostname,
      site.catalogSite.homepageUrl || "",
      site.catalogSite.apiBaseUrl,
      description,
      site.computed.operationalStatusLabel,
      ...recommendationTags,
      ...site.catalogSite.tags,
      ...providerLabels,
      ...allModels,
      site.catalogSite.siteSystem,
      site.catalogSite.sourceStage,
      site.catalogSite.hasCredential ? "has credential" : "no credential",
      site.sks ? "sks" : "no sks",
    ]
      .join(" ")
      .toLowerCase(),
  };
}
