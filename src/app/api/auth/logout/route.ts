import { deleteSession } from "@/lib/db";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sk-session")?.value;
    if (token) {
      deleteSession(token);
    }
    const response = NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.delete("sk-session");
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "登出失败" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
