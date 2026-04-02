import {
  createPlatform,
  deletePlatform,
  getAllPlatforms,
  replacePlatformAttributeValues,
  updatePlatform,
} from "@/lib/db";
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

function normalizeModels(input: unknown) {
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAttributeValues(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      return {
        groupKey: String(value.groupKey || "").trim(),
        optionValue: String(value.optionValue || "").trim(),
        valueText: String(value.valueText || "").trim(),
        valueNumber: value.valueNumber === null || value.valueNumber === undefined || value.valueNumber === ""
          ? null
          : Number(value.valueNumber),
        valueBoolean: typeof value.valueBoolean === "boolean" ? value.valueBoolean : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.groupKey));
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
      models: normalizeModels(data.models),
      uptime: data.uptime || 0,
      latency: data.latency || 0,
      joinDate: data.joinDate || new Date().toISOString().split("T")[0],
      description: data.description || "",
      sortOrder: data.sortOrder || 0,
    });

    replacePlatformAttributeValues(platform.id, normalizeAttributeValues(data.attributeValues));

    return Response.json({ success: true, data: platform }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    const { id } = data;

    if (!id) {
      return Response.json({ success: false, error: "缺少平台 id" }, { status: 400 });
    }

    const platform = updatePlatform(id, {
      name: data.name,
      url: data.url,
      baseUrl: data.baseUrl || "",
      monitorEnabled: !!data.monitorEnabled,
      tag: data.tag,
      tagLabel: data.tagLabel,
      billingRate: data.billingRate,
      billingColor: data.billingColor || "text-foreground",
      models: normalizeModels(data.models),
      uptime: data.uptime || 0,
      latency: data.latency || 0,
      joinDate: data.joinDate,
      description: data.description || "",
      sortOrder: data.sortOrder || 0,
      status: data.status || "active",
    });

    if (!platform) {
      return Response.json({ success: false, error: "平台不存在" }, { status: 404 });
    }

    replacePlatformAttributeValues(platform.id, normalizeAttributeValues(data.attributeValues));

    return Response.json({ success: true, data: platform });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ success: false, error: "缺少平台 id" }, { status: 400 });
    }

    const ok = deletePlatform(id);
    if (!ok) {
      return Response.json({ success: false, error: "平台不存在" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
