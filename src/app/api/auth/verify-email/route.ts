import { consumeEmailVerificationToken, createSession, verifyEmailByCode } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildRedirectUrl(request: Request, status: "success" | "error", message: string) {
  const url = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || url.origin;
  const target = new URL("/", base);
  target.searchParams.set("emailVerification", status);
  target.searchParams.set("message", message);
  return target;
}

function buildSuccessResponse(userId: number, message: string) {
  const sessionToken = createSession(userId);
  const response = NextResponse.json(
    {
      success: true,
      message,
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  response.cookies.set("sk-session", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.redirect(buildRedirectUrl(request, "error", "验证链接无效或缺少参数"));
  }

  const user = consumeEmailVerificationToken(token);
  if (!user) {
    return NextResponse.redirect(buildRedirectUrl(request, "error", "验证链接已失效或已使用"));
  }

  const response = NextResponse.redirect(buildRedirectUrl(request, "success", "邮箱验证成功，已自动登录"));
  response.cookies.set("sk-session", createSession(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCode = String(code || "").trim();

    if (!normalizedEmail || !normalizedCode) {
      return NextResponse.json(
        { success: false, error: "邮箱和验证码不能为空" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { success: false, error: "请输入 6 位数字验证码" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const user = verifyEmailByCode(normalizedEmail, normalizedCode);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "验证码无效、已过期，或该邮箱没有待验证记录" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    return buildSuccessResponse(user.id, "邮箱验证成功，已自动登录");
  } catch (error) {
    console.error("[auth/verify-email] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "邮箱验证失败",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
