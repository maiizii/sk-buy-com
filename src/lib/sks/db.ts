import Database from "better-sqlite3";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type {
  SksCredentialRecord,
  SksCredentialSafeView,
  SksInternalStatus,
  SksProbeResultRecord,
  SksProbeType,
  SksSiteAdminListItem,
  SksSiteImportInput,
  SksSiteImportResult,
  SksSiteModelRecord,
  SksSiteRecord,
  SksSourceType,
  SksSubmissionStatus,
  SksUserSubmissionRecord,
} from "@/lib/sks/types";
import {
  SKS_RETENTION_DAYS,
  chooseHotModels,
  dedupeStrings,
  inferProviderFamily,
  normalizeApiBaseUrl,
  normalizeHostname,
  toDbTimestamp,
} from "@/lib/sks/utils";

export const SKS_DB_PATH = path.join(process.cwd(), "data", "sks.db");
const SKS_KEY_PATH = path.join(process.cwd(), "data", "sks.key");

fs.mkdirSync(path.dirname(SKS_DB_PATH), { recursive: true });

const db = new Database(SKS_DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sks_sites (
    id TEXT PRIMARY KEY,
    hostname TEXT UNIQUE NOT NULL,
    normalizedHostname TEXT UNIQUE NOT NULL,
    displayName TEXT NOT NULL,
    homepageUrl TEXT,
    apiBaseUrl TEXT NOT NULL,
    platformType TEXT NOT NULL DEFAULT 'openai-compatible',
    ownerUserId INTEGER,
    ownershipStatus TEXT NOT NULL DEFAULT 'unclaimed',
    statusVisibility TEXT NOT NULL DEFAULT 'public',
    createdByUserId INTEGER,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sks_credentials (
    id TEXT PRIMARY KEY,
    siteId TEXT NOT NULL,
    sourceType TEXT NOT NULL,
    submittedByUserId INTEGER,
    apiKeyEncrypted TEXT NOT NULL,
    apiKeyHash TEXT NOT NULL,
    apiKeyPreview TEXT NOT NULL,
    apiBaseUrl TEXT NOT NULL,
    label TEXT,
    isEnabled INTEGER NOT NULL DEFAULT 1,
    firstVerifiedAt TEXT,
    lastVerifiedAt TEXT,
    lastSuccessAt TEXT,
    lastFailureAt TEXT,
    stabilityScore REAL NOT NULL DEFAULT 0,
    priorityScore REAL NOT NULL DEFAULT 0,
    successCount INTEGER NOT NULL DEFAULT 0,
    failureCount INTEGER NOT NULL DEFAULT 0,
    cooldownUntil TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(siteId, apiKeyHash),
    FOREIGN KEY (siteId) REFERENCES sks_sites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sks_site_models (
    id TEXT PRIMARY KEY,
    siteId TEXT NOT NULL,
    modelName TEXT NOT NULL,
    providerFamily TEXT,
    firstSeenAt TEXT NOT NULL,
    lastSeenAt TEXT NOT NULL,
    isCurrentlyListed INTEGER NOT NULL DEFAULT 1,
    isTestTarget INTEGER NOT NULL DEFAULT 1,
    isHot INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(siteId, modelName),
    FOREIGN KEY (siteId) REFERENCES sks_sites(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sks_probe_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    siteId TEXT NOT NULL,
    credentialId TEXT,
    probeType TEXT NOT NULL,
    modelName TEXT,
    status TEXT NOT NULL,
    httpStatus INTEGER,
    ttfbMs INTEGER,
    totalMs INTEGER,
    responseChars INTEGER,
    errorType TEXT,
    errorMessage TEXT,
    checkedAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (siteId) REFERENCES sks_sites(id) ON DELETE CASCADE,
    FOREIGN KEY (credentialId) REFERENCES sks_credentials(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS sks_user_submissions (
    id TEXT PRIMARY KEY,
    userId INTEGER NOT NULL,
    hostname TEXT NOT NULL,
    normalizedHostname TEXT NOT NULL,
    apiBaseUrl TEXT NOT NULL,
    homepageUrl TEXT,
    displayName TEXT,
    apiKeyPreview TEXT NOT NULL,
    apiKeyEncrypted TEXT,
    siteId TEXT,
    credentialId TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    lastMessage TEXT,
    sourceType TEXT NOT NULL DEFAULT 'owner',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    validatedAt TEXT,
    UNIQUE(userId, normalizedHostname),
    FOREIGN KEY (siteId) REFERENCES sks_sites(id) ON DELETE SET NULL,
    FOREIGN KEY (credentialId) REFERENCES sks_credentials(id) ON DELETE SET NULL
  );
`);

const sksUserSubmissionColumns = db
  .prepare(`PRAGMA table_info(sks_user_submissions)`)
  .all() as Array<{ name: string }>;
if (!sksUserSubmissionColumns.some((column) => column.name === "apiKeyEncrypted")) {
  db.exec(`ALTER TABLE sks_user_submissions ADD COLUMN apiKeyEncrypted TEXT`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_sites_visibility ON sks_sites(statusVisibility, normalizedHostname)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_credentials_site ON sks_credentials(siteId, isEnabled, priorityScore DESC, stabilityScore DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_site_models_site ON sks_site_models(siteId, isCurrentlyListed, isHot, modelName)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_probe_results_site ON sks_probe_results(siteId, probeType, checkedAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_probe_results_model ON sks_probe_results(siteId, modelName, checkedAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sks_user_submissions_user ON sks_user_submissions(userId, status, datetime(createdAt) DESC)`);

interface SksSiteRow {
  id: string;
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  platformType: string;
  ownerUserId: number | null;
  ownershipStatus: SksSiteRecord["ownershipStatus"];
  statusVisibility: SksSiteRecord["statusVisibility"];
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface SksCredentialRow {
  id: string;
  siteId: string;
  sourceType: SksSourceType;
  submittedByUserId: number | null;
  apiKeyEncrypted: string;
  apiKeyHash: string;
  apiKeyPreview: string;
  apiBaseUrl: string;
  label: string | null;
  isEnabled: number;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  stabilityScore: number;
  priorityScore: number;
  successCount: number;
  failureCount: number;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SksSiteModelRow {
  id: string;
  siteId: string;
  modelName: string;
  providerFamily: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isCurrentlyListed: number;
  isTestTarget: number;
  isHot: number;
  createdAt: string;
  updatedAt: string;
}

interface SksProbeResultRow {
  id: number;
  siteId: string;
  credentialId: string | null;
  probeType: SksProbeType;
  modelName: string | null;
  status: SksInternalStatus;
  httpStatus: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  responseChars: number | null;
  errorType: string | null;
  errorMessage: string | null;
  checkedAt: string;
  createdAt: string;
}

interface SksUserSubmissionRow {
  id: string;
  userId: number;
  hostname: string;
  normalizedHostname: string;
  apiBaseUrl: string;
  homepageUrl: string | null;
  displayName: string | null;
  apiKeyPreview: string;
  apiKeyEncrypted: string | null;
  siteId: string | null;
  credentialId: string | null;
  status: SksSubmissionStatus;
  lastMessage: string | null;
  sourceType: SksSourceType;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
}

function rowToSite(row: SksSiteRow): SksSiteRecord {
  return { ...row };
}

function rowToCredential(row: SksCredentialRow): SksCredentialRecord {
  return {
    ...row,
    isEnabled: row.isEnabled === 1,
  };
}

function rowToSiteModel(row: SksSiteModelRow): SksSiteModelRecord {
  return {
    ...row,
    isCurrentlyListed: row.isCurrentlyListed === 1,
    isTestTarget: row.isTestTarget === 1,
    isHot: row.isHot === 1,
  };
}

function rowToProbeResult(row: SksProbeResultRow): SksProbeResultRecord {
  return { ...row };
}

function rowToUserSubmission(row: SksUserSubmissionRow): SksUserSubmissionRecord {
  return { ...row };
}

function getEncryptionKey() {
  const envKey = process.env.SKS_ENCRYPTION_KEY?.trim();
  if (envKey) {
    return crypto.createHash("sha256").update(envKey).digest();
  }

  if (!fs.existsSync(SKS_KEY_PATH)) {
    fs.writeFileSync(SKS_KEY_PATH, crypto.randomBytes(32).toString("base64"), "utf8");
  }

  const persisted = fs.readFileSync(SKS_KEY_PATH, "utf8").trim();
  if (!persisted) {
    const fallback = crypto.randomBytes(32).toString("base64");
    fs.writeFileSync(SKS_KEY_PATH, fallback, "utf8");
    return Buffer.from(fallback, "base64");
  }

  return Buffer.from(persisted, "base64");
}

function encryptApiKey(apiKey: string) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(JSON.stringify({
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  })).toString("base64");
}

function decryptApiKey(payload: string) {
  const key = getEncryptionKey();
  const parsed = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as {
    iv: string;
    tag: string;
    data: string;
  };
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function hashApiKey(apiKey: string) {
  return crypto.createHash("sha256").update(apiKey.trim()).digest("hex");
}

function getApiKeyPreview(apiKey: string) {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 10) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function sanitizeCredential(record: SksCredentialRecord): SksCredentialSafeView {
  const { apiKeyEncrypted: _secret, ...rest } = record;
  return {
    ...rest,
    hasApiKey: Boolean(_secret),
  };
}

function resolveSiteUpsert(input: SksSiteImportInput) {
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  if (!apiBaseUrl) {
    throw new Error("API Base URL 无效");
  }

  const hostname = normalizeHostname(apiBaseUrl);
  if (!hostname) {
    throw new Error("无法从 API Base URL 解析 hostname");
  }

  const homepageUrl = input.homepageUrl ? normalizeApiBaseUrl(input.homepageUrl) : null;

  return {
    hostname,
    normalizedHostname: hostname,
    displayName: input.displayName?.trim() || "",
    homepageUrl,
    apiBaseUrl,
    platformType: input.platformType?.trim() || "openai-compatible",
    ownerUserId: input.ownerUserId ?? null,
    ownershipStatus: input.ownershipStatus || "unclaimed",
    statusVisibility: input.statusVisibility || "public",
    createdByUserId: input.createdByUserId ?? null,
  };
}

export interface SksResolvedCredential {
  record: SksCredentialRecord;
  apiKey: string;
}

export interface SksProbeQueryOptions {
  hours?: number;
  probeType?: SksProbeType;
  modelName?: string | null;
  limit?: number;
  onlyFailures?: boolean;
}

export interface CreateSksProbeResultInput {
  siteId: string;
  credentialId?: string | null;
  probeType: SksProbeType;
  modelName?: string | null;
  status: SksInternalStatus;
  httpStatus?: number | null;
  ttfbMs?: number | null;
  totalMs?: number | null;
  responseChars?: number | null;
  errorType?: string | null;
  errorMessage?: string | null;
  checkedAt?: string;
}

export function getAllSksSites() {
  const rows = db
    .prepare(`SELECT * FROM sks_sites ORDER BY datetime(updatedAt) DESC, normalizedHostname ASC`)
    .all() as SksSiteRow[];
  return rows.map(rowToSite);
}

export function getPublicSksSites() {
  const rows = db
    .prepare(
      `SELECT * FROM sks_sites WHERE statusVisibility = 'public' ORDER BY datetime(updatedAt) DESC, normalizedHostname ASC`
    )
    .all() as SksSiteRow[];
  return rows.map(rowToSite);
}

export function getSksSiteRecordById(siteId: string) {
  const row = db.prepare(`SELECT * FROM sks_sites WHERE id = ?`).get(siteId) as SksSiteRow | undefined;
  return row ? rowToSite(row) : null;
}

export function getSksSiteRecordByKey(siteKey: string) {
  const normalizedKey = decodeURIComponent(siteKey).trim().toLowerCase();
  if (!normalizedKey) return null;

  const row = db
    .prepare(`SELECT * FROM sks_sites WHERE id = ? OR normalizedHostname = ? OR hostname = ?`)
    .get(normalizedKey, normalizedKey, normalizedKey) as SksSiteRow | undefined;

  return row ? rowToSite(row) : null;
}

export function upsertSksSite(input: SksSiteImportInput) {
  const payload = resolveSiteUpsert(input);
  const now = toDbTimestamp();
  const existing = db
    .prepare(`SELECT * FROM sks_sites WHERE normalizedHostname = ?`)
    .get(payload.normalizedHostname) as SksSiteRow | undefined;

  if (existing) {
    db.prepare(
      `UPDATE sks_sites SET
        hostname = ?,
        normalizedHostname = ?,
        displayName = ?,
        homepageUrl = ?,
        apiBaseUrl = ?,
        platformType = ?,
        ownerUserId = ?,
        ownershipStatus = ?,
        statusVisibility = ?,
        createdByUserId = ?,
        updatedAt = ?
      WHERE id = ?`
    ).run(
      payload.hostname,
      payload.normalizedHostname,
      payload.displayName || existing.displayName || payload.hostname,
      payload.homepageUrl,
      payload.apiBaseUrl,
      payload.platformType,
      payload.ownerUserId,
      payload.ownershipStatus,
      payload.statusVisibility,
      payload.createdByUserId,
      now,
      existing.id
    );

    return getSksSiteRecordById(existing.id)!;
  }

  const siteId = payload.normalizedHostname;
  db.prepare(
    `INSERT INTO sks_sites (
      id, hostname, normalizedHostname, displayName, homepageUrl, apiBaseUrl,
      platformType, ownerUserId, ownershipStatus, statusVisibility, createdByUserId, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    siteId,
    payload.hostname,
    payload.normalizedHostname,
    payload.displayName || payload.hostname,
    payload.homepageUrl,
    payload.apiBaseUrl,
    payload.platformType,
    payload.ownerUserId,
    payload.ownershipStatus,
    payload.statusVisibility,
    payload.createdByUserId,
    now,
    now
  );

  return getSksSiteRecordById(siteId)!;
}

export function updateSksSite(
  siteKey: string,
  input: {
    displayName?: string;
    homepageUrl?: string | null;
    apiBaseUrl?: string;
    statusVisibility?: SksSiteRecord["statusVisibility"];
    ownershipStatus?: SksSiteRecord["ownershipStatus"];
  }
) {
  const existing = getSksSiteRecordByKey(siteKey);
  if (!existing) return null;

  const now = toDbTimestamp();
  const nextDisplayName =
    input.displayName !== undefined ? String(input.displayName || "").trim() || existing.displayName : existing.displayName;
  const nextHomepageUrl =
    input.homepageUrl !== undefined
      ? input.homepageUrl
        ? normalizeApiBaseUrl(String(input.homepageUrl).trim())
        : null
      : existing.homepageUrl;
  const nextApiBaseUrl =
    input.apiBaseUrl !== undefined ? normalizeApiBaseUrl(String(input.apiBaseUrl || "").trim()) : existing.apiBaseUrl;
  const nextStatusVisibility =
    input.statusVisibility === "public" || input.statusVisibility === "unlisted" || input.statusVisibility === "private"
      ? input.statusVisibility
      : existing.statusVisibility;
  const nextOwnershipStatus =
    input.ownershipStatus === "unclaimed" ||
    input.ownershipStatus === "observed" ||
    input.ownershipStatus === "probable_owner" ||
    input.ownershipStatus === "claimed"
      ? input.ownershipStatus
      : existing.ownershipStatus;

  if (!nextApiBaseUrl) {
    throw new Error("API Base URL 无效");
  }

  db.prepare(
    `UPDATE sks_sites SET
      displayName = ?,
      homepageUrl = ?,
      apiBaseUrl = ?,
      statusVisibility = ?,
      ownershipStatus = ?,
      updatedAt = ?
    WHERE id = ?`
  ).run(
    nextDisplayName,
    nextHomepageUrl,
    nextApiBaseUrl,
    nextStatusVisibility,
    nextOwnershipStatus,
    now,
    existing.id
  );

  db.prepare(
    `UPDATE sks_credentials SET apiBaseUrl = ?, updatedAt = ? WHERE siteId = ?`
  ).run(nextApiBaseUrl, now, existing.id);

  return getSksSiteRecordById(existing.id)!;
}

export function deleteSksSite(siteKey: string) {
  const existing = getSksSiteRecordByKey(siteKey);
  if (!existing) return false;
  const result = db.prepare(`DELETE FROM sks_sites WHERE id = ?`).run(existing.id);
  return result.changes > 0;
}

export function getSksCredentialById(credentialId: string) {
  const row = db
    .prepare(`SELECT * FROM sks_credentials WHERE id = ?`)
    .get(credentialId) as SksCredentialRow | undefined;
  return row ? rowToCredential(row) : null;
}

export function listSksCredentialsBySite(siteId: string, options?: { enabledOnly?: boolean }) {
  const rows = db
    .prepare(
      `SELECT *
       FROM sks_credentials
       WHERE siteId = ? ${options?.enabledOnly ? "AND isEnabled = 1" : ""}
       ORDER BY isEnabled DESC, priorityScore DESC, stabilityScore DESC, datetime(lastSuccessAt) DESC, datetime(createdAt) ASC`
    )
    .all(siteId) as SksCredentialRow[];
  return rows.map(rowToCredential);
}

export function upsertSksCredential(
  siteId: string,
  input: {
    apiKey: string;
    apiBaseUrl?: string;
    sourceType?: SksSourceType;
    submittedByUserId?: number | null;
    label?: string | null;
    isEnabled?: boolean;
    priorityScore?: number;
  }
) {
  const site = getSksSiteRecordById(siteId);
  if (!site) {
    throw new Error("站点不存在");
  }

  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("API Key 不能为空");
  }

  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl || site.apiBaseUrl);
  const apiKeyHash = hashApiKey(apiKey);
  const existing = db
    .prepare(`SELECT * FROM sks_credentials WHERE siteId = ? AND apiKeyHash = ?`)
    .get(siteId, apiKeyHash) as SksCredentialRow | undefined;
  const now = toDbTimestamp();

  if (existing) {
    db.prepare(
      `UPDATE sks_credentials SET
        sourceType = ?,
        submittedByUserId = ?,
        apiKeyEncrypted = ?,
        apiKeyPreview = ?,
        apiBaseUrl = ?,
        label = ?,
        isEnabled = ?,
        priorityScore = ?,
        updatedAt = ?
      WHERE id = ?`
    ).run(
      input.sourceType || existing.sourceType,
      input.submittedByUserId ?? existing.submittedByUserId,
      encryptApiKey(apiKey),
      getApiKeyPreview(apiKey),
      apiBaseUrl,
      input.label ?? existing.label,
      input.isEnabled === false ? 0 : 1,
      input.priorityScore ?? existing.priorityScore,
      now,
      existing.id
    );

    return getSksCredentialById(existing.id)!;
  }

  const credentialId = crypto.randomUUID();
  db.prepare(
    `INSERT INTO sks_credentials (
      id, siteId, sourceType, submittedByUserId, apiKeyEncrypted, apiKeyHash, apiKeyPreview,
      apiBaseUrl, label, isEnabled, priorityScore, stabilityScore, successCount, failureCount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`
  ).run(
    credentialId,
    siteId,
    input.sourceType || "system",
    input.submittedByUserId ?? null,
    encryptApiKey(apiKey),
    apiKeyHash,
    getApiKeyPreview(apiKey),
    apiBaseUrl,
    input.label ?? null,
    input.isEnabled === false ? 0 : 1,
    input.priorityScore ?? 100,
    now,
    now
  );

  return getSksCredentialById(credentialId)!;
}

export function importSksSiteWithCredential(input: SksSiteImportInput): SksSiteImportResult {
  const site = upsertSksSite(input);
  const credential = upsertSksCredential(site.id, {
    apiKey: input.apiKey,
    apiBaseUrl: input.apiBaseUrl,
    sourceType: input.sourceType,
    submittedByUserId: input.submittedByUserId,
    label: input.label,
    isEnabled: input.isEnabled,
    priorityScore: input.priorityScore,
  });

  return {
    site,
    credential: sanitizeCredential(credential),
  };
}

export function getResolvedSksCredentialById(credentialId: string): SksResolvedCredential | null {
  const record = getSksCredentialById(credentialId);
  if (!record) return null;
  return {
    record,
    apiKey: decryptApiKey(record.apiKeyEncrypted),
  };
}

export function getPreferredResolvedSksCredential(siteId: string): SksResolvedCredential | null {
  const record = listSksCredentialsBySite(siteId, { enabledOnly: true })[0] || null;
  if (!record) return null;
  return {
    record,
    apiKey: decryptApiKey(record.apiKeyEncrypted),
  };
}

export function markSksCredentialResult(credentialId: string, success: boolean, checkedAt: string = toDbTimestamp()) {
  const credential = getSksCredentialById(credentialId);
  if (!credential) return null;

  const successCount = credential.successCount + (success ? 1 : 0);
  const failureCount = credential.failureCount + (success ? 0 : 1);
  const total = successCount + failureCount;
  const stabilityScore = total > 0 ? Math.round((successCount / total) * 1000) / 10 : 0;

  db.prepare(
    `UPDATE sks_credentials SET
      firstVerifiedAt = COALESCE(firstVerifiedAt, ?),
      lastVerifiedAt = ?,
      lastSuccessAt = ?,
      lastFailureAt = ?,
      successCount = ?,
      failureCount = ?,
      stabilityScore = ?,
      updatedAt = ?
    WHERE id = ?`
  ).run(
    checkedAt,
    checkedAt,
    success ? checkedAt : credential.lastSuccessAt,
    success ? credential.lastFailureAt : checkedAt,
    successCount,
    failureCount,
    stabilityScore,
    checkedAt,
    credentialId
  );

  return getSksCredentialById(credentialId);
}

export function saveSksProbeResult(input: CreateSksProbeResultInput) {
  const checkedAt = input.checkedAt || toDbTimestamp();
  const result = db
    .prepare(
      `INSERT INTO sks_probe_results (
        siteId, credentialId, probeType, modelName, status, httpStatus,
        ttfbMs, totalMs, responseChars, errorType, errorMessage, checkedAt, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      input.siteId,
      input.credentialId ?? null,
      input.probeType,
      input.modelName ?? null,
      input.status,
      input.httpStatus ?? null,
      input.ttfbMs ?? null,
      input.totalMs ?? null,
      input.responseChars ?? null,
      input.errorType ?? null,
      input.errorMessage ?? null,
      checkedAt,
      checkedAt
    );

  const row = db
    .prepare(`SELECT * FROM sks_probe_results WHERE id = ?`)
    .get(result.lastInsertRowid as number) as SksProbeResultRow | undefined;

  return row ? rowToProbeResult(row) : null;
}

export function listSksProbeResults(siteId: string, options: SksProbeQueryOptions = {}) {
  const conditions = ["siteId = ?"];
  const values: Array<string | number> = [siteId];

  if (options.probeType) {
    conditions.push("probeType = ?");
    values.push(options.probeType);
  }

  if (options.modelName !== undefined) {
    if (options.modelName === null) {
      conditions.push("modelName IS NULL");
    } else {
      conditions.push("modelName = ?");
      values.push(options.modelName);
    }
  }

  if (typeof options.hours === "number" && options.hours > 0) {
    conditions.push("datetime(checkedAt) >= datetime('now', ?)");
    values.push(`-${Math.floor(options.hours)} hours`);
  }

  if (options.onlyFailures) {
    conditions.push("status NOT IN ('ok', 'slow')");
  }

  const limit = Math.max(1, Math.floor(options.limit ?? 500));
  const sql = `
    SELECT *
    FROM sks_probe_results
    WHERE ${conditions.join(" AND ")}
    ORDER BY datetime(checkedAt) DESC, id DESC
    LIMIT ?
  `;

  const rows = db.prepare(sql).all(...values, limit) as SksProbeResultRow[];
  return rows.map(rowToProbeResult);
}

export function listSksSiteModels(siteId: string, options?: { currentlyListedOnly?: boolean }) {
  const rows = db
    .prepare(
      `SELECT *
       FROM sks_site_models
       WHERE siteId = ? ${options?.currentlyListedOnly ? "AND isCurrentlyListed = 1" : ""}
       ORDER BY isHot DESC, isCurrentlyListed DESC, modelName COLLATE NOCASE ASC`
    )
    .all(siteId) as SksSiteModelRow[];
  return rows.map(rowToSiteModel);
}

export function upsertSksSiteModels(siteId: string, modelNames: string[]) {
  const normalized = dedupeStrings(modelNames);
  const hotSet = new Set(chooseHotModels(normalized));
  const now = toDbTimestamp();

  const transaction = db.transaction((currentSiteId: string, models: string[]) => {
    db.prepare(
      `UPDATE sks_site_models SET isCurrentlyListed = 0, isHot = 0, updatedAt = ? WHERE siteId = ?`
    ).run(now, currentSiteId);

    for (const modelName of models) {
      const providerFamily = inferProviderFamily(modelName);
      db.prepare(
        `INSERT INTO sks_site_models (
          id, siteId, modelName, providerFamily, firstSeenAt, lastSeenAt,
          isCurrentlyListed, isTestTarget, isHot, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
        ON CONFLICT(siteId, modelName) DO UPDATE SET
          providerFamily = excluded.providerFamily,
          lastSeenAt = excluded.lastSeenAt,
          isCurrentlyListed = 1,
          isHot = excluded.isHot,
          updatedAt = excluded.updatedAt`
      ).run(
        crypto.randomUUID(),
        currentSiteId,
        modelName,
        providerFamily,
        now,
        now,
        hotSet.has(modelName) ? 1 : 0,
        now,
        now
      );
    }
  });

  transaction(siteId, normalized);
  return listSksSiteModels(siteId);
}

export function getSksAdminSiteList(): SksSiteAdminListItem[] {
  return getAllSksSites().map((site) => {
    const credentials = listSksCredentialsBySite(site.id);
    const models = listSksSiteModels(site.id, { currentlyListedOnly: true });
    const latestProbe = listSksProbeResults(site.id, { probeType: "model_list", limit: 1 })[0] || null;

    return {
      site,
      credentialCount: credentials.length,
      enabledCredentialCount: credentials.filter((item) => item.isEnabled).length,
      modelCount: models.length,
      currentStatus:
        latestProbe?.status === "ok"
          ? "ok"
          : latestProbe?.status === "slow"
            ? "slow"
            : latestProbe
              ? "failed"
              : "unknown",
      lastCheckedAt: latestProbe?.checkedAt || null,
    };
  });
}

export function getSksAdminSiteBase(siteKey: string) {
  const site = getSksSiteRecordByKey(siteKey);
  if (!site) return null;

  const models = listSksSiteModels(site.id, { currentlyListedOnly: true });
  const currentModelSet = new Set(models.map((item) => item.modelName));
  const recentProbes = listSksProbeResults(site.id, { limit: 200 })
    .filter((probe) => !probe.modelName || currentModelSet.has(probe.modelName))
    .slice(0, 50);

  return {
    site,
    credentials: listSksCredentialsBySite(site.id).map(sanitizeCredential),
    models,
    recentProbes,
  };
}

export function cleanOldSksProbeResults(retentionDays: number = SKS_RETENTION_DAYS) {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const result = db
    .prepare(`DELETE FROM sks_probe_results WHERE datetime(checkedAt) < datetime('now', ?)`)
    .run(`-${safeDays} days`);
  return result.changes;
}

export function getSksUserSubmissionById(submissionId: string) {
  const row = db
    .prepare(`SELECT * FROM sks_user_submissions WHERE id = ?`)
    .get(submissionId) as SksUserSubmissionRow | undefined;
  return row ? rowToUserSubmission(row) : null;
}

export function listSksUserSubmissionsByUser(userId: number) {
  const rows = db
    .prepare(
      `SELECT *
       FROM sks_user_submissions
       WHERE userId = ?
       ORDER BY datetime(createdAt) DESC, id DESC`
    )
    .all(userId) as SksUserSubmissionRow[];
  return rows.map(rowToUserSubmission);
}

export function createSksUserSubmission(input: {
  userId: number;
  hostname: string;
  normalizedHostname: string;
  apiBaseUrl: string;
  homepageUrl?: string | null;
  displayName?: string | null;
  apiKeyPreview: string;
  apiKey?: string | null;
  sourceType?: SksSourceType;
}) {
  const submissionId = crypto.randomUUID();
  const now = toDbTimestamp();

  try {
    db.prepare(
      `INSERT INTO sks_user_submissions (
        id, userId, hostname, normalizedHostname, apiBaseUrl, homepageUrl, displayName,
        apiKeyPreview, apiKeyEncrypted, status, lastMessage, sourceType, createdAt, updatedAt, validatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?, ?, NULL)`
    ).run(
      submissionId,
      input.userId,
      input.hostname,
      input.normalizedHostname,
      input.apiBaseUrl,
      input.homepageUrl ?? null,
      input.displayName ?? null,
      input.apiKeyPreview,
      input.apiKey ? encryptApiKey(input.apiKey) : null,
      input.sourceType || "owner",
      now,
      now
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/unique/i.test(message)) {
      throw new Error("你已经提交过这个网站，请不要重复提交");
    }
    throw error;
  }

  return getSksUserSubmissionById(submissionId)!;
}

export function setSksUserSubmissionResult(
  submissionId: string,
  input: {
    status: SksSubmissionStatus;
    lastMessage?: string | null;
    siteId?: string | null;
    credentialId?: string | null;
    displayName?: string | null;
    homepageUrl?: string | null;
    apiBaseUrl?: string;
    apiKeyPreview?: string;
    apiKey?: string | null;
    validatedAt?: string | null;
  }
) {
  const existing = getSksUserSubmissionById(submissionId);
  if (!existing) return null;

  const now = toDbTimestamp();
  db.prepare(
    `UPDATE sks_user_submissions SET
      status = ?,
      lastMessage = ?,
      siteId = ?,
      credentialId = ?,
      displayName = ?,
      homepageUrl = ?,
      apiBaseUrl = ?,
      apiKeyPreview = ?,
      apiKeyEncrypted = ?,
      updatedAt = ?,
      validatedAt = ?
    WHERE id = ?`
  ).run(
    input.status,
    input.lastMessage ?? existing.lastMessage,
    input.siteId ?? existing.siteId,
    input.credentialId ?? existing.credentialId,
    input.displayName ?? existing.displayName,
    input.homepageUrl ?? existing.homepageUrl,
    input.apiBaseUrl ?? existing.apiBaseUrl,
    input.apiKeyPreview ?? existing.apiKeyPreview,
    input.apiKey !== undefined
      ? input.apiKey
        ? encryptApiKey(input.apiKey)
        : null
      : existing.apiKeyEncrypted,
    now,
    input.validatedAt ?? existing.validatedAt,
    submissionId
  );

  return getSksUserSubmissionById(submissionId);
}

export function getSafeSksCredentialView(credentialId: string) {
  const credential = getSksCredentialById(credentialId);
  return credential ? sanitizeCredential(credential) : null;
}

export function getSafeSksCredentialViews(siteId: string) {
  return listSksCredentialsBySite(siteId).map(sanitizeCredential);
}

export function getResolvedSksUserSubmissionById(submissionId: string) {
  const record = getSksUserSubmissionById(submissionId);
  if (!record) return null;

  return {
    record,
    apiKey: record.apiKeyEncrypted ? decryptApiKey(record.apiKeyEncrypted) : "",
  };
}

export function deleteSksUserSubmission(submissionId: string, userId: number) {
  const existing = getSksUserSubmissionById(submissionId);
  if (!existing || existing.userId !== userId) return false;
  const result = db.prepare(`DELETE FROM sks_user_submissions WHERE id = ? AND userId = ?`).run(submissionId, userId);
  return result.changes > 0;
}
