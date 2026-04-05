import {
  SKS_GRID_HOURS,
  SKS_RETENTION_DAYS,
  getRecentFailureMessages,
  getSksSiteByKey,
} from "@/lib/sks/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    const { siteKey } = await params;
    const detail = getSksSiteByKey(siteKey);

    if (!detail) {
      return Response.json(
        { success: false, error: "站点状态不存在" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      meta: {
        gridHours: SKS_GRID_HOURS,
        retentionDays: SKS_RETENTION_DAYS,
      },
      data: {
        ...detail,
        recentFailures: getRecentFailureMessages(detail),
      },
    });
  } catch (error) {
    console.error("[api/sks/site] failed:", error);
    return Response.json(
      { success: false, error: "获取 SKS 站点详情失败" },
      { status: 500 }
    );
  }
}
