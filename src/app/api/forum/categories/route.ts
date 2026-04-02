import { getAllCategories, createCategory, updateCategory, deleteCategory } from "@/lib/forum-db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const categories = getAllCategories();
    return Response.json({ success: true, data: categories });
  } catch {
    return Response.json({ success: false, error: "获取板块失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    if (!data.id || !data.name) {
      return Response.json({ success: false, error: "ID 和名称必填" }, { status: 400 });
    }
    const category = createCategory(data);
    return Response.json({ success: true, data: category }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const data = await request.json();
    if (!data.id) {
      return Response.json({ success: false, error: "ID 必填" }, { status: 400 });
    }
    const category = updateCategory(data.id, data);
    if (!category) {
      return Response.json({ success: false, error: "板块不存在" }, { status: 404 });
    }
    return Response.json({ success: true, data: category });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { id } = await request.json();
    if (!id) {
      return Response.json({ success: false, error: "ID 必填" }, { status: 400 });
    }
    deleteCategory(id);
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
