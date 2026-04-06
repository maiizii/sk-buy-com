import {
  getPublicSksSites,
  getSksAdminSiteBase,
  getSksAdminSiteList,
  getSksSiteRecordByKey,
  listSksProbeResults,
  listSksSiteModels,
} from "@/lib/sks/db";
import type {
  SksDisplayStatus,
  SksGridCell,
  SksModelStatusView,
  SksProbeResultRecord,
  SksProbeStats,
  SksSiteAdminListItem,
  SksSiteAdminView,
  SksSiteCardView,
  SksSiteDetailView,
  SksSiteModelRecord,
  SksSiteRecord,
  SksStatusSnapshot,
} from "@/lib/sks/types";
import {
  SKS_GRID_HOURS,
  SKS_RETENTION_DAYS,
  SKS_RETENTION_HOURS,
  addUtcHours,
  chooseHotModels,
  floorToUtcHour,
  formatHourLabel,
  getDisplayStatusFromInternal,
  parseDbTimestamp,
  toBucketKey,
} from "@/lib/sks/utils";

function isPublicSite(site: SksSiteRecord) {
  return site.statusVisibility === "public";
}

function getStatusRank(status: SksDisplayStatus) {
  if (status === "failed") return 0;
  if (status === "unknown") return 1;
  if (status === "slow") return 2;
  return 3;
}

function getProbeTimestamp(probe: SksProbeResultRecord) {
  return parseDbTimestamp(probe.checkedAt)?.getTime() ?? 0;
}

function toStatusSnapshot(probe: SksProbeResultRecord | null | undefined): SksStatusSnapshot {
  if (!probe) {
    return {
      status: "unknown",
      checkedAt: null,
      ttfbMs: null,
      totalMs: null,
      errorMessage: null,
    };
  }

  return {
    status: getDisplayStatusFromInternal(probe.status),
    checkedAt: probe.checkedAt,
    ttfbMs: probe.ttfbMs,
    totalMs: probe.totalMs,
    errorMessage: probe.errorMessage,
  };
}

function normalizeSiteLevelProbes(probes: SksProbeResultRecord[]) {
  const siteLevel = probes.filter(
    (probe) => probe.probeType !== "model_inference" || !probe.modelName
  );
  return siteLevel.length > 0 ? siteLevel : probes;
}

function pickBucketProbe(
  current: SksProbeResultRecord | undefined,
  candidate: SksProbeResultRecord
) {
  if (!current) return candidate;

  const currentRank = getStatusRank(getDisplayStatusFromInternal(current.status));
  const candidateRank = getStatusRank(getDisplayStatusFromInternal(candidate.status));

  if (candidateRank < currentRank) return candidate;
  if (candidateRank > currentRank) return current;

  return getProbeTimestamp(candidate) >= getProbeTimestamp(current) ? candidate : current;
}

function buildProbeStats(probes: SksProbeResultRecord[]): SksProbeStats {
  const total = probes.length;
  let okCount = 0;
  let slowCount = 0;

  for (const probe of probes) {
    const status = getDisplayStatusFromInternal(probe.status);
    if (status === "ok") okCount += 1;
    if (status === "slow") slowCount += 1;
  }

  const failedCount = total - okCount - slowCount;
  const successCount = okCount + slowCount;

  return {
    total,
    okCount,
    slowCount,
    failedCount,
    successRate: total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0,
  };
}

function resolveGridWindowEnd(probes: SksProbeResultRecord[]) {
  const latestProbeTimestamp = probes.reduce((latest, probe) => {
    const timestamp = getProbeTimestamp(probe);
    return timestamp > latest ? timestamp : latest;
  }, 0);

  return latestProbeTimestamp > 0
    ? floorToUtcHour(new Date(latestProbeTimestamp))
    : floorToUtcHour(new Date());
}

function buildGrid(probes: SksProbeResultRecord[], hours: number = SKS_GRID_HOURS): SksGridCell[] {
  const bucketMap = new Map<string, SksProbeResultRecord>();

  for (const probe of probes) {
    const parsed = parseDbTimestamp(probe.checkedAt);
    if (!parsed) continue;
    const bucketKey = toBucketKey(floorToUtcHour(parsed));
    bucketMap.set(bucketKey, pickBucketProbe(bucketMap.get(bucketKey), probe));
  }

  const end = resolveGridWindowEnd(probes);
  const start = addUtcHours(end, -(hours - 1));

  return Array.from({ length: hours }, (_, index) => {
    const bucketStart = addUtcHours(start, index);
    const key = toBucketKey(bucketStart);
    const probe = bucketMap.get(key);
    const snapshot = toStatusSnapshot(probe);

    return {
      bucketStart: bucketStart.toISOString(),
      label: formatHourLabel(bucketStart),
      status: snapshot.status,
      checkedAt: snapshot.checkedAt,
      ttfbMs: snapshot.ttfbMs,
      totalMs: snapshot.totalMs,
      errorMessage: snapshot.errorMessage,
    };
  });
}

function resolveHotModels(models: SksSiteModelRecord[]) {
  const flagged = models.filter((model) => model.isHot).map((model) => model.modelName);
  if (flagged.length > 0) return flagged;
  return chooseHotModels(models.map((model) => model.modelName), 6);
}

function buildModelStatusView(
  siteId: string,
  model: SksSiteModelRecord
): SksModelStatusView {
  const probes = listSksProbeResults(siteId, {
    probeType: "model_inference",
    modelName: model.modelName,
    hours: SKS_RETENTION_HOURS,
    limit: 1000,
  });

  const current = toStatusSnapshot(probes[0]);

  return {
    modelName: model.modelName,
    providerFamily: model.providerFamily,
    isHot: model.isHot,
    lastSeenAt: model.lastSeenAt,
    current,
    stats7d: buildProbeStats(probes),
    grid: buildGrid(probes),
  };
}

function buildSiteCardView(site: SksSiteRecord): SksSiteCardView {
  const models = listSksSiteModels(site.id, { currentlyListedOnly: true });
  const probes = normalizeSiteLevelProbes(
    listSksProbeResults(site.id, {
      hours: SKS_RETENTION_HOURS,
      limit: 2000,
    })
  );

  return {
    site,
    current: toStatusSnapshot(probes[0]),
    models: {
      count: models.length,
      hot: resolveHotModels(models).slice(0, 10),
      all: models.map((model) => model.modelName),
    },
    stats7d: buildProbeStats(probes),
    grid: buildGrid(probes),
  };
}

function buildSiteDetailView(site: SksSiteRecord): SksSiteDetailView {
  const card = buildSiteCardView(site);
  const models = listSksSiteModels(site.id, { currentlyListedOnly: true });
  const modelStatuses = models
    .map((model) => buildModelStatusView(site.id, model))
    .sort((a, b) => {
      if (a.isHot !== b.isHot) return a.isHot ? -1 : 1;
      return a.modelName.localeCompare(b.modelName, "en");
    });

  return {
    ...card,
    widgetToken: null,
    modelStatuses,
  };
}

export function getSksSiteList(): SksSiteCardView[] {
  return getPublicSksSites()
    .filter(isPublicSite)
    .map((site) => buildSiteCardView(site))
    .sort((a, b) => {
      const statusDiff = getStatusRank(a.current.status) - getStatusRank(b.current.status);
      if (statusDiff !== 0) return statusDiff;
      if (b.stats7d.successRate !== a.stats7d.successRate) {
        return b.stats7d.successRate - a.stats7d.successRate;
      }
      return a.site.displayName.localeCompare(b.site.displayName, "zh-CN");
    });
}

export function getSksSiteByKey(siteKey: string): SksSiteDetailView | null {
  const site = getSksSiteRecordByKey(siteKey);
  if (!site || !isPublicSite(site)) return null;
  return buildSiteDetailView(site);
}

export function getSksAdminList(): SksSiteAdminListItem[] {
  return getSksAdminSiteList().sort((a, b) => {
    const statusDiff = getStatusRank(a.currentStatus) - getStatusRank(b.currentStatus);
    if (statusDiff !== 0) return statusDiff;
    return a.site.displayName.localeCompare(b.site.displayName, "zh-CN");
  });
}

export function getSksAdminSiteView(siteKey: string): SksSiteAdminView | null {
  const base = getSksAdminSiteBase(siteKey);
  if (!base) return null;

  return {
    ...base,
    publicView: buildSiteDetailView(base.site),
  };
}

export function getRecentFailureMessages(detail: SksSiteDetailView, limit: number = 5) {
  const failures: Array<{ message: string; checkedAt: number }> = [];
  const seen = new Set<string>();

  const register = (message: string | null, checkedAt: string | null, status: SksDisplayStatus) => {
    if (!message) return;
    if (status !== "failed") return;
    if (seen.has(message)) return;
    seen.add(message);
    failures.push({
      message,
      checkedAt: parseDbTimestamp(checkedAt)?.getTime() ?? 0,
    });
  };

  register(detail.current.errorMessage, detail.current.checkedAt, detail.current.status);

  for (const cell of detail.grid) {
    register(cell.errorMessage, cell.checkedAt, cell.status);
  }

  for (const model of detail.modelStatuses) {
    register(model.current.errorMessage, model.current.checkedAt, model.current.status);
    for (const cell of model.grid) {
      register(cell.errorMessage, cell.checkedAt, cell.status);
    }
  }

  return failures
    .sort((a, b) => b.checkedAt - a.checkedAt)
    .slice(0, limit)
    .map((item) => item.message);
}

export {
  SKS_GRID_HOURS,
  SKS_RETENTION_DAYS,
  SKS_RETENTION_HOURS,
};
