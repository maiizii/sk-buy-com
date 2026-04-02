"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Tag } from "lucide-react";

interface Category {
  id: string;
  name: string;
  readOnly: boolean;
}

function NewTopicForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCategory = searchParams.get("category") || "";
  const defaultTag = searchParams.get("tag") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(defaultCategory);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState(defaultTag);
  const [tags, setTags] = useState<string[]>(defaultTag ? [defaultTag] : []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: number; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/forum/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCategories(data.data);
      });
  }, []);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      setTagInput("");
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          title: title.trim(),
          content: content.trim(),
          tags,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/forum/t/${data.data.id}`);
      } else {
        setError(data.error);
      }
    } catch {
      setError("发帖失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <main className="w-full py-12">
        <div className="forum-card p-8 text-center">
          <p className="text-muted mb-4">请先登录后发帖</p>
          <Link href="/" className="btn-glass btn-glass-primary">
            返回首页登录
          </Link>
        </div>
      </main>
    );
  }

  // Filter categories: if user is not admin, exclude readOnly categories
  const availableCategories =
    user.role === "admin"
      ? categories
      : categories.filter((c) => !c.readOnly);

  return (
    <main className="w-full py-8 space-y-6">
      <Link
        href="/forum"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        返回论坛
      </Link>

      <h1 className="text-lg font-bold font-mono">发布新帖</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <div>
          <label className="admin-label">选择板块 *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="admin-input"
            required
          >
            <option value="">请选择板块</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.readOnly ? " (官方)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="admin-label">标题 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="admin-input"
            placeholder="帖子标题"
            maxLength={200}
            required
          />
        </div>

        {/* Content */}
        <div>
          <label className="admin-label">内容 * （支持 Markdown）</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="admin-input min-h-[240px] resize-y"
            placeholder="帖子内容，支持 Markdown 格式..."
            required
          />
        </div>

        {/* Tags */}
        <div>
          <label className="admin-label">标签（可选）</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              className="admin-input flex-1"
              placeholder="输入标签后按回车添加"
            />
            <button type="button" onClick={addTag} className="btn-glass">
              <Tag className="w-3.5 h-3.5" />
              添加
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="forum-tag cursor-pointer group"
                  onClick={() => removeTag(t)}
                >
                  #{t}
                  <span className="ml-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    ×
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/forum" className="btn-glass">
            取消
          </Link>
          <button
            type="submit"
            disabled={submitting || !categoryId || !title.trim() || !content.trim()}
            className="btn-glass btn-glass-primary disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitting ? "发布中..." : "发布帖子"}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function NewTopicPage() {
  return (
    <Suspense
      fallback={
        <main className="w-full py-12 text-center text-muted font-mono animate-pulse">
          加载中...
        </main>
      }
    >
      <NewTopicForm />
    </Suspense>
  );
}
