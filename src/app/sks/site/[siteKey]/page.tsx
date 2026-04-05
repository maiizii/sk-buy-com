import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, ExternalLink, Globe, Link2 } from "lucide-react";
import {
  SKS_GRID_HOURS,
  SKS_RETENTION_DAYS,
  getRecentFailureMessages,
  getSksSiteByKey,
} from "@/lib/sks/service";
import {
  SksHourGrid,
  SksMetric,
  SksStatusPill,
  formatCheckedAt,
  formatLatency,
} from "@/components/sks/SksUi";

export const dynamic = "force-dynamic";

async function resolveSite(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) notFound();
  return detail;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteKey: string }>;
}): Promise<Metadata> {
  const { siteKey } = await params;
  const detail = getSksSiteByKey(siteKey);

  if (!detail) {
    return {
      title: "站点状态不存在 — SKS",
      description: "请求的 SKS 站点不存在或尚未公开。",
    };
  }

  return {
    title: `${detail.site.displayName} 状态页 — SKS`,
    description: `${detail.site.displayName} 的 SKS 状态页，展示最近 ${SKS_GRID_HOURS} 小时状态方格、7 天可用率与模型覆盖。`,
    keywords: [
      "SKS",
      detail.site.displayName,
      detail.site.hostname,
      "status",
      "uptime",
      "AI API",
    ],
  };
}

export default async function SksSiteDetailPage({
  params,
}: {
  params: Promise<{ siteKey: string }>;
}) {
  const { siteKey } = await params;
  const detail = await resolveSite(siteKey);
  const failures = getRecentFailureMessages(detail);
  const apiUrl = `/api/sks/site/${encodeURIComponent(detail.site.normalizedHostname || detail.site.id)}`;
  const hotModels = detail.modelStatuses.filter((model) => model.isHot).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/sks" className="inline-flex items-center gap-2 hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          返回 SKS 总览
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">{detail.site.displayName}</span>
      </div>

      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                {detail.site.displayName}
              </h1>
              <SksStatusPill status={detail.current.status} />
            </div>

            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p className="break-all">
                <span className="font-medium text-[var(--foreground)]">Hostname：</span>
                {detail.site.hostname}
              </p>
              <p className="break-all">
                <span className="font-medium text-[var(--foreground)]">API Base：</span>
                {detail.site.apiBaseUrl}
              </p>
              <p>
                当前展示最近 {SKS_GRID_HOURS} 小时状态格，每小时 1 格；原始探测记录保留 {SKS_RETENTION_DAYS} 天。
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {detail.site.homepageUrl ? (
              <a
                href={detail.site.homepageUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-glass"
              >
                <Globe className="h-4 w-4" />
                访问站点
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <a href={apiUrl} target="_blank" rel="noreferrer" className="btn-glass">
              <Link2 className="h-4 w-4" />
              查看 JSON
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SksMetric
          label="当前延迟"
          value={formatLatency(detail.current.totalMs)}
          hint={`最后检查：${formatCheckedAt(detail.current.checkedAt)}`}
        />
        <SksMetric
          label="7 天可用率"
          value={`${detail.stats7d.successRate.toFixed(1)}%`}
          hint={`成功 ${detail.stats7d.okCount + detail.stats7d.slowCount} · 失败 ${detail.stats7d.failedCount}`}
        />
        <SksMetric
          label="模型总数"
          value={`${detail.models.count} 个`}
          hint={`热门模型 ${detail.models.hot.length} 个`}
        />
        <SksMetric
          label="状态窗口"
          value={`${detail.grid.length} 格`}
          hint={`每小时 1 格 · 保存 ${SKS_RETENTION_DAYS} 天`}
        />
      </section>

      <section className="shell-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">最近 24 小时状态格</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              用最直接的方式看持续状态：绿表示正常，黄表示偏慢，红表示失败，灰表示暂无采样。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />正常
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" />偏慢
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-700 dark:text-rose-300">
              <span className="h-2 w-2 rounded-full bg-rose-500" />失败
            </span>
          </div>
        </div>
        <SksHourGrid cells={detail.grid} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="shell-panel space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">热门模型状态</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              第一阶段先聚焦热门模型摘要，帮助快速判断平台当前是否具备核心模型能力。
            </p>
          </div>

          {hotModels.length > 0 ? (
            <div className="space-y-4">
              {hotModels.map((model) => (
                <div
                  key={model.modelName}
                  className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[var(--foreground)]">{model.modelName}</p>
                        <SksStatusPill status={model.current.status} />
                        {model.providerFamily ? (
                          <span className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                            {model.providerFamily}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        最近发现：{formatCheckedAt(model.lastSeenAt)} · 7 天可用率 {model.stats7d.successRate.toFixed(1)}%
                      </p>
                    </div>
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {formatLatency(model.current.totalMs)}
                    </p>
                  </div>

                  <div className="mt-4">
                    <SksHourGrid cells={model.grid} compact caption="模型级小方格（当前阶段沿用站点窗口）" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">当前还没有热门模型摘要。</p>
          )}
        </div>

        <div className="space-y-6">
          <section className="shell-panel space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">最近失败原因</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                只保留近期出现过的去重摘要，便于快速判断是网络、鉴权还是上游异常。
              </p>
            </div>

            {failures.length > 0 ? (
              <ul className="space-y-2">
                {failures.map((failure) => (
                  <li
                    key={failure}
                    className="flex items-start gap-2 rounded-2xl border border-rose-500/15 bg-rose-500/8 px-3 py-3 text-sm text-rose-700 dark:text-rose-300"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{failure}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">最近窗口内没有记录到明确失败原因。</p>
            )}
          </section>

          <section className="shell-panel space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">当前可用模型</h2>
              <p className="mt-2 text-sm text-[var(--muted)]">
                这里展示当前记录到的模型名称，后续可以继续扩展为模型上下线变化与独立实测结果。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {detail.modelStatuses.length > 0 ? (
                detail.modelStatuses.map((model) => (
                  <span
                    key={model.modelName}
                    className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--card-hover)] px-3 py-1 text-xs text-[var(--foreground)]"
                  >
                    {model.modelName}
                  </span>
                ))
              ) : (
                <span className="text-sm text-[var(--muted)]">暂无模型列表</span>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
