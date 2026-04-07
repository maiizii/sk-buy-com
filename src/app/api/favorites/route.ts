import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import db from "@/lib/db";
import { getSiteCatalogSiteByHostname } from "@/lib/site-catalog/db";

function ensureFavoritesTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_favorite_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      siteKey TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, siteKey),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_favorite_sites_user ON user_favorite_sites(userId, createdAt DESC);
  `);
}

ensureFavoritesTable();

export async function GET() {
  try {
    const user = await requireAuth();
    const rows = db
      .prepare(`SELECT siteKey FROM user_favorite_sites WHERE userId = ? ORDER BY datetime(createdAt) DESC`)
      .all(user.id) as Array<{ siteKey: string }>;

    return NextResponse.json({
      success: true,
      data: {
        favorites: rows.map((row) => row.siteKey),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const body = (await request.json().catch(() => ({}))) as { siteKey?: string; action?: "add" | "remove" | "toggle" };
    const siteKey = String(body.siteKey || "").trim();
    const action = body.action || "toggle";

    if (!siteKey) {
      return NextResponse.json({ success: false, error: "缺少 siteKey" }, { status: 400 });
    }

    const site = getSiteCatalogSiteByHostname(siteKey);
    if (!site) {
      return NextResponse.json({ success: false, error: "站点不存在" }, { status: 404 });
    }

    const existing = db
      .prepare(`SELECT id FROM user_favorite_sites WHERE userId = ? AND siteKey = ? LIMIT 1`)
      .get(user.id, site.normalizedHostname) as { id: number } | undefined;

    if (action === "remove") {
      if (existing) {
        db.prepare(`DELETE FROM user_favorite_sites WHERE id = ?`).run(existing.id);
      }
      return NextResponse.json({ success: true, data: { favorited: false } });
    }

    if (action === "add") {
      if (!existing) {
        db.prepare(`INSERT INTO user_favorite_sites (userId, siteKey) VALUES (?, ?)`).run(user.id, site.normalizedHostname);
      }
      return NextResponse.json({ success: true, data: { favorited: true } });
    }

    if (existing) {
      db.prepare(`DELETE FROM user_favorite_sites WHERE id = ?`).run(existing.id);
      return NextResponse.json({ success: true, data: { favorited: false } });
    }

    db.prepare(`INSERT INTO user_favorite_sites (userId, siteKey) VALUES (?, ?)`)
      .run(user.id, site.normalizedHostname);

    return NextResponse.json({ success: true, data: { favorited: true } });
  } catch {
    return NextResponse.json({ success: false, error: "请先登录再收藏网站" }, { status: 401 });
  }
}
