// Side-effect: auto-starts the SKS probe monitor loop
import "@/lib/sks/monitor";
import { listPublicSiteCatalogCards } from "@/lib/site-catalog/service";
import { SKS_GRID_HOURS, SKS_RETENTION_DAYS } from "@/lib/sks/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({
      success: true,
      meta: {
        gridHours: SKS_GRID_HOURS,
        retentionDays: SKS_RETENTION_DAYS,
        count: listPublicSiteCatalogCards().length,
      },
      data: listPublicSiteCatalogCards(),
    });
  } catch (error) {
    console.error("[api/sites] failed:", error);
    return Response.json(
      { success: false, error: "获取站点目录列表失败" },
      { status: 500 }
    );
  }
}
