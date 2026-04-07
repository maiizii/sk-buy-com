"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";
import {
  ArrowRight,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { Tracker, type TrackerBlockProps } from "@/components/Tracker";
import { getMessages } from "@/lib/i18n";
import type {
  SiteCatalogSiteCardView,
  SiteCatalogSiteDetailView,
} from "@/lib/site-catalog/types";
import type { SksDisplayStatus, SksGridCell, SksModelStatusView } from "@/lib/sks/types";

interface HomeSiteTag {
  key: string;
  label: string;
  color?: string;
  shortLabel?: string;
  family?: string;
  iconUrl?: string;
  darkIconUrl?: string;
}

interface HomeSiteCard {
  id: string;
  siteKey: string;
  name: string;
  displayUrl: string;
  searchText: string;
  description: string;
  operationalStatusLabel: string;
  displayStatus: SksDisplayStatus;
  statusColor: string;
  siteStatusText: string;
  tag: "premium" | "free" | "stable" | "dead";
  tagLabel: string;
  tagColor?: string;
  supplierTags: HomeSiteTag[];
  supportedModels: HomeSiteTag[];
  uptimeText: string;
  averageLatencyText: string;
  trackerData: TrackerBlockProps[];
  trackerHoverEffect: boolean;
  visitUrl: string | null;
  reviewUrl: string | null;
}

interface HomeSiteBadge {
  tag: HomeSiteCard["tag"];
  label: string;
  color?: string;
}

type Messages = ReturnType<typeof getMessages>;
type HomeSiteDetail = SiteCatalogSiteDetailView & { recentFailures?: string[] };

interface SitesApiResponse {
  success: boolean;
  data?: SiteCatalogSiteCardView[];
  error?: string;
}

interface SiteDetailApiResponse {
  success: boolean;
  data?: HomeSiteDetail | null;
  error?: string;
}

const DEFAULT_TAG_COLOR = "#737373";
const LOBE_LIGHT_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/light";
const LOBE_DARK_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/dark";
const PRIORITY_PROVIDER_ORDER = ["anthropic", "openai", "gemini"] as const;
const HOME_SITE_REFRESH_INTERVAL_MS = 15_000;

function makeSoftTagStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}1A`, borderColor: `${safeColor}33` };
}

function makeBadgeStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}14`, borderColor: `${safeColor}33` };
}

function normalizeExternalUrl(url?: string | null) {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function getBadgeClass(tag: HomeSiteCard["tag"]) {
  if (tag === "premium") return "badge badge-premium";
  if (tag === "free") return "badge badge-free";
  if (tag === "dead") return "badge badge-dead";
  return "badge badge-stable";
}

function getStatusColor(status: SksDisplayStatus) {
  if (status === "ok") return "#10b981";
  if (status === "slow") return "#f59e0b";
  if (status === "failed") return "#f43f5e";
  return "#737373";
}

function getTrackerColor(status: SksDisplayStatus) {
  if (status === "ok") return "bg-emerald-500";
  if (status === "slow") return "bg-amber-400";
  if (status === "failed") return "bg-rose-500";
  return "bg-slate-300/80 dark:bg-slate-700/80";
}

function getStatusText(status: SksDisplayStatus) {
  if (status === "ok") return "正常";
  if (status === "slow") return "偏慢";
  if (status === "failed") return "异常";
  return "未知";
}

function getLatencyValue(input: { totalMs: number | null; ttfbMs: number | null }) {
  if (typeof input.totalMs === "number" && Number.isFinite(input.totalMs)) return input.totalMs;
  if (typeof input.ttfbMs === "number" && Number.isFinite(input.ttfbMs)) return input.ttfbMs;
  return null;
}

function computeAverageLatency(grid: SksGridCell[] | null | undefined, nodeCount: number = 24) {
  const recentCells = Array.isArray(grid) ? grid.slice(-nodeCount) : [];
  const latencyValues = recentCells
    .map((cell) => getLatencyValue(cell))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (latencyValues.length === 0) return null;
  return Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length);
}

function formatLatencyText(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}ms`;
}

function buildSevenDayHealthyText(rateText: string, messages: Messages) {
  if (rateText === messages.common.noData) {
    return `${messages.home.last7Days} ${messages.common.noData}`;
  }
  return `${messages.home.last7Days} ${rateText} ${messages.home.healthySuffix}`;
}

function buildAverageLatencyText(latencyText: string, messages: Messages) {
  return `${messages.home.averageLatency} ${latencyText}`;
}

function normalizeProviderFamilyKey(value: string) {
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

function getProviderIconFileName(value: string) {
  const normalized = normalizeProviderFamilyKey(value);
  if (normalized === "openai") return "openai.png";
  if (normalized === "anthropic") return "claude-color.png";
  if (normalized === "gemini") return "gemini-color.png";
  if (normalized === "xai") return "xai.png";
  if (normalized === "deepseek") return "deepseek-color.png";
  if (normalized === "qwen") return "qwen-color.png";
  if (normalized === "glm") return "zhipu-color.png";
  if (normalized === "meta") return "meta-color.png";
  if (normalized === "cohere") return "cohere-color.png";
  if (normalized === "minimax") return "minimax-color.png";
  if (normalized === "moonshot") return "moonshot.png";
  return "";
}

function getProviderIconUrl(value: string) {
  const fileName = getProviderIconFileName(value);
  return fileName ? `${LOBE_LIGHT_ICON_BASE_URL}/${fileName}` : "";
}

function getProviderDarkIconUrl(value: string) {
  const fileName = getProviderIconFileName(value);
  return fileName ? `${LOBE_DARK_ICON_BASE_URL}/${fileName}` : "";
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

function formatProviderFamily(value: string) {
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

function inferProviderFamilyFromModelName(modelName: string) {
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

function getProviderTagMeta(family: string) {
  const normalized = normalizeProviderFamilyKey(family);
  const iconUrl = getProviderIconUrl(normalized);
  const darkIconUrl = getProviderDarkIconUrl(normalized);

  if (normalized === "openai") {
    return { family: normalized, label: "OpenAI", color: "#10a37f", shortLabel: "AI", iconUrl, darkIconUrl };
  }
  if (normalized === "anthropic") {
    return { family: normalized, label: "Claude", color: "#d97706", shortLabel: "CL", iconUrl, darkIconUrl };
  }
  if (normalized === "gemini") {
    return { family: normalized, label: "Gemini", color: "#4285F4", shortLabel: "G", iconUrl, darkIconUrl };
  }
  if (normalized === "xai") {
    return { family: normalized, label: "xAI", color: "#111827", shortLabel: "x", iconUrl, darkIconUrl };
  }
  if (normalized === "deepseek") {
    return { family: normalized, label: "DeepSeek", color: "#4f46e5", shortLabel: "DS", iconUrl, darkIconUrl };
  }
  if (normalized === "qwen") {
    return { family: normalized, label: "Qwen", color: "#06b6d4", shortLabel: "QW", iconUrl, darkIconUrl };
  }
  if (normalized === "glm") {
    return { family: normalized, label: "GLM", color: "#2563eb", shortLabel: "GL", iconUrl, darkIconUrl };
  }
  if (normalized === "meta") {
    return { family: normalized, label: "Meta Llama", color: "#2563eb", shortLabel: "M", iconUrl, darkIconUrl };
  }
  if (normalized === "cohere") {
    return { family: normalized, label: "Cohere", color: "#7c3aed", shortLabel: "CO", iconUrl, darkIconUrl };
  }
  if (normalized === "minimax") {
    return { family: normalized, label: "MiniMax", color: "#db2777", shortLabel: "MM", iconUrl, darkIconUrl };
  }
  if (normalized === "moonshot") {
    return { family: normalized, label: "Moonshot", color: "#0f766e", shortLabel: "MS", iconUrl, darkIconUrl };
  }

  const label = formatProviderFamily(normalized);
  return {
    family: normalized,
    label: label || "未知供应商",
    color: DEFAULT_TAG_COLOR,
    shortLabel: (label || "??").slice(0, 2).toUpperCase(),
    iconUrl,
    darkIconUrl,
  };
}

function getModelFallbackColor(modelName: string) {
  const family = inferProviderFamilyFromModelName(modelName);
  return getProviderTagMeta(family).color || DEFAULT_TAG_COLOR;
}

function recommendationTagColor(label: string) {
  if (label === "免费公益") return "#10b981";
  if (label === "人气权威") return "#8b5cf6";
  if (label === "新站抢注") return "#3b82f6";
  return undefined;
}

function getSiteCategoryDisplayLabel(label: string) {
  return label === "新站上线" ? "新站收录" : label;
}

function addTag(target: Map<string, HomeSiteTag>, key: string, tag: Omit<HomeSiteTag, "key">) {
  const normalizedLabel = String(tag.label || "").trim();
  if (!normalizedLabel || target.has(normalizedLabel)) return;
  target.set(normalizedLabel, { key, ...tag, label: normalizedLabel });
}

function InlineHoverTooltip({
  content,
  children,
  align = "center",
}: {
  content: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <HoverCardPrimitives.Root openDelay={60} closeDelay={40}>
      <HoverCardPrimitives.Trigger asChild>{children}</HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={10}
          side="top"
          align={align}
          avoidCollisions
          className="z-50 max-w-[260px] break-all rounded-md bg-gray-900 px-2 py-1 text-sm text-white shadow-md dark:bg-gray-50 dark:text-gray-900"
        >
          {content}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
}

function ProviderIcon({ tag }: { tag: HomeSiteTag }) {
  const safeColor = tag.color || DEFAULT_TAG_COLOR;

  return (
    <InlineHoverTooltip content={tag.label}>
      <span
        aria-label={tag.label}
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: `${safeColor}12` }}
      >
        {tag.iconUrl ? (
          <>
            <img
              src={tag.iconUrl}
              alt={tag.label}
              className={`h-5 w-5 object-contain ${tag.darkIconUrl ? "dark:hidden" : ""}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            {tag.darkIconUrl ? (
              <img
                src={tag.darkIconUrl}
                alt={tag.label}
                className="hidden h-5 w-5 object-contain dark:block"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : null}
          </>
        ) : (
          <span className="text-[10px] font-semibold" style={{ color: safeColor }}>
            {tag.shortLabel || "??"}
          </span>
        )}
      </span>
    </InlineHoverTooltip>
  );
}

function gridToSimpleTrackerData(
  grid: SksGridCell[] | null | undefined,
  nodeCount: number = 24
): TrackerBlockProps[] {
  const recentCells = Array.isArray(grid) ? grid.slice(-nodeCount) : [];
  const emptyCount = Math.max(0, nodeCount - recentCells.length);

  return [
    ...Array.from({ length: emptyCount }, (_, index) => ({
      key: `empty-simple-${index}`,
      color: "bg-slate-200 dark:bg-slate-700/70",
    })),
    ...recentCells.map((cell, index) => ({
      key: `${cell.bucketStart}-simple-${index}`,
      color: getTrackerColor(cell.status),
    })),
  ];
}

function ModelStatusHoverCard({
  model,
  modelStatus,
  loading,
  messages,
  onPreload,
}: {
  model: HomeSiteTag;
  modelStatus?: SksModelStatusView;
  loading: boolean;
  messages: Messages;
  onPreload?: () => void;
}) {
  const modelDisplayStatus = modelStatus?.current.status || "unknown";
  const uptimeText = modelStatus ? `${modelStatus.stats7d.successRate.toFixed(1)}%` : messages.common.noData;
  const averageLatencyText = modelStatus
    ? formatLatencyText(computeAverageLatency(modelStatus.grid, 24) ?? getLatencyValue(modelStatus.current))
    : "--";
  const statusLabel = getStatusText(modelDisplayStatus);
  const statusColor = modelStatus ? getStatusColor(modelDisplayStatus) : getModelFallbackColor(model.label);
  const trackerData = modelStatus
    ? gridToTrackerData(modelStatus.grid, messages.common.noData, messages.common.connectionFailed, 24)
    : generateGreyTrackerData(messages.common.noData, 24);

  return (
    <HoverCardPrimitives.Root openDelay={60} closeDelay={60}>
      <HoverCardPrimitives.Trigger asChild>
        <span className="soft-tag cursor-pointer" style={makeSoftTagStyle(statusColor)} onMouseEnter={onPreload}>
          {model.label}
        </span>
      </HoverCardPrimitives.Trigger>
      <HoverCardPrimitives.Portal>
        <HoverCardPrimitives.Content
          sideOffset={8}
          side="bottom"
          align="start"
          avoidCollisions
          className="z-50 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-color)] bg-[var(--card)]/95 p-3 shadow-xl backdrop-blur"
        >
          {loading && !modelStatus ? (
            <p className="text-xs text-[var(--muted)]">{messages.home.loadingModelStatus}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3 text-xs">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-[var(--accent-strong)]">
                    {buildSevenDayHealthyText(uptimeText, messages)}
                  </span>
                  <span className="text-[var(--muted)]">
                    {buildAverageLatencyText(averageLatencyText, messages)}
                  </span>
                </div>
                <span className="shrink-0 text-right font-semibold" style={{ color: statusColor }}>
                  {messages.common.status}：{statusLabel}
                </span>
              </div>
              <Tracker data={trackerData} className="h-4" hoverEffect hoverClassName="hover:opacity-75" />
            </div>
          )}
        </HoverCardPrimitives.Content>
      </HoverCardPrimitives.Portal>
    </HoverCardPrimitives.Root>
  );
}

function buildGridTooltip(cell: SksGridCell, noDataText: string, connectionFailedText: string) {
  if (!cell.checkedAt) return `${cell.label} · ${noDataText}`;
  if (cell.status === "failed") {
    return `${cell.label} · ${cell.errorMessage || connectionFailedText}`;
  }
  return `${cell.label} · ${cell.totalMs ?? cell.ttfbMs ?? 0}ms`;
}

function gridToTrackerData(
  grid: SksGridCell[] | null | undefined,
  noDataText: string,
  connectionFailedText: string,
  nodeCount: number = 24
): TrackerBlockProps[] {
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

function generateGreyTrackerData(monitoringDisabledText: string, nodeCount: number = 24): TrackerBlockProps[] {
  return Array.from({ length: nodeCount }, (_, index) => ({
    key: `disabled-${index}`,
    color: "bg-slate-200 dark:bg-slate-700/70",
    tooltip: monitoringDisabledText,
  }));
}

function buildBadge(site: SiteCatalogSiteCardView): HomeSiteBadge {
  if (site.computed.recommendationTags.includes("免费公益")) {
    return {
      tag: "free",
      label: "免费公益",
      color: recommendationTagColor("免费公益"),
    };
  }

  if (site.computed.recommendationTags.includes("人气权威")) {
    return {
      tag: "premium",
      label: "人气权威",
      color: recommendationTagColor("人气权威"),
    };
  }

  if (site.computed.recommendationTags.includes("新站抢注")) {
    return {
      tag: "stable",
      label: "新站抢注",
      color: recommendationTagColor("新站抢注"),
    };
  }

  if (site.computed.displayStatus === "failed") {
    return {
      tag: "dead",
      label: getSiteCategoryDisplayLabel(site.computed.operationalStatusLabel || "疑似停运"),
      color: getStatusColor(site.computed.displayStatus),
    };
  }

  if (site.computed.operationalStatusLabel === "长期稳定") {
    return {
      tag: "premium",
      label: getSiteCategoryDisplayLabel(site.computed.operationalStatusLabel),
      color: "#8b5cf6",
    };
  }

  return {
    tag: "stable",
    label: getSiteCategoryDisplayLabel(site.computed.operationalStatusLabel || "正常运营"),
    color: getStatusColor(site.computed.displayStatus),
  };
}

function buildSupplierTags(site: SiteCatalogSiteCardView) {
  const tags = new Map<string, HomeSiteTag>();
  const families = new Set<string>();

  for (const model of site.sks?.models.all || site.sks?.models.hot || []) {
    const family = inferProviderFamilyFromModelName(model);
    if (family) families.add(family);
  }

  for (const family of site.computed.providerFamilies) {
    if (family) families.add(family);
  }

  for (const family of sortProviderFamilies(families)) {
    const meta = getProviderTagMeta(family);
    addTag(tags, `supplier:${meta.family || family}`, {
      label: meta.label,
      color: meta.color,
      shortLabel: meta.shortLabel,
      family: meta.family,
      iconUrl: meta.iconUrl,
      darkIconUrl: meta.darkIconUrl,
    });
  }

  return Array.from(tags.values());
}

function buildSupportedModels(site: SiteCatalogSiteCardView) {
  const models = Array.from(
    new Set(
      (site.sks?.models.all || site.sks?.models.hot || [])
        .map((model) => String(model || "").trim())
        .filter(Boolean)
    )
  );

  return models
    .sort((a, b) => {
      const priorityDiff =
        getProviderPriority(inferProviderFamilyFromModelName(a)) -
        getProviderPriority(inferProviderFamilyFromModelName(b));
      if (priorityDiff !== 0) return priorityDiff;
      return a.localeCompare(b, "en");
    })
    .map((model) => ({
      key: `model:${model}`,
      label: model,
    }));
}

function buildSiteDescription(site: SiteCatalogSiteCardView) {
  return String(site.catalogSite.description || site.catalogSite.summary || "").trim();
}

function adaptSiteCard(site: SiteCatalogSiteCardView, messages: Messages): HomeSiteCard {
  const badge = buildBadge(site);
  const supplierTags = buildSupplierTags(site);
  const supportedModels = buildSupportedModels(site);
  const description = buildSiteDescription(site);
  const displayUrl = site.catalogSite.homepageUrl || site.catalogSite.apiBaseUrl || site.catalogSite.hostname;
  const uptimeText = site.computed.stats7d
    ? `${site.computed.stats7d.successRate.toFixed(1)}%`
    : messages.common.noData;
  const averageLatencyText = formatLatencyText(
    site.sks ? computeAverageLatency(site.sks.grid, 24) ?? getLatencyValue(site.sks.current) : null
  );
  const statusColor = getStatusColor(site.computed.displayStatus);

  return {
    id: site.catalogSite.normalizedHostname,
    siteKey: site.catalogSite.normalizedHostname,
    name: site.catalogSite.displayName || site.catalogSite.hostname,
    displayUrl,
    searchText: [
      site.catalogSite.displayName,
      site.catalogSite.hostname,
      site.catalogSite.homepageUrl || "",
      site.catalogSite.apiBaseUrl,
      displayUrl,
      description,
      site.computed.operationalStatusLabel,
      badge.label,
      ...supplierTags.map((item) => item.label),
      ...supportedModels.map((item) => item.label),
      ...site.catalogSite.tags,
    ]
      .join(" ")
      .toLowerCase(),
    description,
    operationalStatusLabel: getSiteCategoryDisplayLabel(site.computed.operationalStatusLabel || "正常运营"),
    displayStatus: site.computed.displayStatus,
    statusColor,
    siteStatusText: getStatusText(site.computed.displayStatus),
    tag: badge.tag,
    tagLabel: badge.label,
    tagColor: badge.color,
    supplierTags,
    supportedModels,
    uptimeText,
    averageLatencyText,
    trackerData: site.sks
      ? gridToTrackerData(site.sks.grid, messages.common.noData, messages.common.connectionFailed, 24)
      : generateGreyTrackerData(messages.common.monitoringDisabled, 24),
    trackerHoverEffect: Boolean(site.sks),
    visitUrl: normalizeExternalUrl(site.catalogSite.homepageUrl || site.catalogSite.apiBaseUrl),
    reviewUrl: `/review/site/${encodeURIComponent(site.catalogSite.normalizedHostname || site.catalogSite.hostname)}`,
  };
}

export default function Home() {
  const t = getMessages();
  const [sites, setSites] = useState<SiteCatalogSiteCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [siteDetails, setSiteDetails] = useState<Record<string, HomeSiteDetail | null | undefined>>({});
  const [siteDetailLoading, setSiteDetailLoading] = useState<Record<string, boolean>>({});
  const [siteDetailFetchedAt, setSiteDetailFetchedAt] = useState<Record<string, number>>({});

  const fetchSites = useCallback(async () => {
    const response = await fetch("/api/sites", { cache: "no-store" });
    const result: SitesApiResponse = await response.json();
    return result.success && Array.isArray(result.data) ? result.data : null;
  }, []);

  useEffect(() => {
    let disposed = false;

    const loadSites = async () => {
      try {
        const data = await fetchSites();
        if (!disposed && data) {
          setSites(data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    loadSites();
    const intervalId = window.setInterval(() => {
      fetchSites()
        .then((data) => {
          if (!disposed && data) {
            setSites(data);
          }
        })
        .catch(console.error);
    }, HOME_SITE_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [fetchSites]);

  const loadSiteDetail = (siteKey: string) => {
    if (siteDetailLoading[siteKey]) return;

    const lastFetchedAt = siteDetailFetchedAt[siteKey] || 0;
    const hasFreshCache =
      siteDetails[siteKey] !== undefined && Date.now() - lastFetchedAt < HOME_SITE_REFRESH_INTERVAL_MS;

    if (hasFreshCache) return;

    setSiteDetailLoading((prev) => ({ ...prev, [siteKey]: true }));
    fetch(`/api/site/${encodeURIComponent(siteKey)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result: SiteDetailApiResponse) => {
        setSiteDetails((prev) => ({
          ...prev,
          [siteKey]: result.success && result.data ? result.data : null,
        }));
        setSiteDetailFetchedAt((prev) => ({ ...prev, [siteKey]: Date.now() }));
      })
      .catch((error) => {
        console.error(error);
        setSiteDetails((prev) => ({ ...prev, [siteKey]: null }));
        setSiteDetailFetchedAt((prev) => ({ ...prev, [siteKey]: Date.now() }));
      })
      .finally(() => {
        setSiteDetailLoading((prev) => ({ ...prev, [siteKey]: false }));
      });
  };

  const homeCards = useMemo(() => sites.map((site) => adaptSiteCard(site, t)), [sites, t]);

  useEffect(() => {
    const expandedSiteKeys = homeCards
      .filter((site) => expandedCards[site.id])
      .map((site) => site.siteKey);

    expandedSiteKeys.forEach((siteKey) => {
      loadSiteDetail(siteKey);
    });
  }, [expandedCards, homeCards]);

  const filteredPlatforms = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return homeCards
      .filter((site) => !normalizedKeyword || site.searchText.includes(normalizedKeyword))
      .slice(0, 8);
  }, [homeCards, keyword]);

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/30">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              <Search className="h-3.5 w-3.5" />
              {t.home.compactSearchTitle}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.home.searchTitle}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">{t.home.compactSearchDescription}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/discover" className="btn-glass btn-glass-primary">
                {t.home.openDiscover}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin" className="btn-glass">
                {t.home.viewAdminPlanning}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card)]/80 p-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t.home.keyword}</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t.home.keywordPlaceholder}
                className="admin-input"
              />
            </label>
            <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
              {t.home.quickHint}
            </p>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
              <h3 className="text-base font-semibold">{t.home.featuredTitle}</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.home.featuredDescription}</p>
          </div>
          <Link href="/discover" className="btn-glass">
            {t.home.enterDiscover}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid items-start gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-10 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
          ) : filteredPlatforms.length === 0 ? (
            <div className="col-span-full py-10 text-center text-sm text-[var(--muted)]">{t.home.empty}</div>
          ) : (
            filteredPlatforms.map((site) => {
              const expanded = !!expandedCards[site.id];
              const siteDetail = siteDetails[site.siteKey];
              const modelStatusByName = new Map(
                (siteDetail?.sksDetail?.modelStatuses || []).map((model) => [model.modelName, model])
              );
              const isModelStatusLoading = Boolean(siteDetailLoading[site.siteKey]);

              return (
                <article
                  key={site.id}
                  className="home-featured-card flex h-auto cursor-pointer flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-sm transition-all duration-200"
                  onClick={() => {
                    const nextExpanded = !expanded;
                    setExpandedCards((prev) => ({ ...prev, [site.id]: nextExpanded }));
                    if (nextExpanded && site.trackerHoverEffect) {
                      loadSiteDetail(site.siteKey);
                    }
                  }}
                  data-expanded={expanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <InlineHoverTooltip content={site.visitUrl || site.displayUrl} align="start">
                          <h4 className="max-w-full cursor-pointer truncate text-base font-semibold">
                            {site.name}
                          </h4>
                        </InlineHoverTooltip>
                        <span
                          className="inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                          style={makeBadgeStyle(site.statusColor)}
                        >
                          {site.operationalStatusLabel}
                        </span>
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--card)]/80 text-[var(--muted)]">
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: site.statusColor }} />
                        <span className="text-xs font-semibold" style={{ color: site.statusColor }}>
                          {site.siteStatusText}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`mt-3 flex flex-wrap items-center gap-3 ${
                      site.supplierTags.length > 0 ? "justify-between" : "justify-end"
                    }`}
                  >
                    {site.supplierTags.length > 0 ? (
                      <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2">
                        {site.supplierTags.map((tag) => (
                          <ProviderIcon key={tag.key} tag={tag} />
                        ))}
                      </div>
                    ) : null}

                    <span className={`${getBadgeClass(site.tag)} shrink-0`} style={makeBadgeStyle(site.tagColor)}>
                      {site.tagLabel}
                    </span>
                  </div>

                  {expanded && site.description ? (
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{site.description}</p>
                  ) : null}

                  {expanded && site.supportedModels.length > 0 ? (
                    <div className="mt-3" onMouseEnter={() => loadSiteDetail(site.siteKey)}>
                      <div className="flex flex-wrap gap-1.5">
                        {site.supportedModels.map((model) => (
                          <ModelStatusHoverCard
                            key={model.key}
                            model={model}
                            modelStatus={modelStatusByName.get(model.label)}
                            loading={isModelStatusLoading}
                            messages={t}
                            onPreload={() => loadSiteDetail(site.siteKey)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto flex flex-wrap items-end gap-3 pt-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[var(--accent-strong)]">
                          {buildSevenDayHealthyText(site.uptimeText, t)}
                        </span>
                        <span className="text-[var(--muted)]">
                          {buildAverageLatencyText(site.averageLatencyText, t)}
                        </span>
                      </div>
                      <Tracker data={site.trackerData} className="h-4" hoverEffect={site.trackerHoverEffect} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {site.visitUrl ? (
                        <Link
                          href={`/visit/site/${encodeURIComponent(site.siteKey)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-glass"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t.common.visit}
                        </Link>
                      ) : null}
                      {site.reviewUrl ? (
                        <Link href={site.reviewUrl} className="btn-glass" onClick={(e) => e.stopPropagation()}>
                          <MessageSquare className="h-3.5 w-3.5" />
                          {t.common.review}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
