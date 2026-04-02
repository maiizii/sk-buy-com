import { getAllPlatforms, createPlatform } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
// Side-effect: auto-starts the connectivity monitor loop
import "@/lib/monitor";

export async function GET() {
  try {
    const platforms = getAllPlatforms();
    return Response.json({ success: true, data: platforms });
  } catch {
    return Response.json(
      { success: false, error: "获取平台列表失败" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const data = await request.json();
    const { id, name, url, tag, tagLabel, billingRate } = data;

    if (!id || !name || !url || !tag || !tagLabel || !billingRate) {
      return Response.json(
        { success: false, error: "缺少必填字段" },
        { status: 400 }
      );
    }

    const platform = createPlatform({
      id,
      name,
      url,
      baseUrl: data.baseUrl || "",
      monitorEnabled: data.monitorEnabled || false,
      tag,
      tagLabel,
      billingRate,
      billingColor: data.billingColor || "text-foreground",
      models: data.models || [],
      uptime: data.uptime || 0,
      latency: data.latency || 0,
      joinDate: data.joinDate || new Date().toISOString().split("T")[0],
      description: data.description || "",
      sortOrder: data.sortOrder || 0,
    });

    return Response.json({ success: true, data: platform }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
