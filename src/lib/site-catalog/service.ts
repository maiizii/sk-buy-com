import {
  getSiteCatalogSiteByHostname,
  listSiteCatalogSites,
  markSiteCatalogSksSynced,
  upsertSiteCatalogSite,
} from "@/lib/site-catalog/db";
import type {
  SiteCatalogComputedView,
  SiteCatalogImportInput,
  SiteCatalogImportResult,
  SiteCatalogSiteCardView,
  SiteCatalogSiteDetailView,
  SiteCatalogSiteRecord,
} from "@/lib/site-catalog/types";
import { runSksFullProbe } from "@/lib/sks/probe";
import { getSksSiteByKey, getSksSiteList } from "@/lib/sks/service";
import type { SksDisplayStatus, SksSiteCardView, SksSiteDetailView } from "@/lib/sks/types";
import { importSksSiteWithCredential } from "@/lib/sks/db";
import {
  detectSksSitePublicMeta,
  resolveImportedSiteDisplayName,
} from "@/lib/sks/site-public";
import { inferProviderFamily, parseDbTimestamp } from "@/lib/sks/utils";

function getStatusRank(status: SksDisplayStatus) {
  if (status === "failed") return 0;
  if (status === "unknown") return 1;
  if (status === "slow") return 2;
  return 3;
}

function safeParseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getSiteAgeDays(site: SiteCatalogSiteRecord) {
  const createdAt = parseDbTimestamp(site.createdAt);
  if (!createdAt) return Number.POSITIVE_INFINITY;
  return (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
}

function deriveOperationalStatusLabel(site: SiteCatalogSiteRecord, sksCard: SksSiteCardView | null) {
  const siteAgeDays = getSiteAgeDays(site);
  if (siteAgeDays <= 3) return "新站上线";
  if (!sksCard) return "正常运营";

  const successRate = sksCard.stats7d.successRate;
  if (successRate >= 97 && sksCard.current.status === "ok") return "长期稳定";
  if (successRate >= 85) return "正常运营";
  if (successRate >= 60) return "略有波动";
  return "疑似停运";
}

function deriveRecommendationTags(site: SiteCatalogSiteRecord, sksCard: SksSiteCardView | null) {
  const tags = new Set(site.tags);
  const meta = safeParseJsonObject(site.metaJson);
  const text = [site.displayName, site.summary, site.description].join(" ");

  if (
    meta.isPublicWelfare === true ||
    meta.isFree公益 === true ||
    /免费|公益|welfare|free/i.test(text)
  ) {
    tags.add("免费公益");
  }

  if (site.registrationOpen === true && site.hasInitialQuota === true) {
    tags.add("新站抢注");
  }

  const visitCount = typeof meta.visitCount === "number" ? meta.visitCount : 0;
  const reviewCount = typeof meta.reviewCount === "number" ? meta.reviewCount : 0;
  const successRate = sksCard?.stats7d.successRate ?? 0;
  if ((visitCount >= 500 || reviewCount >= 10) && successRate >= 90) {
    tags.add("人气权威");
  }

  if (tags.size === 0) {
    tags.add("新站抢注");
  }

  return Array.from(tags);
}

function deriveProviderFamilies(site: SiteCatalogSiteRecord, sksCard: SksSiteCardView | null, sksDetail: SksSiteDetailView | null) {
  const families = new Set<string>();
  const modelNames = sksDetail
    ? sksDetail.modelStatuses.map((item) => item.modelName)
    : sksCard?.models.all || sksCard?.models.hot || [];

  for (const modelName of modelNames) {
    const family = inferProviderFamily(modelName);
    if (family) families.add(family);
  }

  const meta = safeParseJsonObject(site.metaJson);
  const metaFamilies = Array.isArray(meta.providerFamilies)
    ? meta.providerFamilies.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  for (const family of metaFamilies) {
    families.add(family);
  }

  return Array.from(families);
}

function buildComputedView(
  site: SiteCatalogSiteRecord,
  sksCard: SksSiteCardView | null,
  sksDetail: SksSiteDetailView | null = null
): SiteCatalogComputedView {
  return {
    displayStatus: sksCard?.current.status || "unknown",
    operationalStatusLabel: deriveOperationalStatusLabel(site, sksCard),
    recommendationTags: deriveRecommendationTags(site, sksCard),
    providerFamilies: deriveProviderFamilies(site, sksCard, sksDetail),
    stats7d: sksCard?.stats7d || null,
  };
}

function buildCardView(site: SiteCatalogSiteRecord, sksCard: SksSiteCardView | null): SiteCatalogSiteCardView {
  return {
    catalogSite: site,
    sks: sksCard,
    computed: buildComputedView(site, sksCard),
  };
}

export function listPublicSiteCatalogCards() {
  const catalogSites = listSiteCatalogSites({ visibility: "public", catalogStatus: "active" });
  const sksByHostname = new Map(getSksSiteList().map((item) => [item.site.normalizedHostname, item]));

  return catalogSites
    .map((site) => buildCardView(site, sksByHostname.get(site.normalizedHostname) || null))
    .sort((a, b) => {
      const rankDiff = getStatusRank(b.computed.displayStatus) - getStatusRank(a.computed.displayStatus);
      if (rankDiff !== 0) return rankDiff;

      const successRateDiff = (b.computed.stats7d?.successRate || 0) - (a.computed.stats7d?.successRate || 0);
      if (successRateDiff !== 0) return successRateDiff;

      return a.catalogSite.displayName.localeCompare(b.catalogSite.displayName, "zh-CN");
    });
}

export function getPublicSiteCatalogDetail(siteKey: string): SiteCatalogSiteDetailView | null {
  const catalogSite = getSiteCatalogSiteByHostname(siteKey);
  if (!catalogSite || catalogSite.visibility !== "public" || catalogSite.catalogStatus !== "active") {
    return null;
  }

  const sksDetail = getSksSiteByKey(siteKey);
  const card = sksDetail
    ? {
        site: sksDetail.site,
        current: sksDetail.current,
        models: sksDetail.models,
        stats7d: sksDetail.stats7d,
        stats30d: sksDetail.stats30d,
        grid: sksDetail.grid,
        dailyGrid: sksDetail.dailyGrid,
      }
    : null;

  return {
    catalogSite,
    sks: card,
    sksDetail,
    computed: buildComputedView(catalogSite, card, sksDetail),
  };
}

export async function importSiteCatalogEntry(input: SiteCatalogImportInput): Promise<SiteCatalogImportResult> {
  const detectedPublicMeta = await detectSksSitePublicMeta(input.apiBaseUrl);
  const resolvedDisplayName = resolveImportedSiteDisplayName({
    displayName: input.displayName,
    detectedDisplayName: detectedPublicMeta.displayName,
    apiBaseUrl: input.apiBaseUrl,
  });
  const resolvedInput: SiteCatalogImportInput = {
    ...input,
    displayName: resolvedDisplayName,
    siteSystem:
      input.siteSystem && input.siteSystem !== "unknown"
        ? input.siteSystem
        : detectedPublicMeta.siteSystem !== "unknown"
          ? detectedPublicMeta.siteSystem
          : input.siteSystem,
  };

  const catalogSite = upsertSiteCatalogSite(resolvedInput);
  const apiKey = String(resolvedInput.apiKey || "").trim();

  let sksImport: SiteCatalogImportResult["sksImport"] = null;
  let initialProbe: SiteCatalogImportResult["initialProbe"] = null;
  let probeError: string | null = null;

  if (apiKey) {
    sksImport = importSksSiteWithCredential({
      displayName: catalogSite.displayName,
      homepageUrl: catalogSite.homepageUrl,
      apiBaseUrl: catalogSite.apiBaseUrl,
      apiKey,
      platformType: resolvedInput.platformType || catalogSite.siteSystem || "openai-compatible",
      statusVisibility: catalogSite.visibility,
      ownershipStatus: resolvedInput.ownershipStatus,
      ownerUserId: resolvedInput.ownerUserId ?? null,
      createdByUserId: resolvedInput.createdByUserId ?? null,
      sourceType: resolvedInput.sourceType,
      submittedByUserId: resolvedInput.submittedByUserId ?? null,
      label: resolvedInput.label,
      isEnabled: resolvedInput.isEnabled !== false,
      priorityScore: resolvedInput.priorityScore,
    });

    markSiteCatalogSksSynced(catalogSite.normalizedHostname);

    if (resolvedInput.runInitialProbe) {
      try {
        initialProbe = await runSksFullProbe(catalogSite.normalizedHostname, {
          credentialId: sksImport.credential.id,
          modelLimit:
            typeof resolvedInput.initialProbeModelLimit === "number" &&
            Number.isFinite(resolvedInput.initialProbeModelLimit)
              ? resolvedInput.initialProbeModelLimit
              : undefined,
          forceModels: Array.isArray(resolvedInput.forceModels)
            ? resolvedInput.forceModels.map((item) => String(item || "").trim()).filter(Boolean)
            : undefined,
          allowPrivateProbe: resolvedInput.allowPrivateProbe,
        });
      } catch (error) {
        probeError = error instanceof Error ? error.message : "首次探测失败";
      }
    }
  }

  return {
    catalogSite: getSiteCatalogSiteByHostname(catalogSite.normalizedHostname) || catalogSite,
    sksImport,
    initialProbe,
    probeError,
  };
}
