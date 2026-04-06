import { getSiteCatalogSiteByHostname, upsertSiteCatalogSite } from "@/lib/site-catalog/db";
import { importSiteCatalogEntry } from "@/lib/site-catalog/service";
import {
  createSksUserSubmission,
  deleteSksUserSubmission,
  getResolvedSksUserSubmissionById,
  getSksSiteRecordById,
  getSksSiteRecordByKey,
  listSksUserSubmissionsByUser,
  setSksUserSubmissionResult,
  upsertSksSite,
} from "@/lib/sks/db";
import { getSksSiteByKey } from "@/lib/sks/service";
import type {
  SksCallOptionView,
  SksFullProbeResult,
  SksInternalStatus,
  SksUserSubmissionRecord,
  SksUserSubmissionView,
} from "@/lib/sks/types";
import { normalizeApiBaseUrl, normalizeHostname, toDbTimestamp } from "@/lib/sks/utils";

function getApiKeyPreview(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function isHealthyStatus(status: SksInternalStatus | null | undefined) {
  return status === "ok" || status === "slow";
}

function isInitialProbeAccepted(result: SksFullProbeResult | null) {
  if (!result?.modelListProbe) return false;
  if (!isHealthyStatus(result.modelListProbe.status)) return false;
  if (result.testedModels.length === 0) return false;
  return result.testedModels.every((probe) => isHealthyStatus(probe.status));
}

function resolveFailureMessage(input: {
  probeError: string | null;
  initialProbe: SksFullProbeResult | null;
}) {
  if (input.probeError) return input.probeError;

  const failedModelProbe = input.initialProbe?.testedModels.find(
    (probe) => !isHealthyStatus(probe.status)
  );
  if (failedModelProbe?.errorMessage) return failedModelProbe.errorMessage;

  if (failedModelProbe?.status) {
    return `模型实测未通过：${failedModelProbe.modelName || "unknown"}（${failedModelProbe.status}）`;
  }

  if (input.initialProbe?.modelListProbe?.errorMessage) {
    return input.initialProbe.modelListProbe.errorMessage;
  }

  if (input.initialProbe?.modelListProbe?.status) {
    return `模型列表检测未通过（${input.initialProbe.modelListProbe.status}）`;
  }

  return "检测未通过，暂未收录";
}

function buildIframeScript(iframeUrl: string, height: number) {
  return [
    "const container = document.querySelector('#sks-widget');",
    "const iframe = document.createElement('iframe');",
    `iframe.src = ${JSON.stringify(iframeUrl)};`,
    "iframe.loading = 'lazy';",
    "iframe.style.width = '100%';",
    `iframe.style.height = '${height}px';`,
    "iframe.style.border = '0';",
    "iframe.style.borderRadius = '16px';",
    "iframe.style.overflow = 'hidden';",
    "container?.appendChild(iframe);",
  ].join("\n");
}

function buildJsonSnippet(jsonUrl: string) {
  return [
    `fetch(${JSON.stringify(jsonUrl)}, { cache: "no-store" })`,
    "  .then((response) => response.json())",
    "  .then((payload) => {",
    "    console.log('SKS payload:', payload);",
    "  });",
  ].join("\n");
}

export function buildSksCallOptions(siteKey: string): SksCallOptionView[] {
  const encodedSiteKey = encodeURIComponent(siteKey);
  const statusPageUrl = `/sks/site/${encodedSiteKey}`;
  const jsonUrl = `/api/sks/site/${encodedSiteKey}`;
  const widgetBaseUrl = `/api/sks/widget/${encodedSiteKey}`;

  const widgetOptions: Array<{
    template: Exclude<SksCallOptionView["template"], "json-feed">;
    label: string;
    description: string;
    height: number;
  }> = [
    {
      template: "badge",
      label: "Badge 横幅",
      description: "适合页头、侧栏或个人导航页，突出当前状态与延迟。",
      height: 84,
    },
    {
      template: "mini-grid",
      label: "Mini Grid 小方格",
      description: "适合展示最近 24 小时连续状态，信息密度更高。",
      height: 164,
    },
    {
      template: "full-card",
      label: "Full Card 完整卡片",
      description: "适合独立页面或文档页，包含状态、成功率与热门模型。",
      height: 256,
    },
  ];

  const widgets = widgetOptions.map((item) => {
    const iframeUrl = `${widgetBaseUrl}?template=${item.template}`;

    return {
      template: item.template,
      label: item.label,
      description: item.description,
      statusPageUrl,
      previewUrl: iframeUrl,
      jsonUrl,
      iframeUrl,
      scriptUrl: null,
      iframeSnippet: `<iframe src="${iframeUrl}" loading="lazy" style="width:100%;height:${item.height}px;border:0;border-radius:16px;overflow:hidden;"></iframe>`,
      scriptSnippet: buildIframeScript(iframeUrl, item.height),
      jsonSnippet: buildJsonSnippet(jsonUrl),
    } satisfies SksCallOptionView;
  });

  return [
    ...widgets,
    {
      template: "json-feed",
      label: "JSON Feed 数据接口",
      description: "适合脚本调用、自动化同步或你自己的前端组件二次渲染。",
      statusPageUrl,
      previewUrl: jsonUrl,
      jsonUrl,
      iframeUrl: null,
      scriptUrl: null,
      iframeSnippet: null,
      scriptSnippet: buildJsonSnippet(jsonUrl),
      jsonSnippet: buildJsonSnippet(jsonUrl),
    },
  ];
}

function resolveSubmissionSite(submission: SksUserSubmissionRecord) {
  if (submission.siteId) {
    return getSksSiteRecordById(submission.siteId) || getSksSiteRecordByKey(submission.normalizedHostname);
  }

  return getSksSiteRecordByKey(submission.normalizedHostname);
}

function isRetryableSubmission(submission: SksUserSubmissionRecord) {
  if (submission.status === "failed") return true;
  if (submission.status !== "approved") return false;
  return !resolveSubmissionSite(submission);
}

function buildSubmissionView(submission: SksUserSubmissionRecord): SksUserSubmissionView {
  const site = resolveSubmissionSite(submission);
  const publicView =
    submission.status === "approved" && site?.statusVisibility === "public"
      ? getSksSiteByKey(site.normalizedHostname || site.id)
      : null;

  return {
    submission,
    site,
    publicView,
    callOptions: publicView
      ? buildSksCallOptions(publicView.site.normalizedHostname || publicView.site.id)
      : [],
  };
}

export function listSksUserSubmissionViews(userId: number): SksUserSubmissionView[] {
  return listSksUserSubmissionsByUser(userId).map(buildSubmissionView);
}

async function submitSksSiteForSubmission(input: {
  userId: number;
  apiBaseUrl: string;
  apiKey: string;
  submissionId?: string;
}) {
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  if (!apiBaseUrl) {
    throw new Error("网址无效，请输入可访问的网站地址或 API Base URL");
  }

  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("API SKY 不能为空");
  }

  const hostname = normalizeHostname(apiBaseUrl);
  if (!hostname) {
    throw new Error("无法识别网站域名");
  }

  const matchedSubmission = listSksUserSubmissionsByUser(input.userId).find(
    (item) => item.normalizedHostname === hostname
  );
  const effectiveSubmissionId =
    input.submissionId || (matchedSubmission && isRetryableSubmission(matchedSubmission) ? matchedSubmission.id : undefined);

  if (effectiveSubmissionId) {
    const existing = getResolvedSksUserSubmissionById(effectiveSubmissionId);
    if (!existing || existing.record.userId !== input.userId) {
      throw new Error("提交记录不存在或无权操作");
    }
    if (!isRetryableSubmission(existing.record)) {
      throw new Error("你已经提交过这个网站，请不要重复提交");
    }
  }

  const existingSite = getSksSiteRecordByKey(hostname);
  const existingCatalog = getSiteCatalogSiteByHostname(hostname);

  const submission = effectiveSubmissionId
    ? setSksUserSubmissionResult(effectiveSubmissionId, {
        status: "pending",
        lastMessage:
          matchedSubmission?.status === "approved"
            ? "检测记录仍在，但站点已被移除，正在重新检测并恢复收录"
            : "已更新参数，正在重新检测",
        siteId: null,
        credentialId: null,
        displayName: existingSite?.displayName || existingCatalog?.displayName || null,
        homepageUrl: apiBaseUrl,
        apiBaseUrl,
        apiKeyPreview: getApiKeyPreview(apiKey),
        apiKey,
        validatedAt: null,
      })
    : createSksUserSubmission({
        userId: input.userId,
        hostname,
        normalizedHostname: hostname,
        apiBaseUrl,
        homepageUrl: apiBaseUrl,
        displayName: existingSite?.displayName || existingCatalog?.displayName || null,
        apiKeyPreview: getApiKeyPreview(apiKey),
        apiKey,
        sourceType: "owner",
      });

  if (!submission) {
    throw new Error("提交记录不存在或无权操作");
  }

  try {
    const imported = await importSiteCatalogEntry({
      displayName: existingCatalog?.displayName || existingSite?.displayName,
      homepageUrl: existingCatalog?.homepageUrl || existingSite?.homepageUrl || apiBaseUrl,
      apiBaseUrl,
      siteSystem: existingCatalog?.siteSystem,
      platformType: existingSite?.platformType || existingCatalog?.siteSystem || "openai-compatible",
      sourceStage: existingCatalog?.sourceStage || "website",
      sourceModule: "user-submission",
      visibility: existingCatalog?.visibility || "private",
      catalogStatus: existingCatalog?.catalogStatus || "pending",
      summary: existingCatalog?.summary,
      description: existingCatalog?.description,
      registrationOpen: existingCatalog?.registrationOpen,
      emailVerificationRequired: existingCatalog?.emailVerificationRequired,
      inviteCodeRequired: existingCatalog?.inviteCodeRequired,
      hasInitialQuota: existingCatalog?.hasInitialQuota,
      tags: existingCatalog?.tags,
      ownershipStatus: existingSite?.ownershipStatus || "probable_owner",
      ownerUserId: existingSite?.ownerUserId ?? null,
      createdByUserId: existingSite?.createdByUserId ?? input.userId,
      apiKey,
      sourceType: "owner",
      submittedByUserId: input.userId,
      label: `用户提交 · ${hostname}`,
      isEnabled: true,
      priorityScore: 120,
      runInitialProbe: true,
      allowPrivateProbe: existingSite?.statusVisibility === "private",
    });

    const approved = !imported.probeError && isInitialProbeAccepted(imported.initialProbe);

    if (approved) {
      const publishedCatalog = upsertSiteCatalogSite({
        displayName: imported.catalogSite.displayName,
        homepageUrl: imported.catalogSite.homepageUrl,
        apiBaseUrl: imported.catalogSite.apiBaseUrl,
        siteSystem: imported.catalogSite.siteSystem,
        sourceStage: "sks",
        sourceModule: "user-submission",
        visibility: "public",
        catalogStatus: "active",
        summary: imported.catalogSite.summary,
        description: imported.catalogSite.description,
        registrationOpen: imported.catalogSite.registrationOpen,
        emailVerificationRequired: imported.catalogSite.emailVerificationRequired,
        inviteCodeRequired: imported.catalogSite.inviteCodeRequired,
        hasInitialQuota: imported.catalogSite.hasInitialQuota,
        tags: imported.catalogSite.tags,
        ownershipStatus: existingSite?.ownershipStatus || "probable_owner",
        ownerUserId: existingSite?.ownerUserId ?? null,
        createdByUserId: existingSite?.createdByUserId ?? input.userId,
      });

      const publishedSite = upsertSksSite({
        displayName: publishedCatalog.displayName,
        homepageUrl: publishedCatalog.homepageUrl,
        apiBaseUrl: publishedCatalog.apiBaseUrl,
        apiKey,
        platformType: existingSite?.platformType || publishedCatalog.siteSystem || "openai-compatible",
        statusVisibility: "public",
        ownershipStatus: existingSite?.ownershipStatus || "probable_owner",
        ownerUserId: existingSite?.ownerUserId ?? null,
        createdByUserId: existingSite?.createdByUserId ?? input.userId,
        sourceType: "owner",
        submittedByUserId: input.userId,
        label: `用户提交 · ${hostname}`,
        isEnabled: true,
        priorityScore: 120,
      });

      const approvedSubmission =
        setSksUserSubmissionResult(submission.id, {
          status: "approved",
          lastMessage: "检测通过，已收录成功",
          siteId: imported.sksImport?.site.id || publishedSite.id,
          credentialId: imported.sksImport?.credential.id ?? null,
          displayName: publishedCatalog.displayName,
          homepageUrl: publishedCatalog.homepageUrl,
          validatedAt: toDbTimestamp(),
        }) || submission;

      return buildSubmissionView(approvedSubmission);
    }

    const failedSubmission =
      setSksUserSubmissionResult(submission.id, {
        status: "failed",
        lastMessage: resolveFailureMessage({
          probeError: imported.probeError,
          initialProbe: imported.initialProbe,
        }),
        siteId: imported.sksImport?.site.id ?? null,
        credentialId: imported.sksImport?.credential.id ?? null,
        displayName: imported.catalogSite.displayName,
        homepageUrl: imported.catalogSite.homepageUrl,
        validatedAt: toDbTimestamp(),
      }) || submission;

    return buildSubmissionView(failedSubmission);
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交失败";
    const failedSubmission =
      setSksUserSubmissionResult(submission.id, {
        status: "failed",
        lastMessage: message,
        validatedAt: toDbTimestamp(),
      }) || submission;

    return buildSubmissionView(failedSubmission);
  }
}

export async function submitSksSiteForUser(input: {
  userId: number;
  apiBaseUrl: string;
  apiKey: string;
}) {
  return submitSksSiteForSubmission(input);
}

export async function retrySksSiteSubmissionForUser(input: {
  userId: number;
  submissionId: string;
  apiBaseUrl: string;
  apiKey: string;
}) {
  return submitSksSiteForSubmission(input);
}

export function removeSksSiteSubmissionForUser(input: { userId: number; submissionId: string }) {
  const deleted = deleteSksUserSubmission(input.submissionId, input.userId);
  if (!deleted) {
    throw new Error("提交记录不存在或无权删除");
  }

  return { deleted: true, submissionId: input.submissionId };
}

export function getEditableSksSubmissionSecret(input: { userId: number; submissionId: string }) {
  const resolved = getResolvedSksUserSubmissionById(input.submissionId);
  if (!resolved || resolved.record.userId !== input.userId) {
    throw new Error("提交记录不存在或无权查看");
  }

  if (!isRetryableSubmission(resolved.record)) {
    throw new Error("只有失败记录或已失效的成功记录才允许编辑");
  }

  return {
    submissionId: resolved.record.id,
    apiBaseUrl: resolved.record.apiBaseUrl,
    apiKey: resolved.apiKey,
  };
}
