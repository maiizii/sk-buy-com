import http from "node:http";
import https from "node:https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

function printUsage() {
  console.log(`用法：
  npm run proxy:test-static -- --proxy-url=http://user:pass@host:port
  npm run proxy:test-static -- --proxy-url=socks5://user:pass@host:port --api-base-url=https://example.com --api-key=sk-xxx
  npm run proxy:test-static -- --proxy-url=http://host:port --api-base-url=https://example.com --api-key=sk-xxx --model=gpt-4o-mini

参数：
  --proxy-url=...       必填，支持 http / https / socks5
  --ip-echo-url=...     可选，默认 https://api64.ipify.org?format=json
  --api-base-url=...    可选，OpenAI 兼容 API Base URL
  --api-key=...         可选，配合 --api-base-url 使用
  --model=...           可选，做 1-token 推理测试
  --timeout-ms=15000    可选，请求超时
`);
}

function parseArgs(argv) {
  const options = {
    proxyUrl: "",
    ipEchoUrl: "https://api64.ipify.org?format=json",
    apiBaseUrl: "",
    apiKey: "",
    model: "",
    timeoutMs: 15000,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (!arg.startsWith("--") || !arg.includes("=")) {
      throw new Error(`不支持的参数格式: ${arg}`);
    }
    const [rawKey, ...rest] = arg.slice(2).split("=");
    const value = rest.join("=");
    switch (rawKey) {
      case "proxy-url":
        options.proxyUrl = value;
        break;
      case "ip-echo-url":
        options.ipEchoUrl = value;
        break;
      case "api-base-url":
        options.apiBaseUrl = value;
        break;
      case "api-key":
        options.apiKey = value;
        break;
      case "model":
        options.model = value;
        break;
      case "timeout-ms":
        options.timeoutMs = Number.parseInt(value, 10);
        break;
      default:
        throw new Error(`未知参数: --${rawKey}`);
    }
  }

  return options;
}

function normalizeApiBaseUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  let pathname = url.pathname.replace(/\/(chat\/completions|responses|models)\/?$/i, "");
  pathname = pathname.replace(/\/+$/, "");
  url.pathname = pathname || "/";
  return url.toString().replace(/\/+$/, "");
}

function buildOpenAiUrl(baseUrl, resourcePath) {
  const normalizedBase = normalizeApiBaseUrl(baseUrl);
  const url = new URL(normalizedBase);
  const pathname = url.pathname.replace(/\/+$/, "");
  const cleanResourcePath = resourcePath.replace(/^\/+/, "");
  if (!pathname || pathname === "/") {
    url.pathname = `/v1/${cleanResourcePath}`;
  } else if (/\/v\d+$/i.test(pathname)) {
    url.pathname = `${pathname}/${cleanResourcePath}`;
  } else {
    url.pathname = `${pathname}/v1/${cleanResourcePath}`;
  }
  return url.toString();
}

function createAgent(proxyUrl) {
  const protocol = new URL(proxyUrl).protocol.toLowerCase();
  if (protocol.startsWith("socks")) {
    const agentProxyUrl = proxyUrl.replace(/^socks5:\/\//i, "socks5h://");
    return new SocksProxyAgent(agentProxyUrl);
  }
  if (protocol === "http:") return new HttpProxyAgent(proxyUrl);
  if (protocol === "https:") return new HttpsProxyAgent(proxyUrl);
  throw new Error(`不支持的代理协议: ${protocol}`);
}

function requestViaProxy(proxyUrl, inputUrl, init = {}) {
  const maskedProxyUrl = proxyUrl.replace(/:\/\/([^:@/]+):([^@/]+)@/, "://***:***@").replace(/^socks5:\/\//i, "socks5h://");
  const maxRedirects = Math.max(0, init.maxRedirects ?? 5);

  function send(currentUrl, redirectCount, method, body) {
    const url = new URL(currentUrl);
    const transport = url.protocol === "https:" ? https : http;
    const agent = createAgent(proxyUrl);

    return new Promise((resolve, reject) => {
      const request = transport.request(url, {
        method,
        headers: init.headers,
        agent,
      }, (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", async () => {
          const result = {
            status: response.statusCode || 0,
            statusText: response.statusMessage || "",
            text: Buffer.concat(chunks).toString("utf8"),
            headers: response.headers,
            finalUrl: url.toString(),
          };

          const locationHeader = response.headers.location;
          const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
          const shouldRedirect = [301, 302, 303, 307, 308].includes(result.status) && Boolean(location);
          if (!shouldRedirect || !location || redirectCount >= maxRedirects) {
            resolve(result);
            return;
          }

          try {
            const nextUrl = new URL(location, url).toString();
            const nextMethod = result.status === 307 || result.status === 308 ? method : "GET";
            const nextBody = nextMethod === method ? body : undefined;
            resolve(await send(nextUrl, redirectCount + 1, nextMethod, nextBody));
          } catch (error) {
            reject(error);
          }
        });
      });
      request.on("error", (error) => {
        reject(
          new Error(
            [
              `url=${url.toString()}`,
              `host=${url.host}`,
              `protocol=${url.protocol}`,
              `proxy=${maskedProxyUrl}`,
              `message=${error instanceof Error ? error.message : String(error)}`,
            ].join(" | ")
          )
        );
      });
      request.setTimeout(Math.max(1000, init.timeoutMs || 15000), () => {
        request.destroy(new Error("请求超时"));
      });
      if (body) request.write(body);
      request.end();
    });
  }

  return send(inputUrl, 0, init.method || "GET", init.body);
}

function truncateText(value, limit = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }
  if (!options.proxyUrl) {
    throw new Error("必须提供 --proxy-url");
  }

  const report = {
    proxyUrl: options.proxyUrl.replace(/:\/\/([^:@/]+):([^@/]+)@/, "://***:***@"),
    ipEcho: null,
    models: null,
    inference: null,
  };

  const ipEcho = await requestViaProxy(options.proxyUrl, options.ipEchoUrl, {
    timeoutMs: options.timeoutMs,
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "sk-buy-proxy-test-script/1.0",
    },
  });

  report.ipEcho = {
    ok: ipEcho.status >= 200 && ipEcho.status < 300,
    status: ipEcho.status,
    bodyPreview: truncateText(ipEcho.text),
  };

  if (options.apiBaseUrl && options.apiKey) {
    const modelUrl = buildOpenAiUrl(options.apiBaseUrl, "models");
    const models = await requestViaProxy(options.proxyUrl, modelUrl, {
      timeoutMs: options.timeoutMs,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${options.apiKey}`,
        "User-Agent": "sk-buy-proxy-test-script/1.0",
      },
    });

    report.models = {
      ok: models.status >= 200 && models.status < 300,
      status: models.status,
      bodyPreview: truncateText(models.text),
    };

    if (options.model) {
      const inferenceUrl = buildOpenAiUrl(options.apiBaseUrl, "chat/completions");
      const inference = await requestViaProxy(options.proxyUrl, inferenceUrl, {
        method: "POST",
        timeoutMs: options.timeoutMs,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "sk-buy-proxy-test-script/1.0",
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
          temperature: 0,
        }),
      });

      report.inference = {
        ok: inference.status >= 200 && inference.status < 300,
        status: inference.status,
        bodyPreview: truncateText(inference.text),
      };
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
