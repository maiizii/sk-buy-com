import {
  getUserByUsername,
  verifyPassword,
  createSession,
} from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { success: false, error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    const user = getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return Response.json(
        { success: false, error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    const token = createSession(user.id);
    const cookieStore = await cookies();
    cookieStore.set("sk-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return Response.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch {
    return Response.json(
      { success: false, error: "登录失败" },
      { status: 500 }
    );
  }
}
