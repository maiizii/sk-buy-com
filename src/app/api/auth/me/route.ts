import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { success: false, error: "未登录" },
        { status: 401 }
      );
    }
    return Response.json({ success: true, data: user });
  } catch {
    return Response.json(
      { success: false, error: "获取用户信息失败" },
      { status: 500 }
    );
  }
}
