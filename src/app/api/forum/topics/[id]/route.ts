import { getTopicById, updateTopic, deleteTopic, incrementTopicViewCount } from "@/lib/forum-db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const topic = getTopicById(Number(id));
    if (!topic) {
      return Response.json({ success: false, error: "帖子不存在" }, { status: 404 });
    }
    incrementTopicViewCount(Number(id));
    return Response.json({ success: true, data: { ...topic, viewCount: topic.viewCount + 1 } });
  } catch {
    return Response.json({ success: false, error: "获取帖子失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const topic = getTopicById(Number(id));
    if (!topic) {
      return Response.json({ success: false, error: "帖子不存在" }, { status: 404 });
    }

    // Only author or admin can edit
    if (topic.authorId !== user.id && user.role !== "admin") {
      return Response.json({ success: false, error: "无权限编辑" }, { status: 403 });
    }

    const data = await request.json();
    const updated = updateTopic(Number(id), data);
    return Response.json({ success: true, data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { id } = await params;
    const topic = getTopicById(Number(id));
    if (!topic) {
      return Response.json({ success: false, error: "帖子不存在" }, { status: 404 });
    }

    if (topic.authorId !== user.id && user.role !== "admin") {
      return Response.json({ success: false, error: "无权限删除" }, { status: 403 });
    }

    deleteTopic(Number(id));
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
