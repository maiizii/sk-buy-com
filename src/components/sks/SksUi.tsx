import Link from "next/link";
import type { SksDisplayStatus, SksGridCell, SksSiteCardView } from "@/lib/sks/types";

const STATUS_META: Record<
  SksDisplayStatus,
  {
    label: string;
    pillClassName: string;
    cellClassName: string;
  }
> = {
  ok: {
    label: "正常",
    pillClassName:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    cellClassName: "border-emerald-500/20 bg-emerald-500/80",
  },
  slow: {
    label: "偏慢",
    pillClassName:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    cellClassName: "border-amber-500/20 bg-amber-400/85",
  },
  failed: {
    label: "失败",
    pillClassName:
      "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    cellClassName: "border-rose-500/20 bg-rose-500/85",
  },
  unknown: {
    label: "未知",
    pillClassName:
      "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
    cellClassName: "border-[var(--border-color)] bg-[var(--accent-soft)]/40",
  },
};

function parseTimestamp(value: string | null) {
  if (!value) return null;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const date = new Date(withTimezone);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatCheckedAt(value: string | null) {
  const date = parseTimestamp(value);
  if (!date) return "暂无检测";

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function formatLatency(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return `${Math.round(value)} ms`;
}

export function getStatusLabel(status: SksDisplayStatus) {
  return STATUS_META[status].label;
}

export function getSksSiteHref(siteKey: string) {
  return `/sks/site/${encodeURIComponent(siteKey)}`;
}

export function SksStatusPill({ status }: { status: SksDisplayStatus }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.pillClassName}`}
    >
      {meta.label}
    </span>
  );
}

function getGridCellTitle(cell: SksGridCell) {
  const statusLabel = getStatusLabel(cell.status);
  const duration = cell.totalMs === null ? "--" : `${Math.round(cell.totalMs)} ms`;
  const errorText = cell.errorMessage ? ` · ${cell.errorMessage}` : "";
  return `${cell.label} · ${statusLabel} · ${duration}${errorText}`;
}

export function SksHourGrid({
  cells,
  caption,
  compact = false,
}: {
  cells: SksGridCell[];
  caption?: string;
  compact?: boolean;
}) {
  const heightClass = compact ? "h-4" : "h-6";
  const gridMinWidth = Math.max(cells.length * (compact ? 18 : 26), 360);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
            minWidth: `${gridMinWidth}px`,
          }}
        >
          {cells.map((cell) => (
            <div
              key={cell.bucketStart}
              title={getGridCellTitle(cell)}
              className={`${heightClass} rounded-md border ${STATUS_META[cell.status].cellClassName}`}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-[var(--muted)]">
        <span>{cells[0]?.label ?? "--"}</span>
        <span>{caption ?? `最近 ${cells.length} 小时，每小时 1 格`}</span>
        <span>{cells.at(-1)?.label ?? "--"}</span>
      </div>
    </div>
  );
}

export function SksMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function SksSiteCard({ item }: { item: SksSiteCardView }) {
  const detailHref = getSksSiteHref(item.site.normalizedHostname || item.site.id);

  return (
    <article className="shell-panel flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              {item.site.displayName}
            </h2>
            <SksStatusPill status={item.current.status} />
          </div>
          <p className="break-all text-sm text-[var(--muted)]">{item.site.hostname}</p>
          <p className="break-all text-xs text-[var(--muted)]/90">{item.site.apiBaseUrl}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={detailHref} className="btn-glass">
            查看状态页
          </Link>
          {item.site.homepageUrl ? (
            <a
              href={item.site.homepageUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-glass"
            >
              访问站点
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SksMetric
          label="7 天可用率"
          value={`${item.stats7d.successRate.toFixed(1)}%`}
          hint={`共 ${item.stats7d.total} 次探测`}
        />
        <SksMetric
          label="最近延迟"
          value={formatLatency(item.current.totalMs)}
          hint={`最后检查：${formatCheckedAt(item.current.checkedAt)}`}
        />
        <SksMetric
          label="模型覆盖"
          value={`${item.models.count} 个`}
          hint={item.models.hot.length > 0 ? `热门：${item.models.hot.slice(0, 3).join(" / ")}` : "暂未记录热门模型"}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--foreground)]">24 小时状态格</p>
          <p className="text-xs text-[var(--muted)]">每小时 1 格，统一展示</p>
        </div>
        <SksHourGrid cells={item.grid} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-[var(--foreground)]">热门模型</p>
        <div className="flex flex-wrap gap-2">
          {item.models.hot.length > 0 ? (
            item.models.hot.map((model) => (
              <span
                key={model}
                className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--card-hover)] px-3 py-1 text-xs text-[var(--foreground)]"
              >
                {model}
              </span>
            ))
          ) : (
            <span className="text-sm text-[var(--muted)]">暂无模型列表</span>
          )}
        </div>
      </div>
    </article>
  );
}
