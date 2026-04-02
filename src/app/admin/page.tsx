"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Shield,
  Loader2,
  Radio,
  Zap,
  MessageCircle,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
interface User {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
}

interface Platform {
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
}

const TAG_OPTIONS = [
  { value: "premium", label: "高品质站", color: "badge-premium" },
  { value: "free", label: "白嫖公益站", color: "badge-free" },
  { value: "stable", label: "稳定可靠", color: "badge-stable" },
  { value: "dead", label: "疑似跑路", color: "badge-dead" },
];

const BILLING_COLOR_OPTIONS = [
  { value: "text-foreground", label: "默认" },
  { value: "text-emerald-400", label: "绿色" },
  { value: "text-blue-400", label: "蓝色" },
  { value: "text-red-400", label: "红色" },
  { value: "text-red-400 line-through", label: "红色删除线" },
];

// ============================================================
// Empty Platform Template
// ============================================================
function emptyPlatform(): Omit<Platform, ""> {
  return {
    id: "",
    name: "",
    url: "",
    baseUrl: "",
    monitorEnabled: false,
    tag: "stable",
    tagLabel: "稳定可靠",
    billingRate: "1.0x",
    billingColor: "text-foreground",
    models: [],
    uptime: 0,
    latency: 0,
    joinDate: new Date().toISOString().split("T")[0],
    description: "",
    sortOrder: 0,
  };
}

// ============================================================
// Login Form Component
// ============================================================
function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.data);
      } else {
        setError(data.error);
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="admin-card p-8">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/20">
              <Shield className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-mono">sk-buy 管理后台</h1>
              <p className="text-xs text-muted">管理员登录</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="admin-label">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-input"
                placeholder="请输入用户名"
                required
              />
            </div>
            <div>
              <label className="admin-label">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                placeholder="请输入密码"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-glass btn-glass-primary py-3 justify-center text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "登 录"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-xs text-muted hover:text-[var(--accent)] transition-colors"
            >
              ← 返回首页
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Platform Form Component
// ============================================================
function PlatformForm({
  platform,
  isNew,
  onSave,
  onCancel,
}: {
  platform: Platform;
  isNew: boolean;
  onSave: (data: Platform) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Platform>({ ...platform });
  const [modelsText, setModelsText] = useState(platform.models.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (key: keyof Platform, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTagChange = (tag: string) => {
    const option = TAG_OPTIONS.find((t) => t.value === tag);
    update("tag", tag);
    if (option) update("tagLabel", option.label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const models = modelsText
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      await onSave({ ...form, models });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="admin-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold font-mono">
            {isNew ? "新建平台" : `编辑: ${platform.name}`}
          </h2>
          <button
            onClick={onCancel}
            className="btn-glass p-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label">平台 ID *</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => update("id", e.target.value)}
                className="admin-input"
                placeholder="唯一标识，如 my-platform"
                disabled={!isNew}
                required
              />
            </div>
            <div>
              <label className="admin-label">平台名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className="admin-input"
                placeholder="如 OpenRouter Pro"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label">网站域名 *</label>
              <input
                type="text"
                value={form.url}
                onChange={(e) => update("url", e.target.value)}
                className="admin-input"
                placeholder="如 openrouter.ai"
                required
              />
            </div>
            <div>
              <label className="admin-label">加入时间</label>
              <input
                type="date"
                value={form.joinDate}
                onChange={(e) => update("joinDate", e.target.value)}
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="admin-label">API Base URL</label>
              <input
                type="text"
                value={form.baseUrl}
                onChange={(e) => update("baseUrl", e.target.value)}
                className="admin-input"
                placeholder="如 https://api.openrouter.ai/v1"
              />
              <p className="text-xs text-muted mt-1">用于连通性检测的 API 地址，需包含协议前缀</p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-1">
            <button
              type="button"
              onClick={() => update("monitorEnabled", !form.monitorEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.monitorEnabled
                  ? "bg-emerald-500"
                  : "bg-[var(--border-color)]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  form.monitorEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <div>
              <label className="admin-label mb-0">启用连通监控</label>
              <p className="text-xs text-muted">开启后系统将每 5 分钟自动检测接口连通性</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="admin-label">分类标签 *</label>
              <select
                value={form.tag}
                onChange={(e) => handleTagChange(e.target.value)}
                className="admin-input"
              >
                {TAG_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="admin-label">标签文字</label>
              <input
                type="text"
                value={form.tagLabel}
                onChange={(e) => update("tagLabel", e.target.value)}
                className="admin-input"
              />
            </div>
            <div>
              <label className="admin-label">排序权重</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => update("sortOrder", Number(e.target.value))}
                className="admin-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label">计费倍率 *</label>
              <input
                type="text"
                value={form.billingRate}
                onChange={(e) => update("billingRate", e.target.value)}
                className="admin-input"
                placeholder="如 1.0x 或 FREE"
                required
              />
            </div>
            <div>
              <label className="admin-label">倍率颜色</label>
              <select
                value={form.billingColor}
                onChange={(e) => update("billingColor", e.target.value)}
                className="admin-input"
              >
                {BILLING_COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="admin-label">连通率 (%)</label>
              <input
                type="number"
                value={form.uptime}
                onChange={(e) => update("uptime", Number(e.target.value))}
                className="admin-input"
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div>
              <label className="admin-label">延迟 (ms)</label>
              <input
                type="number"
                value={form.latency}
                onChange={(e) => update("latency", Number(e.target.value))}
                className="admin-input"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="admin-label">
              主打模型（逗号分隔）
            </label>
            <input
              type="text"
              value={modelsText}
              onChange={(e) => setModelsText(e.target.value)}
              className="admin-input"
              placeholder="如 GPT-4o, Claude 3.5 Sonnet"
            />
          </div>

          <div>
            <label className="admin-label">描述</label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              className="admin-input min-h-[80px] resize-y"
              placeholder="简要描述该平台的特点"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
            <button type="button" onClick={onCancel} className="btn-glass px-4 py-2">
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-glass btn-glass-primary px-4 py-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {isNew ? "创建" : "保存"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// Delete Confirmation Dialog
// ============================================================
function DeleteDialog({
  platform,
  onConfirm,
  onCancel,
}: {
  platform: Platform;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="admin-card w-full max-w-md p-6">
        <h2 className="text-lg font-bold mb-2">确认删除</h2>
        <p className="text-sm text-muted mb-6">
          确定要删除平台 <strong className="text-foreground">{platform.name}</strong>{" "}
          吗？此操作不可撤销。
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-glass px-4 py-2">
            取消
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-glass px-4 py-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                删除
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Admin Page Main Component
// ============================================================
export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [deletingPlatform, setDeletingPlatform] = useState<Platform | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; description: string; icon: string; color: string; sortOrder: number; readOnly: boolean; topicCount: number }[]>([]);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string; description: string; icon: string; color: string; sortOrder: number; readOnly: boolean } | null>(null);
  const [newCategory, setNewCategory] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPlatforms = useCallback(async () => {
    const res = await fetch("/api/platforms");
    const data = await res.json();
    if (data.success) setPlatforms(data.data);
  }, []);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/forum/categories");
    const data = await res.json();
    if (data.success) setCategories(data.data);
  }, []);

  // Check authentication on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data.role === "admin") {
          setUser(data.data);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // Load platforms when authenticated
  useEffect(() => {
    if (user) {
      loadPlatforms();
      loadCategories();
    }
  }, [user, loadPlatforms, loadCategories]);

  const handleLogin = (u: User) => {
    if (u.role !== "admin") {
      showToast("您没有管理员权限", "error");
      return;
    }
    setUser(u);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const handleCreate = async (data: Platform) => {
    const res = await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    setShowForm(false);
    await loadPlatforms();
    showToast(`平台 "${data.name}" 创建成功`);
  };

  const handleUpdate = async (data: Platform) => {
    const res = await fetch(`/api/platforms/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error);
    setEditingPlatform(null);
    await loadPlatforms();
    showToast(`平台 "${data.name}" 更新成功`);
  };

  const handleDelete = async () => {
    if (!deletingPlatform) return;
    const res = await fetch(`/api/platforms/${deletingPlatform.id}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (!result.success) {
      showToast(result.error, "error");
      return;
    }
    setDeletingPlatform(null);
    await loadPlatforms();
    showToast(`平台 "${deletingPlatform.name}" 已删除`);
  };

  // Loading state
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  // Not authenticated — show login
  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  // Admin dashboard
  return (
    <div className="relative z-10 space-y-6 py-8">
      <section className="shell-panel">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
              Admin workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">管理后台</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              已登录管理员：{user.username}，可在此管理平台与论坛板块。
            </p>
          </div>
          <button onClick={handleLogout} className="btn-glass">
            退出登录
          </button>
        </div>
      </section>

      <main className="space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="admin-stat-card">
            <span className="text-xs text-muted">总平台数</span>
            <span className="text-2xl font-bold font-mono">{platforms.length}</span>
          </div>
          <div className="admin-stat-card">
            <span className="text-xs text-muted">正常运行</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">
              {platforms.filter((p) => p.tag !== "dead").length}
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="text-xs text-muted">免费站点</span>
            <span className="text-2xl font-bold font-mono text-blue-400">
              {platforms.filter((p) => p.tag === "free").length}
            </span>
          </div>
          <div className="admin-stat-card">
            <span className="text-xs text-muted">已下线</span>
            <span className="text-2xl font-bold font-mono text-red-400">
              {platforms.filter((p) => p.tag === "dead").length}
            </span>
          </div>
        </div>

        {/* Platform Management Table */}
        <div className="admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="text-sm font-semibold">平台管理</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  showToast("正在执行连通性检查...");
                  try {
                    const res = await fetch("/api/connectivity/check", { method: "POST" });
                    const data = await res.json();
                    if (data.success) {
                      showToast("连通性检查完成");
                      await loadPlatforms();
                    } else {
                      showToast(data.error || "检查失败", "error");
                    }
                  } catch {
                    showToast("检查请求失败", "error");
                  }
                }}
                className="btn-glass"
              >
                <Zap className="w-4 h-4" />
                手动检测
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="btn-glass btn-glass-primary"
              >
                <Plus className="w-4 h-4" />
                新建平台
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase">排序</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">平台</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">分类</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">倍率</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">监控</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">连通率</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">延迟</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">模型数</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {platforms.map((p) => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="px-6 py-3">
                      <span className="text-xs font-mono text-muted">{p.sortOrder}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold font-mono text-sm">{p.name}</div>
                      <div className="text-xs text-muted font-mono">{p.url}</div>
                      {p.baseUrl && (
                        <div className="text-xs text-muted/60 font-mono truncate max-w-[200px]" title={p.baseUrl}>
                          {p.baseUrl}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge badge-${p.tag}`}>{p.tagLabel}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm font-bold ${p.billingColor}`}>
                        {p.billingRate}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.monitorEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
                          <Radio className="w-3 h-3" />
                          运行中
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--border-color)] text-muted text-xs font-mono">
                          关闭
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{p.uptime}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{p.latency}ms</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{p.models.length}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingPlatform(p)}
                          className="btn-glass p-2"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingPlatform(p)}
                          className="btn-glass p-2 hover:border-red-500/30 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {platforms.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-muted text-sm">
                      暂无平台数据，点击「新建平台」添加
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Forum Category Management */}
        <div className="admin-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              论坛板块管理
            </h2>
            <button
              onClick={() => {
                setNewCategory(true);
                setEditingCategory({ id: "", name: "", description: "", icon: "MessageCircle", color: "#8b5cf6", sortOrder: categories.length + 1, readOnly: false });
              }}
              className="btn-glass btn-glass-primary"
            >
              <Plus className="w-4 h-4" />
              新建板块
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-muted uppercase">排序</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">名称</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">描述</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">颜色</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">类型</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted uppercase">帖子数</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-muted uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {categories.map((c) => (
                  <tr key={c.id} className="table-row-hover">
                    <td className="px-6 py-3"><span className="text-xs font-mono text-muted">{c.sortOrder}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono">{c.id}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-5 rounded-full" style={{ background: c.color }} />
                        <span className="font-semibold text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-muted max-w-[200px] truncate block">{c.description}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded" style={{ background: c.color }} />
                        <span className="text-xs font-mono text-muted">{c.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.readOnly ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">官方只读</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--border-color)] text-muted">开放</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className="font-mono text-sm">{c.topicCount}</span></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setEditingCategory({ ...c }); setNewCategory(false); }}
                          className="btn-glass p-2"
                          title="编辑"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`确定删除板块「${c.name}」？板块下的帖子不会被删除。`)) return;
                            const res = await fetch("/api/forum/categories", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
                            const data = await res.json();
                            if (data.success) { await loadCategories(); showToast(`板块「${c.name}」已删除`); }
                            else showToast(data.error, "error");
                          }}
                          className="btn-glass p-2 hover:border-red-500/30 hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showForm && (
        <PlatformForm
          platform={emptyPlatform()}
          isNew={true}
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingPlatform && (
        <PlatformForm
          platform={editingPlatform}
          isNew={false}
          onSave={handleUpdate}
          onCancel={() => setEditingPlatform(null)}
        />
      )}

      {deletingPlatform && (
        <DeleteDialog
          platform={deletingPlatform}
          onConfirm={handleDelete}
          onCancel={() => setDeletingPlatform(null)}
        />
      )}

      {/* Category Edit Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="admin-card w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold font-mono">{newCategory ? "新建板块" : `编辑: ${editingCategory.name}`}</h2>
              <button onClick={() => setEditingCategory(null)} className="btn-glass p-2"><X className="w-4 h-4" /></button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const method = newCategory ? "POST" : "PUT";
                const res = await fetch("/api/forum/categories", {
                  method,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(editingCategory),
                });
                const data = await res.json();
                if (data.success) {
                  setEditingCategory(null);
                  await loadCategories();
                  showToast(newCategory ? "板块创建成功" : "板块更新成功");
                } else {
                  showToast(data.error, "error");
                }
              }}
              className="space-y-4"
            >
              {newCategory && (
                <div>
                  <label className="admin-label">板块 ID（英文，如 tech-talk）</label>
                  <input type="text" className="admin-input" required value={editingCategory.id} onChange={(e) => setEditingCategory({ ...editingCategory, id: e.target.value })} pattern="[a-z0-9-]+" title="仅限小写字母、数字和连字符" />
                </div>
              )}
              <div>
                <label className="admin-label">板块名称</label>
                <input type="text" className="admin-input" required value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} />
              </div>
              <div>
                <label className="admin-label">描述</label>
                <input type="text" className="admin-input" value={editingCategory.description} onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">图标名称</label>
                  <select className="admin-input" value={editingCategory.icon} onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}>
                    {["Gift", "BookOpen", "Star", "MessageCircle", "Flag", "Sparkles", "Zap", "Code", "Heart", "Shield"].map((i) => (<option key={i} value={i}>{i}</option>))}
                  </select>
                </div>
                <div>
                  <label className="admin-label">主题色</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={editingCategory.color} onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })} className="w-10 h-10 rounded border border-[var(--border-color)] cursor-pointer" />
                    <input type="text" className="admin-input flex-1" value={editingCategory.color} onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="admin-label">排序</label>
                  <input type="number" className="admin-input" value={editingCategory.sortOrder} onChange={(e) => setEditingCategory({ ...editingCategory, sortOrder: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="admin-label">官方只读</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={editingCategory.readOnly} onChange={(e) => setEditingCategory({ ...editingCategory, readOnly: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm text-muted">仅管理员可发帖</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
                <button type="button" onClick={() => setEditingCategory(null)} className="btn-glass px-4 py-2">取消</button>
                <button type="submit" className="btn-glass btn-glass-primary px-4 py-2">
                  <Save className="w-4 h-4" />
                  {newCategory ? "创建" : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg border text-sm font-mono animate-fade-in-up ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
