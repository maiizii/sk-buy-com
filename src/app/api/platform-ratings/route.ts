import { upsertRating, getRatingsByPlatform, getRatingSummary, getAllRatingSummaries } from "@/lib/forum-db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platformIdParam = searchParams.get("platformId");

    // If no platformId, return all summaries for the homepage
    if (!platformIdParam) {
      const summaries = getAllRatingSummaries();
      return Response.json({ success: true, data: summaries });
    }

    const platformId = Number(platformIdParam);
    if (!Number.isInteger(platformId) || platformId <= 0) {
      return Response.json({ success: false, error: "平台不存在" }, { status: 404 });
    }

    const ratings = getRatingsByPlatform(platformId);
    const summary = getRatingSummary(platformId);
    return Response.json({ success: true, data: { ratings, summary } });
  } catch {
    return Response.json({ success: false, error: "获取评分失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { platformId: rawPlatformId, score, comment } = await request.json();
    const platformId = Number(rawPlatformId);
    if (!Number.isInteger(platformId) || platformId <= 0 || !score || score < 1 || score > 5) {
      return Response.json({ success: false, error: "评分无效（1-5 分）" }, { status: 400 });
    }

    const rating = upsertRating({
      platformId,
      userId: user.id,
      score,
      comment: comment || "",
    });

    return Response.json({ success: true, data: rating });
  } catch (err) {
    const message = err instanceof Error ? err.message : "评分失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
