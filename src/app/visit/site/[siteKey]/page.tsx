import { notFound, redirect } from "next/navigation";
import { getSiteCatalogSiteByHostname, incrementSiteCatalogVisitCount } from "@/lib/site-catalog/db";

function normalizeExternalUrl(url: string | null | undefined) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function SiteVisitEntryPage({
  params,
}: {
  params: Promise<{ siteKey: string }>;
}) {
  const { siteKey } = await params;
  const site = getSiteCatalogSiteByHostname(siteKey);

  if (!site || site.visibility !== "public" || site.catalogStatus !== "active") {
    notFound();
  }

  const targetUrl = normalizeExternalUrl(site.homepageUrl || site.apiBaseUrl);
  if (targetUrl === "#") {
    notFound();
  }

  incrementSiteCatalogVisitCount(siteKey);
  redirect(targetUrl);
}
