import { redirect } from "next/navigation";

export default async function LegacyPlatformReviewEntryPage({
  params,
}: {
  params: Promise<{ platformId: string }>;
}) {
  const { platformId } = await params;
  redirect(`/review/${platformId}`);
}
