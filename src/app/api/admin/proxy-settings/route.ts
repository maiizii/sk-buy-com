import { requireAdmin } from "@/lib/auth";
import {
  createProxyPoolEntry,
  deleteProxyPoolEntry,
  getProxyPoolsSettingKey,
  getSksProxyConfig,
  getSksProxyEnabledSettingKey,
  listProxyPoolEntries,
  setSksProxyEnabled,
  updateProxyPoolEntry,
} from "@/lib/proxy-pools";

export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function GET() {
  try {
    await requireAdmin();
    return createJsonResponse({
      success: true,
      data: {
        settingKey: getProxyPoolsSettingKey(),
        sksProxyEnabledSettingKey: getSksProxyEnabledSettingKey(),
        sksProxyConfig: getSksProxyConfig(),
        staticEntries: listProxyPoolEntries("static"),
        residentialEntries: listProxyPoolEntries("residential"),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取代理设置失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    if (body && typeof body === "object" && body.action === "set_sks_proxy_enabled") {
      const config = setSksProxyEnabled(body.enabled === true);
      return createJsonResponse({ success: true, data: config });
    }
    const entry = createProxyPoolEntry(body && typeof body === "object" ? body : {});
    return createJsonResponse({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建代理失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const entryId = String(body?.id || "").trim();
    if (!entryId) {
      return createJsonResponse({ success: false, error: "缺少代理 ID" }, { status: 400 });
    }
    const updated = updateProxyPoolEntry(entryId, body && typeof body === "object" ? body : {});
    if (!updated) {
      return createJsonResponse({ success: false, error: "代理记录不存在" }, { status: 404 });
    }
    return createJsonResponse({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新代理失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("不存在")
        ? 404
        : 400;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const entryId = String(searchParams.get("id") || "").trim();
    if (!entryId) {
      return createJsonResponse({ success: false, error: "缺少代理 ID" }, { status: 400 });
    }
    const deleted = deleteProxyPoolEntry(entryId);
    if (!deleted) {
      return createJsonResponse({ success: false, error: "代理记录不存在" }, { status: 404 });
    }
    return createJsonResponse({ success: true, data: { id: entryId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除代理失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 400;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
