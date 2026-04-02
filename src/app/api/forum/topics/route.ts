import { getTopics, createTopic, getCategoryById } from "@/lib/forum-db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = getTopics({
      categoryId: searchParams.get("category") || undefined,
      tag: searchParams.get("tag") || undefined,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 20,
      sort: (searchParams.get("sort") as "latest" | "hot" | "oldest") || "latest",
    });
    return Response.json({ success: true, data: result });
  } catch {
    return Response.json({ success: false, error: "获取帖子列表失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const data = await request.json();
    if (!data.categoryId || !data.title?.trim() || !data.content?.trim()) {
      return Response.json({ success: false, error: "板块、标题和内容必填" }, { status: 400 });
    }

    // Check if category is readOnly and user is not admin
    const category = getCategoryById(data.categoryId);
    if (!category) {
      return Response.json({ success: false, error: "板块不存在" }, { status: 404 });
    }
    if (category.readOnly && user.role !== "admin") {
      return Response.json({ success: false, error: "该板块仅管理员可发帖" }, { status: 403 });
    }

    const topic = createTopic({
      categoryId: data.categoryId,
      authorId: user.id,
      title: data.title.trim(),
      content: data.content.trim(),
      tags: data.tags || [],
    });

    return Response.json({ success: true, data: topic }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "发帖失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
