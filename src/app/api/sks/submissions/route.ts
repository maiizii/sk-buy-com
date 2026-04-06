import { getCurrentUser } from "@/lib/auth";
import {
  getEditableSksSubmissionSecret,
  listSksUserSubmissionViews,
  removeSksSiteSubmissionForUser,
  retrySksSiteSubmissionForUser,
  submitSksSiteForUser,
} from "@/lib/sks/submission";

export const dynamic = "force-dynamic";

function resolveErrorStatus(message: string) {
  if (/登录/.test(message)) return 401;
  if (/不能为空|无效|重复提交|已经提交|不存在|无权|只有失败/.test(message)) return 400;
  return 500;
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const submissionId = String(searchParams.get("submissionId") || "").trim();

    if (action === "prefill") {
      if (!submissionId) {
        return Response.json({ success: false, error: "submissionId 不能为空" }, { status: 400 });
      }

      return Response.json({
        success: true,
        data: getEditableSksSubmissionSecret({ userId: user.id, submissionId }),
      });
    }

    return Response.json({
      success: true,
      data: listSksUserSubmissionViews(user.id),
    });
  } catch (error) {
    console.error("[api/sks/submissions][GET] failed:", error);
    const message = error instanceof Error ? error.message : "获取提交记录失败";
    return Response.json({ success: false, error: message }, { status: resolveErrorStatus(message) });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | {
          apiBaseUrl?: string;
          apiKey?: string;
          submissionId?: string;
        }
      | null;

    const apiBaseUrl = String(body?.apiBaseUrl || "").trim();
    const apiKey = String(body?.apiKey || "").trim();
    const submissionId = String(body?.submissionId || "").trim();

    if (!apiBaseUrl) {
      return Response.json({ success: false, error: "网址不能为空" }, { status: 400 });
    }

    if (!apiKey) {
      return Response.json({ success: false, error: "API SKY 不能为空" }, { status: 400 });
    }

    const result = submissionId
      ? await retrySksSiteSubmissionForUser({
          userId: user.id,
          submissionId,
          apiBaseUrl,
          apiKey,
        })
      : await submitSksSiteForUser({
          userId: user.id,
          apiBaseUrl,
          apiKey,
        });

    return Response.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[api/sks/submissions][POST] failed:", error);
    const message = error instanceof Error ? error.message : "提交失败";
    return Response.json({ success: false, error: message }, { status: resolveErrorStatus(message) });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: "请先登录" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { submissionId?: string } | null;
    const submissionId = String(body?.submissionId || "").trim();

    if (!submissionId) {
      return Response.json({ success: false, error: "submissionId 不能为空" }, { status: 400 });
    }

    return Response.json({
      success: true,
      data: removeSksSiteSubmissionForUser({ userId: user.id, submissionId }),
    });
  } catch (error) {
    console.error("[api/sks/submissions][DELETE] failed:", error);
    const message = error instanceof Error ? error.message : "删除失败";
    return Response.json({ success: false, error: message }, { status: resolveErrorStatus(message) });
  }
}
