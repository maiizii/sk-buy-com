import type { Metadata } from "next";
import { Activity, AlertTriangle, Boxes, DatabaseZap } from "lucide-react";
import { SKS_GRID_HOURS, SKS_RETENTION_DAYS, getSksSiteList } from "@/lib/sks/service";
import { SksMetric, SksSiteCard } from "@/components/sks/SksUi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SKS (SK Status) — sk-buy.com",
  description:
    "SKS 是 sk-buy 内置的第三方平台状态观测模块，当前统一展示最近 24 小时状态方格，并保留 7 天原始数据。",
  keywords: ["SKS", "SK Status", "status", "uptime", "AI API", "监控"],
};

export default function SksIndexPage() {
  const sites = getSksSiteList();
  const okCount = sites.filter((site) => site.current.status === "ok").length;
  const degradedCount = sites.filter((site) => site.current.status === "slow").length;
  const failedCount = sites.filter((site) => site.current.status === "failed").length;
  const modelCount = sites.reduce((sum, site) => sum + site.models.count, 0);

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--card-hover)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
              <Activity className="h-4 w-4 text-[var(--accent)]" />
              SKS (SK Status) · 第三方平台持续状态观测
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                面向使用者视角的 API 状态页
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                当前版本先聚焦“持续状态是否稳定”。所有站点统一展示最近 {SKS_GRID_HOURS}
                小时小方格，每小时 1 格；原始探测数据保留 {SKS_RETENTION_DAYS}
                天，方便快速判断平台是否持续可用，而不是只看某一刻是否能通。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--card)] px-3 py-1.5">
              <DatabaseZap className="h-4 w-4 text-[var(--accent)]" />
              JSON API：/api/sks/sites
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--card)] px-3 py-1.5">
              <Boxes className="h-4 w-4 text-[var(--accent)]" />
              详情接口：/api/sks/site/[siteKey]
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SksMetric label="站点数" value={`${sites.length} 个`} hint="公开状态页" />
        <SksMetric label="当前正常" value={`${okCount} 个`} hint="最近一次探测返回正常" />
        <SksMetric label="当前异常" value={`${failedCount + degradedCount} 个`} hint={`失败 ${failedCount} · 偏慢 ${degradedCount}`} />
        <SksMetric label="模型记录" value={`${modelCount} 个`} hint={`原始点位保留 ${SKS_RETENTION_DAYS} 天`} />
      </section>

      <section className="shell-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">当前公开状态页</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              优先展示持续性结果：最近 24 小时的方格、7 天窗口成功率、最新延迟，以及当前记录到的热门模型。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            初期统一为 24 格展示，不做更密的半小时分析
          </div>
        </div>
      </section>

      {sites.length > 0 ? (
        <section className="grid gap-6 xl:grid-cols-2">
          {sites.map((site) => (
            <SksSiteCard key={site.site.id} item={site} />
          ))}
        </section>
      ) : (
        <section className="shell-panel">
          <p className="text-sm text-[var(--muted)]">
            当前还没有可公开展示的 SKS 站点。启用平台监控后，这里会自动生成状态卡片与公开详情页。
          </p>
        </section>
      )}
    </div>
  );
}
