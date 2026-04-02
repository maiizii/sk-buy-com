import { deleteSession } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("sk-session")?.value;
    if (token) {
      deleteSession(token);
    }
    cookieStore.delete("sk-session");
    return Response.json({ success: true });
  } catch {
    return Response.json(
      { success: false, error: "登出失败" },
      { status: 500 }
    );
  }
}
