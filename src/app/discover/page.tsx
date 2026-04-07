"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";
import { ArrowRightLeft, ChevronDown, ExternalLink, Gauge, Settings2 } from "lucide-react";
import { Tracker } from "@/components/Tracker";
import { getMessages } from "@/lib/i18n";
import {
  adaptSiteCatalogRecord,
  formatProviderFamily,
  generateGreyTrackerData,
  getEffectiveLatencyMs,
  getStatusColor,
  gridToTrackerData,
  inferProviderFamilyFromModelName,
  makeBadgeStyle,
  makeSoftTagStyle,
  normalizeProviderFamilyKey,
  type SiteCatalogDiscoverRecord,
} from "@/lib/site-catalog/discover-compare";
import type {
  SiteCatalogSiteCardView,
  SiteCatalogSiteDetailView,
} from "@/lib/site-catalog/types";
import type { SksGridCell, SksModelStatusView } from "@/lib/sks/types";

const t = getMessages();
const DEFAULT_TAG_COLOR = "#737373";
const LOBE_LIGHT_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/light";
const LOBE_DARK_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/dark";
const PRIORITY_PROVIDER_ORDER = ["anthropic", "openai", "gemini"] as const;
const SITE_CATEGORY_ORDER = ["新站收录", "长期稳定", "正常运营", "略有波动", "疑似停运"];
const DISCOVER_SITE_REFRESH_INTERVAL_MS = 15_000;

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d97706",
  gemini: "#4285F4",
  xai: "#111827",
  deepseek: "#4f46e5",
  qwen: "#06b6d4",
  glm: "#2563eb",
  meta: "#2563eb",
  cohere: "#7c3aed",
  minimax: "#db2777",
  moonshot: "#0f766e",
};

type Messages = ReturnType<typeof getMessages>;
type FilterKey = "status" | "siteTag" | "provider" | "otherTag";
type SortOption = "default" | "uptime" | "latency";
type SiteDetail = SiteCatalogSiteDetailView & { recentFailures?: string[] };

interface SitesApiResponse {
  success: boolean;
  data?: SiteCatalogSiteCardView[];
  error?: string;
}

interface SiteDetailApiResponse {
  success: boolean;
  data?: SiteDetail | null;
  error?: string;
}

interface FilterOption {
  value: string;
  label: string;
  color?: string;
  shortLabel?: string;
  iconUrl?: string;
  darkIconUrl?: string;
}

interface SiteTagView {
  key: string;
  label: string;
  color?: string;
}

interface FilterTagView extends SiteTagView {
  value: string;
}

interface HomeSiteTag {
  key: string;
  label: string;
  color?: string;
  shortLabel?: string;
  family?: string;
  iconUrl?: string;
  darkIconUrl?: string;
}

interface ProviderVisualItem {
  label: string;
  color?: string;
  shortLabel?: string;
  iconUrl?: string;
  darkIconUrl?: string;
}

function createEmptyFilters(): Record<FilterKey, string[]> {
  return {
    status: [],
    siteTag: [],
    provider: [],
    otherTag: [],
  };
}

function getDisplayStatusLabel(status: SiteCatalogDiscoverRecord["displayStatus"]) {
  if (status === "ok") return t.discoverPage.statusOk;
  if (status === "slow") return t.discoverPage.statusSlow;
  if (status === "failed") return t.discoverPage.statusFailed;
  return t.discoverPage.statusUnknown;
}

function getRecommendationTagColor(label: string) {
  if (label === "免费公益") return "#10b981";
  if (label === "人气权威") return "#8b5cf6";
  if (label === "新站抢注") return "#3b82f6";
  return undefined;
}

function getSiteCategoryDisplayLabel(label: string) {
  return label === "新站上线" ? "新站收录" : label;
}

function getSiteCategoryColor(label: string) {
  if (label === "新站上线" || label === "新站收录") return "#3b82f6";
  if (label === "长期稳定") return "#8b5cf6";
  if (label === "正常运营") return "#10b981";
  if (label === "略有波动") return "#f59e0b";
  if (label === "疑似停运") return "#f43f5e";
  return DEFAULT_TAG_COLOR;
}

function getProviderPriority(value: string) {
  const normalized = normalizeProviderFamilyKey(value);
  const index = PRIORITY_PROVIDER_ORDER.indexOf(normalized as (typeof PRIORITY_PROVIDER_ORDER)[number]);
  return index === -1 ? PRIORITY_PROVIDER_ORDER.length : index;
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

function getProviderTagMeta(family: string) {
  const normalized = normalizeProviderFamilyKey(family);
  const iconUrl = getProviderIconUrl(normalized);
  const darkIconUrl = getProviderDarkIconUrl(normalized);
  const label = formatProviderFamily(normalized) || "未知供应商";

  return {
    family: normalized,
    label,
    color: PROVIDER_COLORS[normalized] || DEFAULT_TAG_COLOR,
    shortLabel: label.slice(0, 2).toUpperCase(),
    iconUrl,
    darkIconUrl,
  };
}

function getModelFallbackColor(modelName: string) {
  const family = inferProviderFamilyFromModelName(modelName);
  return getProviderTagMeta(family).color || DEFAULT_TAG_COLOR;
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

function getComparableLatency(site: SiteCatalogDiscoverRecord) {
  return (
    computeAverageLatency(site.trackerGrid, 24) ||
    getEffectiveLatencyMs({
      todayAverageLatencyMs: site.todayAverageLatencyMs,
      currentLatencyMs: site.currentLatencyMs,
    })
  );
}

function buildSiteCategoryTag(site: SiteCatalogDiscoverRecord): FilterTagView {
  return {
    key: `site-category:${site.siteKey}:${site.operationalStatusLabel}`,
    value: `category:${site.operationalStatusLabel}`,
    label: getSiteCategoryDisplayLabel(site.operationalStatusLabel),
    color: getSiteCategoryColor(site.operationalStatusLabel),
  };
}

function buildRecommendationTags(site: SiteCatalogDiscoverRecord): FilterTagView[] {
  return site.recommendationTags.map((label) => ({
    key: `recommendation:${site.siteKey}:${label}`,
    value: `recommendation:${label}`,
    label,
    color: getRecommendationTagColor(label),
  }));
}

function buildSiteLabelTags(site: SiteCatalogDiscoverRecord) {
  return [buildSiteCategoryTag(site), ...buildRecommendationTags(site)];
}

function buildProviderTags(site: SiteCatalogDiscoverRecord): HomeSiteTag[] {
  const families =
    site.providerFamilies.length > 0
      ? site.providerFamilies
      : site.providerLabels.map((label) => normalizeProviderFamilyKey(label));

  return sortProviderFamilies(families).map((family) => {
    const meta = getProviderTagMeta(family);
    return {
      key: `provider:${site.siteKey}:${meta.family || meta.label}`,
      label: meta.label,
      color: meta.color,
      shortLabel: meta.shortLabel,
      family: meta.family,
      iconUrl: meta.iconUrl,
      darkIconUrl: meta.darkIconUrl,
    };
  });
}

function buildModelTags(site: SiteCatalogDiscoverRecord): HomeSiteTag[] {
  const models = Array.from(
    new Set(
      (site.models.length > 0 ? site.models : site.hotModels)
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
      key: `model:${site.siteKey}:${model}`,
      label: model,
    }));
}

function buildOtherTags(site: SiteCatalogDiscoverRecord): FilterTagView[] {
  const tags: FilterTagView[] = [];

  if (site.registrationMode === "open") {
    tags.push({
      key: `other:${site.siteKey}:open`,
      value: "registration:open",
      label: t.discoverPage.registrationOpen,
      color: "#10b981",
    });
  } else if (site.registrationMode === "invite") {
    tags.push({
      key: `other:${site.siteKey}:invite`,
      value: "registration:invite",
      label: t.discoverPage.registrationInvite,
      color: "#f59e0b",
    });
  } else if (site.registrationMode === "closed") {
    tags.push({
      key: `other:${site.siteKey}:closed`,
      value: "registration:closed",
      label: t.discoverPage.registrationClosed,
      color: "#f43f5e",
    });
  } else {
    tags.push({
      key: `other:${site.siteKey}:unknown`,
      value: "registration:unknown",
      label: t.discoverPage.registrationUnknown,
      color: "#737373",
    });
  }

  if (site.emailVerificationRequired === true) {
    tags.push({
      key: `other:${site.siteKey}:email-verification`,
      value: "registration:email-verification",
      label: t.discoverPage.registrationEmailVerification,
      color: "#6366f1",
    });
  }

  if (site.hasInitialQuota === true) {
    tags.push({
      key: `other:${site.siteKey}:initial-quota`,
      value: "registration:initial-quota",
      label: t.discoverPage.initialQuotaYes,
      color: "#8b5cf6",
    });
  }

  return tags;
}

function getFilterSectionClassName(sectionKey: FilterKey) {
  if (sectionKey === "status") return "min-w-[152px] flex-[0.66] space-y-2";
  if (sectionKey === "siteTag") return "min-w-[180px] flex-[0.78] space-y-2";
  if (sectionKey === "provider") return "min-w-[312px] flex-[1.55] space-y-2";
  return "min-w-[212px] flex-[0.96] space-y-2";
}

function makeFilterOptionButtonStyle(color?: string, active?: boolean) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return {
    ...makeSoftTagStyle(color),
    backgroundColor: active ? `${safeColor}24` : `${safeColor}14`,
    borderColor: active ? `${safeColor}88` : `${safeColor}33`,
    boxShadow: active ? `0 0 0 2px ${safeColor}26` : undefined,
  };
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

function ProviderLogoLabel({ item }: { item: ProviderVisualItem }) {
  const safeColor = item.color || DEFAULT_TAG_COLOR;
  const fallbackLabel = (item.shortLabel || item.label || "??").slice(0, 2).toUpperCase();

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-sm"
        style={{ backgroundColor: `${safeColor}12` }}
      >
        {item.iconUrl ? (
          <>
            <Image
              src={item.iconUrl}
              alt=""
              width={14}
              height={14}
              className={`h-3.5 w-3.5 object-contain ${item.darkIconUrl ? "dark:hidden" : ""}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              unoptimized={false}
            />
            {item.darkIconUrl ? (
              <Image
                src={item.darkIconUrl}
                alt=""
                width={14}
                height={14}
                className="hidden h-3.5 w-3.5 object-contain dark:block"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                unoptimized={false}
              />
            ) : null}
          </>
        ) : (
          <span className="text-[8px] font-semibold leading-none" style={{ color: safeColor }}>
            {fallbackLabel}
          </span>
        )}
      </span>
      <span className="truncate">{item.label}</span>
    </span>
  );
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
  const statusLabel = getDisplayStatusLabel(modelDisplayStatus);
   const statusColor = modelStatus ? getStatusColor(modelDisplayStatus) : getModelFallbackColor(model.label);
  const trackerData = modelStatus
    ? gridToTrackerData(modelStatus.grid, messages.common.noData, messages.common.connectionFailed, 24)
    : generateGreyTrackerData(messages.common.noData, 24);

  return (
    <HoverCardPrimitives.Root openDelay={60} closeDelay={60}>
      <HoverCardPrimitives.Trigger asChild>
        <span
          className="soft-tag cursor-pointer"
          style={makeSoftTagStyle(statusColor)}
          onMouseEnter={onPreload}
        >
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
            <div className="space-y-2.5">
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

function ModelTagCluster({
  site,
  loading,
  modelStatusByName,
  messages,
  onPreload,
}: {
  site: SiteCatalogDiscoverRecord;
  loading: boolean;
  modelStatusByName: Map<string, SksModelStatusView>;
  messages: Messages;
  onPreload: () => void;
}) {
  const modelTags = buildModelTags(site);

  return (
    <div className="flex flex-wrap gap-2.5" onMouseEnter={onPreload}>
      {modelTags.length > 0 ? (
        modelTags.map((model) => (
          <ModelStatusHoverCard
            key={model.key}
            model={model}
            modelStatus={modelStatusByName.get(model.label)}
            loading={loading}
            messages={messages}
            onPreload={onPreload}
          />
        ))
      ) : (
        <span className="text-xs text-[var(--muted)]">{messages.common.noData}</span>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteCatalogDiscoverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const [selectedFilters, setSelectedFilters] = useState<Record<FilterKey, string[]>>(createEmptyFilters);
  const [selectedCompareKeys, setSelectedCompareKeys] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [siteDetails, setSiteDetails] = useState<Record<string, SiteDetail | null | undefined>>({});
  const [siteDetailLoading, setSiteDetailLoading] = useState<Record<string, boolean>>({});
  const [siteDetailFetchedAt, setSiteDetailFetchedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    let disposed = false;

    const requestSites = async () => {
      try {
        const response = await fetch("/api/sites", { cache: "no-store" });
        const result: SitesApiResponse = await response.json();

        if (!disposed && result.success && Array.isArray(result.data)) {
          setSites(
            result.data
              .map((site) => adaptSiteCatalogRecord(site))
              .filter((site) => site.hasSks && site.hasCredential)
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    requestSites();
    const intervalId = window.setInterval(requestSites, DISCOVER_SITE_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const loadSiteDetail = useCallback((siteKey: string) => {
    if (siteDetailLoading[siteKey]) return;

    const lastFetchedAt = siteDetailFetchedAt[siteKey] || 0;
    const hasFreshCache =
      siteDetails[siteKey] !== undefined && Date.now() - lastFetchedAt < DISCOVER_SITE_REFRESH_INTERVAL_MS;

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
  }, [siteDetailFetchedAt, siteDetailLoading, siteDetails]);

  const filterSections = useMemo(() => {
    const providerMap = new Map<string, FilterOption>();
    const categoryMap = new Map<string, FilterOption>();
    const recommendationMap = new Map<string, FilterOption>();
    const otherTagMap = new Map<string, FilterOption>();

    for (const site of sites) {
      const categoryTag = buildSiteCategoryTag(site);
      categoryMap.set(categoryTag.value, {
        value: categoryTag.value,
        label: categoryTag.label,
        color: categoryTag.color,
      });

      for (const tag of buildRecommendationTags(site)) {
        recommendationMap.set(tag.value, {
          value: tag.value,
          label: tag.label,
          color: tag.color,
        });
      }

      for (const providerFamily of sortProviderFamilies(site.providerFamilies)) {
        const meta = getProviderTagMeta(providerFamily);
        providerMap.set(providerFamily, {
          value: providerFamily,
          label: meta.label,
          color: meta.color,
          shortLabel: meta.shortLabel,
          iconUrl: meta.iconUrl,
          darkIconUrl: meta.darkIconUrl,
        });
      }

      for (const tag of buildOtherTags(site)) {
        otherTagMap.set(tag.value, {
          value: tag.value,
          label: tag.label,
          color: tag.color,
        });
      }
    }

    const categoryOptions = Array.from(categoryMap.values()).sort((a, b) => {
      const aIndex = SITE_CATEGORY_ORDER.indexOf(a.label);
      const bIndex = SITE_CATEGORY_ORDER.indexOf(b.label);
      if (aIndex !== -1 || bIndex !== -1) {
        return (aIndex === -1 ? SITE_CATEGORY_ORDER.length : aIndex) -
          (bIndex === -1 ? SITE_CATEGORY_ORDER.length : bIndex);
      }
      return a.label.localeCompare(b.label, "zh-CN");
    });

    const recommendationOptions = Array.from(recommendationMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "zh-CN")
    );

    return [
      {
        key: "status" as const,
        label: t.discoverPage.filterStatus,
        options: [
          { value: "ok", label: t.discoverPage.statusOk, color: getStatusColor("ok") },
          { value: "slow", label: t.discoverPage.statusSlow, color: getStatusColor("slow") },
          { value: "failed", label: t.discoverPage.statusFailed, color: getStatusColor("failed") },
          { value: "unknown", label: t.discoverPage.statusUnknown, color: getStatusColor("unknown") },
        ],
      },
      {
        key: "siteTag" as const,
        label: t.discoverPage.filterSiteTag,
        options: [...categoryOptions, ...recommendationOptions],
      },
      {
        key: "provider" as const,
        label: t.discoverPage.filterProviderFamily,
        options: Array.from(providerMap.values()).sort((a, b) => {
          const priorityDiff = getProviderPriority(a.value) - getProviderPriority(b.value);
          if (priorityDiff !== 0) return priorityDiff;
          return a.label.localeCompare(b.label, "en");
        }),
      },
      {
        key: "otherTag" as const,
        label: t.discoverPage.filterOtherTag,
        options: Array.from(otherTagMap.values()).sort((a, b) => a.label.localeCompare(b.label, "zh-CN")),
      },
    ].filter((section) => section.options.length > 0);
  }, [sites]);

  const resetFilters = () => {
    setKeyword("");
    setSortBy("default");
    setSelectedFilters(createEmptyFilters());
  };

  const toggleFilterValue = (groupKey: FilterKey, value: string) => {
    setSelectedFilters((prev) => {
      const current = prev[groupKey] || [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [groupKey]: next };
    });
  };

  const toggleCompareSite = (siteKey: string) => {
    setSelectedCompareKeys((prev) =>
      prev.includes(siteKey) ? prev.filter((item) => item !== siteKey) : [...prev, siteKey]
    );
  };

  const toggleRowExpand = (siteKey: string) => {
    const nextExpanded = !expandedRows[siteKey];
    setExpandedRows(nextExpanded ? { [siteKey]: true } : {});
    if (nextExpanded) {
      loadSiteDetail(siteKey);
    }
  };

  useEffect(() => {
    const expandedSiteKeys = Object.entries(expandedRows)
      .filter(([, expanded]) => Boolean(expanded))
      .map(([siteKey]) => siteKey);

    expandedSiteKeys.forEach((siteKey) => {
      loadSiteDetail(siteKey);
    });
  }, [expandedRows, loadSiteDetail]);

  const filteredSites = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const result = sites.filter((site) => {
      const matchesStatus =
        selectedFilters.status.length === 0 || selectedFilters.status.includes(site.displayStatus);
      if (!matchesStatus) return false;

      const siteTagValues = buildSiteLabelTags(site).map((tag) => tag.value);
      const matchesSiteTag =
        selectedFilters.siteTag.length === 0 ||
        selectedFilters.siteTag.some((value) => siteTagValues.includes(value));
      if (!matchesSiteTag) return false;

      const matchesProvider =
        selectedFilters.provider.length === 0 ||
        selectedFilters.provider.some((provider) => site.providerFamilies.includes(provider));
      if (!matchesProvider) return false;

      const otherTagValues = buildOtherTags(site).map((tag) => tag.value);
      const matchesOtherTag =
        selectedFilters.otherTag.length === 0 ||
        selectedFilters.otherTag.some((value) => otherTagValues.includes(value));
      if (!matchesOtherTag) return false;

      if (!normalizedKeyword) return true;
      return site.searchText.includes(normalizedKeyword);
    });

    if (sortBy === "uptime") {
      result.sort((a, b) => {
        const uptimeDiff = (b.uptimeRate ?? -1) - (a.uptimeRate ?? -1);
        if (uptimeDiff !== 0) return uptimeDiff;
        return a.name.localeCompare(b.name, "zh-CN");
      });
    }

    if (sortBy === "latency") {
      result.sort((a, b) => {
        const latencyDiff = (getComparableLatency(a) ?? Number.POSITIVE_INFINITY) -
          (getComparableLatency(b) ?? Number.POSITIVE_INFINITY);
        if (latencyDiff !== 0) return latencyDiff;
        return a.name.localeCompare(b.name, "zh-CN");
      });
    }

    return result;
  }, [sites, keyword, selectedFilters, sortBy]);

  const visibleSelectedCompareKeys = useMemo(() => {
    const visibleSiteKeys = new Set(filteredSites.map((site) => site.siteKey));
    return selectedCompareKeys.filter((key) => visibleSiteKeys.has(key));
  }, [filteredSites, selectedCompareKeys]);

  const compareDisabled = visibleSelectedCompareKeys.length < 2;

  const goToCompare = () => {
    if (compareDisabled) return;
    const query = visibleSelectedCompareKeys.map((key) => encodeURIComponent(key)).join(",");
    router.push(`/compare?keys=${query}`);
  };

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {t.admin.searchWorkbench}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.home.searchTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {t.home.searchDescription}
            </p>
          </div>
          <Link href="/admin" className="btn-glass">
            <Settings2 className="h-4 w-4" />
            {t.discoverPage.configureAdmin}
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_220px]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t.home.keyword}
            </span>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t.home.keywordPlaceholder}
              className="admin-input"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {t.home.sortBy}
            </span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="admin-input"
            >
              <option value="default">{t.home.sortByOrder}</option>
              <option value="uptime">{t.home.sortByUptime}</option>
              <option value="latency">{t.home.sortByLatency}</option>
            </select>
          </label>
        </div>

        {filterSections.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card)]/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t.discoverPage.advancedFilterTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{t.discoverPage.advancedFilterDescription}</p>
              </div>
              <button type="button" onClick={resetFilters} className="btn-glass">
                {t.discoverPage.resetFilters}
              </button>
            </div>
            <div className="flex flex-wrap items-start gap-x-3 gap-y-4">
              {filterSections.map((section) => (
                <div key={section.key} className={getFilterSectionClassName(section.key)}>
                  <p className="text-xs font-semibold text-[var(--muted)]">{section.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {section.options.map((option) => {
                      const active = (selectedFilters[section.key] || []).includes(option.value);
                      return (
                        <button
                          key={`${section.key}-${option.value}`}
                          type="button"
                          onClick={() => toggleFilterValue(section.key, option.value)}
                          className={`soft-tag inline-flex max-w-full cursor-pointer items-center transition duration-150 ${
                            active
                              ? "-translate-y-px font-semibold opacity-100 shadow-sm"
                              : "opacity-85 hover:-translate-y-0.5 hover:opacity-100 hover:shadow-sm"
                          }`}
                          style={makeFilterOptionButtonStyle(option.color, active)}
                        >
                          {section.key === "provider" ? <ProviderLogoLabel item={option} /> : option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {!compareDisabled && (
        <button
          type="button"
          onClick={goToCompare}
          className="fixed bottom-6 left-6 z-30 inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--accent)]/65 bg-[linear-gradient(135deg,var(--accent),var(--accent-strong))] px-3 py-2 text-xs font-semibold text-white shadow-[0_12px_30px_rgba(99,102,241,0.28)] transition-all duration-200 hover:border-[var(--accent)]/85 hover:bg-[linear-gradient(135deg,var(--accent-strong),var(--accent))] hover:shadow-[0_14px_34px_rgba(99,102,241,0.32)] lg:bottom-auto lg:left-8 lg:top-1/2 lg:-translate-y-1/2"
          title={t.discoverPage.compareAction}
          aria-label={t.discoverPage.compareAction}
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/18 text-white">
            <ArrowRightLeft className="h-4 w-4" />
          </span>
          <span className="hidden sm:flex sm:flex-col sm:items-start sm:leading-tight">
            <span>{t.discoverPage.compareAction}</span>
            <span className="text-[10px] font-medium text-white/88">
              {t.discoverPage.compareSelectedCountPrefix}
              {visibleSelectedCompareKeys.length}
              {t.discoverPage.compareSelectedCountSuffix}
            </span>
          </span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/18 px-1.5 py-0.5 text-[10px] font-bold text-white sm:hidden">
            {visibleSelectedCompareKeys.length}
          </span>
        </button>
      )}

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-color)] px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-4 w-4 text-[var(--accent-strong)]" />
              <h3 className="text-base font-semibold">{t.discoverPage.compareSelectionTitle}</h3>
              <span className="text-sm font-semibold text-[var(--accent-strong)]">
                {t.discoverPage.compareSelectedCountPrefix}
                {visibleSelectedCompareKeys.length}
                {t.discoverPage.compareSelectedCountSuffix}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{t.discoverPage.compareSelectionDescription}</p>
          </div>
          <button
            type="button"
            onClick={goToCompare}
            disabled={compareDisabled}
            className={`btn-glass btn-glass-primary ${
              compareDisabled ? "cursor-not-allowed opacity-50 hover:translate-y-0" : ""
            }`}
          >
            <ArrowRightLeft className="h-4 w-4" />
            {t.discoverPage.compareAction}
          </button>
        </div>
        {compareDisabled && (
          <div className="border-b border-[var(--border-color)] bg-[var(--accent-soft)]/20 px-6 py-3 text-sm text-[var(--muted)]">
            {t.discoverPage.compareNeedAtLeastTwo}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-5">
          <div className="flex items-center gap-3">
            <Gauge className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">{t.home.resultTitle}</h3>
            <span className="text-sm font-semibold text-[var(--accent-strong)]">{filteredSites.length}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">{t.home.resultDescription}</p>
        </div>

        <div className="px-4 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <div className="py-20 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
          ) : filteredSites.length === 0 ? (
            <div className="py-20 text-center text-sm text-[var(--muted)]">{t.home.empty}</div>
          ) : (
            <div className="space-y-3">
              {filteredSites.map((site) => {
                const expanded = Boolean(expandedRows[site.siteKey]);
                const trackerData = site.hasMonitoring
                  ? gridToTrackerData(site.trackerGrid, t.common.noData, t.common.connectionFailed, 24)
                  : generateGreyTrackerData(t.common.monitoringDisabled, 24);
                const compareSelected = visibleSelectedCompareKeys.includes(site.siteKey);
                const recommendationTags = buildRecommendationTags(site);
                const providerTags = buildProviderTags(site);
                const otherTags = buildOtherTags(site);
                const siteDetail = siteDetails[site.siteKey];
                const modelStatusByName = new Map(
                  (siteDetail?.sksDetail?.modelStatuses || []).map((model) => [model.modelName, model])
                );
                const isModelStatusLoading = Boolean(siteDetailLoading[site.siteKey]);
                const uptimeText = site.hasMonitoring
                  ? typeof site.uptimeRate === "number"
                    ? `${site.uptimeRate.toFixed(1)}%`
                    : t.common.noData
                  : t.discoverPage.unmonitored;
                const averageLatencyText = site.hasMonitoring
                  ? formatLatencyText(computeAverageLatency(site.trackerGrid, 24) ?? site.currentLatencyMs)
                  : t.discoverPage.unmonitored;

                return (
                  <article
                    key={site.siteKey}
                    className={`group rounded-[28px] border bg-[var(--card)] transition-all duration-200 ${
                      expanded
                        ? "border-[var(--border-color)] bg-[var(--accent-soft)]/28 shadow-[0_12px_30px_rgba(99,102,241,0.12)]"
                        : "border-[var(--border-color)] shadow-[0_4px_18px_rgba(15,23,42,0.05)] hover:-translate-y-0.5 hover:border-[var(--accent)]/20 hover:bg-[var(--accent-soft)]/38 hover:shadow-[0_12px_28px_rgba(99,102,241,0.14)]"
                    }`}
                  >
                    <div
                      className="cursor-pointer p-3 sm:px-4 sm:py-3"
                      onClick={() => toggleRowExpand(site.siteKey)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleRowExpand(site.siteKey);
                        }
                      }}
                    >
                      <div className="grid items-center gap-x-2 gap-y-0 xl:grid-cols-[44px_252px_minmax(300px,1fr)_max-content_260px_148px]">
                        <div className="flex min-h-[52px] items-center justify-center">
                          <InlineHoverTooltip
                            content={compareSelected ? t.discoverPage.compareSelected : t.discoverPage.compareSelect}
                          >
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleCompareSite(site.siteKey);
                              }}
                              className={`inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition ${
                                compareSelected
                                  ? "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-sm"
                                  : "border-[var(--border-color)] bg-[var(--card)] text-[var(--muted)] hover:border-[var(--accent)]/25 hover:bg-[var(--accent-soft)]/65 hover:text-[var(--foreground)]"
                              }`}
                              aria-label={compareSelected ? t.discoverPage.compareSelected : t.discoverPage.compareSelect}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                          </InlineHoverTooltip>
                        </div>

                        <div className="min-w-0 self-center py-0.5">
                          <div className="flex items-center gap-2">
                            <InlineHoverTooltip content={site.visitUrl || site.displayUrl} align="start">
                              <span className="max-w-full truncate text-[15px] font-semibold text-[var(--foreground)]">{site.name}</span>
                            </InlineHoverTooltip>
                            <span
                              className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                              style={makeBadgeStyle(getStatusColor(site.displayStatus))}
                            >
                              {getDisplayStatusLabel(site.displayStatus)}
                            </span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleRowExpand(site.siteKey);
                              }}
                              className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--card)] text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
                              title={expanded ? t.discoverPage.collapseAction : t.discoverPage.expandAction}
                              aria-label={expanded ? t.discoverPage.collapseAction : t.discoverPage.expandAction}
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                          </div>
                          <div className="mt-1.5 flex min-h-[42px] flex-wrap content-center gap-1.5 pt-0.5">
                            <span className="soft-tag" style={makeSoftTagStyle(getSiteCategoryColor(site.operationalStatusLabel))}>
                              {getSiteCategoryDisplayLabel(site.operationalStatusLabel)}
                            </span>
                            {recommendationTags.map((tag) => (
                              <span key={tag.key} className="soft-tag" style={makeSoftTagStyle(tag.color)}>
                                {tag.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="min-w-0 self-center py-0.5">
                          <div className="flex min-h-[42px] flex-wrap content-center gap-1.5 overflow-visible py-0.5">
                            {providerTags.length > 0 ? (
                              providerTags.map((tag) => (
                                <span
                                  key={tag.key}
                                  className="soft-tag inline-flex max-w-full items-center"
                                  style={makeSoftTagStyle(tag.color)}
                                >
                                  <ProviderLogoLabel item={tag} />
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[var(--muted)]">{t.common.noData}</span>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 self-center pl-1.5 pr-6 py-0.5">
                          <div className="flex min-h-[42px] flex-wrap content-center justify-start gap-1.5 overflow-visible py-0.5 xl:justify-end">
                            {otherTags.length > 0 ? (
                              otherTags.map((tag) => (
                                <span key={tag.key} className="soft-tag text-[11px]" style={makeSoftTagStyle(tag.color)}>
                                  {tag.label}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-[var(--muted)]">{t.common.noData}</span>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0 self-center justify-self-stretch">
                          <div className="ml-auto w-full max-w-[260px]">
                            <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                              <span className="font-semibold text-[var(--accent-strong)]">
                                {site.hasMonitoring ? buildSevenDayHealthyText(uptimeText, t) : t.discoverPage.unmonitored}
                              </span>
                              <span className="text-[var(--muted)] text-right">
                                {site.hasMonitoring
                                  ? buildAverageLatencyText(averageLatencyText, t)
                                  : t.discoverPage.unmonitored}
                              </span>
                            </div>
                            <Tracker data={trackerData} className="h-3.5 w-full max-w-[260px]" hoverEffect={site.hasMonitoring} />
                          </div>
                        </div>

                        <div className="flex items-center justify-end justify-self-end gap-1">
                          {site.visitUrl ? (
                            <Link
                              href={`/visit/site/${encodeURIComponent(site.siteKey)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-glass shrink-0 whitespace-nowrap px-2.5 py-2"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t.common.visit}
                            </Link>
                          ) : (
                            <span
                              className="btn-glass cursor-not-allowed whitespace-nowrap px-2.5 py-2 opacity-50"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              {t.common.visit}
                            </span>
                          )}
                          <Link
                            href={site.reviewUrl}
                            className="btn-glass btn-glass-primary shrink-0 whitespace-nowrap px-2.5 py-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {t.common.review}
                          </Link>
                        </div>
                      </div>


                    </div>

                    {expanded ? (
                      <div className="px-4 pb-4 pt-0 sm:px-4">
                        <div className="pt-2.5">
                          {site.description ? (
                            <p className="text-sm leading-6 text-[var(--muted)]">{site.description}</p>
                          ) : null}

                          <div className={site.description ? "mt-3" : ""}>
                            <ModelTagCluster
                              site={site}
                              loading={isModelStatusLoading}
                              modelStatusByName={modelStatusByName}
                              messages={t}
                              onPreload={() => loadSiteDetail(site.siteKey)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
