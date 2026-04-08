import { getSiteCatalogSiteByHostname, upsertSiteCatalogSite } from "@/lib/site-catalog/db";
import { importSiteCatalogEntry } from "@/lib/site-catalog/service";
import { runSksModelVerification, syncSksSiteModels } from "@/lib/sks/probe";
import {
  createSksUserSubmission,
  deleteSksUserSubmission,
  getResolvedSksUserSubmissionById,
  getSksSiteRecordById,
  getSksSiteRecordByKey,
  listSksUserSubmissionsByHostname,
  listSksUserSubmissionsByUser,
  setSksUserSubmissionResult,
  upsertSksSite,
} from "@/lib/sks/db";
import { getSksSiteByKey } from "@/lib/sks/service";
import { buildSksEmbedFingerprint } from "@/lib/sks/fingerprint";
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
  return status === "ok" || status === "slow" || status === "reachable";
}

function isBasicSubmissionAccepted(input: {
  modelListProbe: { status: SksInternalStatus } | null | undefined;
  syncedModels: string[] | null | undefined;
}) {
  if (!input.modelListProbe) return false;
  if (!isHealthyStatus(input.modelListProbe.status)) return false;
  return Array.isArray(input.syncedModels) && input.syncedModels.length > 0;
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

function buildIframeScript(iframeUrl: string, height: number, length: number) {
  return [
    "const container = document.querySelector('#sks-widget');",
    "const iframe = document.createElement('iframe');",
    `iframe.src = ${JSON.stringify(iframeUrl)};`,
    "iframe.loading = 'lazy';",
    `iframe.style.width = '${length}px';`,
    "iframe.style.maxWidth = '100%';",
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
  return buildSksCallOptionsForUser(siteKey, 0);
}

export function buildSksCallOptionsForUser(siteKey: string, userId: number): SksCallOptionView[] {
  const encodedSiteKey = encodeURIComponent(siteKey);
  const fingerprint = buildSksEmbedFingerprint({ userId, siteKey });
  const statusPageUrl = `/sks/site/${encodedSiteKey}`;
  const jsonUrl = `/api/sks/site/${encodedSiteKey}?fp=${encodeURIComponent(fingerprint)}`;
  const widgetBaseUrl = `/api/sks/widget/${encodedSiteKey}`;

  const widgetOptions: Array<{
    template: Exclude<SksCallOptionView["template"], "json-feed">;
    label: string;
    description: string;
    length: number;
    height: number;
  }> = [
    {
      template: "site-card-large",
      label: "首页卡片同款模板",
      description: "与首页 Featured 卡片同款交互与展示效果，用于嵌入展示你提交的网站状态。",
      length: 680,
      height: 272,
    },
    {
      template: "site-card-compact",
      label: "发现页长条模板",
      description: "横向长条样式，适合列表、侧栏或信息流位置展示。",
      length: 980,
      height: 220,
    },
  ];

  const widgets = widgetOptions.map((item) => {
    const iframeUrl = `${widgetBaseUrl}?template=${item.template}&length=${item.length}&fp=${encodeURIComponent(fingerprint)}`;

    return {
      template: item.template,
      label: item.label,
      description: item.description,
      fingerprint,
      statusPageUrl,
      previewUrl: iframeUrl,
      jsonUrl,
      iframeUrl,
      scriptUrl: null,
      iframeSnippet: `<iframe src="${iframeUrl}" loading="lazy" style="width:${item.length}px;max-width:100%;height:${item.height}px;border:0;border-radius:16px;overflow:hidden;"></iframe>`,
      scriptSnippet: buildIframeScript(iframeUrl, item.height, item.length),
      jsonSnippet: buildJsonSnippet(jsonUrl),
    } satisfies SksCallOptionView;
  });

  return [
    ...widgets,
    {
      template: "json-feed",
      label: "JSON Feed 数据接口",
      description: "适合脚本调用、自动化同步或你自己的前端组件二次渲染。",
      fingerprint,
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

function reconcileSubmissionStatus(submission: SksUserSubmissionRecord) {
  const site = resolveSubmissionSite(submission);
  if (!site || site.statusVisibility !== "public") {
    return submission;
  }

  if (submission.status === "approved" && submission.siteId === site.id) {
    return submission;
  }

  return (
    setSksUserSubmissionResult(submission.id, {
      status: "approved",
      lastMessage: "站点已恢复公开展示，申请记录已自动同步为成功",
      siteId: site.id,
      displayName: site.displayName,
      homepageUrl: site.homepageUrl,
      apiBaseUrl: site.apiBaseUrl,
      validatedAt: toDbTimestamp(),
    }) || submission
  );
}

function buildSubmissionView(submission: SksUserSubmissionRecord): SksUserSubmissionView {
  const reconciledSubmission = reconcileSubmissionStatus(submission);
  const site = resolveSubmissionSite(reconciledSubmission);
  const publicView =
    reconciledSubmission.status === "approved" && site?.statusVisibility === "public"
      ? getSksSiteByKey(site.normalizedHostname || site.id)
      : null;

  return {
    submission: reconciledSubmission,
    site,
    publicView,
    callOptions: publicView
      ? buildSksCallOptionsForUser(publicView.site.normalizedHostname || publicView.site.id, reconciledSubmission.userId)
      : [],
  };
}

export function listSksUserSubmissionViews(userId: number): SksUserSubmissionView[] {
  return listSksUserSubmissionsByUser(userId).map(buildSubmissionView);
}

export function syncSksSubmissionStatusForSite(siteKey: string) {
  const site = getSksSiteRecordByKey(siteKey);
  if (!site) {
    return { updatedCount: 0, site: null };
  }

  const hostname = site.normalizedHostname || site.hostname || site.id;
  const submissions = listSksUserSubmissionsByHostname(hostname);
  let updatedCount = 0;

  for (const submission of submissions) {
    if (submission.status === "approved" && submission.siteId === site.id) {
      continue;
    }

    const nextStatus = site.statusVisibility === "public" ? "approved" : submission.status;
    const nextMessage =
      site.statusVisibility === "public"
        ? "后台已恢复并重新检测通过，站点已重新收录"
        : submission.lastMessage;

    const updated = setSksUserSubmissionResult(submission.id, {
      status: nextStatus,
      lastMessage: nextMessage,
      siteId: site.id,
      displayName: site.displayName,
      homepageUrl: site.homepageUrl,
      apiBaseUrl: site.apiBaseUrl,
      validatedAt: site.statusVisibility === "public" ? toDbTimestamp() : submission.validatedAt,
    });

    if (updated) {
      updatedCount += 1;
    }
  }

  return { updatedCount, site };
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
      visibility: existingSite?.statusVisibility || existingCatalog?.visibility || "unlisted",
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
      runInitialProbe: false,
    });

    let basicProbeError: string | null = null;
    let basicProbeResult: Awaited<ReturnType<typeof syncSksSiteModels>> | null = null;

    if (imported.sksImport?.credential.id) {
      try {
        basicProbeResult = await syncSksSiteModels(imported.catalogSite.normalizedHostname, {
          credentialId: imported.sksImport.credential.id,
        });
      } catch (error) {
        basicProbeError = error instanceof Error ? error.message : "首次基础验证失败";
      }
    } else {
      basicProbeError = "站点导入成功，但未找到可用凭据";
    }

    const approved = !basicProbeError && isBasicSubmissionAccepted({
      modelListProbe: basicProbeResult?.probe,
      syncedModels: basicProbeResult?.models,
    });

    if (approved && basicProbeResult) {
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
          lastMessage: "基础验证通过，已收录成功；模型可用性正在后台继续检测",
          siteId: imported.sksImport?.site.id || publishedSite.id,
          credentialId: imported.sksImport?.credential.id ?? null,
          displayName: publishedCatalog.displayName,
          homepageUrl: publishedCatalog.homepageUrl,
          validatedAt: toDbTimestamp(),
        }) || submission;

      void runSksModelVerification(imported.catalogSite.normalizedHostname, {
        credentialId: imported.sksImport?.credential.id ?? undefined,
      }).catch((error) => {
        console.error("[sks/submission] background model verification failed:", error);
      });

      return buildSubmissionView(approvedSubmission);
    }

    const failedSubmission =
      setSksUserSubmissionResult(submission.id, {
        status: "failed",
        lastMessage:
          basicProbeError ||
          resolveFailureMessage({
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
