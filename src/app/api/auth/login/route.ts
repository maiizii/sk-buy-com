import { getUserByEmail, verifyPassword, createSession } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "邮箱和密码不能为空" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = getUserByEmail(normalizedEmail);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { success: false, error: "邮箱或密码错误" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { success: false, error: "邮箱尚未验证，请先前往邮件中点击验证链接" },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const token = createSession(user.id);
    const response = NextResponse.json(
      {
        success: true,
        data: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    response.cookies.set("sk-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "登录失败" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
