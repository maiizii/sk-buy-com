import { getReplies, createReply, getTopicById } from "@/lib/forum-db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const result = getReplies(Number(id), page);
    return Response.json({ success: true, data: result });
  } catch {
    return Response.json({ success: false, error: "获取回复失败" }, { status: 500 });
  }
}

export async function POST(
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
    if (topic.locked) {
      return Response.json({ success: false, error: "帖子已锁定，无法回复" }, { status: 403 });
    }

    const { content } = await request.json();
    if (!content?.trim()) {
      return Response.json({ success: false, error: "回复内容不能为空" }, { status: 400 });
    }

    const reply = createReply({
      topicId: Number(id),
      authorId: user.id,
      content: content.trim(),
    });

    return Response.json({ success: true, data: reply }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "回复失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
