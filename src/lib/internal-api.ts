export function getInternalApiTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) {
    return bearerMatch[1].trim();
  }

  return request.headers.get("x-sk-internal-token")?.trim() || "";
}

export function requireInternalApiToken(request: Request) {
  const expectedToken = (process.env.SK_INTERNAL_API_TOKEN || process.env.SK_IMPORT_TOKEN || "").trim();
  if (!expectedToken) {
    throw new Error("InternalApiTokenNotConfigured");
  }

  const actualToken = getInternalApiTokenFromRequest(request);
  if (!actualToken || actualToken !== expectedToken) {
    throw new Error("Forbidden");
  }
}
