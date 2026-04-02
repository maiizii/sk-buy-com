import { requireAdmin } from "@/lib/auth";
import { runMonitorCycle } from "@/lib/monitor";

export async function POST() {
  try {
    await requireAdmin();
    await runMonitorCycle();
    return Response.json({ success: true, message: "健康检查已完成" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "检查失败";
    const status =
      message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
