import { notFound, redirect } from "next/navigation";
import { getPlatformById, incrementPlatformVisitCount } from "@/lib/db";

function normalizeExternalUrl(url: string) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default async function PlatformVisitEntryPage({
  params,
}: {
  params: Promise<{ platformId: string }>;
}) {
  const { platformId } = await params;
  const numericPlatformId = Number(platformId);

  if (!Number.isInteger(numericPlatformId) || numericPlatformId <= 0) {
    notFound();
  }

  const platform = getPlatformById(numericPlatformId);
  if (!platform) {
    notFound();
  }

  const targetUrl = normalizeExternalUrl(platform.visitUrl || platform.url);
  if (targetUrl === "#") {
    notFound();
  }

  incrementPlatformVisitCount(numericPlatformId);
  redirect(targetUrl);
}
