import { notFound, redirect } from "next/navigation";
import { ensureSiteReviewTopic } from "@/lib/forum-db";

export default async function SiteReviewEntryPage({
  params,
}: {
  params: Promise<{ siteKey: string }>;
}) {
  const { siteKey } = await params;
  const topic = ensureSiteReviewTopic(siteKey);

  if (!topic) {
    notFound();
  }

  redirect(`/forum/t/${topic.id}`);
}
