import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { getDetectionProxyAgent } from "@/lib/proxy-config";

export interface ProxiedHttpResponse {
  status: number;
  statusText: string;
  headers: http.IncomingHttpHeaders;
  text: string;
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
  } = {}
): Promise<ProxiedHttpResponse> {
  const url = new URL(inputUrl);
  const transport = resolveTransport(url);
  const agent = getDetectionProxyAgent();

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: init.method || "GET",
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
          });
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });

    const timeoutMs = Math.max(1, init.timeoutMs || 10000);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timeout (${Math.floor(timeoutMs / 1000)}s)`));
    });

    if (init.body) {
      request.write(init.body);
    }

    request.end();
  });
}
