import {
  getUserByUsername,
  getUserByEmail,
  createUser,
  createSession,
} from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { username, email, password } = await request.json();

    if (!username || !email || !password) {
      return Response.json(
        { success: false, error: "所有字段都是必填的" },
        { status: 400 }
      );
    }

    if (username.length < 2 || username.length > 20) {
      return Response.json(
        { success: false, error: "用户名长度需在 2-20 之间" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return Response.json(
        { success: false, error: "密码长度不能少于 6 位" },
        { status: 400 }
      );
    }

    // Check existing user
    if (getUserByUsername(username)) {
      return Response.json(
        { success: false, error: "用户名已被注册" },
        { status: 409 }
      );
    }

    if (getUserByEmail(email)) {
      return Response.json(
        { success: false, error: "邮箱已被注册" },
        { status: 409 }
      );
    }

    const user = createUser(username, email, password, "user");
    const token = createSession(user.id);

    const cookieStore = await cookies();
    cookieStore.set("sk-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return Response.json({ success: true, data: user }, { status: 201 });
  } catch {
    return Response.json(
      { success: false, error: "注册失败" },
      { status: 500 }
    );
  }
}
