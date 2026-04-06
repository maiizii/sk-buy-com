import { requireAdmin } from "@/lib/auth";
import { importSiteCatalogEntry } from "@/lib/site-catalog/service";
import { getSksAdminList } from "@/lib/sks/service";

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
      data: getSksAdminList(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取 SKS 管理列表失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const apiBaseUrl = String(body.apiBaseUrl || "").trim();
    const apiKey = String(body.apiKey || "").trim();

    if (!apiBaseUrl || !apiKey) {
      return createJsonResponse(
        { success: false, error: "apiBaseUrl 与 apiKey 为必填项" },
        { status: 400 }
      );
    }

    const imported = await importSiteCatalogEntry({
      displayName: body.displayName,
      homepageUrl: body.homepageUrl,
      apiBaseUrl,
      siteSystem: body.siteSystem,
      platformType: body.platformType,
      sourceStage: body.sourceStage || "website",
      sourceModule: body.sourceModule || "admin",
      visibility: body.visibility || body.statusVisibility,
      catalogStatus: body.catalogStatus,
      summary: body.summary,
      description: body.description,
      registrationOpen: typeof body.registrationOpen === "boolean" ? body.registrationOpen : undefined,
      emailVerificationRequired:
        typeof body.emailVerificationRequired === "boolean" ? body.emailVerificationRequired : undefined,
      inviteCodeRequired: typeof body.inviteCodeRequired === "boolean" ? body.inviteCodeRequired : undefined,
      hasInitialQuota: typeof body.hasInitialQuota === "boolean" ? body.hasInitialQuota : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map((item: unknown) => String(item).trim()).filter(Boolean) : undefined,
      meta: body.meta && typeof body.meta === "object" ? body.meta : undefined,
      manualOverrides:
        body.manualOverrides && typeof body.manualOverrides === "object" ? body.manualOverrides : undefined,
      ownershipStatus: body.ownershipStatus,
      ownerUserId: typeof body.ownerUserId === "number" ? body.ownerUserId : null,
      createdByUserId: typeof body.createdByUserId === "number" ? body.createdByUserId : null,
      apiKey,
      sourceType: body.sourceType,
      submittedByUserId: typeof body.submittedByUserId === "number" ? body.submittedByUserId : null,
      label: body.label,
      isEnabled: body.isEnabled !== false,
      priorityScore: typeof body.priorityScore === "number" ? body.priorityScore : undefined,
      runInitialProbe: body.runInitialProbe !== false,
      initialProbeModelLimit:
        typeof body.modelLimit === "number" && Number.isFinite(body.modelLimit)
          ? body.modelLimit
          : 3,
      forceModels: Array.isArray(body.forceModels)
        ? body.forceModels.map((item: unknown) => String(item).trim()).filter(Boolean)
        : undefined,
    });

    return createJsonResponse(
      {
        success: true,
        data: {
          site: imported.sksImport?.site || null,
          credential: imported.sksImport?.credential || null,
          catalogSite: imported.catalogSite,
          initialProbe: imported.initialProbe,
          probeError: imported.probeError,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "导入 SKS 站点失败";
    const status = message === "Unauthorized" || message === "Forbidden" ? 403 : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
