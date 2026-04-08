import crypto from "crypto";

function getFingerprintSecret() {
  return (
    process.env.SKS_EMBED_FINGERPRINT_SECRET?.trim() ||
    process.env.SKS_ENCRYPTION_KEY?.trim() ||
    "sks-embed-fingerprint-dev-secret"
  );
}

function signPayload(payloadBase64Url: string) {
  return crypto.createHmac("sha256", getFingerprintSecret()).update(payloadBase64Url).digest("base64url");
}

export function buildSksEmbedFingerprint(input: { userId: number; siteKey: string }) {
  const normalizedSiteKey = String(input.siteKey || "").trim().toLowerCase();
  const payloadBase64Url = Buffer.from(
    JSON.stringify({ uid: input.userId, sk: normalizedSiteKey }),
    "utf8"
  ).toString("base64url");
  const signature = signPayload(payloadBase64Url);
  return `${payloadBase64Url}.${signature}`;
}

export function verifySksEmbedFingerprint(input: { fingerprint: string; siteKey: string }) {
  const token = String(input.fingerprint || "").trim();
  const [payloadBase64Url, signature] = token.split(".");
  if (!payloadBase64Url || !signature) {
    return { valid: false as const, userId: null };
  }

  const expectedSignature = signPayload(payloadBase64Url);
  const isValidSignature =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!isValidSignature) {
    return { valid: false as const, userId: null };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64Url, "base64url").toString("utf8")) as {
      uid?: unknown;
      sk?: unknown;
    };
    const normalizedSiteKey = String(input.siteKey || "").trim().toLowerCase();
    const payloadSiteKey = String(payload.sk || "").trim().toLowerCase();
    const payloadUserId = Number(payload.uid);
    if (!Number.isFinite(payloadUserId) || payloadUserId <= 0 || payloadSiteKey !== normalizedSiteKey) {
      return { valid: false as const, userId: null };
    }
    return { valid: true as const, userId: payloadUserId };
  } catch {
    return { valid: false as const, userId: null };
  }
}
