import { SKS_GRID_HOURS, SKS_RETENTION_DAYS, getSksSiteList } from "@/lib/sks/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({
      success: true,
      meta: {
        gridHours: SKS_GRID_HOURS,
        retentionDays: SKS_RETENTION_DAYS,
      },
      data: getSksSiteList(),
    });
  } catch (error) {
    console.error("[api/sks/sites] failed:", error);
    return Response.json(
      { success: false, error: "获取 SKS 站点列表失败" },
      { status: 500 }
    );
  }
}
