import { getSksSiteByKey } from "@/lib/sks/service";
import { formatCheckedAt, formatLatency, getStatusLabel } from "@/components/sks/SksUi";
import { verifySksEmbedFingerprint } from "@/lib/sks/fingerprint";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getStatusColor(status: "ok" | "slow" | "failed" | "unknown") {
  if (status === "ok") return "#10b981";
  if (status === "slow") return "#f59e0b";
  if (status === "failed") return "#ef4444";
  return "#94a3b8";
}

const LOBE_LIGHT_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/light";
const LOBE_DARK_ICON_BASE_URL = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.85.0/dark";
const PRIORITY_PROVIDER_ORDER = ["anthropic", "openai", "gemini"] as const;

function normalizeProviderFamilyKey(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "google") return "gemini";
  if (normalized === "claude") return "anthropic";
  if (normalized === "llama") return "meta";
  return normalized;
}

function inferProviderFamilyFromModelName(modelName: string) {
  const normalized = String(modelName || "").trim().toLowerCase();
  if (!normalized) return "";
  if (
    normalized.includes("gpt") ||
    normalized.includes("o1") ||
    normalized.includes("o3") ||
    normalized.includes("o4") ||
    normalized.includes("o5")
  ) {
    return "openai";
  }
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gemini") || normalized.includes("gemma")) return "gemini";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("glm")) return "glm";
  if (normalized.includes("llama")) return "meta";
  if (normalized.includes("command")) return "cohere";
  if (normalized.includes("grok")) return "xai";
  if (normalized.includes("minimax")) return "minimax";
  if (normalized.includes("moonshot") || normalized.includes("kimi")) return "moonshot";
  return "";
}

function getProviderPriority(value: string) {
  const normalized = normalizeProviderFamilyKey(value);
  const index = PRIORITY_PROVIDER_ORDER.indexOf(normalized as (typeof PRIORITY_PROVIDER_ORDER)[number]);
  return index === -1 ? PRIORITY_PROVIDER_ORDER.length : index;
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

function getProviderMetaFromModel(modelName: string) {
  const family = normalizeProviderFamilyKey(inferProviderFamilyFromModelName(modelName));
  const iconUrl = getProviderIconUrl(family);
  const darkIconUrl = getProviderDarkIconUrl(family);
  if (family === "openai") return { label: "OpenAI", color: "#10a37f", iconUrl, darkIconUrl, shortLabel: "AI" };
  if (family === "anthropic") return { label: "Claude", color: "#d97706", iconUrl, darkIconUrl, shortLabel: "CL" };
  if (family === "gemini") return { label: "Gemini", color: "#4285F4", iconUrl, darkIconUrl, shortLabel: "G" };
  if (family === "xai") return { label: "xAI", color: "#111827", iconUrl, darkIconUrl, shortLabel: "x" };
  if (family === "deepseek") return { label: "DeepSeek", color: "#4f46e5", iconUrl, darkIconUrl, shortLabel: "DS" };
  if (family === "qwen") return { label: "Qwen", color: "#06b6d4", iconUrl, darkIconUrl, shortLabel: "QW" };
  if (family === "glm") return { label: "GLM", color: "#2563eb", iconUrl, darkIconUrl, shortLabel: "GL" };
  if (family === "meta") return { label: "Meta", color: "#2563eb", iconUrl, darkIconUrl, shortLabel: "M" };
  if (family === "cohere") return { label: "Cohere", color: "#7c3aed", iconUrl, darkIconUrl, shortLabel: "CO" };
  if (family === "minimax") return { label: "MiniMax", color: "#db2777", iconUrl, darkIconUrl, shortLabel: "MM" };
  if (family === "moonshot") return { label: "Moonshot", color: "#0f766e", iconUrl, darkIconUrl, shortLabel: "MS" };
  return { label: modelName, color: "#64748b", iconUrl: "", darkIconUrl: "", shortLabel: modelName.slice(0, 2).toUpperCase() || "AI" };
}

function renderTrackerCells(detail: NonNullable<ReturnType<typeof getSksSiteByKey>>, max = 24) {
  return detail.grid
    .slice(0, max)
    .map((cell) => {
      const tone =
        cell.status === "ok"
          ? "ok"
          : cell.status === "slow"
            ? "slow"
            : cell.status === "failed"
              ? "failed"
              : "unknown";
      const hoverText = `${cell.label} · ${getStatusLabel(cell.status)} · ${formatLatency(cell.totalMs)}`;
      return `<span class="tracker-cell ${tone}" data-hover="${escapeHtml(hoverText)}"></span>`;
    })
    .join("");
}

function renderProviderIcons(detail: NonNullable<ReturnType<typeof getSksSiteByKey>>, max: number) {
  const sourceModels = detail.models.all.length > 0 ? detail.models.all : detail.models.hot;
  const uniqueProviders = Array.from(
    new Map(
      sourceModels
        .map((modelName) => {
          const provider = getProviderMetaFromModel(modelName);
          return [provider.label, provider] as const;
        })
        .filter((entry) => entry[0] && entry[1].iconUrl)
    ).values()
  )
    .sort((a, b) => {
      const priorityDiff = getProviderPriority(a.label) - getProviderPriority(b.label);
      if (priorityDiff !== 0) return priorityDiff;
      return a.label.localeCompare(b.label, "en");
    })
    .slice(0, max);

  return uniqueProviders.map((provider) => {
    const iconPart = `<img src="${escapeHtml(provider.iconUrl)}" alt="${escapeHtml(provider.label)}" class="provider-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
    return `<span class="provider-icon" data-hover="${escapeHtml(provider.label)}">${iconPart}</span>`;
  });
}

function renderProviderLogoLabels(detail: NonNullable<ReturnType<typeof getSksSiteByKey>>, max: number) {
  const sourceModels = detail.models.all.length > 0 ? detail.models.all : detail.models.hot;
  const uniqueProviders = Array.from(
    new Map(
      sourceModels
        .map((modelName) => {
          const provider = getProviderMetaFromModel(modelName);
          return [provider.label, provider] as const;
        })
        .filter((entry) => entry[0] && entry[1].iconUrl)
    ).values()
  )
    .sort((a, b) => {
      const priorityDiff = getProviderPriority(a.label) - getProviderPriority(b.label);
      if (priorityDiff !== 0) return priorityDiff;
      return a.label.localeCompare(b.label, "en");
    })
    .slice(0, max);

  return uniqueProviders.map((provider) => {
    return `<span class="provider-chip" data-hover="${escapeHtml(provider.label)}"><img src="${escapeHtml(provider.iconUrl)}" alt="${escapeHtml(provider.label)}" class="provider-chip-img" loading="lazy" decoding="async" referrerpolicy="no-referrer" /><span class="provider-chip-label">${escapeHtml(provider.label)}</span></span>`;
  });
}

function renderModelTags(detail: NonNullable<ReturnType<typeof getSksSiteByKey>>, max: number) {
  const sourceModels = Array.from(
    new Set(
      (detail.models.all.length > 0 ? detail.models.all : detail.models.hot)
        .map((modelName) => String(modelName || "").trim())
        .filter(Boolean)
    )
  );

  return sourceModels
    .sort((a, b) => {
      const priorityDiff =
        getProviderPriority(inferProviderFamilyFromModelName(a)) -
        getProviderPriority(inferProviderFamilyFromModelName(b));
      if (priorityDiff !== 0) return priorityDiff;
      return a.localeCompare(b, "en");
    })
    .slice(0, max)
    .map((modelName) => {
    const modelStatus = detail.modelStatuses.find((item) => item.modelName === modelName);
    const modelGrid = (modelStatus?.grid?.length ? modelStatus.grid : detail.grid).slice(-24);
    const gridCodes = modelGrid.map((cell) => cell.status).join(",");
    const toneColor = modelStatus ? getStatusColor(modelStatus.current.status) : "#64748b";
    const hoverText = modelStatus
      ? `7天可用率 ${modelStatus.stats7d.successRate.toFixed(1)}% · ${getStatusLabel(modelStatus.current.status)}`
      : "暂无额外统计";
      return `<span class="model-tag" style="border-color:${toneColor}44;background:${toneColor}14;color:${toneColor}" data-hover="${escapeHtml(hoverText)}" data-grid="${escapeHtml(gridCodes)}">${escapeHtml(modelName)}</span>`;
    });
}

function renderHomeCard(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) return null;

  const statusColor = getStatusColor(detail.current.status);
  const tracker = renderTrackerCells(detail, 24);
  const providerIcons = renderProviderIcons(detail, 10).join("");
  const modelTags = renderModelTags(detail, 999).join("");
  const checkedAt = formatCheckedAt(detail.current.checkedAt);
  const dailyCodes = detail.dailyGrid.slice(-30).map((cell) => cell.status).join(",");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
*{box-sizing:border-box}
body{margin:0;background:transparent;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;color:#0f172a}
.wrap{position:relative;padding:10px}
.card{display:flex;flex-direction:column;cursor:pointer;border-radius:16px;border:1px solid #e2e8f0;background:#fff;padding:14px;box-shadow:0 4px 18px rgba(15,23,42,.05);transition:all .2s ease}
.card:hover{transform:translateY(-1px);border-color:rgba(99,102,241,.3);box-shadow:0 12px 28px rgba(99,102,241,.14);background:color-mix(in srgb, rgba(99,102,241,.08) 25%, #fff)}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.title-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.title{font-size:20px;line-height:1.25;font-weight:600;color:#0f172a;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;padding-bottom:1px}
.host{font-size:13px;color:rgba(100,116,139,.5);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.site-link{color:inherit;text-decoration:none;cursor:pointer}
.chev{display:inline-flex;height:20px;width:20px;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e2e8f0;background:#fff;color:#64748b;transition:all .2s ease}
.chev svg{width:14px;height:14px;transition:transform .2s ease}
.status-box{flex:0 0 auto;border-radius:12px;border:1px solid #e2e8f0;background:rgba(99,102,241,.08);padding:6px 8px;min-width:0}
.status-pill{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:${statusColor}}
.status-dot{width:8px;height:8px;border-radius:999px;background:${statusColor}}
.providers{margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.provider-list{display:flex;align-items:center;gap:6px;min-width:0;overflow:auto;padding-bottom:2px}
.provider-icon{display:inline-flex;height:28px;width:28px;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:10px;font-weight:700;flex:0 0 auto}
.provider-img{width:18px;height:18px;object-fit:contain}
.provider-fallback{font-size:10px;font-weight:700;line-height:1}
.collapsed-only{display:none}
.expanded .collapsed-only{display:block}
.expanded .chev svg{transform:rotate(180deg)}
.desc{margin-top:10px;font-size:13px;line-height:1.55;color:#64748b}
.models{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.model-tag{display:inline-flex;align-items:center;border-radius:999px;border:1px solid #e2e8f0;background:#f8fafc;padding:4px 10px;font-size:11px;font-weight:600;color:#334155}
.bottom{margin-top:12px;display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px}
.metrics{min-width:0;flex:1}
.metrics-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:12px;row-gap:6px;align-items:center}
.metric-line{grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;min-width:0}
.metric-left{color:#4f46e5;font-weight:700;cursor:pointer}
.metric-right{color:#64748b;text-align:right;white-space:nowrap;flex:0 0 auto;margin-left:auto}
.tracker-row{grid-column:1;grid-row:2;display:flex;align-items:center;gap:8px}
.tracker{margin-top:6px;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px}
.tracker-row .tracker{margin-top:0;flex:1}
.tracker-cell{height:16px;border-radius:4px;background:#cbd5e1}
.tracker-cell.ok{background:#10b981}
.tracker-cell.slow{background:#f59e0b}
.tracker-cell.failed{background:#ef4444}
.tracker-cell.unknown{background:#cbd5e1}
.brand-link{grid-column:2;grid-row:1 / span 2;display:inline-flex;align-items:center;justify-content:center;align-self:end;justify-self:end;padding:0;margin-right:-8px;margin-bottom:-2px;border:0;background:transparent;text-decoration:none;cursor:pointer;flex:0 0 auto}
.brand-logo{display:block;height:22px;width:auto;max-width:none}
.hover{pointer-events:none;position:absolute;z-index:20;left:0;top:0;transform:translate3d(-999px,-999px,0);opacity:0;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:rgba(15,23,42,.96);padding:6px 8px;font-size:11px;line-height:1.45;color:#e2e8f0;max-width:320px;transition:opacity .12s ease}
.hover.active{opacity:1}
.hover-grid{margin-top:6px;display:flex;gap:2px;flex-wrap:nowrap}
.hover-grid span{display:inline-block;width:6px;height:14px;border-radius:3px;background:#cbd5e1}
</style>
</head>
<body>
  <div class="wrap" id="widget-wrap">
    <article class="card" id="widget-card">
      <div class="head">
        <div style="min-width:0;flex:1;">
          <div class="title-line">
            <a class="title site-link" href="${escapeHtml(detail.site.homepageUrl || `https://${detail.site.hostname}`)}" target="_blank" rel="noreferrer" data-hover="${escapeHtml(detail.site.hostname)}">${escapeHtml(detail.site.displayName)}</a>
            <span class="chev" id="toggle-btn"><svg viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </div>
        </div>
        <div class="status-box" data-hover="${escapeHtml(`最近检测 ${checkedAt}`)}"><div class="status-pill"><span class="status-dot"></span><span>${escapeHtml(getStatusLabel(detail.current.status))}</span></div></div>
      </div>
      <div class="providers">
        <div class="provider-list">${providerIcons || '<span class="provider-icon"><span>AI</span></span>'}</div>
      </div>
      <div class="collapsed-only">
        <p class="desc">${escapeHtml(`${detail.site.displayName} · 最近检查 ${checkedAt}`)}</p>
        <div class="models">${modelTags || '<span class="model-tag">暂无模型</span>'}</div>
      </div>
      <div class="bottom">
        <div class="metrics">
          <div class="metrics-grid"><div class="metric-line"><span class="metric-left" data-hover="30天详细连接状态" data-grid="${escapeHtml(dailyCodes)}">30天 ${detail.stats30d.successRate.toFixed(1)}% 正常</span><span class="metric-right">平均延迟 ${escapeHtml(formatLatency(detail.current.totalMs))}</span></div><div class="tracker-row"><div class="tracker">${tracker}</div></div><a class="brand-link" href="https://sk-buy.com" target="_blank" rel="noreferrer" data-hover="SK Status技术支持"><img class="brand-logo" src="/logo200x54.png" alt="sk-buy.com" loading="lazy" decoding="async" /></a></div>
        </div>
      </div>
    </article>
    <div class="hover" id="hover-pop"></div>
  </div>
<script>
(() => {
  const wrap = document.getElementById('widget-wrap');
  const card = document.getElementById('widget-card');
  const toggle = document.getElementById('toggle-btn');
  const brandLink = wrap.querySelector('.brand-link');
  const siteLinks = wrap.querySelectorAll('.site-link');
  const hover = document.getElementById('hover-pop');
  if (!wrap || !card || !toggle || !hover) return;
  card.classList.remove('expanded');
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    card.classList.toggle('expanded');
  });
  brandLink?.addEventListener('click', (event) => event.stopPropagation());
  siteLinks.forEach((node) => node.addEventListener('click', (event) => event.stopPropagation()));
  card.addEventListener('click', () => card.classList.toggle('expanded'));
  let timer = null;
  const show = (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const content = target.dataset.hover;
    if (!content) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const esc = (value) => String(value || "")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const gridCodes = String(target.dataset.grid || "")
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (gridCodes.length > 0) {
      const blocks = gridCodes
        .map((code) => {
          const color = code === 'ok' ? '#10b981' : code === 'slow' ? '#f59e0b' : code === 'failed' ? '#ef4444' : '#cbd5e1';
          return '<span style="background:' + color + '"></span>';
        })
        .join('');
      hover.innerHTML = '<div>' + esc(content) + '</div><div class="hover-grid">' + blocks + '</div>';
    } else {
      hover.textContent = content;
    }
    const rect = wrap.getBoundingClientRect();
    hover.style.transform = 'translate3d(' + (event.clientX - rect.left + 10) + 'px,' + (event.clientY - rect.top + 10) + 'px,0)';
    hover.classList.add('active');
  };
  const hide = () => {
    timer = setTimeout(() => {
      hover.classList.remove('active');
      hover.style.transform = 'translate3d(-999px,-999px,0)';
    }, 40);
  };
  wrap.querySelectorAll('[data-hover]').forEach((node) => {
    node.addEventListener('mouseenter', show);
    node.addEventListener('mousemove', show);
    node.addEventListener('mouseleave', hide);
  });
})();
</script>
</body>
</html>`;
}

function renderDiscoverCard(siteKey: string) {
  const detail = getSksSiteByKey(siteKey);
  if (!detail) return null;

  const statusColor = getStatusColor(detail.current.status);
  const tracker = renderTrackerCells(detail, 24);
  const providerLabels = renderProviderLogoLabels(detail, 999).join("");
  const modelTags = renderModelTags(detail, 999).join("");
  const checkedAt = formatCheckedAt(detail.current.checkedAt);
  const dailyCodes = detail.dailyGrid.slice(-30).map((cell) => cell.status).join(",");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
*{box-sizing:border-box}
body{margin:0;background:transparent;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;color:#0f172a}
.wrap{position:relative;padding:8px}
.row{border-radius:28px;border:1px solid #e2e8f0;background:#fff;box-shadow:0 4px 18px rgba(15,23,42,.05);transition:all .2s ease;overflow:hidden}
.row:hover{transform:translateY(-1px);border-color:rgba(99,102,241,.2);background:color-mix(in srgb, rgba(99,102,241,.08) 35%, #fff);box-shadow:0 12px 28px rgba(99,102,241,.14)}
.head{cursor:pointer;padding:12px 14px}
.grid{display:grid;grid-template-columns:minmax(120px,auto) minmax(0,1fr) 330px;align-items:center;gap:10px}
.name{display:flex;align-items:center;gap:8px;min-width:0}
.name-title{font-size:15px;font-weight:700;color:#0f172a;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;line-height:1.25;padding-bottom:1px}
.site-link{color:inherit;text-decoration:none;cursor:pointer}
.status-badge{display:inline-flex;align-items:center;border-radius:999px;border:1px solid color-mix(in srgb, ${statusColor} 35%, #e2e8f0);padding:2px 8px;font-size:11px;font-weight:600;color:${statusColor};background:color-mix(in srgb, ${statusColor} 12%, #fff);white-space:nowrap}
.toggle{display:inline-flex;height:24px;width:24px;align-items:center;justify-content:center;border-radius:999px;border:1px solid #e2e8f0;background:#fff;color:#64748b}
.toggle svg{width:14px;height:14px;transition:transform .2s ease}
.expanded .toggle svg{transform:rotate(180deg)}
.providers{display:flex;align-items:center;align-content:center;justify-content:flex-start;justify-self:start;flex-wrap:wrap;gap:6px;row-gap:6px;min-width:0;width:100%;max-height:none;overflow:visible;padding:2px 0}
.provider-chip{display:inline-flex;align-items:center;gap:5px;border-radius:999px;border:1px solid #e2e8f0;background:#f8fafc;padding:4px 8px 3px;flex:0 0 auto;max-width:140px;overflow:visible;line-height:1.25;min-height:26px}
.provider-chip-img{height:14px;width:14px;object-fit:contain;flex:0 0 auto}
.provider-chip-label{font-size:11px;font-weight:500;color:#334155;white-space:normal;word-break:break-word;line-height:1.3;padding-top:0;display:block}
.stats{min-width:330px;width:330px;justify-self:end}
.metrics-grid{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto;row-gap:6px;align-items:center}
.metric-line{grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;min-width:0;padding-right:88px}
.metric-left{color:#4f46e5;font-weight:700;cursor:pointer}
.metric-right{color:#64748b;text-align:right;white-space:nowrap;flex:0 0 auto;margin-left:auto}
.tracker-row{grid-column:1;grid-row:2;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:8px;min-width:0;overflow:hidden}
.tracker{margin-top:0;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px;width:100%;min-width:0}
.tracker-cell{height:16px;border-radius:4px;background:#cbd5e1}
.tracker-cell.ok{background:#10b981}
.tracker-cell.slow{background:#f59e0b}
.tracker-cell.failed{background:#ef4444}
.tracker-cell.unknown{background:#cbd5e1}
.brand-link{display:inline-flex;align-items:center;justify-content:center;padding:0;margin:0;border:0;background:transparent;text-decoration:none;cursor:pointer;flex:0 0 auto}
.brand-logo{display:block;height:22px;width:auto;max-width:none}
.content{display:none;padding:0 14px 14px}
.expanded .content{display:block}
.desc{padding-top:0;margin-top:0;font-size:13px;line-height:1.55;color:#64748b}
.models{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.model-tag{display:inline-flex;align-items:center;border-radius:999px;border:1px solid #e2e8f0;background:#f8fafc;padding:4px 10px;font-size:11px;font-weight:600;color:#334155;cursor:pointer}
.hover{pointer-events:none;position:absolute;z-index:20;left:0;top:0;transform:translate3d(-999px,-999px,0);opacity:0;border-radius:8px;border:1px solid rgba(148,163,184,.4);background:rgba(15,23,42,.96);padding:6px 8px;font-size:11px;line-height:1.45;color:#e2e8f0;max-width:320px;transition:opacity .12s ease}
.hover.active{opacity:1}
.hover-grid{margin-top:6px;display:flex;gap:2px;flex-wrap:nowrap}
.hover-grid span{display:inline-block;width:6px;height:14px;border-radius:3px;background:#cbd5e1}
</style>
</head>
<body>
  <div class="wrap" id="widget-wrap">
    <article class="row" id="widget-row">
      <div class="head" id="toggle-row">
        <div class="grid">
          <div class="name">
            <a class="name-title site-link" href="${escapeHtml(detail.site.homepageUrl || `https://${detail.site.hostname}`)}" target="_blank" rel="noreferrer" data-hover="${escapeHtml(detail.site.hostname)}">${escapeHtml(detail.site.displayName)}</a>
            <span class="status-badge">${escapeHtml(getStatusLabel(detail.current.status))}</span>
            <span class="toggle"><svg viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </div>
          <div class="providers">${providerLabels || '<span class="provider-chip"><span class="provider-chip-label">暂无已识别供应商</span></span>'}</div>
          <div class="stats">
            <div class="metrics-grid"><div class="metric-line"><span class="metric-left" data-hover="30天详细连接状态" data-grid="${escapeHtml(dailyCodes)}">30天 ${detail.stats30d.successRate.toFixed(1)}% 正常</span><span class="metric-right">平均延迟 ${escapeHtml(formatLatency(detail.current.totalMs))}</span></div><div class="tracker-row"><div class="tracker">${tracker}</div><a class="brand-link" href="https://sk-buy.com" target="_blank" rel="noreferrer" data-hover="SK Status技术支持"><img class="brand-logo" src="/logo200x54.png" alt="sk-buy.com" loading="lazy" decoding="async" /></a></div></div>
          </div>
        </div>
      </div>
      <div class="content">
        <p class="desc">${escapeHtml(`${detail.site.hostname} · 最近检测 ${checkedAt}`)}</p>
        <div class="models">${modelTags || '<span class="model-tag">暂无模型</span>'}</div>
      </div>
    </article>
    <div class="hover" id="hover-pop"></div>
  </div>
<script>
(() => {
  const wrap = document.getElementById('widget-wrap');
  const row = document.getElementById('widget-row');
  const toggle = document.getElementById('toggle-row');
  const brandLink = wrap.querySelector('.brand-link');
  const siteLinks = wrap.querySelectorAll('.site-link');
  const hover = document.getElementById('hover-pop');
  if (!wrap || !row || !toggle || !hover) return;
  row.classList.remove('expanded');
  toggle.addEventListener('click', () => row.classList.toggle('expanded'));
  brandLink?.addEventListener('click', (event) => event.stopPropagation());
  siteLinks.forEach((node) => node.addEventListener('click', (event) => event.stopPropagation()));
  let timer = null;
  const show = (event) => {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const content = target.dataset.hover;
    if (!content) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const esc = (value) => String(value || "")
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const gridCodes = String(target.dataset.grid || "")
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (gridCodes.length > 0) {
      const blocks = gridCodes
        .map((code) => {
          const color = code === 'ok' ? '#10b981' : code === 'slow' ? '#f59e0b' : code === 'failed' ? '#ef4444' : '#cbd5e1';
          return '<span style="background:' + color + '"></span>';
        })
        .join('');
      hover.innerHTML = '<div>' + esc(content) + '</div><div class="hover-grid">' + blocks + '</div>';
    } else {
      hover.textContent = content;
    }
    const rect = wrap.getBoundingClientRect();
    hover.style.transform = 'translate3d(' + (event.clientX - rect.left + 10) + 'px,' + (event.clientY - rect.top + 10) + 'px,0)';
    hover.classList.add('active');
  };
  const hide = () => {
    timer = setTimeout(() => {
      hover.classList.remove('active');
      hover.style.transform = 'translate3d(-999px,-999px,0)';
    }, 40);
  };
  wrap.querySelectorAll('[data-hover]').forEach((node) => {
    node.addEventListener('mouseenter', show);
    node.addEventListener('mousemove', show);
    node.addEventListener('mouseleave', hide);
  });
})();
</script>
</body>
</html>`;
}

function renderSiteCardCompact(siteKey: string) {
  return renderDiscoverCard(siteKey);
}

function renderSiteCardLarge(siteKey: string) {
  return renderHomeCard(siteKey);
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

  const statusColor = getStatusColor(detail.current.status);
  const checkedAt = formatCheckedAt(detail.current.checkedAt);
  const siteUrl = detail.site.homepageUrl || `https://${detail.site.hostname}`;
  const dailyCodes = detail.dailyGrid.slice(-30).map((cell) => cell.status).join(",");
  const siteTracker = detail.grid
    .slice(-24)
    .map((cell) => {
      const hoverText = `${cell.label} · ${getStatusLabel(cell.status)} · ${formatLatency(cell.totalMs)}`;
      return `<span class="tracker-cell ${cell.status}" data-hover="${escapeHtml(hoverText)}"></span>`;
    })
    .join("");

  const providerPriorityMap = new Map<string, number>([
    ["Claude", 0],
    ["OpenAI", 1],
    ["Gemini", 2],
  ]);

  const modelItems =
    detail.modelStatuses.length > 0
      ? detail.modelStatuses.map((model) => {
          const tone = getStatusColor(model.current.status);
          const provider = getProviderMetaFromModel(model.modelName);
          const providerLabel = provider.label || "未知供应商";
          const providerIcon = provider.iconUrl || "";
          const providerDarkIcon = provider.darkIconUrl || "";
          const modelGrid = (model.grid.length > 0 ? model.grid : detail.grid)
            .slice(-24)
            .map((cell) => {
              const hoverText = `${cell.label} · ${formatLatency(cell.totalMs)}`;
              return `<span class="model-cell ${cell.status}" data-hover="${escapeHtml(hoverText)}"></span>`;
            })
            .join("");

          const providerRank = providerPriorityMap.has(providerLabel)
            ? providerPriorityMap.get(providerLabel)!
            : 10 + getProviderPriority(providerLabel);

          return {
            providerLabel,
            providerRank,
            card: `<article class="model-card"><div class="model-head"><div class="model-title-wrap">${providerIcon ? `<img src="${escapeHtml(providerIcon)}" data-light="${escapeHtml(providerIcon)}" data-dark="${escapeHtml(providerDarkIcon || providerIcon)}" alt="${escapeHtml(providerLabel)}" class="provider-icon" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : '<span class="provider-icon provider-fallback">AI</span>'}<div class="model-name-wrap"><div class="model-name" data-hover="${escapeHtml(model.modelName)}">${escapeHtml(model.modelName)}</div></div></div><span class="model-status" style="color:${tone};border-color:${tone}44;background:${tone}14"><span class="status-dot" style="background:${tone}"></span>${escapeHtml(getStatusLabel(model.current.status))}</span></div><div class="model-sub">${escapeHtml(providerLabel)} · 最近 ${escapeHtml(formatCheckedAt(model.current.checkedAt || model.lastSeenAt))}</div><div class="model-metrics"><div class="metric"><span class="metric-label">7天可用率</span><span class="metric-value">${model.stats7d.successRate.toFixed(1)}%</span></div><div class="metric"><span class="metric-label">当前延迟</span><span class="metric-value">${escapeHtml(formatLatency(model.current.totalMs))}</span></div></div><div class="model-grid">${modelGrid}</div></article>`,
          };
        })
      : detail.models.all.map((modelName) => {
          const provider = getProviderMetaFromModel(modelName);
          const providerLabel = provider.label || "未知供应商";
          const providerIcon = provider.iconUrl || "";
          const providerDarkIcon = provider.darkIconUrl || "";

          return {
            providerLabel,
            providerRank: providerPriorityMap.has(providerLabel)
              ? providerPriorityMap.get(providerLabel)!
              : 10 + getProviderPriority(providerLabel),
            card: `<article class="model-card"><div class="model-head"><div class="model-title-wrap">${providerIcon ? `<img src="${escapeHtml(providerIcon)}" data-light="${escapeHtml(providerIcon)}" data-dark="${escapeHtml(providerDarkIcon || providerIcon)}" alt="${escapeHtml(providerLabel)}" class="provider-icon" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : '<span class="provider-icon provider-fallback">AI</span>'}<div class="model-name-wrap"><div class="model-name" data-hover="${escapeHtml(modelName)}">${escapeHtml(modelName)}</div></div></div><span class="model-status"><span class="status-dot"></span>暂无探测</span></div><div class="model-sub">${escapeHtml(providerLabel)} · 暂未生成该模型状态轨迹</div><div class="model-grid">${Array.from({ length: 24 }, () => '<span class="model-cell unknown"></span>').join("")}</div></article>`,
          };
        });

  const providerGroups = new Map<string, { rank: number; cards: string[] }>();
  for (const item of modelItems) {
    if (!providerGroups.has(item.providerLabel)) {
      providerGroups.set(item.providerLabel, { rank: item.providerRank, cards: [] });
    }
    providerGroups.get(item.providerLabel)!.cards.push(item.card);
  }

  const groupedModelRows = Array.from(providerGroups.entries())
    .sort((a, b) => {
      if (a[1].rank !== b[1].rank) return a[1].rank - b[1].rank;
      return a[0].localeCompare(b[0], "en");
    })
    .map(([, group]) => `<div class="model-row"><div class="model-matrix">${group.cards.join("")}</div></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
*{box-sizing:border-box}
body{margin:0;font-family:Inter,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;background:transparent;--bg:#ffffff;--card:#ffffff;--card-alt:#f8fafc;--text:#0f172a;--muted:#64748b;--border:#e2e8f0;--shadow:0 10px 30px rgba(15,23,42,.08)}
body[data-theme="dark"]{--bg:#020617;--card:#0f172a;--card-alt:#0b1220;--text:#e2e8f0;--muted:#94a3b8;--border:rgba(148,163,184,.26);--shadow:0 18px 46px rgba(2,6,23,.52)}
.screen{position:relative;padding:10px;background:var(--bg);color:var(--text)}
.card{padding:16px;border:1px solid var(--border);border-radius:20px;background:var(--card);box-shadow:var(--shadow)}
.title-row{display:flex;align-items:center;gap:16px;flex-wrap:nowrap}
.site-info-block{min-width:0;max-width:calc(100% - 520px)}
.site-main{min-width:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.site-link{color:inherit;text-decoration:none;font-size:30px;font-weight:700;line-height:1.25;letter-spacing:.01em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;padding-bottom:1px}
.site-status{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:400;border:1px solid color-mix(in srgb, ${statusColor} 36%, var(--border));background:color-mix(in srgb, ${statusColor} 14%, var(--card));color:${statusColor}}
.status-dot{width:8px;height:8px;border-radius:999px;background:${statusColor}}
.brand-link{display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;text-decoration:none;cursor:pointer;flex:0 0 auto}
.brand-logo{display:block;height:24px;width:auto;max-width:none}
.site-sub{margin-top:8px;color:var(--muted);font-size:13px}
.site-status-group{width:360px;flex:0 0 360px;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--card-alt);margin-top:0;margin-left:14px}
.site-metric-line{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.site-metric-left{font-weight:700;color:#4f46e5;cursor:pointer}
.site-metric-right{color:var(--muted)}
.site-tracker{margin-top:8px;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:3px}
.tracker-cell{height:12px;border-radius:4px;background:#cbd5e1;cursor:pointer}
.tracker-cell.ok{background:#10b981}
.tracker-cell.slow{background:#f59e0b}
.tracker-cell.failed{background:#ef4444}
.tracker-cell.unknown{background:#94a3b8}
.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
.stat{padding:12px;border-radius:12px;border:1px solid var(--border);background:var(--card-alt)}
.label{display:block;font-size:11px;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
.value{display:block;margin-top:6px;font-size:22px;font-weight:400;color:var(--text)}
.board{margin-top:14px;border:1px solid var(--border);border-radius:14px;background:var(--card-alt);padding:12px}
.board-title{font-size:13px;font-weight:400;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
.model-row + .model-row{margin-top:10px}
.model-matrix{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.model-card{border:1px solid var(--border);background:var(--card);border-radius:12px;padding:12px;transition:all .2s ease;cursor:pointer}
.model-card:hover{transform:translateY(-1px);border-color:color-mix(in srgb, ${statusColor} 35%, var(--border));box-shadow:0 10px 22px rgba(15,23,42,.08)}
.model-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.model-title-wrap{display:flex;align-items:center;gap:8px;min-width:0}
.provider-icon{width:28px;height:28px;object-fit:contain;border-radius:999px;flex:0 0 auto}
.provider-fallback{display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:400;border:1px solid var(--border);background:var(--card-alt);color:var(--muted)}
.model-name-wrap{min-height:2.5em;display:flex;align-items:center}
.model-name{font-size:18px;line-height:1.25;font-weight:400;color:var(--text);word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;max-height:2.5em}
.model-status{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--border);border-radius:999px;padding:2px 8px;font-size:11px;font-weight:400;white-space:nowrap}
.model-sub{margin-top:7px;font-size:11px;line-height:1.45;color:var(--muted)}
.model-metrics{margin-top:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.metric{padding:8px;border-radius:10px;border:1px solid var(--border);background:var(--card-alt)}
.metric-label{display:block;font-size:10px;color:var(--muted)}
.metric-value{display:block;margin-top:4px;font-size:14px;font-weight:400;color:var(--text)}
.model-grid{margin-top:9px;display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px}
.model-cell{height:12px;border-radius:4px;background:#cbd5e1;transition:filter .15s ease,opacity .15s ease}
.model-cell.ok{background:#10b981}
.model-cell.slow{background:#f59e0b}
.model-cell.failed{background:#ef4444}
.model-cell.unknown{background:#94a3b8}
.model-cell[data-hover]{cursor:pointer}
.model-cell[data-hover]:hover{filter:saturate(25%);opacity:.45}
.right-ops{display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;min-height:62px;gap:8px;margin-left:auto}
.mode-btn{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--border);background:var(--card);color:var(--text);border-radius:999px;cursor:pointer}
.mode-icon{width:18px;height:18px;display:block}
.hover{pointer-events:none;position:absolute;z-index:50;left:0;top:0;transform:translate3d(-999px,-999px,0);opacity:0;border-radius:8px;border:1px solid rgba(148,163,184,.45);background:rgba(15,23,42,.96);padding:6px 8px;font-size:11px;line-height:1.45;color:#e2e8f0;max-width:260px;transition:opacity .12s ease}
.hover.active{opacity:1}
.hover-grid{margin-top:6px;display:flex;gap:2px;flex-wrap:nowrap}
.hover-grid span{display:inline-block;width:6px;height:14px;border-radius:3px;background:#cbd5e1}
@media (max-width:1280px){.site-info-block{max-width:calc(100% - 480px)}.site-status-group{width:320px;flex-basis:320px}.model-matrix{grid-template-columns:repeat(3,minmax(0,1fr));}}
@media (max-width:980px){.title-row{flex-wrap:wrap}.site-info-block{max-width:100%}.site-status-group{width:100%;flex-basis:100%}.right-ops{margin-left:0;align-items:flex-start;min-height:auto;flex-direction:row-reverse;justify-content:space-between}.stats{grid-template-columns:repeat(2,minmax(0,1fr));}.model-matrix{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:560px){.site-link{font-size:20px}.stats{grid-template-columns:1fr}}
</style>
</head>
<body data-theme="light">
  <div class="screen" id="screen-wrap">
  <div class="card">
    <div class="title-row">
      <div class="site-info-block">
        <div class="site-main">
          <a class="site-link" href="${escapeHtml(siteUrl)}" target="_blank" rel="noreferrer" data-hover="${escapeHtml(detail.site.hostname)}">${escapeHtml(detail.site.displayName)}</a>
          <span class="site-status"><span class="status-dot"></span>${escapeHtml(getStatusLabel(detail.current.status))}</span>
        </div>
        <div class="site-sub">${escapeHtml(detail.site.hostname)} · 最后检查 ${escapeHtml(checkedAt)}</div>
      </div>
      <div class="site-status-group">
        <div class="site-metric-line"><span class="site-metric-left" data-hover="30天详细连接状态" data-grid="${escapeHtml(dailyCodes)}">30天 ${detail.stats30d.successRate.toFixed(1)}% 正常</span><span class="site-metric-right">平均延迟 ${escapeHtml(formatLatency(detail.current.totalMs))}</span></div>
        <div class="site-tracker">${siteTracker}</div>
      </div>
      <div class="right-ops">
        <button class="mode-btn" id="mode-btn" type="button" title="切换亮暗模式" aria-label="切换亮暗模式"><svg class="mode-icon" id="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg></button>
        <a class="brand-link" href="https://sk-buy.com" target="_blank" rel="noreferrer" data-hover="SK Status技术支持"><img class="brand-logo" src="/logo200x54.png" data-light="/logo200x54.png" data-dark="/logo200x54_d.png" alt="sk-buy.com" loading="lazy" decoding="async" /></a>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="label">7天可用率</div><div class="value">${detail.stats7d.successRate.toFixed(1)}%</div></div>
      <div class="stat"><div class="label">当前延迟</div><div class="value">${escapeHtml(formatLatency(detail.current.totalMs))}</div></div>
      <div class="stat"><div class="label">模型数量</div><div class="value">${detail.models.count}</div></div>
    </div>
    <section class="board">
      <div class="board-title">模型状态矩阵</div>
      ${groupedModelRows || '<div class="model-row"><div class="model-matrix"><article class="model-card"><div class="model-name">暂无模型</div></article></div></div>'}
    </section>
  </div>
  <div class="hover" id="hover-pop"></div>
  <script>
  (() => {
    const screen = document.getElementById('screen-wrap');
    const hover = document.getElementById('hover-pop');
    const modeBtn = document.getElementById('mode-btn');
    const modeIcon = document.getElementById('mode-icon');
    if (!screen || !hover || !modeBtn) return;

    const sunIcon = '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>';
    const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3c.5 3 3 5.5 6 6 .7 1 .9 2.2.79 3.79z"></path>';

    const syncThemeAssets = (isDark) => {
      screen.querySelectorAll('[data-light][data-dark]').forEach((node) => {
        if (node instanceof HTMLImageElement) {
          const lightSrc = node.dataset.light || '';
          const darkSrc = node.dataset.dark || lightSrc;
          node.src = isDark ? darkSrc : lightSrc;
        }
      });
    };

    modeBtn.addEventListener('click', () => {
      const dark = document.body.getAttribute('data-theme') === 'dark';
      const nextDark = !dark;
      document.body.setAttribute('data-theme', nextDark ? 'dark' : 'light');
      if (modeIcon) modeIcon.innerHTML = nextDark ? moonIcon : sunIcon;
      syncThemeAssets(nextDark);
    });

    syncThemeAssets(false);

    let timer = null;
    const show = (event) => {
      const target = event.currentTarget;
      if (!(target instanceof HTMLElement)) return;
      const content = target.dataset.hover;
      if (!content) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const esc = (value) => String(value || "")
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
      const gridCodes = String(target.dataset.grid || "")
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (gridCodes.length > 0) {
        const blocks = gridCodes
          .map((code) => {
            const color = code === 'ok' ? '#10b981' : code === 'slow' ? '#f59e0b' : code === 'failed' ? '#ef4444' : '#cbd5e1';
            return '<span style="background:' + color + '"></span>';
          })
          .join('');
        hover.innerHTML = '<div>' + esc(content) + '</div><div class="hover-grid">' + blocks + '</div>';
      } else {
        hover.textContent = content;
      }
      const rect = screen.getBoundingClientRect();
      hover.style.transform = 'translate3d(' + (event.clientX - rect.left + 10) + 'px,' + (event.clientY - rect.top + 10) + 'px,0)';
      hover.classList.add('active');
    };
    const hide = () => {
      timer = setTimeout(() => {
        hover.classList.remove('active');
        hover.style.transform = 'translate3d(-999px,-999px,0)';
      }, 40);
    };

    screen.querySelectorAll('[data-hover]').forEach((node) => {
      node.addEventListener('mouseenter', show);
      node.addEventListener('mousemove', show);
      node.addEventListener('mouseleave', hide);
    });
  })();
  </script>
  </div>
</body>
</html>`;
}

export async function GET(request: Request, { params }: { params: Promise<{ siteKey: string }> }) {
  try {
    const { siteKey } = await params;
    const { searchParams } = new URL(request.url);
    const fingerprint = String(searchParams.get("fp") || "").trim();
    const verified = verifySksEmbedFingerprint({ fingerprint, siteKey });
    if (!verified.valid) {
      return new Response("Forbidden", { status: 403 });
    }
    const template = String(searchParams.get("template") || "badge").trim();
    const lengthParam = searchParams.get("length");
    const html =
      template === "site-card-compact"
        ? renderSiteCardCompact(siteKey)
        : template === "site-card-large"
          ? renderSiteCardLarge(siteKey)
          : template === "mini-grid"
            ? renderMiniGrid(siteKey)
            : template === "full-card"
              ? renderFullCard(siteKey)
              : renderBadge(siteKey);

    if (!html) {
      return new Response("Widget not found", { status: 404 });
    }

    const maxLength = 2000;
    const minLength = 120;
    const requestedLength = Number.parseInt(String(lengthParam || ""), 10);
    const safeLength = Number.isFinite(requestedLength)
      ? Math.max(minLength, Math.min(maxLength, requestedLength))
      : null;
    const outputHtml =
      safeLength && (template === "site-card-large" || template === "site-card-compact")
        ? html
            .replace("<body>", `<body style=\"margin:0;padding:0;overflow-x:auto;overflow-y:hidden;\">`)
            .replace('id="widget-wrap"', `id="widget-wrap" style="width:${safeLength}px;max-width:${safeLength}px"`)
        : safeLength && template === "full-card"
          ? html
              .replace("<body", `<body style=\"margin:0;padding:0;overflow-x:auto;overflow-y:auto;\"`)
              .replace('id="screen-wrap"', `id="screen-wrap" style="width:${safeLength}px;max-width:${safeLength}px"`)
          : html;

    return new Response(outputHtml, {
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
