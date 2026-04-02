import {
  getModelRegistry,
  getPlatformAttributeGroups,
  getPlatformAttributeOptions,
  getPlatformAttributeValues,
} from "@/lib/db";

export async function GET() {
  try {
    return Response.json({
      success: true,
      data: {
        groups: getPlatformAttributeGroups(),
        options: getPlatformAttributeOptions(),
        values: getPlatformAttributeValues(),
        models: getModelRegistry(),
      },
    });
  } catch {
    return Response.json(
      { success: false, error: "获取平台配置失败" },
      { status: 500 }
    );
  }
}
