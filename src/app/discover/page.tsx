"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Gauge, Settings2 } from "lucide-react";
import { Tracker, type TrackerBlockProps } from "@/components/Tracker";
import { getMessages } from "@/lib/i18n";

interface Platform {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  monitorEnabled: boolean;
  tag: "premium" | "free" | "stable" | "dead";
  tagLabel: string;
  billingRate: string;
  billingColor: string;
  models: string[];
  uptime: number;
  latency: number;
  joinDate: string;
  description: string;
  sortOrder: number;
  status: string;
}

interface ConnectivityLog {
  id: number;
  platformId: string;
  success: boolean;
  latency: number;
  errorMessage: string;
  checkedAt: string;
}

interface ConnectivitySummary {
  uptime: number;
  avgLatency: number;
  lastCheck: string | null;
  totalChecks: number;
}

interface ConnectivityData {
  [platformId: string]: {
    logs: ConnectivityLog[];
    summary: ConnectivitySummary;
  };
}

interface AttributeGroup {
  id: string;
  key: string;
  label: string;
  inputType: string;
  enabled: boolean;
  isFilterable?: boolean;
  isComparable?: boolean;
  isVisibleByDefault?: boolean;
  sortOrder?: number;
  boundField?: "none" | "site_tag" | "featured_models";
}

interface AttributeOption {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color?: string;
  enabled: boolean;
  sortOrder?: number;
}

interface AttributeValue {
  id: number;
  platformId: string;
  groupKey: string;
  optionValue: string;
  valueText: string;
}

interface PlatformConfigData {
  groups: AttributeGroup[];
  options: AttributeOption[];
  values: AttributeValue[];
  models: Array<{ id: string; key: string; name: string; vendor: string; featured: boolean }>;
}

const t = getMessages();
const DEFAULT_TAG_COLOR = "#737373";

function makeSoftTagStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}1A`, borderColor: `${safeColor}33` };
}

function makeBadgeStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}14`, borderColor: `${safeColor}33` };
}

function logsToTrackerData(logs: ConnectivityLog[], nodeCount: number = 24): TrackerBlockProps[] {
  const data: TrackerBlockProps[] = [];
  const recentLogs = logs.slice(-nodeCount);
  const emptyCount = Math.max(0, nodeCount - recentLogs.length);

  for (let i = 0; i < emptyCount; i++) {
    data.push({ color: "bg-slate-300/80 dark:bg-slate-700/80", tooltip: getMessages().common.noData });
  }

  for (const log of recentLogs) {
    const time = new Date(log.checkedAt + "Z").toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    data.push({
      color: log.success ? (log.latency > 1500 ? "bg-amber-400" : "bg-emerald-500") : "bg-rose-500",
      tooltip: log.success ? `${time} · ${log.latency}ms` : `${time} · ${log.errorMessage || getMessages().common.connectionFailed}`,
    });
  }

  return data;
}

function generateGreyTrackerData(nodeCount: number = 24): TrackerBlockProps[] {
  return Array.from({ length: nodeCount }, () => ({
    color: "bg-slate-200 dark:bg-slate-700/70",
    tooltip: getMessages().common.monitoringDisabled,
  }));
}

function getBadgeClass(tag: Platform["tag"]) {
  if (tag === "premium") return "badge badge-premium";
  if (tag === "free") return "badge badge-free";
  if (tag === "dead") return "badge badge-dead";
  return "badge badge-stable";
}

function clampTags<T>(items: T[], max: number) {
  if (items.length <= max) return { visible: items, hiddenCount: 0 };
  return { visible: items.slice(0, max), hiddenCount: items.length - max };
}

export default function DiscoverPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connectivity, setConnectivity] = useState<ConnectivityData>({});
  const [config, setConfig] = useState<PlatformConfigData>({ groups: [], options: [], values: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [monitoredOnly, setMonitoredOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "uptime" | "latency" | "billing">("default");
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

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

  const filterableGroups = useMemo(
    () => config.groups.filter((group) => group.enabled && group.isFilterable),
    [config.groups]
  );

  const valuesByPlatform = useMemo(() => {
    return config.values.reduce<Record<string, AttributeValue[]>>((acc, value) => {
      acc[value.platformId] ??= [];
      acc[value.platformId].push(value);
      return acc;
    }, {});
  }, [config.values]);

  const optionMap = useMemo(() => {
    return config.options.reduce<Record<string, AttributeOption>>((acc, option) => {
      acc[`${option.groupKey}:${option.value}`] = option;
      return acc;
    }, {});
  }, [config.options]);

  const boundGroupKeys = useMemo(
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

  const resetFilters = () => {
    setKeyword("");
    setMonitoredOnly(false);
    setSortBy("default");
    setSelectedFilters({});
  };

  const toggleFilterValue = (groupKey: string, value: string) => {
    setSelectedFilters((prev) => {
      const current = prev[groupKey] || [];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [groupKey]: next };
    });
  };

  const getEffectiveUptime = useCallback((platform: Platform) => {
    const summary = connectivity[platform.id]?.summary;
    return summary && summary.totalChecks > 0 ? summary.uptime : platform.uptime;
  }, [connectivity]);

  const getEffectiveLatency = useCallback((platform: Platform) => {
    const summary = connectivity[platform.id]?.summary;
    return summary && summary.totalChecks > 0 ? summary.avgLatency : platform.latency;
  }, [connectivity]);

  const getPlatformValues = useCallback((platformId: string, includeBound = true) => {
    const values = valuesByPlatform[platformId] || [];
    return values
      .filter((item) => (includeBound ? true : !boundGroupKeys.has(item.groupKey)))
      .map((item) => {
        const group = config.groups.find((entry) => entry.key === item.groupKey);
        const option = optionMap[`${item.groupKey}:${item.optionValue}`];
        return {
          key: `${item.groupKey}:${item.optionValue}`,
          label: option?.label || item.optionValue,
          color: option?.color,
          groupLabel: group?.label || item.groupKey,
        };
      });
  }, [valuesByPlatform, boundGroupKeys, config.groups, optionMap]);

  const getSiteTagOption = (platformId: string) => {
    if (!siteTagGroup) return null;
    const value = (valuesByPlatform[platformId] || []).find((item) => item.groupKey === siteTagGroup.key);
    if (!value) return null;
    return optionMap[`${value.groupKey}:${value.optionValue}`] || null;
  };

  const getFeaturedModels = (platform: Platform) => {
    if (!featuredModelsGroup) return platform.models;
    const values = (valuesByPlatform[platform.id] || []).filter((item) => item.groupKey === featuredModelsGroup.key);
    const labels = values
      .map((item) => optionMap[`${item.groupKey}:${item.optionValue}`]?.label || item.optionValue)
      .filter(Boolean);
    return labels.length > 0 ? labels : platform.models;
  };

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredPlatforms = useMemo(() => {
    return platforms
      .filter((platform) => {
        if (monitoredOnly && !platform.monitorEnabled) return false;

        const platformValues = valuesByPlatform[platform.id] || [];
        const matchesDynamicFilters = filterableGroups.every((group) => {
          const selected = selectedFilters[group.key] || [];
          if (selected.length === 0) return true;
          const ownValues = platformValues
            .filter((item) => item.groupKey === group.key)
            .map((item) => item.optionValue)
            .filter(Boolean);
          return selected.some((value) => ownValues.includes(value));
        });
        if (!matchesDynamicFilters) return false;

        if (!normalizedKeyword) return true;
        const dynamicTexts = getPlatformValues(platform.id).map((item) => item.label);
        const haystack = [platform.name, platform.url, platform.description, platform.tagLabel, ...platform.models, ...dynamicTexts]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedKeyword);
      })
      .sort((a, b) => {
        if (sortBy === "uptime") return getEffectiveUptime(b) - getEffectiveUptime(a);
        if (sortBy === "latency") return getEffectiveLatency(a) - getEffectiveLatency(b);
        if (sortBy === "billing") return a.billingRate.localeCompare(b.billingRate);
        return a.sortOrder - b.sortOrder;
      });
  }, [platforms, monitoredOnly, filterableGroups, selectedFilters, normalizedKeyword, sortBy, valuesByPlatform, getPlatformValues, getEffectiveLatency, getEffectiveUptime]);

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {t.admin.searchWorkbench}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.home.searchTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">{t.home.searchDescription}</p>
          </div>
          <Link href="/admin" className="btn-glass">
            <Settings2 className="h-4 w-4" />
            {t.discoverPage.configureAdmin}
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_240px_220px]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t.home.keyword}</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t.home.keywordPlaceholder} className="admin-input" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t.home.sortBy}</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="admin-input">
              <option value="default">{t.home.sortByOrder}</option>
              <option value="uptime">{t.home.sortByUptime}</option>
              <option value="latency">{t.home.sortByLatency}</option>
              <option value="billing">{t.home.sortByBilling}</option>
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{t.discoverPage.monitoringFilter}</span>
            <button type="button" onClick={() => setMonitoredOnly((v) => !v)} className={`admin-input flex w-full items-center justify-center text-center whitespace-nowrap ${monitoredOnly ? "border-emerald-500/40 text-emerald-500" : ""}`}>
              <span>{t.home.monitorOnly}</span>
            </button>
          </div>
        </div>

        {filterableGroups.length > 0 && (
          <div className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--card)]/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t.discoverPage.advancedFilterTitle}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{t.discoverPage.advancedFilterDescription}</p>
              </div>
              <button type="button" onClick={resetFilters} className="btn-glass">{t.discoverPage.resetFilters}</button>
            </div>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              {filterableGroups.map((group) => {
                const options = config.options.filter((option) => option.groupKey === group.key && option.enabled);
                return (
                  <div key={group.id} className="min-w-[220px] flex-1 space-y-2">
                    <p className="text-xs font-semibold text-[var(--muted)]">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const active = (selectedFilters[group.key] || []).includes(option.value);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleFilterValue(group.key, option.value)}
                            className={`soft-tag transition ${active ? "ring-2 ring-[var(--accent)]/20" : "opacity-90 hover:opacity-100"}`}
                            style={makeSoftTagStyle(option.color)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-5">
          <div className="flex items-center gap-3">
            <Gauge className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">{t.home.resultTitle}</h3>
            <span className="text-sm font-semibold text-[var(--accent-strong)]">{filteredPlatforms.length}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">{t.home.resultDescription}</p>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
          ) : filteredPlatforms.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{t.home.empty}</div>
          ) : (
            <table className="min-w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="w-[230px] px-5 py-4">{t.discoverPage.tablePlatform}</th>
                  <th className="w-[86px] px-3 py-4">{t.discoverPage.tableBilling}</th>
                  <th className="w-[190px] px-3 py-4">{t.discoverPage.tableModels}</th>
                  <th className="w-[380px] px-3 py-4">{t.discoverPage.tableOtherTags}</th>
                  <th className="w-[220px] px-3 py-4">{t.discoverPage.tableUptime}</th>
                  <th className="w-[144px] px-5 py-4 text-right">{t.discoverPage.tableActions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlatforms.map((platform) => {
                  const connData = connectivity[platform.id];
                  const trackerData = platform.monitorEnabled
                    ? connData
                      ? logsToTrackerData(connData.logs, 24)
                      : logsToTrackerData([], 24)
                    : generateGreyTrackerData(24);
                  const effectiveUptime = getEffectiveUptime(platform);
                  const effectiveLatency = getEffectiveLatency(platform);
                  const featuredModels = clampTags(getFeaturedModels(platform), 4);
                  const otherTags = clampTags(getPlatformValues(platform.id, false), 8);
                  const siteTagOption = getSiteTagOption(platform.id);

                  return (
                    <tr key={platform.id} className="table-row-hover border-b border-[var(--border-color)] last:border-b-0">
                      <td className="px-5 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{platform.name}</span>
                            <span className={getBadgeClass(platform.tag)} style={makeBadgeStyle(siteTagOption?.color)}>{siteTagOption?.label || platform.tagLabel}</span>
                          </div>
                          <p className="text-xs text-[var(--muted)]">{platform.url}</p>
                          <p className="line-clamp-2 text-xs text-[var(--muted)]">{platform.description}</p>
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <span className={`text-sm font-semibold ${platform.billingColor}`}>{platform.billingRate}</span>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="flex min-h-[60px] flex-wrap content-start gap-1.5 overflow-hidden">
                          {featuredModels.visible.map((model) => (
                            <span key={model} className="soft-tag">{model}</span>
                          ))}
                          {featuredModels.hiddenCount > 0 && <span className="soft-tag soft-tag-muted">…</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="flex min-h-[60px] flex-wrap content-start gap-1.5 overflow-hidden">
                          {otherTags.visible.map((item) => (
                            <span key={item.key} className="soft-tag" style={makeSoftTagStyle(item.color)}>
                              {item.label}
                            </span>
                          ))}
                          {otherTags.hiddenCount > 0 && <span className="soft-tag soft-tag-muted ml-auto">…</span>}
                        </div>
                      </td>
                      <td className="px-3 py-4 align-top">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[var(--accent-strong)]">{effectiveUptime}%</span>
                            <span className="text-[var(--muted)]">{platform.monitorEnabled ? `${Math.round(effectiveLatency)}ms` : t.discoverPage.unmonitored}</span>
                          </div>
                          <Tracker data={trackerData} className="h-5" hoverEffect={platform.monitorEnabled} />
                        </div>
                      </td>
                      <td className="px-5 py-4 align-top text-right">
                        <div className="flex justify-end gap-2">
                          <a href={`https://${platform.url}`} target="_blank" rel="noreferrer" className="btn-glass">
                            <ExternalLink className="h-3.5 w-3.5" />{t.common.visit}
                          </a>
                          <Link href={`/forum/tag/${platform.id}`} className="btn-glass btn-glass-primary">{t.common.review}</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
