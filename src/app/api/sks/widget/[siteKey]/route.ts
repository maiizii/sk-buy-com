import { getSksSiteByKey } from "@/lib/sks/service";
import { formatCheckedAt, formatLatency, getStatusLabel } from "@/components/sks/SksUi";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBadge(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) return null;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:transparent}
.card{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:#0f172a;color:#e2e8f0}
.name{font-size:15px;font-weight:700}.meta{font-size:12px;color:#94a3b8;margin-top:4px}.pill{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${detail.current.status === "ok" ? "rgba(16,185,129,.15)" : detail.current.status === "slow" ? "rgba(245,158,11,.18)" : "rgba(244,63,94,.16)"};color:${detail.current.status === "ok" ? "#34d399" : detail.current.status === "slow" ? "#fbbf24" : "#fb7185"}}
</style>
</head>
<body>
  <div class="card">
    <div>
      <div class="name">${escapeHtml(detail.site.displayName)}</div>
      <div class="meta">${escapeHtml(detail.site.hostname)} · ${escapeHtml(formatLatency(detail.current.totalMs))} · ${escapeHtml(formatCheckedAt(detail.current.checkedAt))}</div>
    </div>
    <div class="pill">${escapeHtml(getStatusLabel(detail.current.status))}</div>
  </div>
</body>
</html>`;
}

function renderMiniGrid(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) return null;

  const cells = detail.grid
    .map((cell) => `<span class="cell ${cell.status}" title="${escapeHtml(`${cell.label} ${getStatusLabel(cell.status)}`)}"></span>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:transparent}
.card{box-sizing:border-box;padding:14px 16px;border:1px solid rgba(148,163,184,.22);border-radius:16px;background:#0f172a;color:#e2e8f0}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px}.name{font-size:15px;font-weight:700}.meta{font-size:12px;color:#94a3b8}
.grid{display:grid;grid-template-columns:repeat(${detail.grid.length},minmax(0,1fr));gap:4px;margin-top:14px}.cell{height:18px;border-radius:6px;background:#334155}.cell.ok{background:#10b981}.cell.slow{background:#f59e0b}.cell.failed{background:#f43f5e}.cell.unknown{background:#475569}
</style>
</head>
<body>
  <div class="card">
    <div class="top">
      <div>
        <div class="name">${escapeHtml(detail.site.displayName)}</div>
        <div class="meta">24h 状态格 · 7天成功率 ${detail.stats7d.successRate.toFixed(1)}%</div>
      </div>
      <div class="meta">${escapeHtml(getStatusLabel(detail.current.status))}</div>
    </div>
    <div class="grid">${cells}</div>
  </div>
</body>
</html>`;
}

function renderFullCard(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) return null;

  const hotModels = detail.models.hot.slice(0, 6).map((model) => `<span class="tag">${escapeHtml(model)}</span>`).join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:transparent}
.card{box-sizing:border-box;padding:18px;border:1px solid rgba(148,163,184,.22);border-radius:20px;background:#0f172a;color:#e2e8f0}
.row{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.name{font-size:18px;font-weight:800}.sub{font-size:12px;color:#94a3b8;margin-top:6px}.pill{padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:#1e293b}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:16px}.stat{padding:12px;border-radius:14px;background:#111827;border:1px solid rgba(148,163,184,.12)}.label{font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.12em}.value{margin-top:6px;font-size:18px;font-weight:800}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.tag{padding:6px 10px;border-radius:999px;background:#111827;border:1px solid rgba(148,163,184,.16);font-size:12px}
</style>
</head>
<body>
  <div class="card">
    <div class="row">
      <div>
        <div class="name">${escapeHtml(detail.site.displayName)}</div>
        <div class="sub">${escapeHtml(detail.site.hostname)} · 最后检查 ${escapeHtml(formatCheckedAt(detail.current.checkedAt))}</div>
      </div>
      <div class="pill">${escapeHtml(getStatusLabel(detail.current.status))}</div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">7天可用率</div><div class="value">${detail.stats7d.successRate.toFixed(1)}%</div></div>
      <div class="stat"><div class="label">当前延迟</div><div class="value">${escapeHtml(formatLatency(detail.current.totalMs))}</div></div>
      <div class="stat"><div class="label">模型数量</div><div class="value">${detail.models.count}</div></div>
    </div>
    <div class="tags">${hotModels || '<span class="tag">暂无热门模型</span>'}</div>
  </div>
</body>
</html>`;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  try {
    const { siteKey } = await params;
    const { searchParams } = new URL(request.url);
    const template = String(searchParams.get("template") || "badge").trim();

    const html =
      template === "mini-grid"
        ? renderMiniGrid(siteKey)
        : template === "full-card"
          ? renderFullCard(siteKey)
          : renderBadge(siteKey);

    if (!html) {
      return new Response("Widget not found", { status: 404 });
    }

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (error) {
    console.error("[api/sks/widget] failed:", error);
    return new Response("Widget render failed", { status: 500 });
  }
}
