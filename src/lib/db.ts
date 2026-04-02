import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ============================================================
// Database Setup
// ============================================================
const DB_PATH = path.join(process.cwd(), "data", "sk-buy.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ============================================================
// Schema Creation
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    avatar TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
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
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
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

// Add columns to existing platforms table (safe if already exists)
try { db.exec(`ALTER TABLE platforms ADD COLUMN baseUrl TEXT DEFAULT ''`); } catch { /* column already exists */ }
try { db.exec(`ALTER TABLE platforms ADD COLUMN monitorEnabled INTEGER DEFAULT 0`); } catch { /* column already exists */ }

// Create indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_connectivity_logs_platform_time ON connectivity_logs(platformId, checkedAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_forum_topics_category ON forum_topics(categoryId, createdAt DESC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_forum_replies_topic ON forum_replies(topicId, createdAt ASC)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_platform_ratings_platform ON platform_ratings(platformId)`);


// ============================================================
// Password Hashing (using Node.js crypto.scrypt — zero deps)
// ============================================================
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

// ============================================================
// User Operations
// ============================================================
export interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
  avatar: string;
  createdAt: string;
}

interface UserRow extends User {
  passwordHash: string;
}

export function createUser(
  username: string,
  email: string,
  password: string,
  role: "user" | "admin" = "user"
): User {
  const passwordHash = hashPassword(password);
  const stmt = db.prepare(
    `INSERT INTO users (username, email, passwordHash, role) VALUES (?, ?, ?, ?)`
  );
  const result = stmt.run(username, email, passwordHash, role);
  return getUserById(result.lastInsertRowid as number)!;
}

export function getUserById(id: number): User | null {
  const row = db
    .prepare(
      `SELECT id, username, email, role, avatar, createdAt FROM users WHERE id = ?`
    )
    .get(id) as User | undefined;
  return row || null;
}

export function getUserByUsername(username: string): UserRow | null {
  const row = db
    .prepare(`SELECT * FROM users WHERE username = ?`)
    .get(username) as UserRow | undefined;
  return row || null;
}

export function getUserByEmail(email: string): UserRow | null {
  const row = db
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .get(email) as UserRow | undefined;
  return row || null;
}

export function getAllUsers(): User[] {
  return db
    .prepare(
      `SELECT id, username, email, role, avatar, createdAt FROM users ORDER BY createdAt DESC`
    )
    .all() as User[];
}

export function updateUserRole(id: number, role: "user" | "admin"): void {
  db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, id);
}

// ============================================================
// Session Operations
// ============================================================
export function createSession(userId: number): string {
  const token = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    `INSERT INTO sessions (userId, token, expiresAt) VALUES (?, ?, ?)`
  ).run(userId, token, expiresAt);
  return token;
}

export function getUserBySessionToken(token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.avatar, u.createdAt
       FROM sessions s
       JOIN users u ON s.userId = u.id
       WHERE s.token = ? AND s.expiresAt > datetime('now')`
    )
    .get(token) as User | undefined;
  return row || null;
}

export function deleteSession(token: string): void {
  db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function cleanExpiredSessions(): void {
  db.prepare(`DELETE FROM sessions WHERE expiresAt <= datetime('now')`).run();
}

// ============================================================
// Platform Operations
// ============================================================
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
  sortOrder: number;
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
  createdAt: string;
  updatedAt: string;
}

function rowToPlatform(row: PlatformRow): Platform {
  return {
    ...row,
    tag: row.tag as Platform["tag"],
    monitorEnabled: row.monitorEnabled === 1,
    models: JSON.parse(row.models || "[]"),
  };
}

export function getAllPlatforms(): Platform[] {
  const rows = db
    .prepare(`SELECT * FROM platforms ORDER BY sortOrder ASC, createdAt DESC`)
    .all() as PlatformRow[];
  return rows.map(rowToPlatform);
}

export function getPlatformById(id: string): Platform | null {
  const row = db
    .prepare(`SELECT * FROM platforms WHERE id = ?`)
    .get(id) as PlatformRow | undefined;
  return row ? rowToPlatform(row) : null;
}

export function createPlatform(
  data: Omit<Platform, "createdAt" | "updatedAt">
): Platform {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO platforms (id, name, url, baseUrl, monitorEnabled, tag, tagLabel, billingRate, billingColor, models, uptime, latency, joinDate, description, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    now,
    now
  );
  return getPlatformById(data.id)!;
}

export function updatePlatform(
  id: string,
  data: Partial<Omit<Platform, "id" | "createdAt" | "updatedAt">>
): Platform | null {
  const existing = getPlatformById(id);
  if (!existing) return null;

  const updated = { ...existing, ...data };
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE platforms SET
      name = ?, url = ?, baseUrl = ?, monitorEnabled = ?, tag = ?, tagLabel = ?, billingRate = ?, billingColor = ?,
      models = ?, uptime = ?, latency = ?, joinDate = ?, description = ?, sortOrder = ?, updatedAt = ?
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
    now,
    id
  );
  return getPlatformById(id);
}

export function deletePlatform(id: string): boolean {
  const result = db.prepare(`DELETE FROM platforms WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================================
// Connectivity Log Operations
// ============================================================
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

export function saveConnectivityLog(
  platformId: string,
  success: boolean,
  latency: number,
  errorMessage: string = ""
): void {
  db.prepare(
    `INSERT INTO connectivity_logs (platformId, success, latency, errorMessage, checkedAt)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(platformId, success ? 1 : 0, latency, errorMessage);
}

export function getLatestConnectivityLogs(
  platformId: string,
  limit: number = 60
): ConnectivityLog[] {
  const rows = db
    .prepare(
      `SELECT * FROM connectivity_logs WHERE platformId = ? ORDER BY checkedAt DESC LIMIT ?`
    )
    .all(platformId, limit) as ConnectivityLogRow[];
  return rows.map((r) => ({
    ...r,
    success: r.success === 1,
  }));
}

/**
 * Get hourly summarized connectivity data for the last 24 hours.
 * Returns one entry per hour: the latest check in each hour window.
 */
export function getHourlyConnectivityLogs(
  platformId: string
): ConnectivityLog[] {
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
  return rows.map((r) => ({
    ...r,
    success: r.success === 1,
  }));
}

export interface ConnectivitySummary {
  uptime: number;
  avgLatency: number;
  lastCheck: string | null;
  totalChecks: number;
}

export function getConnectivitySummary(
  platformId: string
): ConnectivitySummary {
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
    uptime:
      row.totalChecks > 0
        ? Math.round((row.successCount / row.totalChecks) * 1000) / 10
        : 0,
    avgLatency: Math.round(row.avgLatency || 0),
    lastCheck: row.lastCheck,
  };
}

export function getMonitorEnabledPlatforms(): Platform[] {
  const rows = db
    .prepare(`SELECT * FROM platforms WHERE monitorEnabled = 1 ORDER BY sortOrder ASC`)
    .all() as PlatformRow[];
  return rows.map(rowToPlatform);
}

/**
 * Clean up connectivity logs older than 3 days.
 */
export function cleanOldConnectivityLogs(): number {
  const result = db
    .prepare(`DELETE FROM connectivity_logs WHERE checkedAt < datetime('now', '-3 days')`)
    .run();
  return result.changes;
}

// ============================================================
// Seed Data — runs only if tables are empty
// ============================================================
function seedData() {
  const platformCount = (
    db.prepare(`SELECT COUNT(*) as count FROM platforms`).get() as {
      count: number;
    }
  ).count;

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
        sortOrder: 1,
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
        sortOrder: 2,
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
        sortOrder: 3,
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
        sortOrder: 4,
      },
    ];

    for (const p of seedPlatforms) {
      createPlatform(p);
    }
    console.log("[DB] Seeded 4 default platforms");
  }

  // Seed default admin user
  const userCount = (
    db.prepare(`SELECT COUNT(*) as count FROM users`).get() as {
      count: number;
    }
  ).count;

  if (userCount === 0) {
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    createUser(adminUsername, `${adminUsername}@sk-buy.com`, adminPassword, "admin");
    console.log(`[DB] Created default admin user: ${adminUsername}`);
  }

  // Seed default forum categories
  const categoryCount = (
    db.prepare(`SELECT COUNT(*) as count FROM forum_categories`).get() as {
      count: number;
    }
  ).count;

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
    for (const c of categories) {
      stmt.run(c.id, c.name, c.description, c.icon, c.color, c.sortOrder, c.readOnly);
    }
    console.log("[DB] Seeded 6 default forum categories");
  }
}

seedData();

export default db;
