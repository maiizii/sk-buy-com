import { createEmailVerificationChallenge, createUser, getUserByEmail } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/mailer";
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

    const verification = createEmailVerificationChallenge(user.id);
    const url = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || url.origin;
    const verificationUrl = new URL(`/api/auth/verify-email?token=${verification.token}`, baseUrl).toString();

    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
      verificationCode: verification.code,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          email: user.email,
          displayName: user.displayName,
          emailVerified: false,
          verificationMethod: "code_or_link",
        },
        message: "注册成功，验证码和验证链接已发送到你的邮箱",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[auth/register] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "注册失败",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
