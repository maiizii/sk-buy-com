"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Eye,
  MessageSquare,
  Clock,
  Lock,
  Pin,
  PenSquare,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
  categoryName?: string;
}

interface Platform {
  id: string;
  name: string;
  url: string;
  tag: string;
  tagLabel: string;
}

interface RatingSummary {
  avgScore: number;
  totalRatings: number;
}



function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-4 h-4 ${
            s <= Math.round(score)
              ? "text-yellow-400 fill-yellow-400"
              : "text-gray-500"
          }`}
        />
      ))}
    </div>
  );
}

export default function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = use(params);
  const decodedTag = decodeURIComponent(tag);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [ratingSum, setRatingSum] = useState<RatingSummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Check if this tag is a platform ID
  useEffect(() => {
    fetch("/api/platforms")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const p = data.data.find((pl: Platform) => pl.id === decodedTag);
          if (p) setPlatform(p);
        }
      });

    fetch(`/api/platform-ratings?platformId=${decodedTag}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data.summary) {
          setRatingSum(data.data.summary);
        }
      })
      .catch(() => {});
  }, [decodedTag]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/forum/topics?tag=${decodedTag}&page=${page}&pageSize=20`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setTopics(data.data.topics);
          setTotalPages(data.data.totalPages);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [decodedTag, page]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        href="/forum"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        返回论坛
      </Link>

      {/* Platform Card (if tag is a platform) */}
      {platform && (
        <div className="forum-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold font-mono">
                  {platform.name}
                </h1>
                <span className={`badge badge-${platform.tag}`}>
                  {platform.tagLabel}
                </span>
              </div>
              <p className="text-xs text-muted font-mono mt-1">
                {platform.url}
              </p>
            </div>
            {ratingSum && ratingSum.totalRatings > 0 && (
              <div className="text-right">
                <StarRating score={ratingSum.avgScore} />
                <p className="text-[10px] text-muted font-mono mt-1">
                  {ratingSum.avgScore} 分 · {ratingSum.totalRatings} 人评价
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span className="forum-tag text-sm">#{decodedTag}</span>
          相关帖子
        </h2>
        <Link
          href={`/forum/new?tag=${decodedTag}${platform ? "&category=reviews" : ""}`}
          className="btn-glass btn-glass-primary"
        >
          <PenSquare className="w-4 h-4" />
          发布点评
        </Link>
      </div>

      {/* Topics */}
      <div className="forum-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted text-sm font-mono animate-pulse">
            加载中...
          </div>
        ) : topics.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            暂无关于 #{decodedTag} 的帖子，来发表第一个点评吧！
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
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--border-color)] text-muted font-mono">
                    {topic.categoryName}
                  </span>
                  <h3 className="text-sm font-medium">{topic.title}</h3>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted font-mono">
                  <span>{topic.authorName}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(topic.createdAt)}
                  </span>
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-glass p-2 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-muted px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
