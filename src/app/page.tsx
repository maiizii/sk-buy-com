"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  Clock3,
  ExternalLink,
  Gauge,
  Heart,
  MessageSquare,
  Shield,
  SkullIcon,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Tracker, type TrackerBlockProps } from "@/components/Tracker";

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

function logsToTrackerData(logs: ConnectivityLog[], nodeCount: number = 24): TrackerBlockProps[] {
  const data: TrackerBlockProps[] = [];
  const emptyCount = Math.max(0, nodeCount - logs.length);

  for (let i = 0; i < emptyCount; i++) {
    data.push({ color: "bg-slate-300 dark:bg-slate-700", tooltip: "暂无数据" });
  }

  for (const log of logs) {
    const time = new Date(log.checkedAt + "Z").toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (log.success) {
      if (log.latency > 1500) {
        data.push({ color: "bg-amber-400", tooltip: `${time} · 高延迟 ${log.latency}ms` });
      } else {
        data.push({ color: "bg-emerald-500", tooltip: `${time} · 正常 ${log.latency}ms` });
      }
    } else {
      data.push({ color: "bg-rose-500", tooltip: `${time} · ${log.errorMessage || "连接失败"}` });
    }
  }

  return data;
}

function generateGreyTrackerData(nodeCount: number = 24): TrackerBlockProps[] {
  return Array.from({ length: nodeCount }, () => ({
    color: "bg-slate-200 dark:bg-slate-700/70",
    tooltip: "未启用连通监控",
  }));
}

function TagIcon({ type }: { type: string }) {
  switch (type) {
    case "premium":
      return <Shield className="h-3.5 w-3.5" />;
    case "free":
      return <Heart className="h-3.5 w-3.5" />;
    case "stable":
      return <Activity className="h-3.5 w-3.5" />;
    case "dead":
      return <SkullIcon className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="kpi-card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-semibold tracking-tight">{value}</span>
            <span className="pb-1 text-sm text-[var(--muted)]">{sub}</span>
          </div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [refreshTime, setRefreshTime] = useState("--:--");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectivity, setConnectivity] = useState<ConnectivityData>({});

  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPlatforms(data.data);
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

  useEffect(() => {
    const updateTime = () =>
      setRefreshTime(
        new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      );
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const getEffectiveUptime = (p: Platform) => {
    const c = connectivity[p.id];
    if (c && c.summary.totalChecks > 0) return c.summary.uptime;
    return p.uptime;
  };

  const getEffectiveLatency = (p: Platform) => {
    const c = connectivity[p.id];
    if (c && c.summary.totalChecks > 0) return c.summary.avgLatency;
    return p.latency;
  };

  const stats = useMemo(() => {
    const count = platforms.length;
    const monitoredCount = platforms.filter((p) => p.monitorEnabled).length;
    const avgUptime =
      count > 0
        ? (platforms.reduce((sum, p) => sum + getEffectiveUptime(p), 0) / count).toFixed(1)
        : "0";
    const avgLatency =
      count > 0
        ? Math.round(
            platforms.reduce((sum, p) => sum + getEffectiveLatency(p), 0) / count
          ).toLocaleString()
        : "0";
    const bestValue =
      count > 0
        ? platforms.reduce((best, p) => {
            if (p.tag === "dead") return best;
            const up = getEffectiveUptime(p);
            const lat = getEffectiveLatency(p) || 1;
            const bestUp = getEffectiveUptime(best);
            const bestLat = getEffectiveLatency(best) || 1;
            return up / lat > bestUp / bestLat ? p : best;
          }, platforms[0])?.name || "--"
        : "--";

    return { count, monitoredCount, avgUptime, avgLatency, bestValue };
  }, [platforms, connectivity]);

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/40">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
              Materio 风格仪表盘改版
            </span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              AI API 中转站数据总览与社区入口
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              对比平台计费倍率、24 小时连通率、平均延迟与用户点评，默认浅色风格，支持一键切换深色模式。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/forum" className="btn-glass btn-glass-primary">
                进入社区论坛
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin" className="btn-glass">
                打开管理后台
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard icon={Activity} label="收录平台" value={String(stats.count)} sub="家" />
            <KpiCard icon={TrendingUp} label="平均连通率" value={stats.avgUptime} sub="%" />
            <KpiCard icon={Zap} label="平均延迟" value={stats.avgLatency} sub="ms" />
            <KpiCard icon={Award} label="最佳性价比" value={stats.bestValue} sub="" />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] px-6 py-5">
            <div>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-[var(--accent-strong)]" />
                <h3 className="text-base font-semibold">平台对比看板</h3>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">展示计费倍率、监控状态和可用性趋势</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
              <Clock3 className="h-3.5 w-3.5" />
              最近刷新 {refreshTime}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">加载中...</div>
            ) : platforms.length === 0 ? (
              <div className="px-6 py-20 text-center text-sm text-[var(--muted)]">暂无平台数据</div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] text-left text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                    <th className="px-6 py-4">平台</th>
                    <th className="px-4 py-4">倍率</th>
                    <th className="px-4 py-4">模型</th>
                    <th className="px-4 py-4 min-w-[280px]">连通率</th>
                    <th className="px-4 py-4">延迟</th>
                    <th className="px-6 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map((p) => {
                    const hasMonitor = p.monitorEnabled;
                    const connData = connectivity[p.id];
                    const effectiveUptime = getEffectiveUptime(p);
                    const effectiveLatency = getEffectiveLatency(p);
                    const trackerData = hasMonitor && connData
                      ? logsToTrackerData(connData.logs, 24)
                      : hasMonitor
                        ? logsToTrackerData([], 24)
                        : generateGreyTrackerData(24);

                    return (
                      <tr key={p.id} className="table-row-hover border-b border-[var(--border-color)] last:border-b-0">
                        <td className="px-6 py-4 align-top">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{p.name}</span>
                              <span className={`badge badge-${p.tag}`}>
                                <TagIcon type={p.tag} />
                                {p.tagLabel}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted)]">{p.url}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className={`font-semibold ${p.billingColor}`}>{p.billingRate}</span>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {p.models.slice(0, 3).map((model) => (
                              <span key={model} className="forum-tag">
                                {model}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[var(--accent-strong)]">{effectiveUptime}%</span>
                              <span className="text-[var(--muted)]">{hasMonitor ? "监控中" : "未监控"}</span>
                            </div>
                            <Tracker data={trackerData} className="h-5" hoverEffect={hasMonitor} />
                          </div>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="inline-flex rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                            {Math.round(effectiveLatency)}ms
                          </span>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex justify-end gap-2">
                            <a href={`https://${p.url}`} target="_blank" rel="noreferrer" className="btn-glass">
                              <ExternalLink className="h-3.5 w-3.5" />
                              访问
                            </a>
                            <Link href={`/forum/tag/${p.id}`} className="btn-glass btn-glass-primary">
                              <MessageSquare className="h-3.5 w-3.5" />
                              点评
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="shell-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">监控摘要</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[var(--accent-soft)] px-4 py-4">
                <div>
                  <p className="text-sm font-medium">已启用监控</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">每分钟自动拉取摘要</p>
                </div>
                <span className="text-2xl font-semibold text-[var(--accent-strong)]">{stats.monitoredCount}</span>
              </div>
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-4">
                <p className="text-sm font-medium">最佳性价比平台</p>
                <p className="mt-2 text-lg font-semibold">{stats.bestValue}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">综合 uptime / latency 简单计算，仅供参考。</p>
              </div>
            </div>
          </div>

          <div className="shell-panel">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold">说明</p>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
              <li>• 数据仅作参考，不构成购买建议。</li>
              <li>• 可用性、延迟与费用请结合官方信息交叉验证。</li>
              <li>• 首页表格现在独占整行，避免被右侧摘要卡压缩。</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
