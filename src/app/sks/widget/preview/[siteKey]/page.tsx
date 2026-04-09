import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Link2 } from "lucide-react";
import { getSksSiteByKey } from "@/lib/sks/service";

export const dynamic = "force-dynamic";

type VisualTemplate = "site-card-large" | "site-card-compact" | "full-card";

const TEMPLATE_LABEL: Record<VisualTemplate, string> = {
  "site-card-large": "小卡片",
  "site-card-compact": "长条",
  "full-card": "大屏",
};

function resolveTemplate(value: string | undefined): VisualTemplate {
  if (value === "site-card-compact") return "site-card-compact";
  if (value === "full-card") return "full-card";
  return "site-card-large";
}

function resolveLength(value: string | undefined) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return 980;
  return Math.max(120, Math.min(2000, parsed));
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
      title: "预览不存在 — SKS",
      description: "请求的 SKS 站点不存在或尚未公开。",
    };
  }
  return {
    title: `${detail.site.displayName} 可视化调用预览 — SKS`,
    description: `预览 ${detail.site.displayName} 的可嵌入调用样式。`,
  };
}

export default async function SksWidgetPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteKey } = await params;
  const search = searchParams ? await searchParams : {};
  const detail = getSksSiteByKey(siteKey);
  if (!detail) notFound();

  const template = resolveTemplate(typeof search.template === "string" ? search.template : undefined);
  const length = resolveLength(typeof search.length === "string" ? search.length : undefined);
  const encodedSiteKey = encodeURIComponent(detail.site.normalizedHostname || detail.site.id);
  const widgetPreviewUrl =
    template === "site-card-large" || template === "site-card-compact"
      ? `/api/sks/widget/${encodedSiteKey}?template=${template}&length=${length}`
      : `/api/sks/widget/${encodedSiteKey}?template=${template}`;
  const jsonUrl = `/api/sks/site/${encodedSiteKey}`;
  const statusPageUrl = `/sks/site/${encodedSiteKey}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <Link href="/sks" className="inline-flex items-center gap-2 hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          返回 SKS
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">可视化预览</span>
      </div>

      <section className="shell-panel space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              {detail.site.displayName} · {TEMPLATE_LABEL[template]}样式预览
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              当前页面用于查看完整预览效果，后续会继续扩展内容模块和明暗风格配置。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <a href={widgetPreviewUrl} target="_blank" rel="noreferrer" className="btn-glass">
              原始预览
              <ExternalLink className="h-4 w-4" />
            </a>
            <Link href={statusPageUrl} className="btn-glass">
              状态页
            </Link>
            <a href={jsonUrl} target="_blank" rel="noreferrer" className="btn-glass">
              <Link2 className="h-4 w-4" />
              JSON
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-3">
          <iframe
            title={`sks-preview-${detail.site.id}-${template}`}
            src={widgetPreviewUrl}
            className="w-full"
            style={{ border: 0, height: template === "full-card" ? 980 : 360, borderRadius: 12 }}
          />
        </div>
      </section>
    </div>
  );
}
