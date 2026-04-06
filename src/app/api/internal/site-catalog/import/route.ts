import { requireInternalApiToken } from "@/lib/internal-api";
import { importSiteCatalogEntry } from "@/lib/site-catalog/service";
import type { SiteCatalogImportInput } from "@/lib/site-catalog/types";

export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toImportInput(value: unknown): SiteCatalogImportInput | null {
  if (!isRecord(value)) return null;

  const partial = value as Partial<SiteCatalogImportInput>;
  const apiBaseUrl = typeof partial.apiBaseUrl === "string" ? partial.apiBaseUrl.trim() : "";

  return {
    ...partial,
    apiBaseUrl,
  };
}

function normalizeImportItems(body: unknown): SiteCatalogImportInput[] {
  if (Array.isArray(body)) {
    return body
      .map((item) => toImportInput(item))
      .filter((item): item is SiteCatalogImportInput => Boolean(item));
  }

  if (isRecord(body)) {
    if (Array.isArray(body.items)) {
      const { items, ...defaultValues } = body;
      return items
        .map((item) => toImportInput({ ...defaultValues, ...(isRecord(item) ? item : {}) }))
        .filter((entry): entry is SiteCatalogImportInput => Boolean(entry));
    }

    const single = toImportInput(body);
    return single ? [single] : [];
  }

  return [];
}

export async function POST(request: Request) {
  try {
    requireInternalApiToken(request);

    const body = await request.json();
    const items = normalizeImportItems(body);
    if (items.length === 0) {
      return createJsonResponse(
        { success: false, error: "导入数据不能为空" },
        { status: 400 }
      );
    }

    const imported = [] as Array<Awaited<ReturnType<typeof importSiteCatalogEntry>>>;
    const failed: Array<{ index: number; error: string; item: SiteCatalogImportInput }> = [];

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      try {
        imported.push(await importSiteCatalogEntry(item));
      } catch (error) {
        failed.push({
          index,
          item,
          error: error instanceof Error ? error.message : "导入失败",
        });
      }
    }

    const ok = failed.length === 0;
    return createJsonResponse(
      {
        success: ok,
        meta: {
          total: items.length,
          importedCount: imported.length,
          failedCount: failed.length,
        },
        data: {
          imported,
          failed,
        },
      },
      { status: ok ? 201 : imported.length > 0 ? 207 : 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "内部导入失败";
    const status =
      message === "Forbidden"
        ? 403
        : message === "InternalApiTokenNotConfigured"
          ? 500
          : 500;
    return createJsonResponse({ success: false, error: message }, { status });
  }
}
