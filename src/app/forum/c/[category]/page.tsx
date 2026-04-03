"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import { PixelAvatar } from "@/components/PixelAvatar";
import {
  ArrowLeft,
  PenSquare,
  Eye,
  MessageSquare,
  Clock,
  Lock,
  Pin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  readOnly: boolean;
}

interface Topic {
  id: number;
  title: string;
  pinned: boolean;
  locked: boolean;
  viewCount: number;
  replyCount: number;
  tags: string[];
  createdAt: string;
  authorName?: string;
}



export default function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categoryId } = use(params);
  const [category, setCategory] = useState<Category | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState<"latest" | "hot">("latest");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forum/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const cat = data.data.find((c: Category) => c.id === categoryId);
          if (cat) setCategory(cat);
        }
      });
  }, [categoryId]);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/forum/topics?category=${categoryId}&page=${page}&sort=${sort}&pageSize=20`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) {
          setTopics(data.data.topics);
          setTotalPages(data.data.totalPages);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, page, sort]);

  return (
    <main className="w-full py-8 space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/forum"
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3 h-3" />
            返回论坛
          </Link>
          <div className="flex items-center gap-3">
            {category && (
              <div
                className="w-2 h-8 rounded-full"
                style={{ background: category.color }}
              />
            )}
            <div>
              <h1 className="text-lg font-bold font-mono flex items-center gap-2">
                {category?.name || categoryId}
                {category?.readOnly && (
                  <span className="text-[10px] text-muted font-normal px-1.5 py-0.5 rounded bg-[var(--border-color)]">
                    官方板块 · 仅管理员可发帖
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted mt-0.5">
                {category?.description}
              </p>
            </div>
          </div>
        </div>
        <Link
          href={`/forum/new?category=${categoryId}`}
          className="btn-glass btn-glass-primary shrink-0"
        >
          <PenSquare className="w-4 h-4" />
          发帖
        </Link>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setLoading(true);
            setSort("latest");
            setPage(1);
          }}
          className={`nav-link ${sort === "latest" ? "nav-link-active" : ""}`}
        >
          最新
        </button>
        <button
          onClick={() => {
            setLoading(true);
            setSort("hot");
            setPage(1);
          }}
          className={`nav-link ${sort === "hot" ? "nav-link-active" : ""}`}
        >
          热门
        </button>
      </div>

      {/* Topics */}
      <div className="forum-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted text-sm font-mono animate-pulse">
            加载中...
          </div>
        ) : topics.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            暂无帖子
          </div>
        ) : (
          topics.map((topic) => (
            <Link
              key={topic.id}
              href={`/forum/t/${topic.id}`}
              className="forum-topic-row"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {topic.pinned && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                      <Pin className="w-2.5 h-2.5" />
                      置顶
                    </span>
                  )}
                  {topic.locked && <Lock className="w-3 h-3 text-muted" />}
                  <h3 className="text-sm font-medium">{topic.title}</h3>
                </div>
                 <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted font-mono">
                   <span className="inline-flex items-center gap-2">
                     <PixelAvatar
                       seed={topic.authorName || "anonymous"}
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
                        <span key={tag} className="forum-tag">{tag}</span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.max(1, p - 1));
            }}
            disabled={page === 1}
            className="btn-glass p-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-muted px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              setPage((p) => Math.min(totalPages, p + 1));
            }}
            disabled={page === totalPages}
            className="btn-glass p-2 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </main>
  );
}
