"use client";

import { Suspense, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as HoverCardPrimitives from "@radix-ui/react-hover-card";
import { ArrowLeftRight, ExternalLink, Search, Sparkles } from "lucide-react";
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
  normalizeExternalUrl,
  normalizeProviderFamilyKey,
  type SiteCatalogDiscoverRecord,
} from "@/lib/site-catalog/discover-compare";
import type { SiteCatalogSiteCardView, SiteCatalogSiteDetailView } from "@/lib/site-catalog/types";
import type { SksGridCell, SksModelStatusView } from "@/lib/sks/types";

const t = getMessages();
const FIXED_COLUMN_WIDTH = 320;
const STICKY_LABEL_WIDTH = 180;
const MAX_VISIBLE_COMPARE_COLUMNS = 4;
const COMPARE_SITE_REFRESH_INTERVAL_MS = 15_000;
const COMPARE_SITE_LIST_REFRESH_INTERVAL_MS = 15_000;
const DEFAULT_TAG_COLOR = "#737373";
const LOBE_LIGHT_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/light";
const LOBE_DARK_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/dark";
const PRIORITY_PROVIDER_ORDER = ["anthropic", "openai", "gemini"] as const;

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
type SiteDetail = SiteCatalogSiteDetailView & { recentFailures?: string[] };

interface CompareRow {
  key: string;
  label: string;
  values: Array<ReactNode>;
}

interface SiteTagView {
  key: string;
  label: string;
  color?: string;
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

function parseSelectedKeys(raw: string | null) {
  if (!raw) return [] as string[];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => {
          const trimmed = item.trim();
          if (!trimmed) return "";
          try {
            return decodeURIComponent(trimmed);
          } catch {
            return trimmed;
          }
        })
        .filter(Boolean)
    )
  );
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

function getSiteCategoryColor(label: string) {
  if (label === "新站上线") return "#3b82f6";
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

function buildSiteCategoryTag(site: SiteCatalogDiscoverRecord): SiteTagView {
  return {
    key: `site-category:${site.siteKey}:${site.operationalStatusLabel}`,
    label: site.operationalStatusLabel,
    color: getSiteCategoryColor(site.operationalStatusLabel),
  };
}

function buildRecommendationTags(site: SiteCatalogDiscoverRecord): SiteTagView[] {
  return site.recommendationTags.map((label) => ({
    key: `recommendation:${site.siteKey}:${label}`,
    label,
    color: getRecommendationTagColor(label),
  }));
}

function buildSiteTags(site: SiteCatalogDiscoverRecord) {
  return [buildSiteCategoryTag(site), ...buildRecommendationTags(site)];
}

function buildProviderTags(site: SiteCatalogDiscoverRecord): HomeSiteTag[] {
  const families =
    site.providerFamilies.length > 0
      ? site.providerFamilies
      : [
          ...site.providerLabels.map((label) => normalizeProviderFamilyKey(label)),
          ...site.models.map((modelName) => inferProviderFamilyFromModelName(modelName)),
        ];

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

function buildOtherTags(site: SiteCatalogDiscoverRecord): SiteTagView[] {
  const tags: SiteTagView[] = [];

  if (site.registrationMode === "open") {
    tags.push({
      key: `registration:${site.siteKey}:open`,
      label: t.discoverPage.registrationOpen,
      color: "#10b981",
    });
  } else if (site.registrationMode === "invite") {
    tags.push({
      key: `registration:${site.siteKey}:invite`,
      label: t.discoverPage.registrationInvite,
      color: "#f59e0b",
    });
  } else if (site.registrationMode === "closed") {
    tags.push({
      key: `registration:${site.siteKey}:closed`,
      label: t.discoverPage.registrationClosed,
      color: "#f43f5e",
    });
  } else {
    tags.push({
      key: `registration:${site.siteKey}:unknown`,
      label: t.discoverPage.registrationUnknown,
      color: "#737373",
    });
  }

  if (site.emailVerificationRequired === true) {
    tags.push({
      key: `registration:${site.siteKey}:email-verification`,
      label: t.discoverPage.registrationEmailVerification,
      color: "#6366f1",
    });
  }

  const initialQuotaLabel =
    site.hasInitialQuota === true
      ? t.discoverPage.initialQuotaYes
      : site.hasInitialQuota === false
        ? t.discoverPage.initialQuotaNo
        : t.discoverPage.initialQuotaUnknown;

  tags.push({
    key: `initial-quota:${site.siteKey}`,
    label: initialQuotaLabel,
    color: site.hasInitialQuota === true ? "#8b5cf6" : undefined,
  });

  return tags;
}

function renderSimpleTagList(tags: SiteTagView[]) {
  if (tags.length === 0) {
    return <span className="text-sm text-[var(--muted)]">{t.common.noData}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span key={tag.key} className="soft-tag" style={makeSoftTagStyle(tag.color)}>
          {tag.label}
        </span>
      ))}
    </div>
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

function renderProviderTagList(tags: HomeSiteTag[]) {
  if (tags.length === 0) {
    return <span className="text-sm text-[var(--muted)]">{t.common.noData}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag.key}
          className="soft-tag inline-flex max-w-full items-center"
          style={makeSoftTagStyle(tag.color)}
        >
          <ProviderLogoLabel item={tag} />
        </span>
      ))}
    </div>
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

function renderModelTagList({
  site,
  loading,
  modelStatusByName,
  onPreload,
}: {
  site: SiteCatalogDiscoverRecord;
  loading: boolean;
  modelStatusByName: Map<string, SksModelStatusView>;
  onPreload: () => void;
}) {
  const modelTags = buildModelTags(site);

  if (modelTags.length === 0) {
    return <span className="text-sm text-[var(--muted)]">{t.common.noData}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2.5" onMouseEnter={onPreload}>
      {modelTags.map((model) => (
        <ModelStatusHoverCard
          key={model.key}
          model={model}
          modelStatus={modelStatusByName.get(model.label)}
          loading={loading}
          messages={t}
          onPreload={onPreload}
        />
      ))}
    </div>
  );
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<SiteCatalogDiscoverRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableWidth, setTableWidth] = useState(0);
  const [siteDetails, setSiteDetails] = useState<Record<string, SiteDetail | null | undefined>>({});
  const [siteDetailLoading, setSiteDetailLoading] = useState<Record<string, boolean>>({});
  const [siteDetailFetchedAt, setSiteDetailFetchedAt] = useState<Record<string, number>>({});

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    const requestSites = async () => {
      try {
        const response = await fetch("/api/sites", { cache: "no-store" });
        const result: SitesApiResponse = await response.json();

        if (!disposed && result.success && Array.isArray(result.data)) {
          setSites(result.data.map((site) => adaptSiteCatalogRecord(site)));
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
    const intervalId = window.setInterval(requestSites, COMPARE_SITE_LIST_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedKeys = useMemo(() => parseSelectedKeys(searchParams.get("keys")), [searchParams]);

  const comparedSites = useMemo(() => {
    const orderMap = new Map(selectedKeys.map((key, index) => [key, index]));
    return sites
      .filter((site) => orderMap.has(site.siteKey))
      .sort((a, b) => (orderMap.get(a.siteKey) ?? 0) - (orderMap.get(b.siteKey) ?? 0));
  }, [sites, selectedKeys]);

  const loadSiteDetail = useCallback(
    (siteKey: string) => {
      if (siteDetailLoading[siteKey]) return;

      const lastFetchedAt = siteDetailFetchedAt[siteKey] || 0;
      const hasFreshCache =
        siteDetails[siteKey] !== undefined && Date.now() - lastFetchedAt < COMPARE_SITE_REFRESH_INTERVAL_MS;

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
    },
    [siteDetails, siteDetailFetchedAt, siteDetailLoading]
  );

  useEffect(() => {
    comparedSites.forEach((site) => {
      loadSiteDetail(site.siteKey);
    });
  }, [comparedSites, loadSiteDetail]);

  const compareRows = useMemo<CompareRow[]>(() => {
    if (comparedSites.length === 0) return [];

    return [
      {
        key: "website-name",
        label: t.discoverPage.compareWebsiteName,
        values: comparedSites.map((site) => {
          const externalUrl = site.visitUrl || normalizeExternalUrl(site.displayUrl);

          return (
            <div key={site.siteKey} className="space-y-3">
              <div className="text-base font-semibold leading-7 text-[var(--foreground)]">{site.name}</div>
              <div className="text-xs text-[var(--muted)]">
                <span className="mr-1 font-medium">网址：</span>
                {externalUrl ? (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 text-[var(--accent-strong)] hover:underline"
                  >
                    <span className="break-all">{site.displayUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="break-all">{site.displayUrl || t.common.noData}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {site.visitUrl ? (
                  <a href={site.visitUrl} className="btn-glass" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.common.visit}
                  </a>
                ) : (
                  <span className="btn-glass cursor-not-allowed opacity-50">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t.common.visit}
                  </span>
                )}
                <Link href={site.reviewUrl} className="btn-glass btn-glass-primary">
                  {t.common.review}
                </Link>
              </div>
            </div>
          );
        }),
      },
      {
        key: "status",
        label: t.discoverPage.compareCurrentStatus,
        values: comparedSites.map((site) => (
          <span
            key={site.siteKey}
            className="soft-tag inline-flex font-medium"
            style={makeBadgeStyle(getStatusColor(site.displayStatus))}
          >
            {getDisplayStatusLabel(site.displayStatus)}
          </span>
        )),
      },
      {
        key: "site-tags",
        label: t.discoverPage.filterSiteTag,
        values: comparedSites.map((site) => <div key={site.siteKey}>{renderSimpleTagList(buildSiteTags(site))}</div>),
      },
      {
        key: "uptime",
        label: t.discoverPage.tableUptime,
        values: comparedSites.map((site) => {
          const trackerData = site.hasMonitoring
            ? gridToTrackerData(site.trackerGrid, t.common.noData, t.common.connectionFailed, 24)
            : generateGreyTrackerData(t.common.monitoringDisabled, 24);
          const uptimeText =
            typeof site.uptimeRate === "number" ? `${site.uptimeRate.toFixed(1)}%` : t.common.noData;
          const averageLatencyText = formatLatencyText(
            computeAverageLatency(site.trackerGrid, 24) ?? site.currentLatencyMs
          );

          return (
            <div key={site.siteKey} className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[var(--accent-strong)]">
                  {site.hasMonitoring ? buildSevenDayHealthyText(uptimeText, t) : t.discoverPage.unmonitored}
                </span>
                <span className="text-[var(--muted)]">
                  {site.hasMonitoring ? buildAverageLatencyText(averageLatencyText, t) : t.discoverPage.unmonitored}
                </span>
              </div>
              <Tracker data={trackerData} className="h-4" hoverEffect={site.hasMonitoring} />
            </div>
          );
        }),
      },
      {
        key: "providers",
        label: t.discoverPage.tableProviderFamilies,
        values: comparedSites.map((site) => (
          <div key={site.siteKey}>{renderProviderTagList(buildProviderTags(site))}</div>
        )),
      },
      {
        key: "models",
        label: t.discoverPage.tableModels,
        values: comparedSites.map((site) => {
          const siteDetail = siteDetails[site.siteKey];
          const modelStatusByName = new Map(
            (siteDetail?.sksDetail?.modelStatuses || []).map((model) => [model.modelName, model])
          );
          const isModelStatusLoading = Boolean(siteDetailLoading[site.siteKey]);

          return (
            <div key={site.siteKey}>
              {renderModelTagList({
                site,
                loading: isModelStatusLoading,
                modelStatusByName,
                onPreload: () => loadSiteDetail(site.siteKey),
              })}
            </div>
          );
        }),
      },
      {
        key: "other-tags",
        label: t.discoverPage.tableOtherTags,
        values: comparedSites.map((site) => <div key={site.siteKey}>{renderSimpleTagList(buildOtherTags(site))}</div>),
      },
    ];
  }, [comparedSites, loadSiteDetail, siteDetails, siteDetailLoading]);

  const conclusionItems = useMemo(() => {
    if (comparedSites.length < 2) return [] as string[];

    const items: string[] = [];

    const uptimeWinner = [...comparedSites]
      .filter((site) => typeof site.uptimeRate === "number")
      .sort((a, b) => (b.uptimeRate ?? -1) - (a.uptimeRate ?? -1))[0];

    const latencyWinner = [...comparedSites]
      .map((site) => ({ site, latency: getComparableLatency(site) }))
      .filter((item): item is { site: SiteCatalogDiscoverRecord; latency: number } => typeof item.latency === "number")
      .sort((a, b) => a.latency - b.latency)[0];

    if (uptimeWinner) {
      items.push(
        `${t.discoverPage.compareConclusionBestUptime}${uptimeWinner.name} (${uptimeWinner.uptimeRate?.toFixed(1)}%)`
      );
    }

    if (latencyWinner) {
      items.push(
        `${t.discoverPage.compareConclusionBestLatency}${latencyWinner.site.name} (${latencyWinner.latency}ms)`
      );
    }

    return items;
  }, [comparedSites]);

  useEffect(() => {
    if (!tableRef.current) return;
    const updateWidth = () => setTableWidth(tableRef.current?.scrollWidth || 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [compareRows, comparedSites.length]);

  const syncScroll = useCallback((source: "top" | "bottom") => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    const top = topScrollRef.current;
    const bottom = bottomScrollRef.current;
    if (source === "top" && top && bottom) bottom.scrollLeft = top.scrollLeft;
    if (source === "bottom" && top && bottom) top.scrollLeft = bottom.scrollLeft;
    window.requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const requestedSelectionCount = selectedKeys.length;
  const hasSelection = comparedSites.length > 0;
  const waitingForSelectedSites = requestedSelectionCount > 0 && !hasSelection && (loading || sites.length === 0);
  const hasHorizontalOverflow = comparedSites.length > MAX_VISIBLE_COMPARE_COLUMNS;
  const tableMinWidth = STICKY_LABEL_WIDTH + comparedSites.length * FIXED_COLUMN_WIDTH;
  const stretchedColumnWidth = `calc((100% - ${STICKY_LABEL_WIDTH}px) / ${Math.max(comparedSites.length, 1)})`;
  const tableStyle = hasHorizontalOverflow
    ? { minWidth: tableMinWidth, width: tableMinWidth }
    : { minWidth: "100%", width: "100%" };
  const valueColumnStyle = hasHorizontalOverflow
    ? { minWidth: FIXED_COLUMN_WIDTH, width: FIXED_COLUMN_WIDTH }
    : { minWidth: stretchedColumnWidth, width: stretchedColumnWidth };

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {t.discoverPage.compareBadge}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.discoverPage.compareTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {t.discoverPage.compareDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover" className="btn-glass">
              <Search className="h-4 w-4" />
              {t.discoverPage.backToDiscover}
            </Link>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-5">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">{t.discoverPage.compareTableTitle}</h3>
            <span className="text-sm font-semibold text-[var(--accent-strong)]">{comparedSites.length}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">{t.discoverPage.compareTableDescription}</p>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
        ) : waitingForSelectedSites ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">
            <p>正在载入你选中的站点，请稍候…</p>
          </div>
        ) : !hasSelection ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">
            <p>{t.discoverPage.compareEmpty}</p>
            <div className="mt-4">
              <Link href="/discover" className="btn-glass btn-glass-primary">
                {t.discoverPage.goSelectPlatforms}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            {hasHorizontalOverflow ? (
              <div
                ref={topScrollRef}
                className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[color:var(--background)]/55"
                onScroll={() => syncScroll("top")}
                aria-label={t.discoverPage.compareTopScrollbar}
              >
                <div style={{ width: Math.max(tableWidth, tableMinWidth), height: 16 }} />
              </div>
            ) : null}

            <div
              ref={bottomScrollRef}
              className={`rounded-2xl border border-[var(--border-color)] ${
                hasHorizontalOverflow ? "overflow-x-auto" : "overflow-hidden"
              }`}
              onScroll={() => {
                if (hasHorizontalOverflow) syncScroll("bottom");
              }}
            >
              <table ref={tableRef} className="table-fixed text-sm" style={tableStyle}>
                <tbody>
                  {compareRows.map((row, rowIndex) => (
                    <tr
                      key={row.key}
                      className={`border-b border-[var(--border-color)] align-top ${
                        rowIndex % 2 === 0 ? "bg-[color:var(--background)]/20" : "bg-transparent"
                      }`}
                    >
                      <th
                        className="sticky left-0 z-10 border-r border-[var(--border-color)] bg-[var(--card)] px-4 py-4 text-left font-semibold"
                        style={{ width: STICKY_LABEL_WIDTH, minWidth: STICKY_LABEL_WIDTH }}
                      >
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.key}-${index}`}
                          className="border-r border-[var(--border-color)] px-4 py-4 align-top leading-7 last:border-r-0"
                          style={valueColumnStyle}
                        >
                          {typeof value === "string" ? <span>{value}</span> : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-[var(--accent-soft)]/25 align-top">
                    <th
                      className="sticky left-0 z-10 border-r border-[var(--border-color)] bg-[var(--card)] px-4 py-4 text-left font-semibold"
                      style={{ width: STICKY_LABEL_WIDTH, minWidth: STICKY_LABEL_WIDTH }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />
                        {t.discoverPage.compareConclusionRow}
                      </span>
                    </th>
                    <td className="px-4 py-4 leading-7" colSpan={Math.max(comparedSites.length, 1)}>
                      {conclusionItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {conclusionItems.map((item) => (
                            <span key={item} className="soft-tag">
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--muted)]">{t.discoverPage.compareConclusionFallback}</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ComparePageFallback() {
  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {t.discoverPage.compareBadge}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.discoverPage.compareTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {t.discoverPage.compareDescription}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/discover" className="btn-glass">
              <Search className="h-4 w-4" />
              {t.discoverPage.backToDiscover}
            </Link>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
      </section>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<ComparePageFallback />}>
      <ComparePageContent />
    </Suspense>
  );
}
