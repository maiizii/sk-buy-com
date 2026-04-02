import {
  getAllPlatforms,
  getHourlyConnectivityLogs,
  getConnectivitySummary,
} from "@/lib/db";
// Side-effect import: starts the monitor loop on first server-side load
import "@/lib/monitor";

export async function GET() {
  try {
    const platforms = getAllPlatforms();
    const data: Record<
      string,
      {
        logs: ReturnType<typeof getHourlyConnectivityLogs>;
        summary: ReturnType<typeof getConnectivitySummary>;
      }
    > = {};

    for (const p of platforms) {
      if (p.monitorEnabled) {
        data[p.id] = {
          logs: getHourlyConnectivityLogs(p.id),
          summary: getConnectivitySummary(p.id),
        };
      }
    }

    return Response.json({ success: true, data });
  } catch {
    return Response.json(
      { success: false, error: "获取连通性数据失败" },
      { status: 500 }
    );
  }
}
