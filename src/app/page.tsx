"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ExternalLink, MessageSquare, Search, Sparkles } from "lucide-react";
import { Tracker, type TrackerBlockProps } from "@/components/Tracker";
import { getMessages } from "@/lib/i18n";

interface Platform {
  id: number;
  slug: string;
  reviewTopicId: number | null;
  name: string;
  url: string;
  visitUrl?: string;
  visitCount?: number;
  tag: "premium" | "free" | "stable" | "dead";
  tagLabel: string;
  billingRate: string;
  billingColor: string;
  models: string[];
  description: string;
  sortOrder: number;
  status: string;
  monitorEnabled?: boolean;
  uptime?: number;
}

interface ConnectivityLog {
  id: number;
  platformId: number;
  success: boolean;
  latency: number;
  errorMessage: string;
  checkedAt: string;
}

interface ConnectivitySummary {
  uptime: number;
  avgLatency: number;
  totalChecks: number;
  lastCheck: string | null;
}

interface ConnectivityData {
  [platformId: number]: {
    logs: ConnectivityLog[];
    summary: ConnectivitySummary;
  };
}

interface AttributeGroup {
  id: string;
  key: string;
  label: string;
  boundField?: "none" | "site_tag" | "featured_models";
}

interface AttributeOption {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color?: string;
}

interface AttributeValue {
  id: number;
  platformId: number;
  groupKey: string;
  optionValue: string;
}

interface PlatformConfigData {
  groups: AttributeGroup[];
  options: AttributeOption[];
  values: AttributeValue[];
}

const DEFAULT_TAG_COLOR = "#737373";

function makeSoftTagStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}1A`, borderColor: `${safeColor}33` };
}

function makeBadgeStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}14`, borderColor: `${safeColor}33` };
}

function logsToTrackerData(logs: ConnectivityLog[], nodeCount: number = 20): TrackerBlockProps[] {
  const recentLogs = logs.slice(-nodeCount);
  const emptyCount = Math.max(0, nodeCount - recentLogs.length);
  return [
    ...Array.from({ length: emptyCount }, () => ({ color: "bg-slate-300/80 dark:bg-slate-700/80", tooltip: getMessages().common.noData })),
    ...recentLogs.map((log) => ({
      color: log.success ? (log.latency > 1500 ? "bg-amber-400" : "bg-emerald-500") : "bg-rose-500",
      tooltip: log.success ? `${new Date(log.checkedAt + "Z").toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · ${log.latency}ms` : `${new Date(log.checkedAt + "Z").toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · ${log.errorMessage || getMessages().common.connectionFailed}`,
    })),
  ];
}

function generateGreyTrackerData(nodeCount: number = 20): TrackerBlockProps[] {
  return Array.from({ length: nodeCount }, () => ({ color: "bg-slate-200 dark:bg-slate-700/70", tooltip: getMessages().common.monitoringDisabled }));
}

function getBadgeClass(tag: Platform["tag"]) {
  if (tag === "premium") return "badge badge-premium";
  if (tag === "free") return "badge badge-free";
  if (tag === "dead") return "badge badge-dead";
  return "badge badge-stable";
}

export default function Home() {
  const t = getMessages();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [config, setConfig] = useState<PlatformConfigData>({ groups: [], options: [], values: [] });
  const [connectivity, setConnectivity] = useState<ConnectivityData>({});
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([fetch("/api/platforms"), fetch("/api/platforms/config")])
      .then(async ([platformRes, configRes]) => {
        const platformData = await platformRes.json();
        const configData = await configRes.json();
        if (platformData.success) setPlatforms(platformData.data);
        if (configData.success) setConfig(configData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchConnectivity = () => {
      fetch("/api/connectivity")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setConnectivity(data.data);
        })
        .catch(console.error);
    };

    fetchConnectivity();
    const interval = setInterval(fetchConnectivity, 60000);
    return () => clearInterval(interval);
  }, []);

  const optionMap = useMemo(() => {
    return config.options.reduce<Record<string, AttributeOption>>((acc, option) => {
      acc[`${option.groupKey}:${option.value}`] = option;
      return acc;
    }, {});
  }, [config.options]);

  const hiddenGroupKeys = useMemo(
    () => new Set(config.groups.filter((group) => group.boundField && group.boundField !== "none").map((group) => group.key)),
    [config.groups]
  );

  const siteTagGroup = useMemo(
    () => config.groups.find((group) => group.boundField === "site_tag"),
    [config.groups]
  );

  const featuredModelsGroup = useMemo(
    () => config.groups.find((group) => group.boundField === "featured_models"),
    [config.groups]
  );

  const getOtherTags = useCallback((platformId: number) => {
    return config.values
      .filter((value) => value.platformId === platformId && !hiddenGroupKeys.has(value.groupKey))
      .map((value) => {
        const option = optionMap[`${value.groupKey}:${value.optionValue}`];
        return {
          key: `${value.groupKey}:${value.optionValue}`,
          label: option?.label || value.optionValue,
          color: option?.color,
        };
      });
  }, [config.values, hiddenGroupKeys, optionMap]);

  const getSiteTagOption = (platformId: number) => {
    if (!siteTagGroup) return null;
    const value = config.values.find((item) => item.platformId === platformId && item.groupKey === siteTagGroup.key);
    if (!value) return null;
    return optionMap[`${value.groupKey}:${value.optionValue}`] || null;
  };

  const getFeaturedModels = (platform: Platform) => {
    if (!featuredModelsGroup) {
      return platform.models.map((model) => ({
        key: model,
        label: model,
        color: undefined as string | undefined,
      }));
    }

    const values = config.values.filter((item) => item.platformId === platform.id && item.groupKey === featuredModelsGroup.key);
    const models = values
      .map((item) => {
        const option = optionMap[`${item.groupKey}:${item.optionValue}`];
        return {
          key: `${item.groupKey}:${item.optionValue}`,
          label: option?.label || item.optionValue,
          color: option?.color,
        };
      })
      .filter((item) => item.label);

    return models.length > 0
      ? models
      : platform.models.map((model) => ({
          key: model,
          label: model,
          color: undefined as string | undefined,
        }));
  };

  const filteredPlatforms = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return platforms
      .filter((platform) => {
        const dynamicTexts = getOtherTags(platform.id).map((item) => item.label);
        if (!normalizedKeyword) return true;
        return [platform.name, platform.url, platform.description, platform.tagLabel, ...platform.models, ...dynamicTexts]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword);
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 8);
  }, [keyword, platforms, getOtherTags]);

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
            filteredPlatforms.map((platform) => {
              const otherTags = getOtherTags(platform.id);
              const visibleTags = otherTags;
              const hiddenTagCount = 0;
              const featuredModels = getFeaturedModels(platform);
              const siteTagOption = getSiteTagOption(platform.id);
              const connData = connectivity[platform.id];
              const effectiveUptime = connData?.summary.totalChecks ? connData.summary.uptime : (platform.uptime || 0);
              const trackerData = platform.monitorEnabled
                ? connData
                  ? logsToTrackerData(connData.logs, 24)
                  : logsToTrackerData([], 24)
                : generateGreyTrackerData(24);
              const expanded = !!expandedCards[platform.id];

              return (
                <article
                  key={platform.id}
                  className="home-featured-card flex h-auto cursor-pointer flex-col rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-sm transition-all duration-200"
                  onClick={() => setExpandedCards((prev) => ({ ...prev, [platform.id]: !prev[platform.id] }))}
                  data-expanded={expanded}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex items-center gap-2">
                          <h4 className="truncate text-base font-semibold">{platform.name}</h4>
                          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--card)]/80 text-[var(--muted)]">
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                          </span>
                        </div>
                        <span className={`${getBadgeClass(platform.tag)} shrink-0`} style={makeBadgeStyle(siteTagOption?.color)}>{siteTagOption?.label || platform.tagLabel}</span>
                      </div>
                      {expanded ? <p className="mt-1 truncate text-xs text-[var(--muted)]">{platform.url}</p> : null}
                    </div>
                  </div>

                  <div className="mt-3 flex items-start justify-between gap-3">
                    <p className={`min-w-0 flex-1 text-sm leading-6 text-[var(--muted)] ${expanded ? "line-clamp-2" : "line-clamp-1"}`}>{platform.description}</p>
                    <span className={`shrink-0 text-sm font-semibold ${platform.billingColor}`}>{platform.billingRate}</span>
                  </div>

                  {expanded ? (
                    <div className="mt-4">
                      <div className="flex min-h-[32px] flex-wrap content-start gap-1.5">
                        {featuredModels.map((model) => (
                          <span key={model.key} className="soft-tag" style={makeSoftTagStyle(model.color)}>{model.label}</span>
                        ))}
                      </div>
                      <div className="mt-2 flex min-h-[24px] flex-wrap content-start gap-1.5 pr-2">
                        {visibleTags.map((tag) => (
                          <span key={tag.key} className="soft-tag" style={makeSoftTagStyle(tag.color)}>{tag.label}</span>
                        ))}
                        {hiddenTagCount > 0 && <span className="soft-tag soft-tag-muted">…</span>}
                      </div>
                    </div>
                  ) : null}

                  <div className={`mt-auto flex flex-wrap items-end gap-3 ${expanded ? "pt-4" : "pt-5"}`}>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--accent-strong)]">{effectiveUptime}%</span>
                        <span className="text-[var(--muted)]">{t.home.uptime}</span>
                      </div>
                      <Tracker data={trackerData} className="h-4" hoverEffect={!!platform.monitorEnabled} />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/visit/${platform.id}`}
                        className="btn-glass"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t.common.visit}
                      </Link>
                      <Link href={`/review/${platform.id}`} className="btn-glass" onClick={(e) => e.stopPropagation()}>
                        <MessageSquare className="h-3.5 w-3.5" />
                        {t.common.review}
                      </Link>
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
