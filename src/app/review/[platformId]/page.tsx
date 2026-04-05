import { notFound, redirect } from "next/navigation";
import { getPlatformById } from "@/lib/db";
import { ensurePlatformReviewTopic } from "@/lib/forum-db";

export default async function PlatformReviewEntryPage({
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

  const topic = ensurePlatformReviewTopic(numericPlatformId);
  if (!topic) {
    notFound();
  }

  redirect(`/forum/t/${topic.id}`);
}
