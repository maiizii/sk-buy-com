import db from "./db";
import type { User } from "./db";

// ============================================================
// Forum Category Types & Operations
// ============================================================
export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  readOnly: boolean;
  topicCount: number;
}

interface ForumCategoryRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  readOnly: number;
  topicCount: number;
}

function rowToCategory(row: ForumCategoryRow): ForumCategory {
  return { ...row, readOnly: row.readOnly === 1 };
}

export function getAllCategories(): ForumCategory[] {
  const rows = db
    .prepare(`SELECT * FROM forum_categories ORDER BY sortOrder ASC`)
    .all() as ForumCategoryRow[];
  return rows.map(rowToCategory);
}

export function getCategoryById(id: string): ForumCategory | null {
  const row = db
    .prepare(`SELECT * FROM forum_categories WHERE id = ?`)
    .get(id) as ForumCategoryRow | undefined;
  return row ? rowToCategory(row) : null;
}

export function createCategory(data: {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  readOnly?: boolean;
}): ForumCategory {
  db.prepare(
    `INSERT INTO forum_categories (id, name, description, icon, color, sortOrder, readOnly)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.id,
    data.name,
    data.description || "",
    data.icon || "",
    data.color || "",
    data.sortOrder || 0,
    data.readOnly ? 1 : 0
  );
  return getCategoryById(data.id)!;
}

export function updateCategory(
  id: string,
  data: Partial<Omit<ForumCategory, "id" | "topicCount">>
): ForumCategory | null {
  const existing = getCategoryById(id);
  if (!existing) return null;
  const updated = { ...existing, ...data };
  db.prepare(
    `UPDATE forum_categories SET name = ?, description = ?, icon = ?, color = ?, sortOrder = ?, readOnly = ? WHERE id = ?`
  ).run(
    updated.name,
    updated.description,
    updated.icon,
    updated.color,
    updated.sortOrder,
    updated.readOnly ? 1 : 0,
    id
  );
  return getCategoryById(id);
}

export function deleteCategory(id: string): boolean {
  const result = db.prepare(`DELETE FROM forum_categories WHERE id = ?`).run(id);
  return result.changes > 0;
}

// ============================================================
// Forum Topic Types & Operations
// ============================================================
export interface ForumTopic {
  id: number;
  categoryId: string;
  authorId: number;
  title: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  viewCount: number;
  replyCount: number;
  lastReplyAt: string | null;
  lastReplyBy: number | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Joined fields
  authorName?: string;
  categoryName?: string;
}

interface ForumTopicRow {
  id: number;
  categoryId: string;
  authorId: number;
  title: string;
  content: string;
  pinned: number;
  locked: number;
  viewCount: number;
  replyCount: number;
  lastReplyAt: string | null;
  lastReplyBy: number | null;
  tags: string;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
  categoryName?: string;
}

function rowToTopic(row: ForumTopicRow): ForumTopic {
  return {
    ...row,
    pinned: row.pinned === 1,
    locked: row.locked === 1,
    tags: JSON.parse(row.tags || "[]"),
  };
}

export interface TopicListOptions {
  categoryId?: string;
  tag?: string;
  authorId?: number;
  page?: number;
  pageSize?: number;
  sort?: "latest" | "hot" | "oldest";
}

export interface TopicListResult {
  topics: ForumTopic[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function getTopics(options: TopicListOptions = {}): TopicListResult {
  const {
    categoryId,
    tag,
    authorId,
    page = 1,
    pageSize = 20,
    sort = "latest",
  } = options;

  let where = "WHERE 1=1";
  const params: unknown[] = [];

  if (categoryId) {
    where += " AND t.categoryId = ?";
    params.push(categoryId);
  }
  if (tag) {
    where += " AND t.tags LIKE ?";
    params.push(`%"${tag}"%`);
  }
  if (authorId) {
    where += " AND t.authorId = ?";
    params.push(authorId);
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM forum_topics t ${where}`)
    .get(...params) as { count: number };
  const total = countRow.count;

  let orderBy = "t.pinned DESC, t.createdAt DESC";
  if (sort === "hot") orderBy = "t.pinned DESC, t.replyCount DESC, t.viewCount DESC";
  if (sort === "oldest") orderBy = "t.pinned DESC, t.createdAt ASC";

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT t.*, u.username as authorName, c.name as categoryName
       FROM forum_topics t
       LEFT JOIN users u ON t.authorId = u.id
       LEFT JOIN forum_categories c ON t.categoryId = c.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as ForumTopicRow[];

  return {
    topics: rows.map(rowToTopic),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export function getTopicById(id: number): ForumTopic | null {
  const row = db
    .prepare(
      `SELECT t.*, u.username as authorName, c.name as categoryName
       FROM forum_topics t
       LEFT JOIN users u ON t.authorId = u.id
       LEFT JOIN forum_categories c ON t.categoryId = c.id
       WHERE t.id = ?`
    )
    .get(id) as ForumTopicRow | undefined;
  return row ? rowToTopic(row) : null;
}

export function createTopic(data: {
  categoryId: string;
  authorId: number;
  title: string;
  content: string;
  tags?: string[];
}): ForumTopic {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO forum_topics (categoryId, authorId, title, content, tags, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.categoryId,
      data.authorId,
      data.title,
      data.content,
      JSON.stringify(data.tags || []),
      now,
      now
    );

  // Update category topic count
  db.prepare(
    `UPDATE forum_categories SET topicCount = topicCount + 1 WHERE id = ?`
  ).run(data.categoryId);

  return getTopicById(result.lastInsertRowid as number)!;
}

export function updateTopic(
  id: number,
  data: Partial<Pick<ForumTopic, "title" | "content" | "tags" | "pinned" | "locked">>
): ForumTopic | null {
  const existing = getTopicById(id);
  if (!existing) return null;

  const updated = { ...existing, ...data };
  db.prepare(
    `UPDATE forum_topics SET title = ?, content = ?, tags = ?, pinned = ?, locked = ?, updatedAt = datetime('now') WHERE id = ?`
  ).run(
    updated.title,
    updated.content,
    JSON.stringify(updated.tags),
    updated.pinned ? 1 : 0,
    updated.locked ? 1 : 0,
    id
  );
  return getTopicById(id);
}

export function deleteTopic(id: number): boolean {
  const topic = getTopicById(id);
  if (!topic) return false;

  const result = db.prepare(`DELETE FROM forum_topics WHERE id = ?`).run(id);
  if (result.changes > 0) {
    db.prepare(
      `UPDATE forum_categories SET topicCount = MAX(0, topicCount - 1) WHERE id = ?`
    ).run(topic.categoryId);
  }
  return result.changes > 0;
}

export function incrementTopicViewCount(id: number): void {
  db.prepare(`UPDATE forum_topics SET viewCount = viewCount + 1 WHERE id = ?`).run(id);
}

// ============================================================
// Forum Reply Types & Operations
// ============================================================
export interface ForumReply {
  id: number;
  topicId: number;
  authorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
}

interface ForumReplyRow {
  id: number;
  topicId: number;
  authorId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
}

export function getReplies(
  topicId: number,
  page: number = 1,
  pageSize: number = 50
): { replies: ForumReply[]; total: number; totalPages: number } {
  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM forum_replies WHERE topicId = ?`)
    .get(topicId) as { count: number };

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT r.*, u.username as authorName
       FROM forum_replies r
       LEFT JOIN users u ON r.authorId = u.id
       WHERE r.topicId = ?
       ORDER BY r.createdAt ASC
       LIMIT ? OFFSET ?`
    )
    .all(topicId, pageSize, offset) as ForumReplyRow[];

  return {
    replies: rows,
    total: countRow.count,
    totalPages: Math.ceil(countRow.count / pageSize),
  };
}

export function createReply(data: {
  topicId: number;
  authorId: number;
  content: string;
}): ForumReply {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO forum_replies (topicId, authorId, content, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(data.topicId, data.authorId, data.content, now, now);

  // Update topic reply count and last reply info
  db.prepare(
    `UPDATE forum_topics SET replyCount = replyCount + 1, lastReplyAt = ?, lastReplyBy = ?, updatedAt = ? WHERE id = ?`
  ).run(now, data.authorId, now, data.topicId);

  const row = db
    .prepare(
      `SELECT r.*, u.username as authorName FROM forum_replies r LEFT JOIN users u ON r.authorId = u.id WHERE r.id = ?`
    )
    .get(result.lastInsertRowid) as ForumReplyRow;
  return row;
}

export function deleteReply(id: number): boolean {
  const reply = db.prepare(`SELECT * FROM forum_replies WHERE id = ?`).get(id) as ForumReplyRow | undefined;
  if (!reply) return false;

  const result = db.prepare(`DELETE FROM forum_replies WHERE id = ?`).run(id);
  if (result.changes > 0) {
    db.prepare(
      `UPDATE forum_topics SET replyCount = MAX(0, replyCount - 1) WHERE id = ?`
    ).run(reply.topicId);
  }
  return result.changes > 0;
}

// ============================================================
// Platform Rating Types & Operations
// ============================================================
export interface PlatformRating {
  id: number;
  platformId: string;
  userId: number;
  score: number;
  comment: string;
  createdAt: string;
  username?: string;
}

export interface RatingSummary {
  avgScore: number;
  totalRatings: number;
  distribution: Record<number, number>;
}

export function getRatingsByPlatform(platformId: string): PlatformRating[] {
  return db
    .prepare(
      `SELECT r.*, u.username FROM platform_ratings r LEFT JOIN users u ON r.userId = u.id
       WHERE r.platformId = ? ORDER BY r.createdAt DESC`
    )
    .all(platformId) as PlatformRating[];
}

export function getRatingSummary(platformId: string): RatingSummary {
  const row = db
    .prepare(
      `SELECT AVG(score) as avgScore, COUNT(*) as totalRatings FROM platform_ratings WHERE platformId = ?`
    )
    .get(platformId) as { avgScore: number | null; totalRatings: number };

  const dist = db
    .prepare(
      `SELECT score, COUNT(*) as count FROM platform_ratings WHERE platformId = ? GROUP BY score`
    )
    .all(platformId) as { score: number; count: number }[];

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of dist) distribution[d.score] = d.count;

  return {
    avgScore: Math.round((row.avgScore || 0) * 10) / 10,
    totalRatings: row.totalRatings,
    distribution,
  };
}

export function getAllRatingSummaries(): Record<string, RatingSummary> {
  const rows = db
    .prepare(
      `SELECT platformId, AVG(score) as avgScore, COUNT(*) as totalRatings
       FROM platform_ratings GROUP BY platformId`
    )
    .all() as { platformId: string; avgScore: number; totalRatings: number }[];

  const result: Record<string, RatingSummary> = {};
  for (const row of rows) {
    result[row.platformId] = {
      avgScore: Math.round(row.avgScore * 10) / 10,
      totalRatings: row.totalRatings,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
  return result;
}

export function upsertRating(data: {
  platformId: string;
  userId: number;
  score: number;
  comment?: string;
}): PlatformRating {
  db.prepare(
    `INSERT INTO platform_ratings (platformId, userId, score, comment)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(platformId, userId)
     DO UPDATE SET score = excluded.score, comment = excluded.comment, createdAt = datetime('now')`
  ).run(data.platformId, data.userId, data.score, data.comment || "");

  return db
    .prepare(
      `SELECT r.*, u.username FROM platform_ratings r LEFT JOIN users u ON r.userId = u.id
       WHERE r.platformId = ? AND r.userId = ?`
    )
    .get(data.platformId, data.userId) as PlatformRating;
}

export type { User };
