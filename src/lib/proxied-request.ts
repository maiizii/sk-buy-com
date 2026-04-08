import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { getSelectedSksProxyMaskedUrl, getSksProxyAgent } from "@/lib/proxy-pools";

export interface ProxiedHttpResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  text: string;
  finalUrl: string;
}

function resolveTransport(url: URL) {
  return url.protocol === "https:" ? https : http;
}

export async function requestTextViaDetectionProxy(
  inputUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<ProxiedHttpResponse> {
  const agent = getSksProxyAgent();
  const proxyMaskedUrl = getSelectedSksProxyMaskedUrl();
  const timeoutMs = Math.max(1, init.timeoutMs || 10000);
  const maxRedirects = Math.max(0, init.maxRedirects ?? 5);

  async function send(currentUrl: string, redirectCount: number, method: string, body?: string): Promise<ProxiedHttpResponse> {
    const url = new URL(currentUrl);
    const transport = resolveTransport(url);

    const response = await new Promise<ProxiedHttpResponse>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method,
          headers: init.headers,
          agent: agent || undefined,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: response.statusCode || 0,
              statusText: response.statusMessage || "",
              headers: response.headers,
              text,
              finalUrl: url.toString(),
            });
          });
        }
      );

      request.on("error", (error) => {
        const errorWithMeta = error as Error & { code?: string; cause?: unknown };
        const detail = [
          `url=${url.toString()}`,
          `host=${url.host}`,
          `protocol=${url.protocol}`,
          `proxy=${proxyMaskedUrl || "direct"}`,
          errorWithMeta.code ? `code=${errorWithMeta.code}` : null,
          `message=${errorWithMeta.message || "Unknown request error"}`,
        ]
          .filter(Boolean)
          .join(" | ");

        reject(new Error(detail, { cause: errorWithMeta }));
      });

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Request timeout (${Math.floor(timeoutMs / 1000)}s)`));
      });

      if (body) {
        request.write(body);
      }

      request.end();
    });

    const locationHeader = response.headers.location;
    const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
    const shouldRedirect = [301, 302, 303, 307, 308].includes(response.status) && Boolean(location);
    if (!shouldRedirect || !location) {
      return response;
    }

    if (redirectCount >= maxRedirects) {
      return response;
    }

    const nextUrl = new URL(location, url).toString();
    const nextMethod = response.status === 307 || response.status === 308 ? method : "GET";
    const nextBody = nextMethod === method ? body : undefined;
    return send(nextUrl, redirectCount + 1, nextMethod, nextBody);
  }

  return send(inputUrl, 0, init.method || "GET", init.body);
}
