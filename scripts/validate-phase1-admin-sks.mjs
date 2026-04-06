import fs from "fs";
import path from "path";

const DEFAULT_BASE_URL = process.env.SK_BUY_BASE_URL || "http://127.0.0.1:3000";
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sk-buy.com";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DEFAULT_LIVE_INPUT_PATH = process.env.SKS_VALIDATE_LIVE_FILE
  ? path.resolve(process.cwd(), process.env.SKS_VALIDATE_LIVE_FILE)
  : path.join(process.cwd(), "data", "sks-import-sites.local.json");
const DEFAULT_REPORT_PATH = process.env.SKS_VALIDATE_REPORT_PATH
  ? path.resolve(process.cwd(), process.env.SKS_VALIDATE_REPORT_PATH)
  : path.join(process.cwd(), ".tmp", "phase1-admin-sks-validation-report.json");

function printUsage() {
  console.log(`用法：
  node scripts/validate-phase1-admin-sks.mjs [--only=both|admin|live] [--base-url=http://127.0.0.1:3000]
                                         [--admin-email=admin@sk-buy.com] [--admin-password=admin123]
                                         [--live-file=data/sks-import-sites.local.json] [--live-index=0]
                                         [--report=.tmp/phase1-admin-sks-validation-report.json]

说明：
  - admin：验证 /api/sks/admin/sites 管理态导入链路字段映射与列表/详情联通
  - live：验证 runInitialProbe 的真实首轮探测结果是否成功落库
  - both：按顺序执行上面两项验证（默认）

环境变量：
  SK_BUY_BASE_URL           覆盖验证目标地址
  ADMIN_EMAIL               覆盖管理员邮箱
  ADMIN_PASSWORD            覆盖管理员密码
  SKS_VALIDATE_LIVE_FILE    覆盖真实探测数据文件
  SKS_VALIDATE_REPORT_PATH  覆盖报告输出路径

示例：
  npm run sks:validate-phase1
  npm run sks:validate-phase1:admin
  npm run sks:validate-phase1:live
  node scripts/validate-phase1-admin-sks.mjs --only=live --live-index=1
`);
}

function parseArgs(argv) {
  const options = {
    help: false,
    only: "both",
    baseUrl: DEFAULT_BASE_URL,
    adminEmail: DEFAULT_ADMIN_EMAIL,
    adminPassword: DEFAULT_ADMIN_PASSWORD,
    liveFile: DEFAULT_LIVE_INPUT_PATH,
    liveIndex: Number.parseInt(process.env.SKS_VALIDATE_LIVE_INDEX || "0", 10) || 0,
    reportPath: DEFAULT_REPORT_PATH,
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
      case "only":
        if (!["both", "admin", "live"].includes(value)) {
          throw new Error(`--only 仅支持 both/admin/live，收到: ${value}`);
        }
        options.only = value;
        break;
      case "base-url":
        options.baseUrl = value || options.baseUrl;
        break;
      case "admin-email":
        options.adminEmail = value || options.adminEmail;
        break;
      case "admin-password":
        options.adminPassword = value || options.adminPassword;
        break;
      case "live-file":
        options.liveFile = path.resolve(process.cwd(), value);
        break;
      case "live-index": {
        const parsedIndex = Number.parseInt(value, 10);
        if (!Number.isInteger(parsedIndex) || parsedIndex < 0) {
          throw new Error(`--live-index 必须是 >= 0 的整数，收到: ${value}`);
        }
        options.liveIndex = parsedIndex;
        break;
      }
      case "report":
        options.reportPath = path.resolve(process.cwd(), value);
        break;
      default:
        throw new Error(`未知参数: --${rawKey}`);
    }
  }

  return options;
}

function ensureAbsoluteUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function normalizeApiBaseUrl(value) {
  const absolute = ensureAbsoluteUrl(value);
  if (!absolute) return "";

  try {
    const url = new URL(absolute);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";

    let pathname = url.pathname.replace(/\/(chat\/completions|responses|models)\/?$/i, "");
    pathname = pathname.replace(/\/+$/, "");
    url.pathname = pathname || "/";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return absolute.replace(/\/(chat\/completions|responses|models)\/?$/i, "").replace(/\/+$/, "");
  }
}

function normalizeHostname(value) {
  const normalized = ensureAbsoluteUrl(value);
  if (!normalized) return "";

  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split(/[/?#]/)[0]
      .replace(/:\d+$/, "");
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function redactSecret(value) {
  if (typeof value !== "string") return value;
  if (!value.trim()) return value;
  return `${value.slice(0, 6)}***redacted***${value.slice(-4)}`;
}

function sanitizePayload(payload) {
  const next = cloneJsonSafe(payload);
  if (typeof next.apiKey === "string") {
    next.apiKey = redactSecret(next.apiKey);
  }
  return next;
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (Array.isArray(cookies) && cookies.length > 0) return cookies;
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function mergeCookies(cookieJar, response) {
  for (const cookie of getSetCookieHeaders(response)) {
    const pair = String(cookie || "").split(";", 1)[0];
    if (!pair || !pair.includes("=")) continue;
    const index = pair.indexOf("=");
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!name) continue;
    cookieJar.set(name, value);
  }
}

function serializeCookieJar(cookieJar) {
  return Array.from(cookieJar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function requestJson(baseUrl, requestPath, init = {}, cookieJar = null) {
  const headers = new Headers(init.headers || {});
  if (cookieJar && cookieJar.size > 0) {
    headers.set("Cookie", serializeCookieJar(cookieJar));
  }

  const response = await fetch(new URL(requestPath, baseUrl), {
    ...init,
    headers,
    redirect: "manual",
  });

  if (cookieJar) {
    mergeCookies(cookieJar, response);
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

function createPhase(name, requestPayload = null) {
  return {
    name,
    ok: false,
    checks: [],
    requestPayload,
    responses: {},
    error: null,
  };
}

function assertPhase(phase, condition, message, context = undefined) {
  phase.checks.push({
    ok: Boolean(condition),
    message,
    context: condition ? undefined : context,
  });

  if (!condition) {
    const error = new Error(message);
    if (context !== undefined) {
      error.context = context;
    }
    throw error;
  }
}

function summarizeResponse(response, data = response.data) {
  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function loginAsAdmin(options, cookieJar) {
  const loginResponse = await requestJson(
    options.baseUrl,
    "/api/auth/login",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: options.adminEmail,
        password: options.adminPassword,
      }),
    },
    cookieJar
  );

  if (!loginResponse.ok || loginResponse.data?.success !== true) {
    throw new Error(
      `管理员登录失败（${loginResponse.status}）：${loginResponse.data?.error || "未知错误"}`
    );
  }

  const meResponse = await requestJson(
    options.baseUrl,
    "/api/auth/me",
    {
      headers: {
        Accept: "application/json",
      },
    },
    cookieJar
  );

  if (!meResponse.ok || meResponse.data?.success !== true) {
    throw new Error(
      `管理员会话校验失败（${meResponse.status}）：${meResponse.data?.error || "未知错误"}`
    );
  }

  if (meResponse.data?.data?.role !== "admin") {
    throw new Error(`当前登录用户不是管理员：${meResponse.data?.data?.email || "unknown"}`);
  }

  return {
    login: summarizeResponse(loginResponse),
    me: summarizeResponse(meResponse),
  };
}

function buildAdminE2EPayload() {
  const hostname = "phase1-admin-validate.invalid";
  return {
    displayName: "Phase1 Admin Validate",
    homepageUrl: `https://${hostname}`,
    apiBaseUrl: `https://${hostname}/v1`,
    apiKey: "sk-phase1-admin-validation",
    label: "phase1-admin-e2e",
    statusVisibility: "public",
    priorityScore: 321,
    runInitialProbe: false,
    modelLimit: 2,
    forceModels: ["gpt-4o-mini", "claude-3-5-haiku"],
    siteSystem: "openai-compatible",
    platformType: "openai-compatible",
    sourceStage: "website",
    sourceModule: "phase1-admin-e2e",
    summary: "phase1 admin import validation",
    description: "phase1 admin import validation",
    registrationOpen: true,
    emailVerificationRequired: false,
    inviteCodeRequired: false,
    hasInitialQuota: true,
    tags: ["批量验证", "新站抢注"],
    meta: {
      providerFamilies: ["openai", "anthropic"],
      validationPhase: "phase1-admin-e2e",
    },
  };
}

function buildLivePayload(record) {
  const priorityScore = Number(record.priorityScore ?? 220);
  const modelLimit = Number(record.modelLimit ?? 3);
  const forceModels = Array.isArray(record.forceModels)
    ? record.forceModels.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    displayName: record.displayName,
    homepageUrl: record.homepageUrl || record.apiBaseUrl,
    apiBaseUrl: record.apiBaseUrl,
    apiKey: record.apiKey,
    label: record.label || "phase1-live-validation",
    statusVisibility: record.statusVisibility || "public",
    priorityScore: Number.isFinite(priorityScore) ? priorityScore : 220,
    runInitialProbe: true,
    modelLimit: Number.isFinite(modelLimit) && modelLimit > 0 ? modelLimit : 3,
    forceModels,
    siteSystem: record.siteSystem,
    platformType: record.platformType,
    sourceStage: record.sourceStage || "website",
    sourceModule: record.sourceModule || "phase1-live-validation",
    summary: record.summary || "phase1 live initial probe validation",
  };
}

async function runAdminImportValidation(options, cookieJar) {
  const payload = buildAdminE2EPayload();
  const expectedSiteKey = normalizeHostname(payload.apiBaseUrl);
  const expectedApiBaseUrl = normalizeApiBaseUrl(payload.apiBaseUrl);
  const phase = createPhase("admin-import-e2e", sanitizePayload(payload));
  phase.expectedSiteKey = expectedSiteKey;

  try {
    const importResponse = await requestJson(
      options.baseUrl,
      "/api/sks/admin/sites",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      cookieJar
    );

    phase.responses.import = summarizeResponse(importResponse);

    assertPhase(
      phase,
      importResponse.status === 201 && importResponse.data?.success === true,
      "管理态导入返回 201 + success=true",
      importResponse.data
    );

    const importData = importResponse.data?.data || {};
    const site = importData.site;
    const credential = importData.credential;
    const catalogSite = importData.catalogSite;

    assertPhase(phase, Boolean(site), "导入响应包含 SKS site 对象", importData);
    assertPhase(phase, Boolean(credential), "导入响应包含 credential 对象", importData);
    assertPhase(phase, Boolean(catalogSite), "导入响应包含 catalogSite 对象", importData);
    assertPhase(phase, importData.initialProbe === null, "runInitialProbe=false 时 initialProbe 为空", importData);
    assertPhase(phase, importData.probeError === null, "runInitialProbe=false 时 probeError 为空", importData);

    assertPhase(phase, site.normalizedHostname === expectedSiteKey, "SKS 站点 normalizedHostname 正确", site);
    assertPhase(
      phase,
      catalogSite.normalizedHostname === expectedSiteKey,
      "site-catalog normalizedHostname 正确",
      catalogSite
    );
    assertPhase(phase, site.statusVisibility === payload.statusVisibility, "SKS statusVisibility 映射正确", site);
    assertPhase(phase, catalogSite.visibility === payload.statusVisibility, "catalog visibility 映射正确", catalogSite);
    assertPhase(phase, site.apiBaseUrl === expectedApiBaseUrl, "SKS apiBaseUrl 已规范化", site);
    assertPhase(phase, catalogSite.apiBaseUrl === expectedApiBaseUrl, "catalog apiBaseUrl 已规范化", catalogSite);
    assertPhase(phase, credential.label === payload.label, "credential.label 映射正确", credential);
    assertPhase(phase, credential.priorityScore === payload.priorityScore, "credential.priorityScore 映射正确", credential);
    assertPhase(phase, catalogSite.hasCredential === true, "catalogSite.hasCredential 已回写", catalogSite);
    assertPhase(phase, Boolean(catalogSite.lastSksSyncAt), "catalogSite.lastSksSyncAt 已回写", catalogSite);

    const adminListResponse = await requestJson(options.baseUrl, "/api/sks/admin/sites", {}, cookieJar);
    const adminList = Array.isArray(adminListResponse.data?.data) ? adminListResponse.data.data : [];
    const adminListItem = adminList.find((item) => item?.site?.normalizedHostname === expectedSiteKey) || null;
    phase.responses.adminList = summarizeResponse(adminListResponse, {
      count: adminList.length,
      match: adminListItem,
    });
    assertPhase(phase, Boolean(adminListItem), "管理列表可读到导入站点", adminListResponse.data);

    const adminDetailResponse = await requestJson(
      options.baseUrl,
      `/api/sks/admin/site/${encodeURIComponent(expectedSiteKey)}`,
      {},
      cookieJar
    );
    const adminDetail = adminDetailResponse.data?.data || null;
    phase.responses.adminDetail = summarizeResponse(adminDetailResponse, adminDetail);
    assertPhase(phase, adminDetailResponse.data?.success === true, "管理详情接口可读取导入站点", adminDetailResponse.data);
    assertPhase(phase, adminDetail?.site?.normalizedHostname === expectedSiteKey, "管理详情 siteKey 匹配", adminDetail);
    assertPhase(
      phase,
      adminDetail?.credentials?.some(
        (item) => item.label === payload.label && item.priorityScore === payload.priorityScore
      ) === true,
      "管理详情中可见导入 credential",
      adminDetail
    );

    const publicListResponse = await requestJson(options.baseUrl, "/api/sites");
    const publicList = Array.isArray(publicListResponse.data?.data) ? publicListResponse.data.data : [];
    const publicListItem = publicList.find(
      (item) => item?.catalogSite?.normalizedHostname === expectedSiteKey
    ) || null;
    phase.responses.publicList = summarizeResponse(publicListResponse, {
      count: publicList.length,
      match: publicListItem,
    });
    assertPhase(phase, Boolean(publicListItem), "公开列表 API 可读到导入站点", publicListResponse.data);

    const publicDetailResponse = await requestJson(
      options.baseUrl,
      `/api/site/${encodeURIComponent(expectedSiteKey)}`
    );
    const publicDetail = publicDetailResponse.data?.data || null;
    phase.responses.publicDetail = summarizeResponse(publicDetailResponse, publicDetail);
    assertPhase(phase, publicDetailResponse.data?.success === true, "公开详情 API 可读取导入站点", publicDetailResponse.data);
    assertPhase(
      phase,
      publicDetail?.catalogSite?.normalizedHostname === expectedSiteKey,
      "公开详情 normalizedHostname 匹配",
      publicDetail
    );

    phase.ok = true;
  } catch (error) {
    phase.error = {
      message: error instanceof Error ? error.message : String(error),
      context:
        error && typeof error === "object" && "context" in error
          ? error.context
          : undefined,
    };
  }

  return phase;
}

async function runLiveInitialProbeValidation(options, cookieJar) {
  const liveRecords = readJson(options.liveFile);
  if (!Array.isArray(liveRecords) || liveRecords.length === 0) {
    throw new Error(`真实探测数据文件为空或格式不正确: ${options.liveFile}`);
  }
  if (options.liveIndex >= liveRecords.length) {
    throw new Error(
      `--live-index 越界：${options.liveIndex}，当前文件仅有 ${liveRecords.length} 条记录`
    );
  }

  const selectedRecord = liveRecords[options.liveIndex];
  const payload = buildLivePayload(selectedRecord);
  const expectedSiteKey = normalizeHostname(payload.apiBaseUrl);
  const phase = createPhase("runInitialProbe-live", sanitizePayload(payload));
  phase.expectedSiteKey = expectedSiteKey;
  phase.liveSource = {
    file: options.liveFile,
    index: options.liveIndex,
    displayName: selectedRecord.displayName,
    apiBaseUrl: normalizeApiBaseUrl(selectedRecord.apiBaseUrl),
  };

  try {
    const importResponse = await requestJson(
      options.baseUrl,
      "/api/sks/admin/sites",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      cookieJar
    );

    phase.responses.import = summarizeResponse(importResponse);

    assertPhase(
      phase,
      importResponse.status === 201 && importResponse.data?.success === true,
      "真实站点导入返回 201 + success=true",
      importResponse.data
    );

    const importData = importResponse.data?.data || {};
    const initialProbe = importData.initialProbe;
    const probeError = importData.probeError;
    const catalogSite = importData.catalogSite || null;

    assertPhase(phase, Boolean(importData.site), "真实站点导入响应包含 SKS site", importData);
    assertPhase(phase, Boolean(importData.credential), "真实站点导入响应包含 credential", importData);
    assertPhase(phase, Boolean(catalogSite), "真实站点导入响应包含 catalogSite", importData);
    assertPhase(phase, probeError === null, "runInitialProbe 未返回 probeError", importData);
    assertPhase(phase, Boolean(initialProbe), "runInitialProbe 返回 initialProbe", importData);
    assertPhase(
      phase,
      Boolean(initialProbe?.modelListProbe),
      "initialProbe 包含 modelListProbe",
      initialProbe
    );
    assertPhase(
      phase,
      Array.isArray(initialProbe?.testedModels) && initialProbe.testedModels.length > 0,
      "initialProbe 至少包含 1 条模型探测结果",
      initialProbe
    );
    assertPhase(
      phase,
      catalogSite?.normalizedHostname === expectedSiteKey,
      "真实探测写回的 normalizedHostname 正确",
      catalogSite
    );
    assertPhase(phase, catalogSite?.hasCredential === true, "真实探测后 hasCredential 仍为 true", catalogSite);
    assertPhase(phase, Boolean(catalogSite?.lastSksSyncAt), "真实探测后 lastSksSyncAt 已写回", catalogSite);

    const adminDetailResponse = await requestJson(
      options.baseUrl,
      `/api/sks/admin/site/${encodeURIComponent(expectedSiteKey)}`,
      {},
      cookieJar
    );
    const adminDetail = adminDetailResponse.data?.data || null;
    phase.responses.adminDetail = summarizeResponse(adminDetailResponse, adminDetail);
    assertPhase(phase, adminDetailResponse.data?.success === true, "真实探测后管理详情可读取", adminDetailResponse.data);
    assertPhase(
      phase,
      Array.isArray(adminDetail?.recentProbes) && adminDetail.recentProbes.length > 0,
      "真实探测后 recentProbes 已生成",
      adminDetail
    );
    assertPhase(
      phase,
      Boolean(adminDetail?.publicView?.current?.checkedAt),
      "真实探测后 publicView.current.checkedAt 已更新",
      adminDetail
    );
    assertPhase(
      phase,
      adminDetail?.credentials?.some(
        (item) => item.label === payload.label && Boolean(item.lastVerifiedAt)
      ) === true,
      "真实探测后导入 credential 已写入 lastVerifiedAt",
      adminDetail
    );

    const publicDetailResponse = await requestJson(
      options.baseUrl,
      `/api/site/${encodeURIComponent(expectedSiteKey)}`
    );
    const publicDetail = publicDetailResponse.data?.data || null;
    phase.responses.publicDetail = summarizeResponse(publicDetailResponse, publicDetail);
    assertPhase(phase, publicDetailResponse.data?.success === true, "真实探测后公开详情可读取", publicDetailResponse.data);
    assertPhase(
      phase,
      Boolean(publicDetail?.sksDetail?.current?.checkedAt),
      "真实探测后公开详情含最新 checkedAt",
      publicDetail
    );
    assertPhase(
      phase,
      Array.isArray(publicDetail?.recentFailures),
      "真实探测后 recentFailures 字段存在",
      publicDetail
    );

    phase.ok = true;
  } catch (error) {
    phase.error = {
      message: error instanceof Error ? error.message : String(error),
      context:
        error && typeof error === "object" && "context" in error
          ? error.context
          : undefined,
    };
  }

  return phase;
}

function writeReport(reportPath, report) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const cookieJar = new Map();
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: options.baseUrl,
    adminEmail: options.adminEmail,
    reportPath: options.reportPath,
    phases: {},
    overallSuccess: false,
    login: null,
    fatalError: null,
  };

  try {
    report.login = await loginAsAdmin(options, cookieJar);

    if (options.only === "both" || options.only === "admin") {
      console.log("[phase1] 开始验证：admin/sks/sites 管理态导入链路...");
      report.phases.adminImport = await runAdminImportValidation(options, cookieJar);
      console.log(
        `[phase1] admin/sks/sites 管理态导入链路：${report.phases.adminImport.ok ? "通过" : "失败"}`
      );
    }

    if (options.only === "both" || options.only === "live") {
      console.log("[phase1] 开始验证：runInitialProbe 真实首轮探测...");
      report.phases.liveInitialProbe = await runLiveInitialProbeValidation(options, cookieJar);
      console.log(
        `[phase1] runInitialProbe 真实首轮探测：${report.phases.liveInitialProbe.ok ? "通过" : "失败"}`
      );
    }
  } catch (error) {
    report.fatalError = error instanceof Error ? error.message : String(error);
  } finally {
    const phaseResults = Object.values(report.phases);
    report.overallSuccess =
      !report.fatalError && phaseResults.length > 0 && phaseResults.every((phase) => phase.ok === true);
    writeReport(options.reportPath, report);
  }

  console.log(`[phase1] 验证报告已输出：${options.reportPath}`);

  if (!report.overallSuccess) {
    process.exitCode = 1;
    if (report.fatalError) {
      console.error(`[phase1] 致命错误：${report.fatalError}`);
    }
    return;
  }

  console.log("[phase1] 所选验证项全部通过。");
}

await main();
