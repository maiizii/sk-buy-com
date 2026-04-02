import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "未登录" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { success: true, data: user },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[auth/me] failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "获取用户信息失败",
        detail: process.env.NODE_ENV !== "production"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
