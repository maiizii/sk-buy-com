import { deleteReply } from "@/lib/forum-db";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest } from "next/server";
import db from "@/lib/db";

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
    const reply = db
      .prepare(`SELECT * FROM forum_replies WHERE id = ?`)
      .get(Number(id)) as { authorId: number } | undefined;

    if (!reply) {
      return Response.json({ success: false, error: "回复不存在" }, { status: 404 });
    }

    if (reply.authorId !== user.id && user.role !== "admin") {
      return Response.json({ success: false, error: "无权限删除" }, { status: 403 });
    }

    deleteReply(Number(id));
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
