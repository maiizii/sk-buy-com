// Side-effect: auto-starts the SKS probe monitor loop
import "@/lib/sks/monitor";
import {
  SKS_GRID_HOURS,
  SKS_RETENTION_DAYS,
  getRecentFailureMessages,
} from "@/lib/sks/service";
import { getPublicSiteCatalogDetail } from "@/lib/site-catalog/service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    const { siteKey } = await params;
    const detail = getPublicSiteCatalogDetail(siteKey);

    if (!detail) {
      return Response.json(
        { success: false, error: "站点目录详情不存在" },
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
        recentFailures: detail.sksDetail ? getRecentFailureMessages(detail.sksDetail) : [],
      },
    });
  } catch (error) {
    console.error("[api/site] failed:", error);
    return Response.json(
      { success: false, error: "获取站点目录详情失败" },
      { status: 500 }
    );
  }
}
