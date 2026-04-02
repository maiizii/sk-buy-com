import { requireAdmin } from "@/lib/auth";
import {
  createPlatformAttributeOption,
  deletePlatformAttributeOption,
  updatePlatformAttributeOption,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const option = createPlatformAttributeOption(body);
    return Response.json({ success: true, data: option }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建选项失败";
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
      return Response.json({ success: false, error: "缺少选项 id" }, { status: 400 });
    }
    const option = updatePlatformAttributeOption(id, updates);
    if (!option) {
      return Response.json({ success: false, error: "选项不存在" }, { status: 404 });
    }
    return Response.json({ success: true, data: option });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新选项失败";
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
      return Response.json({ success: false, error: "缺少选项 id" }, { status: 400 });
    }
    const ok = deletePlatformAttributeOption(id);
    if (!ok) {
      return Response.json({ success: false, error: "选项不存在" }, { status: 404 });
    }
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除选项失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return Response.json({ success: false, error: message }, { status });
  }
}
