"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import { PixelAvatar } from "@/components/PixelAvatar";
import {
  MessageCircle,
  Gift,
  BookOpen,
  Star,
  Flag,
  Sparkles,
  Eye,
  MessageSquare,
  Clock,
  TrendingUp,
  PenSquare,
  Lock,
} from "lucide-react";
import { getMessages } from "@/lib/i18n";

// ============================================================
// Types
// ============================================================
interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  readOnly: boolean;
  topicCount: number;
}

interface Topic {
  id: number;
  categoryId: string;
  authorId: number;
  title: string;
  pinned: boolean;
  locked: boolean;
  viewCount: number;
  replyCount: number;
  tags: string[];
  createdAt: string;
  authorName?: string;
  categoryName?: string;
}

// ============================================================
// Icon Map
// ============================================================
const ICON_MAP: Record<string, React.ElementType> = {
  Gift,
  BookOpen,
  Star,
  MessageCircle,
  Flag,
  Sparkles,
};

function CategoryIcon({ name, color }: { name: string; color: string }) {
  const Icon = ICON_MAP[name] || MessageCircle;
  return (
    <div
      className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
      style={{ background: `${color}15`, border: `1px solid ${color}30` }}
    >
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
  );
}



// ============================================================
// Page
// ============================================================
export default function ForumHome() {
  const t = getMessages();
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentTopics, setRecentTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/forum/categories").then((r) => r.json()),
      fetch("/api/forum/topics?pageSize=15&sort=latest").then((r) => r.json()),
    ])
      .then(([catData, topicData]) => {
        if (catData.success) setCategories(catData.data);
        if (topicData.success) setRecentTopics(topicData.data.topics);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="w-full py-12">
        <div className="text-center text-muted font-mono animate-pulse">{t.common.loading}</div>
      </main>
    );
  }

  return (
    <main className="w-full py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-mono">{t.forumPage.title}</h1>
          <p className="text-sm text-muted mt-1">
            {t.forumPage.subtitle}
          </p>
        </div>
        <Link href="/forum/new" className="btn-glass btn-glass-primary">
          <PenSquare className="w-4 h-4" />
          {t.forumPage.createTopic}
        </Link>
      </div>

      {/* Categories Grid */}
      <section>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          {t.forumPage.sections}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/forum/c/${cat.id}`}
              className="forum-category-card"
            >
              <CategoryIcon name={cat.icon} color={cat.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{cat.name}</h3>
                  {cat.readOnly && (
                    <span className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-[var(--border-color)]">
                      {t.forumPage.official}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 line-clamp-1">
                  {cat.description}
                </p>
                <p className="text-[10px] text-muted font-mono mt-1.5">
                  {cat.topicCount} {t.forumPage.topicCountSuffix}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Topics */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            {t.forumPage.latestTopics}
          </h2>
        </div>
        <div className="forum-card overflow-hidden">
          {recentTopics.length === 0 ? (
            <div className="py-16 text-center text-muted text-sm">
              {t.forumPage.noTopics}
            </div>
          ) : (
            recentTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/forum/t/${topic.id}`}
                className="forum-topic-row"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {topic.pinned && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                        {t.forumPage.pinned}
                      </span>
                    )}
                    {topic.locked && <Lock className="w-3 h-3 text-muted" />}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--border-color)] text-muted font-mono">
                      {topic.categoryName}
                    </span>
                    <h3 className="text-sm font-medium truncate">
                      {topic.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted font-mono">
                    <span className="inline-flex items-center gap-2">
                      <PixelAvatar
                        seed={topic.authorName || topic.authorId || "anonymous"}
                        alt={topic.authorName || "anonymous"}
                        size={20}
                        className="nav-avatar overflow-hidden"
                      />
                      <span>{topic.authorName}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(topic.createdAt)}
                    </span>
                    {topic.tags.length > 0 && (
                      <div className="flex gap-1">
                        {topic.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="forum-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted font-mono shrink-0">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {topic.viewCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {topic.replyCount}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
