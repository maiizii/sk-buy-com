import { requireAdmin } from "@/lib/auth";
import {
  createPlatformAttributeGroup,
  deletePlatformAttributeGroup,
  updatePlatformAttributeGroup,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const group = createPlatformAttributeGroup(body);
    return Response.json({ success: true, data: group }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建分组失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return Response.json({ success: false, error: "缺少分组 id" }, { status: 400 });
    }
    const group = updatePlatformAttributeGroup(id, updates);
    if (!group) {
      return Response.json({ success: false, error: "分组不存在" }, { status: 404 });
    }
    return Response.json({ success: true, data: group });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新分组失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return Response.json({ success: false, error: "缺少分组 id" }, { status: 400 });
    }
    const ok = deletePlatformAttributeGroup(id);
    if (!ok) {
      return Response.json({ success: false, error: "分组不存在" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除分组失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}
