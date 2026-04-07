"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SksUserSubmissionView } from "@/lib/sks/types";
import { formatCheckedAt, formatLatency, getStatusLabel, SksStatusPill } from "@/components/sks/SksUi";
import { emitFavoritesChanged } from "@/lib/favorites-client";

function statusToPillStatus(item: SksUserSubmissionView) {
  return item.submission.status === "approved"
    ? "ok"
    : item.submission.status === "failed"
      ? "failed"
      : "unknown";
}

function canRepairApprovedSubmission(item: SksUserSubmissionView) {
  return item.submission.status === "approved" && !item.site;
}

function SubmissionCard({
  item,
  expanded,
  busy,
  onToggle,
  onRetry,
  onDelete,
}: {
  item: SksUserSubmissionView;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onRetry: (item: SksUserSubmissionView) => void;
  onDelete: (item: SksUserSubmissionView) => void;
}) {
  const approved = item.submission.status === "approved";
  const failed = item.submission.status === "failed";
  const repairableApproved = canRepairApprovedSubmission(item);

  return (
    <article className="rounded-3xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={onToggle} className="flex-1 text-left">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {item.site?.displayName || item.submission.displayName || item.submission.hostname}
              </h3>
              <SksStatusPill status={statusToPillStatus(item)} />
              <span className="text-xs text-[var(--muted)]">{expanded ? "收起" : "展开"}</span>
            </div>
            <p className="break-all text-sm text-[var(--muted)]">{item.submission.apiBaseUrl}</p>
            <p className="text-xs text-[var(--muted)]">
              API SKY：{item.submission.apiKeyPreview} · 提交时间：{formatCheckedAt(item.submission.createdAt)}
            </p>
          </div>
        </button>

        <div className="flex flex-wrap gap-2">
          {approved && item.publicView ? (
            <Link
              href={`/sks/site/${encodeURIComponent(item.publicView.site.normalizedHostname || item.publicView.site.id)}`}
              className="btn-glass"
            >
              查看状态页
            </Link>
          ) : null}
          {item.site?.homepageUrl ? (
            <a href={item.site.homepageUrl} target="_blank" rel="noreferrer" className="btn-glass">
              访问站点
            </a>
          ) : null}
          {failed || repairableApproved ? (
            <button type="button" className="btn-glass" onClick={() => onRetry(item)} disabled={busy}>
              {repairableApproved ? "重新提交并恢复" : "重新提交"}
            </button>
          ) : null}
          {failed ? (
            <button
              type="button"
              className="btn-glass"
              onClick={() => onDelete(item)}
              disabled={busy}
            >
              删除
            </button>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-5">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 p-4 text-sm">
            <p className="font-medium text-[var(--foreground)]">处理结果</p>
            <p className="mt-2 text-[var(--muted)]">
              {item.submission.lastMessage ||
                (item.submission.status === "pending"
                  ? "已记录，等待系统检测。"
                  : repairableApproved
                    ? "该网站此前检测通过，但当前 SKS 站点记录已不存在，可重新提交以恢复收录。"
                    : item.submission.status === "approved"
                      ? "检测通过，已收录成功。"
                      : "检测失败。")}
            </p>
            {approved && item.publicView ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">当前状态</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">
                    {getStatusLabel(item.publicView.current.status)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">最近延迟</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">
                    {formatLatency(item.publicView.current.totalMs)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">7 天可用率</p>
                  <p className="mt-1 font-semibold text-[var(--foreground)]">
                    {item.publicView.stats7d.successRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {item.callOptions.length > 0 ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-base font-semibold text-[var(--foreground)]">调用方式</h4>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  你可以直接复制 iframe / JS / JSON 方式，把自己提交成功的网站接入到任意页面。
                </p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {item.callOptions.map((option) => (
                  <section
                    key={option.template}
                    className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{option.label}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{option.description}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border-color)] px-2 py-1 text-[11px] text-[var(--muted)]">
                        {option.template}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <a href={option.previewUrl} target="_blank" rel="noreferrer" className="btn-glass">
                        预览
                      </a>
                      <a href={option.jsonUrl} target="_blank" rel="noreferrer" className="btn-glass">
                        JSON
                      </a>
                      <Link href={option.statusPageUrl} className="btn-glass">
                        状态页
                      </Link>
                    </div>

                    {option.iframeSnippet ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">iframe</p>
                        <textarea
                          readOnly
                          value={option.iframeSnippet}
                          className="min-h-[90px] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-3 text-xs text-[var(--foreground)]"
                        />
                      </div>
                    ) : null}

                    {option.scriptSnippet ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">script</p>
                        <textarea
                          readOnly
                          value={option.scriptSnippet}
                          className="min-h-[120px] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-3 text-xs text-[var(--foreground)]"
                        />
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">json</p>
                      <textarea
                        readOnly
                        value={option.jsonSnippet}
                        className="min-h-[100px] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card)] p-3 text-xs text-[var(--foreground)]"
                      />
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function SksSubmitClient({
  initialItems,
  isLoggedIn,
}: {
  initialItems: SksUserSubmissionView[];
  isLoggedIn: boolean;
}) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(initialItems);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [busySubmissionId, setBusySubmissionId] = useState<string | null>(null);

  const approvedCount = useMemo(
    () => items.filter((item) => item.submission.status === "approved").length,
    [items]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoggedIn || loading) return;

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/sks/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiBaseUrl, apiKey, submissionId: editingSubmissionId }),
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: SksUserSubmissionView;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "提交失败");
      }

      setItems((current) => [payload.data!, ...current.filter((item) => item.submission.id !== payload.data!.submission.id)]);
      setExpandedId(payload.data.submission.id);
      setEditingSubmissionId(null);
      setApiBaseUrl("");
      setApiKey("");

      if (payload.data.submission.status === "approved") {
        const favoriteSiteKey = payload.data.publicView?.site.normalizedHostname || payload.data.site?.normalizedHostname;
        if (favoriteSiteKey) {
          try {
            const favoriteResponse = await fetch("/api/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ siteKey: favoriteSiteKey, action: "add" }),
            });
            const favoritePayload = (await favoriteResponse.json().catch(() => null)) as { success?: boolean } | null;
            if (favoriteResponse.ok && favoritePayload?.success) {
              emitFavoritesChanged();
            }
          } catch {
            // 忽略自动收藏失败，不影响提交流程
          }
        }
      }

      setMessage(payload.data.submission.lastMessage || (editingSubmissionId ? "重新提交成功" : "提交成功"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "提交失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(item: SksUserSubmissionView) {
    if (busySubmissionId) return;
    setBusySubmissionId(item.submission.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/sks/submissions?action=prefill&submissionId=${encodeURIComponent(item.submission.id)}`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { submissionId: string; apiBaseUrl: string; apiKey: string };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "获取失败记录失败");
      }

      setEditingSubmissionId(payload.data.submissionId);
      setApiBaseUrl(payload.data.apiBaseUrl);
      setApiKey(payload.data.apiKey);
      setExpandedId(item.submission.id);
      setMessage("已回填失败记录，请确认后重新提交");
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "获取失败记录失败");
    } finally {
      setBusySubmissionId(null);
    }
  }

  async function handleDelete(item: SksUserSubmissionView) {
    if (busySubmissionId) return;
    const confirmed = window.confirm(`确定删除 ${item.submission.hostname} 这条失败记录吗？`);
    if (!confirmed) return;

    setBusySubmissionId(item.submission.id);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/sks/submissions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: item.submission.id }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "删除失败");
      }

      setItems((current) => current.filter((entry) => entry.submission.id !== item.submission.id));
      setExpandedId((current) => (current === item.submission.id ? null : current));
      setEditingSubmissionId((current) => (current === item.submission.id ? null : current));
      setMessage("失败记录已删除");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setBusySubmissionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="shell-panel overflow-hidden bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--accent-soft)]/30">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--card-hover)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
              SKS 申请 · 站点提交收录
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                提交API中转站到SKS（SK Status）
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                只需要提交网址和 API SKY。系统会先拉取该站点最新模型列表，再按列表逐个进行模型检测；通过后即会收录入库，并为你生成多种调用方式。
              </p>
            </div>
            <ul className="space-y-2 text-sm text-[var(--muted)]">
              <li>• 同一用户不能重复提交同一网站。</li>
              <li>• 不同用户可以提交同一网站。</li>
              <li>• 失败记录支持回填参数后再次提交，也可以直接删除；若后台误删已收录站点，也可在这里重新恢复。</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--border-color)] bg-[var(--card)] p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">网址</label>
                <input
                  value={apiBaseUrl}
                  onChange={(event) => setApiBaseUrl(event.target.value)}
                  placeholder="https://example.com/v1"
                  className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] px-4 py-3 text-sm outline-none"
                  disabled={!isLoggedIn || loading}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">API SKY</label>
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] px-4 py-3 text-sm outline-none"
                  disabled={!isLoggedIn || loading}
                />
              </div>

              {editingSubmissionId ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                  正在编辑可重试记录，重新提交后会覆盖当前记录并重新检测。
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              ) : null}

              {isLoggedIn ? (
                <div className="flex gap-3">
                  <button type="submit" className="btn-glass btn-glass-primary flex-1 justify-center" disabled={loading}>
                    {loading ? "正在检测并提交..." : editingSubmissionId ? "重新提交到 SKS" : "提交到 SKS"}
                  </button>
                  {editingSubmissionId ? (
                    <button
                      type="button"
                      className="btn-glass"
                      onClick={() => {
                        setEditingSubmissionId(null);
                        setApiBaseUrl("");
                        setApiKey("");
                        setMessage(null);
                        setError(null);
                      }}
                      disabled={loading}
                    >
                      取消
                    </button>
                  ) : null}
                </div>
              ) : (
                <Link href="/" className="btn-glass w-full justify-center">
                  请先登录后再提交
                </Link>
              )}
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">我的申请</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">已收录</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{approvedCount}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--accent-soft)]/30 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">可调用模板</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {items.reduce((sum, item) => sum + item.callOptions.length, 0)}
          </p>
        </div>
      </section>

      <section className="shell-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">我的已申请网站</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              列表改为单条折叠展开，同一时间只展开一个网站；失败记录可直接回填重试，若后台误删已收录站点，也可在这里重新恢复。
            </p>
          </div>
        </div>
      </section>

      {items.length > 0 ? (
        <section className="space-y-5">
          {items.map((item) => (
            <SubmissionCard
              key={item.submission.id}
              item={item}
              expanded={expandedId === item.submission.id}
              busy={busySubmissionId === item.submission.id}
              onToggle={() => setExpandedId((current) => (current === item.submission.id ? null : item.submission.id))}
              onRetry={handleRetry}
              onDelete={handleDelete}
            />
          ))}
        </section>
      ) : (
        <section className="shell-panel">
          <p className="text-sm text-[var(--muted)]">你还没有申请过网站，提交成功后会在这里展示。</p>
        </section>
      )}
    </div>
  );
}
