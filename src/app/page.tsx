"use client";

import { Tracker, type TrackerBlockProps } from "@/components/Tracker";
import { Navbar } from "@/components/Navbar";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Zap,
  TrendingUp,
  Award,
  ExternalLink,
  Gauge,
  Clock,
  Shield,
  AlertTriangle,
  Heart,
  SkullIcon,
  EyeOff,
  MessageSquare,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
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

interface UserInfo {
  id: number;
  username: string;
  role: "user" | "admin";
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

// ============================================================
// Tracker Data — from real connectivity logs (24 hourly nodes)
// ============================================================
function logsToTrackerData(
  logs: ConnectivityLog[],
  nodeCount: number = 24
): TrackerBlockProps[] {
  const data: TrackerBlockProps[] = [];

  // Fill empty nodes at the beginning if we have less than nodeCount logs
  const emptyCount = Math.max(0, nodeCount - logs.length);
  for (let i = 0; i < emptyCount; i++) {
    data.push({
      color: "bg-gray-600",
      tooltip: "暂无数据",
    });
  }

  // Fill with actual log data
  for (const log of logs) {
    const time = new Date(log.checkedAt + "Z").toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (log.success) {
      if (log.latency > 1500) {
        data.push({
          color: "bg-yellow-500",
          tooltip: `${time} · 高延迟 ${log.latency}ms`,
        });
      } else {
        data.push({
          color: "bg-emerald-500",
          tooltip: `${time} · 正常 ${log.latency}ms`,
        });
      }
    } else {
      data.push({
        color: "bg-red-500",
        tooltip: `${time} · ${log.errorMessage || "连接失败"}`,
      });
    }
  }

  return data;
}

/**
 * Generate grey placeholder tracker data for unmonitored platforms
 */
function generateGreyTrackerData(nodeCount: number = 24): TrackerBlockProps[] {
  return Array.from({ length: nodeCount }, () => ({
    color: "bg-gray-500/30",
    tooltip: "未启用连通监控",
  }));
}

// ============================================================
// Helper components
// ============================================================
function TagIcon({ type }: { type: string }) {
  switch (type) {
    case "premium":
      return <Shield className="w-3 h-3" />;
    case "free":
      return <Heart className="w-3 h-3" />;
    case "stable":
      return <Activity className="w-3 h-3" />;
    case "dead":
      return <SkullIcon className="w-3 h-3" />;
    default:
      return null;
  }
}

function LatencyDisplay({ ms }: { ms: number }) {
  let color = "text-emerald-400";
  let bgColor = "bg-emerald-400/10";
  if (ms > 1500) {
    color = "text-red-400";
    bgColor = "bg-red-400/10";
  } else if (ms > 500) {
    color = "text-yellow-400";
    bgColor = "bg-yellow-400/10";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-sm ${color} ${bgColor}`}
    >
      <Zap className="w-3 h-3" />
      {ms.toLocaleString()}ms
    </span>
  );
}

function UptimePercentage({ value }: { value: number }) {
  let color = "text-emerald-400";
  if (value < 50) color = "text-red-400";
  else if (value < 90) color = "text-yellow-400";
  else if (value < 98) color = "text-blue-400";

  return (
    <span className={`font-mono text-sm font-semibold ${color}`}>{value}%</span>
  );
}

// ============================================================
// KPI Card Component
// ============================================================
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  index: number;
}) {
  return (
    <div className={`kpi-card animate-fade-in-up stagger-${index + 1}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent/10">
          <Icon className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <span className="text-xs font-medium text-muted tracking-wide uppercase">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono tracking-tight">
          {value}
        </span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
    </div>
  );
}

// ============================================================
// Main Page Component
// ============================================================
export default function Home() {
  const [refreshTime, setRefreshTime] = useState("--:--:--");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectivity, setConnectivity] = useState<ConnectivityData>({});

  // Fetch platforms from API
  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setPlatforms(data.data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch connectivity data
  useEffect(() => {
    function fetchConnectivity() {
      fetch("/api/connectivity")
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setConnectivity(data.data);
          }
        })
        .catch(console.error);
    }

    fetchConnectivity();
    // Refresh connectivity data every 60 seconds
    const interval = setInterval(fetchConnectivity, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRefreshTime(new Date().toLocaleTimeString("zh-CN"));
    const timer = setInterval(() => {
      setRefreshTime(new Date().toLocaleTimeString("zh-CN"));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute KPIs — use real connectivity data when available
  const getEffectiveUptime = (p: Platform): number => {
    const c = connectivity[p.id];
    if (c && c.summary.totalChecks > 0) return c.summary.uptime;
    return p.uptime;
  };

  const getEffectiveLatency = (p: Platform): number => {
    const c = connectivity[p.id];
    if (c && c.summary.totalChecks > 0) return c.summary.avgLatency;
    return p.latency;
  };

  const avgUptime =
    platforms.length > 0
      ? (
          platforms.reduce((sum, p) => sum + getEffectiveUptime(p), 0) /
          platforms.length
        ).toFixed(1)
      : "0";

  const avgLatency =
    platforms.length > 0
      ? Math.round(
          platforms.reduce((sum, p) => sum + getEffectiveLatency(p), 0) /
            platforms.length
        ).toLocaleString()
      : "0";

  const bestValue =
    platforms.length > 0
      ? platforms.reduce((best, p) => {
          if (p.tag === "dead") return best;
          const up = getEffectiveUptime(p);
          const lat = getEffectiveLatency(p) || 1;
          const bestUp = getEffectiveUptime(best);
          const bestLat = getEffectiveLatency(best) || 1;
          return up / lat > bestUp / bestLat ? p : best;
        }, platforms[0])?.name || "--"
      : "--";

  // Count monitored platforms
  const monitoredCount = platforms.filter((p) => p.monitorEnabled).length;

  return (
    <div className="relative z-10 min-h-screen">
      <Navbar />

      {/* ===== Main Content ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Activity}
            label="收录平台"
            value={String(platforms.length)}
            sub="家"
            index={0}
          />
          <KpiCard
            icon={TrendingUp}
            label="平均连通率"
            value={avgUptime}
            sub="%"
            index={1}
          />
          <KpiCard
            icon={Zap}
            label="平均延迟"
            value={avgLatency}
            sub="ms"
            index={2}
          />
          <KpiCard
            icon={Award}
            label="最佳性价比"
            value={bestValue}
            sub=""
            index={3}
          />
        </div>

        {/* ===== Data Table Card ===== */}
        <div className="animate-fade-in-up rounded-xl border border-[var(--border-color)] bg-[var(--card)] overflow-hidden">
          {/* Table Header Bar */}
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold tracking-wide">
                平台对比数据看板
              </h2>
              <span className="text-xs text-muted font-mono">实时更新</span>
              {monitoredCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {monitoredCount} 个平台监控中
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted font-mono">
              <Clock className="w-3 h-3" />
              <span>最近刷新: {refreshTime}</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-sm text-muted font-mono animate-pulse">
                  加载中...
                </div>
              </div>
            ) : platforms.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-sm text-muted font-mono">
                  暂无平台数据
                </div>
              </div>
            ) : (
              <table className="w-full text-sm" id="platform-table">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--card)]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      平台名称
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      计费倍率
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      主打模型
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap min-w-[320px]">
                      🟢 24h 连通率
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      ⚡ 延迟
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      加入时间
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {platforms.map((p, idx) => {
                    const hasMonitor = p.monitorEnabled;
                    const connData = connectivity[p.id];
                    const effectiveUptime = getEffectiveUptime(p);
                    const effectiveLatency = getEffectiveLatency(p);

                    // Build tracker data
                    const trackerData = hasMonitor && connData
                      ? logsToTrackerData(connData.logs, 24)
                      : hasMonitor
                        ? logsToTrackerData([], 24) // Monitor enabled but no data yet
                        : generateGreyTrackerData(24);

                    return (
                      <tr
                        key={p.id}
                        id={`platform-${p.id}`}
                        className={`table-row-hover animate-fade-in-up stagger-${idx + 1}`}
                      >
                        {/* Platform Name */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold font-mono text-sm">
                                {p.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`badge badge-${p.tag}`}>
                                <TagIcon type={p.tag} />
                                {p.tagLabel}
                              </span>
                              <span className="text-xs text-muted font-mono">
                                {p.url}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Billing Rate */}
                        <td className="px-4 py-4">
                          <span
                            className={`font-mono text-sm font-bold ${p.billingColor}`}
                          >
                            {p.billingRate}
                          </span>
                        </td>

                        {/* Models */}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {p.models.map((model) => (
                              <span
                                key={model}
                                className="inline-block px-2 py-0.5 rounded-md bg-[var(--border-color)] text-xs font-mono whitespace-nowrap"
                              >
                                {model}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Uptime Tracker */}
                        <td className="px-4 py-4">
                          <div className={`flex flex-col gap-1.5 ${!hasMonitor ? "opacity-40" : ""}`}>
                            <div className="flex items-center justify-between">
                              <UptimePercentage value={effectiveUptime} />
                              {!hasMonitor && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted font-mono">
                                  <EyeOff className="w-3 h-3" />
                                  未监控
                                </span>
                              )}
                              {hasMonitor && connData && connData.summary.lastCheck && (
                                <span className="text-[10px] text-muted font-mono">
                                  {new Date(connData.summary.lastCheck + "Z").toLocaleTimeString("zh-CN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            <Tracker
                              data={trackerData}
                              className="h-5"
                              hoverEffect={hasMonitor}
                            />
                          </div>
                        </td>

                        {/* Latency */}
                        <td className="px-4 py-4">
                          <div className={!hasMonitor ? "opacity-40" : ""}>
                            <LatencyDisplay ms={effectiveLatency} />
                          </div>
                        </td>

                        {/* Join Date */}
                        <td className="px-4 py-4">
                          <span className="text-xs text-muted font-mono">
                            {p.joinDate}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`https://${p.url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-glass btn-glass-primary"
                              id={`buy-${p.id}`}
                            >
                              <ExternalLink className="w-3 h-3" />
                              访问
                            </a>
                            <Link
                              href={`/forum/tag/${p.id}`}
                              className="btn-glass"
                              id={`review-${p.id}`}
                            >
                              <MessageSquare className="w-3 h-3" />
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

        {/* ===== Footer ===== */}
        <footer className="text-center py-8 text-xs text-muted font-mono space-y-1">
          <p>
            <span className="text-[var(--accent)]">sk-buy.com</span> · AI API
            中转站评测聚合平台
          </p>
          <p className="flex items-center justify-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            数据仅供参考，不构成购买建议。评测数据每 60 秒自动刷新。
          </p>
        </footer>
      </main>
    </div>
  );
}
