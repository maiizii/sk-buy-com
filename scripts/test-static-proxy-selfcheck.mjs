import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("无法获取监听端口"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function createMockApiServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/ip") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ip: "203.0.113.10", via: "local-proxy-selfcheck" }));
      return;
    }

    if (url.pathname === "/v1/models") {
      if (request.headers.authorization !== "Bearer test-key") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { message: "invalid api key" } }));
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          object: "list",
          data: [{ id: "gpt-4o-mini" }, { id: "claude-3-5-haiku" }],
        })
      );
      return;
    }

    if (url.pathname === "/v1/chat/completions") {
      const body = await readBody(request);
      let payload = null;
      try {
        payload = JSON.parse(body);
      } catch {}

      if (request.headers.authorization !== "Bearer test-key") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { message: "invalid api key" } }));
        return;
      }

      if (payload?.model !== "gpt-4o-mini") {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: { message: "model not found" } }));
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          id: "chatcmpl-local-proxy-selfcheck",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
        })
      );
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: { message: `not found: ${url.pathname}` } }));
  });
}

function createForwardProxyServer() {
  return http.createServer((clientRequest, clientResponse) => {
    const targetUrl = new URL(clientRequest.url || "");
    const upstreamRequest = http.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || 80,
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: clientRequest.method,
        headers: {
          ...clientRequest.headers,
          host: targetUrl.host,
        },
      },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode || 500, upstreamResponse.headers);
        upstreamResponse.pipe(clientResponse);
      }
    );

    upstreamRequest.on("error", (error) => {
      clientResponse.writeHead(502, { "Content-Type": "application/json" });
      clientResponse.end(JSON.stringify({ error: String(error.message || error) }));
    });

    clientRequest.pipe(upstreamRequest);
  });
}

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "test-static-proxy.mjs"), ...args], {
      cwd: path.resolve(__dirname, ".."),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `测试脚本退出码异常: ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const apiServer = createMockApiServer();
  const proxyServer = createForwardProxyServer();

  let apiPort = 0;
  let proxyPort = 0;

  try {
    apiPort = await listen(apiServer);
    proxyPort = await listen(proxyServer);

    const ipEchoUrl = `http://127.0.0.1:${apiPort}/ip`;
    const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
    const proxyUrl = `http://127.0.0.1:${proxyPort}`;

    const { stdout } = await runCli([
      `--proxy-url=${proxyUrl}`,
      `--ip-echo-url=${ipEchoUrl}`,
      `--api-base-url=${apiBaseUrl}`,
      "--api-key=test-key",
      "--model=gpt-4o-mini",
      "--timeout-ms=5000",
    ]);

    const report = JSON.parse(stdout);
    assert(report.ipEcho?.ok === true, "ipEcho 测试未通过");
    assert(report.models?.ok === true, "models 测试未通过");
    assert(report.inference?.ok === true, "1-token 推理测试未通过");

    console.log(
      JSON.stringify(
        {
          success: true,
          mode: "local-http-proxy-selfcheck",
          proxyUrl,
          ipEchoUrl,
          apiBaseUrl,
          report,
        },
        null,
        2
      )
    );
  } finally {
    await Promise.allSettled([closeServer(apiServer), closeServer(proxyServer)]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
