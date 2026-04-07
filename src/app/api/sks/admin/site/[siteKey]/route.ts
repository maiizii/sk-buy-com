import { requireAdmin } from "@/lib/auth";
import { updateSiteCatalogSiteByHostname, deleteSiteCatalogSiteByHostname } from "@/lib/site-catalog/db";
import { deleteSksSite, updateSksSite } from "@/lib/sks/db";
import { runSksFullProbe, syncSksSiteModels, testSksModel } from "@/lib/sks/probe";
import { getSksAdminSiteView } from "@/lib/sks/service";
import { syncSksSubmissionStatusForSite } from "@/lib/sks/submission";

export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    await requireAdmin();
    const { siteKey } = await params;
    const detail = getSksAdminSiteView(siteKey);

    if (!detail) {
      return createJsonResponse(
        { success: false, error: "SKS 站点不存在" },
        { status: 404 }
      );
    }

    return createJsonResponse({ success: true, data: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 SKS 站点详情失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    await requireAdmin();
    const { siteKey } = await params;
    const body = await request.json();
    const action = String(body.action || "").trim();
    const credentialId = body.credentialId ? String(body.credentialId) : undefined;

    if (!action) {
      return createJsonResponse(
        { success: false, error: "缺少 action 参数" },
        { status: 400 }
      );
    }

    if (action === "sync_models") {
      const result = await syncSksSiteModels(siteKey, { credentialId });
      return createJsonResponse({ success: true, data: result });
    }

    if (action === "test_model") {
      const modelName = String(body.modelName || "").trim();
      if (!modelName) {
        return createJsonResponse(
          { success: false, error: "缺少 modelName 参数" },
          { status: 400 }
        );
      }

      const result = await testSksModel(siteKey, modelName, { credentialId });
      return createJsonResponse({ success: true, data: result });
    }

    if (action === "run_probe") {
      const result = await runSksFullProbe(siteKey, {
        credentialId,
        modelLimit:
          typeof body.modelLimit === "number" && Number.isFinite(body.modelLimit)
            ? body.modelLimit
            : undefined,
        forceModels: Array.isArray(body.forceModels)
          ? body.forceModels.map((item: unknown) => String(item).trim()).filter(Boolean)
          : undefined,
      });
      syncSksSubmissionStatusForSite(siteKey);
      return createJsonResponse({ success: true, data: result });
    }

    return createJsonResponse(
      { success: false, error: `不支持的 action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "执行 SKS 管理动作失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("已暂停")
        ? 409
        : message.includes("不存在")
          ? 404
          : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    await requireAdmin();
    const { siteKey } = await params;
    const body = await request.json();
    const mode = String(body.mode || "edit").trim();

    const nextSite = updateSksSite(siteKey, {
      displayName: body.displayName,
      homepageUrl: body.homepageUrl,
      apiBaseUrl: body.apiBaseUrl,
      statusVisibility:
        mode === "pause"
          ? "private"
          : mode === "resume"
            ? "public"
            : body.statusVisibility,
      ownershipStatus: body.ownershipStatus,
    });

    if (!nextSite) {
      return createJsonResponse({ success: false, error: "SKS 站点不存在" }, { status: 404 });
    }

    updateSiteCatalogSiteByHostname(siteKey, {
      displayName: nextSite.displayName,
      homepageUrl: nextSite.homepageUrl,
      apiBaseUrl: nextSite.apiBaseUrl,
      visibility:
        nextSite.statusVisibility === "private"
          ? "private"
          : nextSite.statusVisibility === "unlisted"
            ? "unlisted"
            : "public",
      catalogStatus: mode === "pause" ? "hidden" : mode === "resume" ? "active" : undefined,
    });

    if (mode === "resume") {
      syncSksSubmissionStatusForSite(nextSite.normalizedHostname || nextSite.id);
    }

    const detail = getSksAdminSiteView(nextSite.normalizedHostname || nextSite.id);
    return createJsonResponse({ success: true, data: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新 SKS 站点失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("不存在")
        ? 404
        : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteKey: string }> }
) {
  try {
    await requireAdmin();
    const { siteKey } = await params;
    const deleted = deleteSksSite(siteKey);
    if (!deleted) {
      return createJsonResponse({ success: false, error: "SKS 站点不存在" }, { status: 404 });
    }

    deleteSiteCatalogSiteByHostname(siteKey);
    return createJsonResponse({ success: true, data: { siteKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除 SKS 站点失败";
    const status = message === "Unauthorized" || message === "Forbidden"
      ? 403
      : message.includes("不存在")
        ? 404
        : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
