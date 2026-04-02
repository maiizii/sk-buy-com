import { getPlatformById, updatePlatform, deletePlatform } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const platform = getPlatformById(id);
    if (!platform) {
      return Response.json(
        { success: false, error: "平台不存在" },
        { status: 404 }
      );
    }
    return Response.json({ success: true, data: platform });
  } catch {
    return Response.json(
      { success: false, error: "获取平台详情失败" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const data = await request.json();

    const platform = updatePlatform(id, data);
    if (!platform) {
      return Response.json(
        { success: false, error: "平台不存在" },
        { status: 404 }
      );
    }
    return Response.json({ success: true, data: platform });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const deleted = deletePlatform(id);
    if (!deleted) {
      return Response.json(
        { success: false, error: "平台不存在" },
        { status: 404 }
      );
    }
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
