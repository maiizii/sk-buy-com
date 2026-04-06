import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  SiteCatalogImportInput,
  SiteCatalogSiteRecord,
  SiteCatalogSourceStage,
  SiteCatalogStatus,
  SiteCatalogSystemType,
  SiteCatalogVisibility,
} from "@/lib/site-catalog/types";
import {
  dedupeStrings,
  normalizeApiBaseUrl,
  normalizeHostname,
  toDbTimestamp,
} from "@/lib/sks/utils";

export const SITE_CATALOG_DB_PATH = path.join(process.cwd(), "data", "site-catalog.db");

fs.mkdirSync(path.dirname(SITE_CATALOG_DB_PATH), { recursive: true });

const db = new Database(SITE_CATALOG_DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS site_catalog_sites (
    hostname TEXT PRIMARY KEY,
    normalizedHostname TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    homepageUrl TEXT,
    apiBaseUrl TEXT NOT NULL,
    siteSystem TEXT NOT NULL DEFAULT 'unknown',
    sourceStage TEXT NOT NULL DEFAULT 'website',
    sourceModule TEXT NOT NULL DEFAULT 'manual',
    catalogStatus TEXT NOT NULL DEFAULT 'active',
    visibility TEXT NOT NULL DEFAULT 'public',
    summary TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    registrationOpen INTEGER,
    emailVerificationRequired INTEGER,
    inviteCodeRequired INTEGER,
    hasInitialQuota INTEGER,
    hasCredential INTEGER NOT NULL DEFAULT 0,
    tagsJson TEXT NOT NULL DEFAULT '[]',
    metaJson TEXT NOT NULL DEFAULT '{}',
    manualOverrideJson TEXT NOT NULL DEFAULT '{}',
    importedAt TEXT NOT NULL DEFAULT (datetime('now')),
    lastSksSyncAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_site_catalog_visibility ON site_catalog_sites(visibility, catalogStatus, normalizedHostname)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_site_catalog_source ON site_catalog_sites(sourceStage, sourceModule, importedAt DESC)`);

interface SiteCatalogRow {
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  siteSystem: SiteCatalogSystemType;
  sourceStage: SiteCatalogSourceStage;
  sourceModule: string;
  catalogStatus: SiteCatalogStatus;
  visibility: SiteCatalogVisibility;
  summary: string;
  description: string;
  registrationOpen: number | null;
  emailVerificationRequired: number | null;
  inviteCodeRequired: number | null;
  hasInitialQuota: number | null;
  hasCredential: number;
  tagsJson: string;
  metaJson: string;
  manualOverrideJson: string;
  importedAt: string;
  lastSksSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function safeParseTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return dedupeStrings(parsed.map((item) => String(item || "").trim()).filter(Boolean));
  } catch {
    return [];
  }
}

function toNullableBoolean(value: number | null): boolean | null {
  if (value === null || value === undefined) return null;
  return value === 1;
}

function boolToDb(value: boolean | null | undefined): number | null {
  if (value === null) return null;
  if (value === undefined) return null;
  return value ? 1 : 0;
}

function rowToSiteCatalogSite(row: SiteCatalogRow): SiteCatalogSiteRecord {
  return {
    hostname: row.hostname,
    normalizedHostname: row.normalizedHostname,
    displayName: row.displayName,
    homepageUrl: row.homepageUrl,
    apiBaseUrl: row.apiBaseUrl,
    siteSystem: row.siteSystem,
    sourceStage: row.sourceStage,
    sourceModule: row.sourceModule,
    catalogStatus: row.catalogStatus,
    visibility: row.visibility,
    summary: row.summary,
    description: row.description,
    registrationOpen: toNullableBoolean(row.registrationOpen),
    emailVerificationRequired: toNullableBoolean(row.emailVerificationRequired),
    inviteCodeRequired: toNullableBoolean(row.inviteCodeRequired),
    hasInitialQuota: toNullableBoolean(row.hasInitialQuota),
    hasCredential: row.hasCredential === 1,
    tags: safeParseTags(row.tagsJson),
    metaJson: row.metaJson,
    manualOverrideJson: row.manualOverrideJson,
    importedAt: row.importedAt,
    lastSksSyncAt: row.lastSksSyncAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeSystemType(value: string | undefined, fallback: SiteCatalogSystemType = "unknown"): SiteCatalogSystemType {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "newapi" ||
    normalized === "sub2api" ||
    normalized === "openai-compatible" ||
    normalized === "unknown" ||
    normalized === "other"
  ) {
    return normalized as SiteCatalogSystemType;
  }
  return fallback;
}

function normalizeSourceStage(value: string | undefined, fallback: SiteCatalogSourceStage = "website"): SiteCatalogSourceStage {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "fofa" || normalized === "screening" || normalized === "sks" || normalized === "website") {
    return normalized as SiteCatalogSourceStage;
  }
  return fallback;
}

function normalizeCatalogStatus(value: string | undefined, fallback: SiteCatalogStatus = "active"): SiteCatalogStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active" || normalized === "pending" || normalized === "hidden" || normalized === "archived") {
    return normalized as SiteCatalogStatus;
  }
  return fallback;
}

function normalizeVisibility(value: string | undefined, fallback: SiteCatalogVisibility = "public"): SiteCatalogVisibility {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "public" || normalized === "unlisted" || normalized === "private") {
    return normalized as SiteCatalogVisibility;
  }
  return fallback;
}

function stringifyJson(value: Record<string, unknown> | undefined, fallback: string = "{}") {
  if (value === undefined) return fallback;
  try {
    return JSON.stringify(value || {});
  } catch {
    return fallback;
  }
}

function normalizeImportInput(input: SiteCatalogImportInput) {
  const apiBaseUrl = normalizeApiBaseUrl(String(input.apiBaseUrl || "").trim());
  if (!apiBaseUrl) {
    throw new Error("apiBaseUrl 无效");
  }

  const normalizedHostname = normalizeHostname(apiBaseUrl);
  if (!normalizedHostname) {
    throw new Error("无法从 apiBaseUrl 解析 hostname");
  }

  const homepageUrl = input.homepageUrl ? normalizeApiBaseUrl(String(input.homepageUrl).trim()) : null;

  return {
    hostname: normalizedHostname,
    normalizedHostname,
    displayName: String(input.displayName || "").trim(),
    homepageUrl,
    apiBaseUrl,
    siteSystem: normalizeSystemType(input.siteSystem),
    sourceStage: input.sourceStage,
    sourceModule: String(input.sourceModule || "").trim(),
    catalogStatus: input.catalogStatus,
    visibility: input.visibility,
    summary: input.summary,
    description: input.description,
    registrationOpen: input.registrationOpen,
    emailVerificationRequired: input.emailVerificationRequired,
    inviteCodeRequired: input.inviteCodeRequired,
    hasInitialQuota: input.hasInitialQuota,
    tags: Array.isArray(input.tags)
      ? dedupeStrings(input.tags.map((item) => String(item || "").trim()).filter(Boolean))
      : undefined,
    metaJson: stringifyJson(input.meta),
    manualOverrideJson: stringifyJson(input.manualOverrides),
    hasCredential: Boolean(String(input.apiKey || "").trim()),
  };
}

export function listSiteCatalogSites(options?: {
  visibility?: SiteCatalogVisibility;
  catalogStatus?: SiteCatalogStatus;
}) {
  const conditions: string[] = [];
  const params: string[] = [];

  if (options?.visibility) {
    conditions.push("visibility = ?");
    params.push(options.visibility);
  }

  if (options?.catalogStatus) {
    conditions.push("catalogStatus = ?");
    params.push(options.catalogStatus);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM site_catalog_sites ${whereClause} ORDER BY datetime(updatedAt) DESC, normalizedHostname ASC`)
    .all(...params) as SiteCatalogRow[];

  return rows.map(rowToSiteCatalogSite);
}

export function getSiteCatalogSiteByHostname(siteKey: string) {
  const normalizedKey = normalizeHostname(String(siteKey || "").trim());
  if (!normalizedKey) return null;

  const row = db
    .prepare(`SELECT * FROM site_catalog_sites WHERE normalizedHostname = ? OR hostname = ? LIMIT 1`)
    .get(normalizedKey, normalizedKey) as SiteCatalogRow | undefined;

  return row ? rowToSiteCatalogSite(row) : null;
}

export function upsertSiteCatalogSite(input: SiteCatalogImportInput) {
  const payload = normalizeImportInput(input);
  const existing = getSiteCatalogSiteByHostname(payload.normalizedHostname);
  const now = toDbTimestamp();

  const nextRecord = {
    hostname: payload.hostname,
    normalizedHostname: payload.normalizedHostname,
    displayName: payload.displayName || existing?.displayName || payload.hostname,
    homepageUrl: payload.homepageUrl !== null ? payload.homepageUrl : existing?.homepageUrl || null,
    apiBaseUrl: payload.apiBaseUrl,
    siteSystem: normalizeSystemType(payload.siteSystem, existing?.siteSystem || "unknown"),
    sourceStage: normalizeSourceStage(payload.sourceStage, existing?.sourceStage || "website"),
    sourceModule: payload.sourceModule || existing?.sourceModule || "manual",
    catalogStatus: normalizeCatalogStatus(payload.catalogStatus, existing?.catalogStatus || "active"),
    visibility: normalizeVisibility(payload.visibility, existing?.visibility || "public"),
    summary: payload.summary === undefined ? existing?.summary || "" : String(payload.summary || "").trim(),
    description: payload.description === undefined ? existing?.description || "" : String(payload.description || "").trim(),
    registrationOpen:
      payload.registrationOpen === undefined ? existing?.registrationOpen ?? null : payload.registrationOpen,
    emailVerificationRequired:
      payload.emailVerificationRequired === undefined
        ? existing?.emailVerificationRequired ?? null
        : payload.emailVerificationRequired,
    inviteCodeRequired:
      payload.inviteCodeRequired === undefined ? existing?.inviteCodeRequired ?? null : payload.inviteCodeRequired,
    hasInitialQuota: payload.hasInitialQuota === undefined ? existing?.hasInitialQuota ?? null : payload.hasInitialQuota,
    hasCredential: payload.hasCredential || existing?.hasCredential || false,
    tagsJson: JSON.stringify(payload.tags ?? existing?.tags ?? []),
    metaJson: input.meta === undefined ? existing?.metaJson || "{}" : payload.metaJson,
    manualOverrideJson:
      input.manualOverrides === undefined ? existing?.manualOverrideJson || "{}" : payload.manualOverrideJson,
    importedAt: now,
    lastSksSyncAt: existing?.lastSksSyncAt || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  db.prepare(
    `INSERT INTO site_catalog_sites (
      hostname, normalizedHostname, displayName, homepageUrl, apiBaseUrl, siteSystem,
      sourceStage, sourceModule, catalogStatus, visibility, summary, description,
      registrationOpen, emailVerificationRequired, inviteCodeRequired, hasInitialQuota,
      hasCredential, tagsJson, metaJson, manualOverrideJson, importedAt, lastSksSyncAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hostname) DO UPDATE SET
      normalizedHostname = excluded.normalizedHostname,
      displayName = excluded.displayName,
      homepageUrl = excluded.homepageUrl,
      apiBaseUrl = excluded.apiBaseUrl,
      siteSystem = excluded.siteSystem,
      sourceStage = excluded.sourceStage,
      sourceModule = excluded.sourceModule,
      catalogStatus = excluded.catalogStatus,
      visibility = excluded.visibility,
      summary = excluded.summary,
      description = excluded.description,
      registrationOpen = excluded.registrationOpen,
      emailVerificationRequired = excluded.emailVerificationRequired,
      inviteCodeRequired = excluded.inviteCodeRequired,
      hasInitialQuota = excluded.hasInitialQuota,
      hasCredential = excluded.hasCredential,
      tagsJson = excluded.tagsJson,
      metaJson = excluded.metaJson,
      manualOverrideJson = excluded.manualOverrideJson,
      importedAt = excluded.importedAt,
      lastSksSyncAt = excluded.lastSksSyncAt,
      updatedAt = excluded.updatedAt`
  ).run(
    nextRecord.hostname,
    nextRecord.normalizedHostname,
    nextRecord.displayName,
    nextRecord.homepageUrl,
    nextRecord.apiBaseUrl,
    nextRecord.siteSystem,
    nextRecord.sourceStage,
    nextRecord.sourceModule,
    nextRecord.catalogStatus,
    nextRecord.visibility,
    nextRecord.summary,
    nextRecord.description,
    boolToDb(nextRecord.registrationOpen),
    boolToDb(nextRecord.emailVerificationRequired),
    boolToDb(nextRecord.inviteCodeRequired),
    boolToDb(nextRecord.hasInitialQuota),
    nextRecord.hasCredential ? 1 : 0,
    nextRecord.tagsJson,
    nextRecord.metaJson,
    nextRecord.manualOverrideJson,
    nextRecord.importedAt,
    nextRecord.lastSksSyncAt,
    nextRecord.createdAt,
    nextRecord.updatedAt
  );

  return getSiteCatalogSiteByHostname(nextRecord.normalizedHostname)!;
}

export function markSiteCatalogSksSynced(hostname: string, syncedAt: string = toDbTimestamp()) {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return null;

  db.prepare(
    `UPDATE site_catalog_sites
     SET hasCredential = 1,
         lastSksSyncAt = ?,
         importedAt = ?,
         updatedAt = ?
     WHERE normalizedHostname = ? OR hostname = ?`
  ).run(syncedAt, syncedAt, syncedAt, normalizedHostname, normalizedHostname);

  return getSiteCatalogSiteByHostname(normalizedHostname);
}
