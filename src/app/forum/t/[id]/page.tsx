"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { PixelAvatar } from "@/components/PixelAvatar";
import remarkGfm from "remark-gfm";
import { timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Eye,
  MessageSquare,
  Clock,
  Lock,
  Pin,
  Send,
  Trash2,
} from "lucide-react";

interface Topic {
  id: number;
  categoryId: string;
  authorId: number;
  title: string;
  content: string;
  pinned: boolean;
  locked: boolean;
  viewCount: number;
  replyCount: number;
  tags: string[];
  createdAt: string;
  authorName?: string;
  categoryName?: string;
}

interface Reply {
  id: number;
  topicId: number;
  authorId: number;
  content: string;
  createdAt: string;
  authorName?: string;
}

interface CurrentUser {
  id: number;
  username: string;
  role: "user" | "admin";
}



export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`/api/forum/topics/${id}`).then((r) => r.json()),
      fetch(`/api/forum/topics/${id}/replies`).then((r) => r.json()),
    ])
      .then(([topicData, replyData]) => {
        if (topicData.success) setTopic(topicData.data);
        if (replyData.success) setReplies(replyData.data.replies);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/forum/topics/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent }),
      });
      const data = await res.json();
      if (data.success) {
        setReplies((prev) => [...prev, data.data]);
        setReplyContent("");
        setTopic((prev) =>
          prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev
        );
      } else {
        setError(data.error);
      }
    } catch {
      setError("回复失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    if (!confirm("确定删除这条回复？")) return;
    try {
      const res = await fetch(`/api/forum/replies/${replyId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setReplies((prev) => prev.filter((r) => r.id !== replyId));
        setTopic((prev) =>
          prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev
        );
      }
    } catch {
      /* ignore */
    }
  };

  const handleDeleteTopic = async () => {
    if (!confirm("确定删除这个帖子？所有回复也将被删除。")) return;
    try {
      const res = await fetch(`/api/forum/topics/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        window.location.href = "/forum";
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <main className="w-full py-12">
        <div className="text-center text-muted font-mono animate-pulse">
          加载中...
        </div>
      </main>
    );
  }

  if (!topic) {
    return (
      <main className="w-full py-12">
        <div className="text-center text-muted">帖子不存在或已被删除</div>
        <div className="text-center mt-4">
          <Link href="/forum" className="btn-glass">
            返回论坛
          </Link>
        </div>
      </main>
    );
  }

  const canDelete =
    user && (user.id === topic.authorId || user.role === "admin");

  return (
    <main className="w-full py-8 space-y-6">
      {/* Back nav */}
      <Link
        href={`/forum/c/${topic.categoryId}`}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        返回 {topic.categoryName}
      </Link>

      {/* Topic Header */}
      <div className="forum-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {topic.pinned && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  <Pin className="w-2.5 h-2.5" />
                  置顶
                </span>
              )}
              {topic.locked && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <Lock className="w-2.5 h-2.5" />
                  已锁定
                </span>
              )}
              <Link
                href={`/forum/c/${topic.categoryId}`}
                className="forum-tag hover:text-[var(--accent)]"
              >
                {topic.categoryName}
              </Link>
              {topic.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/forum/tag/${tag}`}
                  className="forum-tag hover:text-[var(--accent)]"
                >
                  #{tag}
                </Link>
              ))}
            </div>
            <h1 className="text-xl font-bold">{topic.title}</h1>
          </div>
          {canDelete && (
            <button
              onClick={handleDeleteTopic}
              className="btn-glass p-2 hover:border-red-500/30 hover:text-red-400 shrink-0"
              title="删除帖子"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Author info */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--border-color)]">
          <PixelAvatar
            seed={topic.authorName || topic.authorId || "anonymous"}
            alt={topic.authorName || "anonymous"}
            size={30}
            className="nav-avatar overflow-hidden"
          />
          <div className="text-xs font-mono">
            <span className="font-semibold">{topic.authorName}</span>
            <span className="text-muted ml-2 inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(topic.createdAt)}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted font-mono">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {topic.viewCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {topic.replyCount}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="mt-6 markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {topic.content}
          </ReactMarkdown>
        </div>
      </div>

      {/* Replies */}
      <div>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          回复 ({topic.replyCount})
        </h2>

        {replies.length === 0 ? (
          <div className="forum-card p-8 text-center text-muted text-sm">
            暂无回复，来发表你的看法吧
          </div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply, idx) => (
              <div key={reply.id} className="forum-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <PixelAvatar
                      seed={reply.authorName || reply.authorId || "anonymous"}
                      alt={reply.authorName || "anonymous"}
                      size={20}
                      className="nav-avatar overflow-hidden"
                    />
                    <span className="font-semibold">{reply.authorName}</span>
                    <span className="text-muted">#{idx + 1}</span>
                    <span className="text-muted inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(reply.createdAt)}
                    </span>
                  </div>
                  {user &&
                    (user.id === reply.authorId || user.role === "admin") && (
                      <button
                        onClick={() => handleDeleteReply(reply.id)}
                        className="p-1 rounded text-muted hover:text-red-400 transition-colors"
                        title="删除回复"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                </div>
                <div className="markdown-content text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {reply.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply Form */}
      {topic.locked ? (
        <div className="forum-card p-4 text-center text-muted text-sm flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          帖子已锁定，无法回复
        </div>
      ) : user ? (
        <form onSubmit={handleReply} className="forum-card p-4 space-y-3">
          <label className="text-xs font-semibold text-muted font-mono">
            发表回复
          </label>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="admin-input min-h-[100px] resize-y"
            placeholder="支持 Markdown 格式..."
            required
          />
          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !replyContent.trim()}
              className="btn-glass btn-glass-primary disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? "提交中..." : "发表回复"}
            </button>
          </div>
        </form>
      ) : (
        <div className="forum-card p-4 text-center text-muted text-sm">
          请先{" "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            登录
          </Link>{" "}
          后再回复
        </div>
      )}
    </main>
  );
}
