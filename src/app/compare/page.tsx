"use client";

import { Suspense, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, ExternalLink, Search, Sparkles } from "lucide-react";
import { getMessages } from "@/lib/i18n";
import {
  type AttributeOption,
  type AttributeValue,
  type ConnectivityData,
  type Platform,
  type PlatformConfigData,
  getBadgeClass,
  makeBadgeStyle,
  makeSoftTagStyle,
  normalizeExternalUrl,
  parseBillingRateValue,
} from "@/lib/discover-compare";

const t = getMessages();
const MIN_COLUMN_WIDTH = 280;
const STICKY_LABEL_WIDTH = 220;

interface CompareRow {
  key: string;
  label: string;
  values: Array<ReactNode>;
}

function formatDateText(value?: string | null) {
  if (!value) return t.common.noData;
  return value;
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [connectivity, setConnectivity] = useState<ConnectivityData>({});
  const [config, setConfig] = useState<PlatformConfigData>({ groups: [], options: [], values: [], models: [] });
  const [loading, setLoading] = useState(true);
  const [tableWidth, setTableWidth] = useState(0);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    Promise.all([fetch("/api/platforms"), fetch("/api/platforms/config"), fetch("/api/connectivity")])
      .then(async ([platformRes, configRes, connectivityRes]) => {
        const platformData = await platformRes.json();
        const configData = await configRes.json();
        const connectivityData = await connectivityRes.json();
        if (platformData.success) setPlatforms(platformData.data);
        if (configData.success) setConfig(configData.data);
        if (connectivityData.success) setConnectivity(connectivityData.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedIds = useMemo(() => {
    const raw = searchParams.get("ids") || "";
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }, [searchParams]);

  const optionMap = useMemo(() => {
    return config.options.reduce<Record<string, AttributeOption>>((acc, option) => {
      acc[`${option.groupKey}:${option.value}`] = option;
      return acc;
    }, {});
  }, [config.options]);

  const valuesByPlatform = useMemo(() => {
    return config.values.reduce<Record<string, AttributeValue[]>>((acc, value) => {
      acc[value.platformId] ??= [];
      acc[value.platformId].push(value);
      return acc;
    }, {});
  }, [config.values]);

  const comparableGroups = useMemo(() => {
    return config.groups
      .filter((group) => group.enabled && group.isComparable)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [config.groups]);

  const siteTagGroup = useMemo(
    () => config.groups.find((group) => group.boundField === "site_tag"),
    [config.groups]
  );

  const featuredModelsGroup = useMemo(
    () => config.groups.find((group) => group.boundField === "featured_models"),
    [config.groups]
  );

  const getEffectiveUptime = useCallback((platform: Platform) => {
    const summary = connectivity[platform.id]?.summary;
    return summary && summary.totalChecks > 0 ? summary.uptime : platform.uptime;
  }, [connectivity]);

  const getEffectiveLatency = useCallback((platform: Platform) => {
    const summary = connectivity[platform.id]?.summary;
    return summary && summary.totalChecks > 0 ? summary.avgLatency : platform.latency;
  }, [connectivity]);

  const getSiteTagOption = useCallback((platformId: string) => {
    if (!siteTagGroup) return null;
    const value = (valuesByPlatform[platformId] || []).find((item) => item.groupKey === siteTagGroup.key);
    if (!value) return null;
    return optionMap[`${value.groupKey}:${value.optionValue}`] || null;
  }, [siteTagGroup, valuesByPlatform, optionMap]);

  const getFeaturedModels = useCallback((platform: Platform) => {
    if (!featuredModelsGroup) return platform.models;
    const values = (valuesByPlatform[platform.id] || []).filter((item) => item.groupKey === featuredModelsGroup.key);
    const labels = values
      .map((item) => optionMap[`${item.groupKey}:${item.optionValue}`]?.label || item.optionValue)
      .filter(Boolean);
    return labels.length > 0 ? labels : platform.models;
  }, [featuredModelsGroup, valuesByPlatform, optionMap]);

  const getGroupValueLabels = useCallback((platformId: string, groupKey: string) => {
    return (valuesByPlatform[platformId] || [])
      .filter((item) => item.groupKey === groupKey)
      .map((item) => optionMap[`${item.groupKey}:${item.optionValue}`]?.label || item.optionValue || item.valueText)
      .filter(Boolean);
  }, [valuesByPlatform, optionMap]);

  const comparedPlatforms = useMemo(() => {
    const orderMap = new Map(selectedIds.map((id, index) => [id, index]));
    return platforms
      .filter((platform) => orderMap.has(platform.id))
      .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
  }, [platforms, selectedIds]);

  const compareRows = useMemo<CompareRow[]>(() => {
    if (comparedPlatforms.length === 0) return [];

    const rows: CompareRow[] = [
      {
        key: "basic",
        label: t.discoverPage.compareBasicInfo,
        values: comparedPlatforms.map((platform) => {
          const siteTagOption = getSiteTagOption(platform.id);
          return (
            <div key={platform.id} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold">{platform.name}</span>
                <span className={getBadgeClass(platform.tag)} style={makeBadgeStyle(siteTagOption?.color)}>
                  {siteTagOption?.label || platform.tagLabel}
                </span>
              </div>
              <p className="break-all text-xs text-[var(--muted)]">{platform.url}</p>
              <p className="text-sm leading-6 text-[var(--muted)]">{platform.description || t.common.noData}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={normalizeExternalUrl(platform.url)} target="_blank" rel="noreferrer" className="btn-glass">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t.common.visit}
                </a>
                <Link href={`/forum/tag/${platform.id}`} className="btn-glass btn-glass-primary">
                  {t.common.review}
                </Link>
              </div>
            </div>
          );
        }),
      },
      {
        key: "billing",
        label: t.discoverPage.tableBilling,
        values: comparedPlatforms.map((platform) => (
          <span key={platform.id} className={`text-sm font-semibold ${platform.billingColor}`}>{platform.billingRate || t.common.noData}</span>
        )),
      },
      {
        key: "models",
        label: t.discoverPage.tableModels,
        values: comparedPlatforms.map((platform) => {
          const models = getFeaturedModels(platform);
          return (
            <div key={platform.id} className="flex flex-wrap gap-2">
              {models.length > 0 ? models.map((model) => <span key={model} className="soft-tag">{model}</span>) : t.common.noData}
            </div>
          );
        }),
      },
      {
        key: "uptime",
        label: t.discoverPage.tableUptime,
        values: comparedPlatforms.map((platform) => `${getEffectiveUptime(platform)}%`),
      },
      {
        key: "latency",
        label: t.home.sortByLatency,
        values: comparedPlatforms.map((platform) => platform.monitorEnabled ? `${Math.round(getEffectiveLatency(platform))}ms` : t.discoverPage.unmonitored),
      },
      {
        key: "monitoring",
        label: t.discoverPage.compareMonitoringStatus,
        values: comparedPlatforms.map((platform) => platform.monitorEnabled ? t.common.enabled : t.common.disabled),
      },
      {
        key: "joinDate",
        label: t.admin.joinDate,
        values: comparedPlatforms.map((platform) => formatDateText(platform.joinDate)),
      },
    ];

    for (const group of comparableGroups) {
      if (group.boundField === "site_tag") continue;
      const label = group.label;
      rows.push({
        key: `group:${group.key}`,
        label,
        values: comparedPlatforms.map((platform) => {
          const labels = getGroupValueLabels(platform.id, group.key);
          if (labels.length === 0) return t.common.noData;
          return (
            <div key={platform.id} className="flex flex-wrap gap-2">
              {labels.map((item) => {
                const originalValue = (valuesByPlatform[platform.id] || []).find((entry) => entry.groupKey === group.key && (optionMap[`${entry.groupKey}:${entry.optionValue}`]?.label || entry.optionValue || entry.valueText) === item);
                const color = originalValue ? optionMap[`${originalValue.groupKey}:${originalValue.optionValue}`]?.color : undefined;
                return <span key={`${group.key}-${item}`} className="soft-tag" style={makeSoftTagStyle(color)}>{item}</span>;
              })}
            </div>
          );
        }),
      });
    }

    return rows;
  }, [comparedPlatforms, comparableGroups, getEffectiveLatency, getEffectiveUptime, getFeaturedModels, getGroupValueLabels, getSiteTagOption, optionMap, valuesByPlatform]);

  const conclusionItems = useMemo(() => {
    if (comparedPlatforms.length < 2) return [];

    const monitoredPlatforms = comparedPlatforms.filter((platform) => platform.monitorEnabled);
    const billingSorted = [...comparedPlatforms].sort((a, b) => parseBillingRateValue(a.billingRate) - parseBillingRateValue(b.billingRate));
    const uptimeSorted = [...monitoredPlatforms].sort((a, b) => getEffectiveUptime(b) - getEffectiveUptime(a));
    const latencySorted = [...monitoredPlatforms].sort((a, b) => getEffectiveLatency(a) - getEffectiveLatency(b));

    const items: string[] = [];

    if (uptimeSorted[0]) items.push(`${t.discoverPage.compareConclusionBestUptime}${uptimeSorted[0].name}（${getEffectiveUptime(uptimeSorted[0])}%）`);
    if (latencySorted[0]) items.push(`${t.discoverPage.compareConclusionBestLatency}${latencySorted[0].name}（${Math.round(getEffectiveLatency(latencySorted[0]))}ms）`);
    if (billingSorted[0] && Number.isFinite(parseBillingRateValue(billingSorted[0].billingRate))) {
      items.push(`${t.discoverPage.compareConclusionBestBilling}${billingSorted[0].name}（${billingSorted[0].billingRate}）`);
    }

    return items;
  }, [comparedPlatforms, getEffectiveLatency, getEffectiveUptime]);

  useEffect(() => {
    if (!tableRef.current) return;
    const updateWidth = () => setTableWidth(tableRef.current?.scrollWidth || 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [compareRows, comparedPlatforms.length]);

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

  const hasSelection = comparedPlatforms.length > 0;
  const tableMinWidth = STICKY_LABEL_WIDTH + comparedPlatforms.length * MIN_COLUMN_WIDTH;

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              {t.discoverPage.compareBadge}
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{t.discoverPage.compareTitle}</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">{t.discoverPage.compareDescription}</p>
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
            <span className="text-sm font-semibold text-[var(--accent-strong)]">{comparedPlatforms.length}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">{t.discoverPage.compareTableDescription}</p>
        </div>

        {loading ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">{t.common.loading}</div>
        ) : !hasSelection ? (
          <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">
            <p>{t.discoverPage.compareEmpty}</p>
            <div className="mt-4">
              <Link href="/discover" className="btn-glass btn-glass-primary">{t.discoverPage.goSelectPlatforms}</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4 sm:p-5">
            <div
              ref={topScrollRef}
              className="overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[color:var(--background)]/55"
              onScroll={() => syncScroll("top")}
              aria-label={t.discoverPage.compareTopScrollbar}
            >
              <div style={{ width: Math.max(tableWidth, tableMinWidth), height: 16 }} />
            </div>

            <div
              ref={bottomScrollRef}
              className="overflow-x-auto rounded-2xl border border-[var(--border-color)]"
              onScroll={() => syncScroll("bottom")}
            >
              <table ref={tableRef} className="table-fixed text-sm" style={{ minWidth: tableMinWidth }}>
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--card)] text-left text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="sticky left-0 z-20 border-r border-[var(--border-color)] bg-[var(--card)] px-4 py-4" style={{ width: STICKY_LABEL_WIDTH, minWidth: STICKY_LABEL_WIDTH }}>
                      {t.discoverPage.comparePropertyColumn}
                    </th>
                    {comparedPlatforms.map((platform) => (
                      <th key={platform.id} className="border-r border-[var(--border-color)] px-4 py-4 last:border-r-0" style={{ minWidth: MIN_COLUMN_WIDTH, width: MIN_COLUMN_WIDTH }}>
                        <div className="min-w-[240px]">
                          <div className="font-semibold normal-case tracking-normal text-[var(--foreground)]">{platform.name}</div>
                          <div className="mt-1 text-[11px] normal-case tracking-normal text-[var(--muted)]">{platform.url}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, rowIndex) => (
                    <tr key={row.key} className={`border-b border-[var(--border-color)] align-top ${rowIndex % 2 === 0 ? "bg-[color:var(--background)]/20" : "bg-transparent"}`}>
                      <th className="sticky left-0 z-10 border-r border-[var(--border-color)] bg-[var(--card)] px-4 py-4 text-left font-semibold" style={{ width: STICKY_LABEL_WIDTH, minWidth: STICKY_LABEL_WIDTH }}>
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={`${row.key}-${index}`} className="border-r border-[var(--border-color)] px-4 py-4 align-top leading-7 last:border-r-0" style={{ minWidth: MIN_COLUMN_WIDTH, width: MIN_COLUMN_WIDTH }}>
                          {typeof value === "string" ? <span>{value}</span> : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-[var(--accent-soft)]/25 align-top">
                    <th className="sticky left-0 z-10 border-r border-[var(--border-color)] bg-[var(--card)] px-4 py-4 text-left font-semibold" style={{ width: STICKY_LABEL_WIDTH, minWidth: STICKY_LABEL_WIDTH }}>
                      <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--accent-strong)]" />{t.discoverPage.compareConclusionRow}</span>
                    </th>
                    <td className="px-4 py-4 leading-7" colSpan={Math.max(comparedPlatforms.length, 1)}>
                      {conclusionItems.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {conclusionItems.map((item) => <span key={item} className="soft-tag">{item}</span>)}
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
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">{t.discoverPage.compareDescription}</p>
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
