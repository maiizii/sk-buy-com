import { requireAdmin } from "@/lib/auth";
import { runProxyConnectivityTest } from "@/lib/proxy-pools";

export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const data = await runProxyConnectivityTest({
      entryId: typeof body.entryId === "string" ? body.entryId : undefined,
      poolType: body.poolType === "static" || body.poolType === "residential" ? body.poolType : undefined,
      targetUrl: typeof body.targetUrl === "string" ? body.targetUrl : undefined,
      apiBaseUrl: typeof body.apiBaseUrl === "string" ? body.apiBaseUrl : undefined,
      apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
      model: typeof body.model === "string" ? body.model : undefined,
      timeoutMs: Number.isFinite(Number(body.timeoutMs)) ? Number(body.timeoutMs) : undefined,
    });
    return createJsonResponse({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "代理测试失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
