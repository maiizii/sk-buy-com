import { getUserByEmail, createUser, createSession } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "邮箱和密码不能为空" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedDisplayName = String(displayName || "").trim();

    if (!isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "请输入有效邮箱地址" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "密码长度不能少于 6 位" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (getUserByEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, error: "邮箱已被注册" },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = createUser({
      email: normalizedEmail,
      password,
      role: "user",
      displayName: normalizedDisplayName,
    });
    const token = createSession(user.id);

    const response = NextResponse.json(
      { success: true, data: user },
      { status: 201, headers: { "Cache-Control": "no-store" } }
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
      { success: false, error: "注册失败" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
