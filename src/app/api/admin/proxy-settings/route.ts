export const dynamic = "force-dynamic";

function createJsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

export async function GET() {
  return createJsonResponse(
    {
      success: false,
      error: "代理设置后台暂未开放",
    },
    { status: 404 }
  );
}

export async function PUT() {
  return createJsonResponse(
    {
      success: false,
      error: "代理设置后台暂未开放",
    },
    { status: 404 }
  );
}
