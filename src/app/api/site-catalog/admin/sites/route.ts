import { requireAdmin } from "@/lib/auth";
import {
  deleteSiteCatalogSiteByHostname,
  listSiteCatalogSites,
  updateSiteCatalogSiteByHostname,
} from "@/lib/site-catalog/db";

export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function GET() {
  try {
    await requireAdmin();
    const data = listSiteCatalogSites();
    return createJsonResponse({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取站点目录失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const siteKey = String(body.siteKey || "").trim();
    const mode = String(body.mode || "hide").trim();

    if (!siteKey) {
      return createJsonResponse({ success: false, error: "缺少 siteKey" }, { status: 400 });
    }

    const updated = updateSiteCatalogSiteByHostname(siteKey, {
      visibility: mode === "restore" ? "public" : "private",
      catalogStatus: mode === "restore" ? "active" : "hidden",
    });

    if (!updated) {
      return createJsonResponse({ success: false, error: "站点目录记录不存在" }, { status: 404 });
    }

    return createJsonResponse({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新站点目录失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("不存在")
        ? 404
        : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const siteKey = String(searchParams.get("siteKey") || "").trim();

    if (!siteKey) {
      return createJsonResponse({ success: false, error: "缺少 siteKey" }, { status: 400 });
    }

    const deleted = deleteSiteCatalogSiteByHostname(siteKey);
    if (!deleted) {
      return createJsonResponse({ success: false, error: "站点目录记录不存在" }, { status: 404 });
    }

    return createJsonResponse({ success: true, data: { siteKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除站点目录失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("不存在")
        ? 404
        : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
