import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  modelRegistrySeed,
  platformAttributeGroupsSeed,
  platformAttributeOptionsSeed,
} from "./platform-config";

const DB_PATH = path.join(process.cwd(), "data", "sk-buy.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    displayName TEXT DEFAULT '',
    passwordHash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    avatar TEXT DEFAULT '',
    emailVerified INTEGER DEFAULT 0,
    emailVerifiedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_auth_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    provider TEXT NOT NULL,
    providerUserId TEXT NOT NULL,
    metaJson TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, providerUserId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    code TEXT,
    expiresAt TEXT NOT NULL,
    consumedAt TEXT,
    codeConsumedAt TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS platforms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    baseUrl TEXT DEFAULT '',
    monitorEnabled INTEGER DEFAULT 0,
    tag TEXT NOT NULL CHECK(tag IN ('premium', 'free', 'stable', 'dead')),
    tagLabel TEXT NOT NULL,
    billingRate TEXT NOT NULL,
    billingColor TEXT DEFAULT 'text-foreground',
    models TEXT DEFAULT '[]',
    uptime REAL DEFAULT 0,
    latency INTEGER DEFAULT 0,
    joinDate TEXT NOT NULL,
    description TEXT DEFAULT '',
    sortOrder INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    metaJson TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS platform_attribute_groups (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    inputType TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    isFilterable INTEGER DEFAULT 1,
    isComparable INTEGER DEFAULT 1,
    isVisibleByDefault INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    metaJson TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS platform_attribute_options (
    id TEXT PRIMARY KEY,
    groupKey TEXT NOT NULL,
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    sortOrder INTEGER DEFAULT 0,
    metaJson TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(groupKey, value)
  );

  CREATE TABLE IF NOT EXISTS platform_attribute_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    groupKey TEXT NOT NULL,
    optionValue TEXT DEFAULT '',
    valueText TEXT DEFAULT '',
    valueNumber REAL,
    valueBoolean INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS model_registry (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    vendor TEXT DEFAULT '',
    featured INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    metaJson TEXT DEFAULT '{}',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS platform_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    modelKey TEXT NOT NULL,
    isFeatured INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    remark TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(platformId, modelKey),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connectivity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    success INTEGER NOT NULL,
    latency INTEGER DEFAULT 0,
    errorMessage TEXT DEFAULT '',
    checkedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS probe_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    probeType TEXT NOT NULL,
    targetType TEXT DEFAULT 'platform',
    targetKey TEXT DEFAULT '',
    enabled INTEGER DEFAULT 1,
    intervalSeconds INTEGER DEFAULT 300,
    timeoutMs INTEGER DEFAULT 10000,
    retryCount INTEGER DEFAULT 1,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS probe_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    targetType TEXT DEFAULT 'platform',
    targetKey TEXT DEFAULT '',
    timeWindow TEXT NOT NULL,
    uptime REAL DEFAULT 0,
    avgLatency INTEGER DEFAULT 0,
    successCount INTEGER DEFAULT 0,
    failureCount INTEGER DEFAULT 0,
    lastCheckedAt TEXT,
    updatedAt TEXT DEFAULT (datetime('now')),
    UNIQUE(platformId, targetType, targetKey, timeWindow),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS forum_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon TEXT DEFAULT '',
    color TEXT DEFAULT '',
    sortOrder INTEGER DEFAULT 0,
    readOnly INTEGER DEFAULT 0,
    topicCount INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS forum_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoryId TEXT NOT NULL,
    authorId INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    pinned INTEGER DEFAULT 0,
    locked INTEGER DEFAULT 0,
    viewCount INTEGER DEFAULT 0,
    replyCount INTEGER DEFAULT 0,
    lastReplyAt TEXT,
    lastReplyBy INTEGER,
    tags TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (categoryId) REFERENCES forum_categories(id),
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS forum_replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topicId INTEGER NOT NULL,
    authorId INTEGER NOT NULL,
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (topicId) REFERENCES forum_topics(id) ON DELETE CASCADE,
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS platform_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platformId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    score INTEGER NOT NULL CHECK(score >= 1 AND score <= 5),
    comment TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    UNIQUE(platformId, userId),
    FOREIGN KEY (platformId) REFERENCES platforms(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

ensureColumn("platform_attribute_options", "metaJson", "TEXT DEFAULT '{}' ");

function hasColumn(tableName: string, columnName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

if (!hasColumn("users", "displayName")) {
  db.exec(`ALTER TABLE users ADD COLUMN displayName TEXT DEFAULT ''`);
}
if (!hasColumn("users", "emailVerified")) {
  db.exec(`ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0`);
}
if (!hasColumn("users", "emailVerifiedAt")) {
  db.exec(`ALTER TABLE users ADD COLUMN emailVerifiedAt TEXT`);
}
if (!hasColumn("users", "updatedAt")) {
  db.exec(`ALTER TABLE users ADD COLUMN updatedAt TEXT`);
  db.exec(`UPDATE users SET updatedAt = COALESCE(createdAt, datetime('now')) WHERE updatedAt IS NULL OR updatedAt = ''`);
}
if (!hasColumn("email_verification_tokens", "code")) {
  db.exec(`ALTER TABLE email_verification_tokens ADD COLUMN code TEXT`);
}
if (!hasColumn("email_verification_tokens", "codeConsumedAt")) {
  db.exec(`ALTER TABLE email_verification_tokens ADD COLUMN codeConsumedAt TEXT`);
}
db.exec(`
  UPDATE users
  SET emailVerified = 1,
      emailVerifiedAt = COALESCE(emailVerifiedAt, createdAt, datetime('now')),
      updatedAt = datetime('now')
  WHERE role = 'admin'
`);
try { db.exec(`ALTER TABLE platforms ADD COLUMN baseUrl TEXT DEFAULT ''`); } catch {}
if (!hasColumn("platform_attribute_options", "color")) {
  db.exec(`ALTER TABLE platform_attribute_options ADD COLUMN color TEXT DEFAULT ''`);
}
try { db.exec(`ALTER TABLE platforms ADD COLUMN monitorEnabled INTEGER DEFAULT 0`); } catch {}
try { db.exec(`ALTER TABLE platforms ADD COLUMN status TEXT DEFAULT 'active'`); } catch {}
try { db.exec(`ALTER TABLE platforms ADD COLUMN metaJson TEXT DEFAULT '{}'`); } catch {}
try { db.exec(`ALTER TABLE platform_attribute_groups ADD COLUMN metaJson TEXT DEFAULT '{}'`); } catch {}

db.exec(`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(userId, expiresAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_connectivity_logs_platform_time ON connectivity_logs(platformId, checkedAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(categoryId, createdAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies(topicId, createdAt ASC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_platform_ratings_platform ON platform_ratings(platformId)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_platform_attribute_values_platform ON platform_attribute_values(platformId, groupKey)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_platform_models_platform ON platform_models(platformId, modelKey)`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === verify;
}

export interface User {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  avatar: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  avatar: string;
  emailVerified: number;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  passwordHash: string;
}

function rowToUser(row: Omit<UserRow, "passwordHash">): User {
  return {
    ...row,
    emailVerified: row.emailVerified === 1,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateUsernameFromEmail(email: string) {
  const localPart = normalizeEmail(email).split("@")[0].replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "user";
  let username = localPart.slice(0, 24);
  let counter = 1;
  while (getUserByUsername(username)) {
    username = `${localPart.slice(0, 20)}-${counter++}`;
  }
  return username;
}

export function createUser(data: {
  email: string;
  password: string;
  role?: "user" | "admin";
  displayName?: string;
  username?: string;
  emailVerified?: boolean;
}): User {
  const passwordHash = hashPassword(data.password);
  const email = normalizeEmail(data.email);
  const username = data.username?.trim() || generateUsernameFromEmail(email);
  const displayName = data.displayName?.trim() || username;
  const role = data.role || "user";
  const emailVerified = data.emailVerified === true;
  const emailVerifiedAt = emailVerified
    ? new Date().toISOString().slice(0, 19).replace("T", " ")
    : null;
  const result = db
    .prepare(
      `INSERT INTO users (username, email, displayName, passwordHash, role, emailVerified, emailVerifiedAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(username, email, displayName, passwordHash, role, emailVerified ? 1 : 0, emailVerifiedAt);

  const user = getUserById(result.lastInsertRowid as number)!;
  db.prepare(
    `INSERT OR IGNORE INTO user_auth_providers (userId, provider, providerUserId, metaJson) VALUES (?, 'email', ?, '{}')`
  ).run(user.id, user.email);
  return user;
}

export function getUserById(id: number): User | null {
  const row = db
    .prepare(
      `SELECT id, username, email, displayName, role, avatar, emailVerified, emailVerifiedAt, createdAt, updatedAt FROM users WHERE id = ?`
    )
    .get(id) as Omit<UserRow, "passwordHash"> | undefined;
  return row ? rowToUser(row) : null;
}

export function getUserByUsername(username: string): UserRow | null {
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as UserRow | undefined;
  return row || null;
}

export function getUserByEmail(email: string): UserRow | null {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(normalizeEmail(email)) as UserRow | undefined;
  return row || null;
}

export function getAllUsers(): User[] {
  const rows = db
    .prepare(
      `SELECT id, username, email, displayName, role, avatar, emailVerified, emailVerifiedAt, createdAt, updatedAt FROM users ORDER BY createdAt DESC`
    )
    .all() as Array<Omit<UserRow, "passwordHash">>;
  return rows.map(rowToUser);
}

export function updateUserRole(id: number, role: "user" | "admin"): void {
  db.prepare(`UPDATE users SET role = ?, updatedAt = datetime('now') WHERE id = ?`).run(role, id);
}

export function createSession(userId: number): string {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  db.prepare(`INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`).run(userId, token, expiresAt);
  return token;
}

export function getUserBySessionToken(token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.displayName, u.role, u.avatar, u.emailVerified,
              u.emailVerifiedAt, u.createdAt, COALESCE(u.updatedAt, u.createdAt) as updatedAt
       FROM sessions s
       JOIN users u ON s.userId = u.id
       WHERE s.token = ? AND datetime(s.expiresAt) > datetime('now')`
    )
    .get(token) as Omit<UserRow, "passwordHash"> | undefined;
  return row ? rowToUser(row) : null;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function cleanExpiredSessions(): void {
  db.prepare(`DELETE FROM sessions WHERE datetime(expiresAt) <= datetime('now')`).run();
}

export interface EmailVerificationChallenge {
  token: string;
  code: string;
  expiresAt: string;
}

function generateEmailVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function createEmailVerificationChallenge(userId: number, ttlHours: number = 24): EmailVerificationChallenge {
  db.prepare(`DELETE FROM email_verification_tokens WHERE userId = ?`).run(userId);
  const token = crypto.randomBytes(32).toString("hex");
  const code = generateEmailVerificationCode();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");

  db.prepare(`INSERT INTO email_verification_tokens (userId, token, code, expiresAt) VALUES (?, ?, ?, ?)`)
    .run(userId, token, code, expiresAt);

  return { token, code, expiresAt };
}

export function createEmailVerificationToken(userId: number, ttlHours: number = 24): string {
  return createEmailVerificationChallenge(userId, ttlHours).token;
}

export function markUserEmailVerified(userId: number): User | null {
  db.prepare(
    `UPDATE users
     SET emailVerified = 1,
         emailVerifiedAt = COALESCE(emailVerifiedAt, datetime('now')),
         updatedAt = datetime('now')
     WHERE id = ?`
  ).run(userId);
  return getUserById(userId);
}

export function consumeEmailVerificationToken(token: string): User | null {
  const row = db
    .prepare(
      `SELECT id, userId
       FROM email_verification_tokens
       WHERE token = ? AND consumedAt IS NULL AND datetime(expiresAt) > datetime('now')`
    )
    .get(token) as { id: number; userId: number } | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE email_verification_tokens
     SET consumedAt = datetime('now'),
         codeConsumedAt = COALESCE(codeConsumedAt, datetime('now'))
     WHERE id = ?`
  ).run(row.id);
  return markUserEmailVerified(row.userId);
}

export function verifyEmailByCode(email: string, code: string): User | null {
  const user = getUserByEmail(email);
  if (!user) return null;

  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) return null;

  const row = db
    .prepare(
      `SELECT id
       FROM email_verification_tokens
       WHERE userId = ?
         AND code = ?
         AND consumedAt IS NULL
         AND datetime(expiresAt) > datetime('now')
       ORDER BY createdAt DESC
       LIMIT 1`
    )
    .get(user.id, normalizedCode) as { id: number } | undefined;

  if (!row) return null;

  db.prepare(
    `UPDATE email_verification_tokens
     SET consumedAt = datetime('now'),
         codeConsumedAt = datetime('now')
     WHERE id = ?`
  ).run(row.id);

  return markUserEmailVerified(user.id);
}

export interface Platform {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  monitorEnabled: boolean;
  tag: "premium" | "free" | "stable" | "dead";
  tagLabel: string;
  billingRate: string;
  billingColor: string;
  models: string[];
  uptime: number;
  latency: number;
  joinDate: string;
  description: string;
  descriptionZh: string;
  descriptionEn: string;
  sortOrder: number;
  status: string;
  metaJson: string;
  createdAt: string;
  updatedAt: string;
}

interface PlatformRow {
  id: string;
  name: string;
  url: string;
  baseUrl: string;
  monitorEnabled: number;
  tag: string;
  tagLabel: string;
  billingRate: string;
  billingColor: string;
  models: string;
  uptime: number;
  latency: number;
  joinDate: string;
  description: string;
  sortOrder: number;
  status: string;
  metaJson: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPlatform(row: PlatformRow): Platform {
  const meta = JSON.parse(row.metaJson || "{}") as { descriptionZh?: string; descriptionEn?: string };
  const descriptionZh = (meta.descriptionZh || row.description || "").trim();
  const descriptionEn = (meta.descriptionEn || "").trim();
  return {
    ...row,
    tag: row.tag as Platform["tag"],
    monitorEnabled: row.monitorEnabled === 1,
    models: JSON.parse(row.models || "[]"),
    description: descriptionZh || descriptionEn || row.description,
    descriptionZh,
    descriptionEn,
  };
}

export function getAllPlatforms(): Platform[] {
  const rows = db.prepare(`SELECT * FROM platforms ORDER BY sortOrder ASC, createdAt DESC`).all() as PlatformRow[];
  return rows.map(rowToPlatform);
}

export function getPlatformById(id: string): Platform | null {
  const row = db.prepare(`SELECT * FROM platforms WHERE id = ?`).get(id) as PlatformRow | undefined;
  return row ? rowToPlatform(row) : null;
}

export function createPlatform(
  data: Omit<Platform, "createdAt" | "updatedAt" | "status" | "metaJson" | "descriptionZh" | "descriptionEn"> & {
    status?: string;
    metaJson?: string;
    descriptionZh?: string;
    descriptionEn?: string;
  }
): Platform {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO platforms (id, name, url, baseUrl, monitorEnabled, tag, tagLabel, billingRate, billingColor, models, uptime, latency, joinDate, description, sortOrder, status, metaJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.id,
    data.name,
    data.url,
    data.baseUrl || "",
    data.monitorEnabled ? 1 : 0,
    data.tag,
    data.tagLabel,
    data.billingRate,
    data.billingColor,
    JSON.stringify(data.models),
    data.uptime,
    data.latency,
    data.joinDate,
    data.description || "",
    data.sortOrder || 0,
    data.status || "active",
    data.metaJson || "{}",
    now,
    now
  );
  return getPlatformById(data.id)!;
}

export function updatePlatform(id: string, data: Partial<Omit<Platform, "id" | "createdAt" | "updatedAt">>): Platform | null {
  const existing = getPlatformById(id);
  if (!existing) return null;

  const updated = { ...existing, ...data };
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE platforms SET
      name = ?, url = ?, baseUrl = ?, monitorEnabled = ?, tag = ?, tagLabel = ?, billingRate = ?, billingColor = ?,
      models = ?, uptime = ?, latency = ?, joinDate = ?, description = ?, sortOrder = ?, status = ?, metaJson = ?, updatedAt = ?
     WHERE id = ?`
  ).run(
    updated.name,
    updated.url,
    updated.baseUrl || "",
    updated.monitorEnabled ? 1 : 0,
    updated.tag,
    updated.tagLabel,
    updated.billingRate,
    updated.billingColor,
    JSON.stringify(updated.models),
    updated.uptime,
    updated.latency,
    updated.joinDate,
    updated.description,
    updated.sortOrder,
    updated.status,
    updated.metaJson,
    now,
    id
  );
  return getPlatformById(id);
}

export function deletePlatform(id: string): boolean {
  const result = db.prepare(`DELETE FROM platforms WHERE id = ?`).run(id);
  return result.changes > 0;
}

export interface PlatformAttributeGroupRecord {
  id: string;
  key: string;
  label: string;
  labelZh: string;
  labelEn: string;
  inputType: string;
  enabled: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isVisibleByDefault: boolean;
  sortOrder: number;
  boundField?: "none" | "site_tag" | "featured_models";
}

export interface PlatformAttributeOptionRecord {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  labelZh: string;
  labelEn: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ModelRegistryRecord {
  id: string;
  key: string;
  name: string;
  vendor: string;
  featured: boolean;
  enabled: boolean;
}

export interface PlatformAttributeValueRecord {
  id: number;
  platformId: string;
  groupKey: string;
  optionValue: string;
  valueText: string;
  valueNumber: number | null;
  valueBoolean: boolean | null;
}

function slugifyKey(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `group_${crypto.randomUUID().slice(0, 8)}`;
}

function rowToPlatformAttributeGroup(row: {
  id: string;
  key: string;
  label: string;
  inputType: string;
  enabled: number;
  isFilterable: number;
  isComparable: number;
  isVisibleByDefault: number;
  sortOrder: number;
  metaJson?: string;
}): PlatformAttributeGroupRecord {
  const meta = JSON.parse(row.metaJson || "{}") as {
    boundField?: "none" | "site_tag" | "featured_models";
    labelZh?: string;
    labelEn?: string;
  };
  const labelZh = (meta.labelZh || row.label || "").trim();
  const labelEn = (meta.labelEn || "").trim();
  return {
    id: row.id,
    key: row.key,
    label: labelZh || labelEn || row.label,
    labelZh,
    labelEn,
    inputType: row.inputType,
    enabled: row.enabled === 1,
    isFilterable: row.isFilterable === 1,
    isComparable: row.isComparable === 1,
    isVisibleByDefault: row.isVisibleByDefault === 1,
    sortOrder: row.sortOrder,
    boundField: meta.boundField || "none",
  };
}

function rowToPlatformAttributeOption(row: {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color: string;
  enabled: number;
  sortOrder: number;
  metaJson?: string;
}): PlatformAttributeOptionRecord {
  const meta = JSON.parse(row.metaJson || "{}") as { labelZh?: string; labelEn?: string };
  const labelZh = (meta.labelZh || row.label || "").trim();
  const labelEn = (meta.labelEn || "").trim();
  return {
    ...row,
    label: labelZh || labelEn || row.label,
    labelZh,
    labelEn,
    enabled: row.enabled === 1,
  };
}

function rowToPlatformAttributeValue(row: {
  id: number;
  platformId: string;
  groupKey: string;
  optionValue: string;
  valueText: string;
  valueNumber: number | null;
  valueBoolean: number | null;
}): PlatformAttributeValueRecord {
  return {
    ...row,
    valueBoolean: row.valueBoolean === null ? null : row.valueBoolean === 1,
  };
}

export function getPlatformAttributeGroups(): PlatformAttributeGroupRecord[] {
  return db
    .prepare(`SELECT * FROM platform_attribute_groups ORDER BY sortOrder ASC, createdAt ASC`)
    .all()
    .map((row) => rowToPlatformAttributeGroup(row as {
      id: string;
      key: string;
      label: string;
      inputType: string;
      enabled: number;
      isFilterable: number;
      isComparable: number;
      isVisibleByDefault: number;
      sortOrder: number;
      metaJson?: string;
    }));
}

export function createPlatformAttributeGroup(data: {
  label: string;
  labelZh?: string;
  labelEn?: string;
  key?: string;
  inputType: string;
  enabled?: boolean;
  isFilterable?: boolean;
  isComparable?: boolean;
  isVisibleByDefault?: boolean;
  sortOrder?: number;
  boundField?: "none" | "site_tag" | "featured_models";
}): PlatformAttributeGroupRecord {
  const id = `group_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const primaryLabel = (data.labelZh || data.label || data.labelEn || "").trim();
  const key = slugifyKey(data.key || primaryLabel);
  db.prepare(
    `INSERT INTO platform_attribute_groups (id, key, label, inputType, enabled, isFilterable, isComparable, isVisibleByDefault, sortOrder, metaJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    key,
    primaryLabel,
    data.inputType,
    data.enabled === false ? 0 : 1,
    data.isFilterable === false ? 0 : 1,
    data.isComparable === false ? 0 : 1,
    data.isVisibleByDefault ? 1 : 0,
    data.sortOrder || 0,
    JSON.stringify({
      boundField: data.boundField || "none",
      labelZh: (data.labelZh || data.label || "").trim(),
      labelEn: (data.labelEn || "").trim(),
    })
  );
  return getPlatformAttributeGroups().find((group) => group.id === id)!;
}

export function updatePlatformAttributeGroup(
  id: string,
  data: Partial<{
    label: string;
    labelZh: string;
    labelEn: string;
    key: string;
    inputType: string;
    enabled: boolean;
    isFilterable: boolean;
    isComparable: boolean;
    isVisibleByDefault: boolean;
    sortOrder: number;
    boundField: "none" | "site_tag" | "featured_models";
  }>
): PlatformAttributeGroupRecord | null {
  const existing = getPlatformAttributeGroups().find((group) => group.id === id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...data,
    key: data.key ? slugifyKey(data.key) : existing.key,
    labelZh: data.labelZh?.trim() || data.label?.trim() || existing.labelZh,
    labelEn: data.labelEn?.trim() || existing.labelEn,
  };
  updated.label = updated.labelZh || updated.labelEn || existing.label;
  db.prepare(
    `UPDATE platform_attribute_groups SET key = ?, label = ?, inputType = ?, enabled = ?, isFilterable = ?, isComparable = ?, isVisibleByDefault = ?, sortOrder = ?, metaJson = ?, updatedAt = datetime('now') WHERE id = ?`
  ).run(
    updated.key,
    updated.label,
    updated.inputType,
    updated.enabled ? 1 : 0,
    updated.isFilterable ? 1 : 0,
    updated.isComparable ? 1 : 0,
    updated.isVisibleByDefault ? 1 : 0,
    updated.sortOrder,
    JSON.stringify({
      boundField: updated.boundField || "none",
      labelZh: updated.labelZh,
      labelEn: updated.labelEn,
    }),
    id
  );
  return getPlatformAttributeGroups().find((group) => group.id === id) || null;
}

export function deletePlatformAttributeGroup(id: string): boolean {
  const existing = getPlatformAttributeGroups().find((group) => group.id === id);
  if (!existing) return false;
  db.prepare(`DELETE FROM platform_attribute_values WHERE groupKey = ?`).run(existing.key);
  db.prepare(`DELETE FROM platform_attribute_options WHERE groupKey = ?`).run(existing.key);
  const result = db.prepare(`DELETE FROM platform_attribute_groups WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getPlatformAttributeOptions(): PlatformAttributeOptionRecord[] {
  return db
    .prepare(`SELECT * FROM platform_attribute_options ORDER BY groupKey ASC, sortOrder ASC`)
    .all()
    .map((row) => rowToPlatformAttributeOption(row as {
      id: string;
      groupKey: string;
      value: string;
      label: string;
      color: string;
      enabled: number;
      sortOrder: number;
      metaJson?: string;
    }));
}

export function createPlatformAttributeOption(data: {
  groupKey: string;
  label: string;
  labelZh?: string;
  labelEn?: string;
  value?: string;
  color?: string;
  enabled?: boolean;
  sortOrder?: number;
}): PlatformAttributeOptionRecord {
  const id = `option_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const primaryLabel = (data.labelZh || data.label || data.labelEn || "").trim();
  const value = slugifyKey(data.value || primaryLabel);
  db.prepare(
    `INSERT INTO platform_attribute_options (id, groupKey, value, label, color, enabled, sortOrder, metaJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.groupKey,
    value,
    primaryLabel,
    (data.color || "").trim(),
    data.enabled === false ? 0 : 1,
    data.sortOrder || 0,
    JSON.stringify({
      labelZh: (data.labelZh || data.label || "").trim(),
      labelEn: (data.labelEn || "").trim(),
    })
  );
  return getPlatformAttributeOptions().find((option) => option.id === id)!;
}

export function updatePlatformAttributeOption(
  id: string,
  data: Partial<{
    groupKey: string;
    label: string;
    labelZh: string;
    labelEn: string;
    value: string;
    color: string;
    enabled: boolean;
    sortOrder: number;
  }>
): PlatformAttributeOptionRecord | null {
  const existing = getPlatformAttributeOptions().find((option) => option.id === id);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...data,
    value: data.value ? slugifyKey(data.value) : existing.value,
    labelZh: data.labelZh?.trim() || data.label?.trim() || existing.labelZh,
    labelEn: data.labelEn?.trim() || existing.labelEn,
  };
  updated.label = updated.labelZh || updated.labelEn || existing.label;
  db.prepare(
    `UPDATE platform_attribute_options SET groupKey = ?, value = ?, label = ?, color = ?, enabled = ?, sortOrder = ?, metaJson = ?, updatedAt = datetime('now') WHERE id = ?`
  ).run(
    updated.groupKey,
    updated.value,
    updated.label,
    (updated.color || "").trim(),
    updated.enabled ? 1 : 0,
    updated.sortOrder,
    JSON.stringify({
      labelZh: updated.labelZh,
      labelEn: updated.labelEn,
    }),
    id
  );
  return getPlatformAttributeOptions().find((option) => option.id === id) || null;
}

export function deletePlatformAttributeOption(id: string): boolean {
  const existing = getPlatformAttributeOptions().find((option) => option.id === id);
  if (!existing) return false;
  db.prepare(`DELETE FROM platform_attribute_values WHERE groupKey = ? AND optionValue = ?`).run(existing.groupKey, existing.value);
  const result = db.prepare(`DELETE FROM platform_attribute_options WHERE id = ?`).run(id);
  return result.changes > 0;
}

export function getPlatformAttributeValues(platformId?: string): PlatformAttributeValueRecord[] {
  const rows = platformId
    ? db.prepare(`SELECT * FROM platform_attribute_values WHERE platformId = ? ORDER BY groupKey ASC, id ASC`).all(platformId)
    : db.prepare(`SELECT * FROM platform_attribute_values ORDER BY platformId ASC, groupKey ASC, id ASC`).all();

  return rows.map((row) =>
    rowToPlatformAttributeValue(row as {
      id: number;
      platformId: string;
      groupKey: string;
      optionValue: string;
      valueText: string;
      valueNumber: number | null;
      valueBoolean: number | null;
    })
  );
}

export function replacePlatformAttributeValues(
  platformId: string,
  values: Array<{
    groupKey: string;
    optionValue?: string;
    valueText?: string;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
  }>
): PlatformAttributeValueRecord[] {
  db.prepare(`DELETE FROM platform_attribute_values WHERE platformId = ?`).run(platformId);
  const stmt = db.prepare(
    `INSERT INTO platform_attribute_values (platformId, groupKey, optionValue, valueText, valueNumber, valueBoolean, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  for (const item of values) {
    stmt.run(
      platformId,
      item.groupKey,
      item.optionValue || "",
      item.valueText || "",
      item.valueNumber ?? null,
      item.valueBoolean === null || item.valueBoolean === undefined ? null : item.valueBoolean ? 1 : 0
    );
  }

  return getPlatformAttributeValues(platformId);
}

export function getModelRegistry(): ModelRegistryRecord[] {
  return db
    .prepare(`SELECT * FROM model_registry WHERE enabled = 1 ORDER BY featured DESC, name ASC`)
    .all()
    .map((row) => ({
      ...(row as Omit<ModelRegistryRecord, "featured" | "enabled"> & { featured: number; enabled: number }),
      featured: (row as { featured: number }).featured === 1,
      enabled: (row as { enabled: number }).enabled === 1,
    }));
}

export interface ConnectivityLog {
  id: number;
  platformId: string;
  success: boolean;
  latency: number;
  errorMessage: string;
  checkedAt: string;
}

interface ConnectivityLogRow {
  id: number;
  platformId: string;
  success: number;
  latency: number;
  errorMessage: string;
  checkedAt: string;
}

export function saveConnectivityLog(platformId: string, success: boolean, latency: number, errorMessage: string = ""): void {
  db.prepare(
    `INSERT INTO connectivity_logs (platformId, success, latency, errorMessage, checkedAt)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(platformId, success ? 1 : 0, latency, errorMessage);
}

export function getLatestConnectivityLogs(platformId: string, limit: number = 60): ConnectivityLog[] {
  const rows = db
    .prepare(`SELECT * FROM connectivity_logs WHERE platformId = ? ORDER BY checkedAt DESC LIMIT ?`)
    .all(platformId, limit) as ConnectivityLogRow[];
  return rows.map((r) => ({ ...r, success: r.success === 1 }));
}

export function getHourlyConnectivityLogs(platformId: string): ConnectivityLog[] {
  const rows = db
    .prepare(
      `WITH hourly AS (
        SELECT *,
          strftime('%Y-%m-%d %H', checkedAt) AS hour_bucket,
          ROW_NUMBER() OVER (PARTITION BY strftime('%Y-%m-%d %H', checkedAt) ORDER BY checkedAt DESC) AS rn
        FROM connectivity_logs
        WHERE platformId = ? AND checkedAt >= datetime('now', '-24 hours')
      )
      SELECT id, platformId, success, latency, errorMessage, checkedAt
      FROM hourly WHERE rn = 1
      ORDER BY checkedAt ASC`
    )
    .all(platformId) as ConnectivityLogRow[];
  return rows.map((r) => ({ ...r, success: r.success === 1 }));
}

export interface ConnectivitySummary {
  uptime: number;
  avgLatency: number;
  lastCheck: string | null;
  totalChecks: number;
}

export function getConnectivitySummary(platformId: string): ConnectivitySummary {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as totalChecks,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successCount,
        AVG(CASE WHEN success = 1 THEN latency ELSE NULL END) as avgLatency,
        MAX(checkedAt) as lastCheck
       FROM connectivity_logs
       WHERE platformId = ? AND checkedAt >= datetime('now', '-24 hours')`
    )
    .get(platformId) as {
      totalChecks: number;
      successCount: number;
      avgLatency: number | null;
      lastCheck: string | null;
    };

  return {
    totalChecks: row.totalChecks,
    uptime: row.totalChecks > 0 ? Math.round((row.successCount / row.totalChecks) * 1000) / 10 : 0,
    avgLatency: Math.round(row.avgLatency || 0),
    lastCheck: row.lastCheck,
  };
}

export function getMonitorEnabledPlatforms(): Platform[] {
  const rows = db.prepare(`SELECT * FROM platforms WHERE monitorEnabled = 1 ORDER BY sortOrder ASC`).all() as PlatformRow[];
  return rows.map(rowToPlatform);
}

export function cleanOldConnectivityLogs(): number {
  const result = db.prepare(`DELETE FROM connectivity_logs WHERE checkedAt < datetime('now', '-3 days')`).run();
  return result.changes;
}

function seedPlatformConfig() {
  const groupCount = (db.prepare(`SELECT COUNT(*) as count FROM platform_attribute_groups`).get() as { count: number }).count;
  if (groupCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO platform_attribute_groups (id, key, label, inputType, enabled, isFilterable, isComparable, isVisibleByDefault, sortOrder, metaJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const group of platformAttributeGroupsSeed) {
      stmt.run(
        group.id,
        group.key,
        group.label,
        group.inputType,
        group.enabled ? 1 : 0,
        group.isFilterable ? 1 : 0,
        group.isComparable ? 1 : 0,
        group.isVisibleByDefault ? 1 : 0,
        group.sortOrder,
        JSON.stringify({ boundField: group.boundField || "none" })
      );
    }
  }

  const optionCount = (db.prepare(`SELECT COUNT(*) as count FROM platform_attribute_options`).get() as { count: number }).count;
  if (optionCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO platform_attribute_options (id, groupKey, value, label, color, enabled, sortOrder, metaJson)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const option of platformAttributeOptionsSeed) {
      stmt.run(option.id, option.groupKey, option.value, option.label, option.color || "", option.enabled ? 1 : 0, option.sortOrder, JSON.stringify({ labelZh: option.label, labelEn: "" }));
    }
  }

  const modelCount = (db.prepare(`SELECT COUNT(*) as count FROM model_registry`).get() as { count: number }).count;
  if (modelCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO model_registry (id, key, name, vendor, featured, enabled, metaJson)
       VALUES (?, ?, ?, ?, ?, 1, '{}')`
    );
    for (const model of modelRegistrySeed) {
      stmt.run(model.id, model.key, model.name, model.vendor, model.featured ? 1 : 0);
    }
  }
}

function seedData() {
  const platformCount = (db.prepare(`SELECT COUNT(*) as count FROM platforms`).get() as { count: number }).count;

  if (platformCount === 0) {
    const seedPlatforms: Omit<Platform, "createdAt" | "updatedAt">[] = [
      {
        id: "openrouter-pro",
        name: "OpenRouter Pro",
        url: "openrouter.ai",
        baseUrl: "",
        monitorEnabled: false,
        tag: "premium",
        tagLabel: "高品质站",
        billingRate: "1.0x",
        billingColor: "text-foreground",
        models: ["GPT-4o", "Claude 3.5 Sonnet", "Gemini 2.5 Pro"],
        uptime: 99.8,
        latency: 345,
        joinDate: "2024-03-15",
        description: "高品质 API 中转服务，稳定性极佳",
        descriptionZh: "高品质 API 中转服务，稳定性极佳",
        descriptionEn: "High-quality API relay service with excellent stability.",
        sortOrder: 1,
        status: "active",
        metaJson: JSON.stringify({ descriptionZh: "高品质 API 中转服务，稳定性极佳", descriptionEn: "High-quality API relay service with excellent stability." }),
      },
      {
        id: "freegpt-hub",
        name: "FreeGPT Hub",
        url: "freegpt.cc",
        baseUrl: "",
        monitorEnabled: false,
        tag: "free",
        tagLabel: "白嫖公益站",
        billingRate: "FREE",
        billingColor: "text-emerald-400",
        models: ["GPT-3.5", "Llama 3 70B"],
        uptime: 87.3,
        latency: 1200,
        joinDate: "2024-08-22",
        description: "免费公益站，不保证稳定性",
        descriptionZh: "免费公益站，不保证稳定性",
        descriptionEn: "Free public platform with no stability guarantee.",
        sortOrder: 2,
        status: "active",
        metaJson: JSON.stringify({ descriptionZh: "免费公益站，不保证稳定性", descriptionEn: "Free public platform with no stability guarantee." }),
      },
      {
        id: "siliconflow",
        name: "SiliconFlow",
        url: "siliconflow.cn",
        baseUrl: "",
        monitorEnabled: false,
        tag: "stable",
        tagLabel: "稳定可靠",
        billingRate: "0.7x",
        billingColor: "text-blue-400",
        models: ["DeepSeek V3", "Qwen 2.5 72B", "GLM-4"],
        uptime: 96.5,
        latency: 580,
        joinDate: "2024-06-10",
        description: "国产模型聚合，性价比优秀",
        descriptionZh: "国产模型聚合，性价比优秀",
        descriptionEn: "Great-value aggregation platform focused on domestic models.",
        sortOrder: 3,
        status: "active",
        metaJson: JSON.stringify({ descriptionZh: "国产模型聚合，性价比优秀", descriptionEn: "Great-value aggregation platform focused on domestic models." }),
      },
      {
        id: "gpt-proxy-xyz",
        name: "GPT-Proxy.xyz",
        url: "gpt-proxy.xyz",
        baseUrl: "",
        monitorEnabled: false,
        tag: "dead",
        tagLabel: "疑似跑路",
        billingRate: "0.3x",
        billingColor: "text-red-400 line-through",
        models: ["GPT-4 (不可用)"],
        uptime: 23.3,
        latency: 3500,
        joinDate: "2024-01-05",
        description: "服务已不可用，疑似跑路",
        descriptionZh: "服务已不可用，疑似跑路",
        descriptionEn: "Service appears unavailable and likely abandoned.",
        sortOrder: 4,
        status: "archived",
        metaJson: JSON.stringify({ descriptionZh: "服务已不可用，疑似跑路", descriptionEn: "Service appears unavailable and likely abandoned." }),
      },
    ];

    for (const p of seedPlatforms) createPlatform(p);

    replacePlatformAttributeValues("openrouter-pro", [
      { groupKey: "route_type", optionValue: "global_route" },
      { groupKey: "payment_methods", optionValue: "crypto" },
    ]);
    replacePlatformAttributeValues("freegpt-hub", [
      { groupKey: "route_type", optionValue: "global_route" },
    ]);
    replacePlatformAttributeValues("siliconflow", [
      { groupKey: "route_type", optionValue: "cn_direct" },
      { groupKey: "payment_methods", optionValue: "alipay" },
      { groupKey: "payment_methods", optionValue: "wechat_pay" },
    ]);
    replacePlatformAttributeValues("gpt-proxy-xyz", [
      { groupKey: "route_type", optionValue: "global_route" },
      { groupKey: "payment_methods", optionValue: "crypto" },
    ]);

    console.log("[DB] Seeded 4 default platforms");
  }

  const userCount = (db.prepare(`SELECT COUNT(*) as count FROM users`).get() as { count: number }).count;
  if (userCount === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@sk-buy.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || "Admin";
    createUser({
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      displayName: adminDisplayName,
      username: "admin",
      emailVerified: true,
    });
    console.log(`[DB] Created default admin user: ${adminEmail}`);
  }

  const categoryCount = (db.prepare(`SELECT COUNT(*) as count FROM forum_categories`).get() as { count: number }).count;
  if (categoryCount === 0) {
    const categories = [
      { id: "welfare", name: "福利羊毛", description: "API 优惠活动、免费额度、促销信息汇总", icon: "Gift", color: "#22c55e", sortOrder: 1, readOnly: 1 },
      { id: "guide", name: "新手指南", description: "API 使用教程、入门指南、常见问题解答", icon: "BookOpen", color: "#3b82f6", sortOrder: 2, readOnly: 1 },
      { id: "reviews", name: "站点点评", description: "API 中转站使用体验、评价、对比分析", icon: "Star", color: "#f59e0b", sortOrder: 3, readOnly: 0 },
      { id: "general", name: "综合交流", description: "AI 技术讨论、经验分享、自由交流", icon: "MessageCircle", color: "#8b5cf6", sortOrder: 4, readOnly: 0 },
      { id: "feedback", name: "站务反馈", description: "网站功能建议、Bug 反馈、意见交流", icon: "Flag", color: "#ef4444", sortOrder: 5, readOnly: 0 },
      { id: "showcase", name: "作品展示", description: "基于 AI API 构建的项目和应用展示", icon: "Sparkles", color: "#ec4899", sortOrder: 6, readOnly: 0 },
    ];
    const stmt = db.prepare(
      `INSERT INTO forum_categories (id, name, description, icon, color, sortOrder, readOnly) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of categories) stmt.run(c.id, c.name, c.description, c.icon, c.color, c.sortOrder, c.readOnly);
    console.log("[DB] Seeded 6 default forum categories");
  }

  seedPlatformConfig();
}

seedData();

export default db;
