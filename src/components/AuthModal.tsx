"use client";

import { useEffect, useState } from "react";
import { Loader2, X, LogIn, UserPlus, Mail } from "lucide-react";

type AuthTab = "login" | "register";

interface AuthModalProps {
  isOpen: boolean;
  defaultTab?: AuthTab;
  onClose: () => void;
  onSuccess: (user: {
    id: number;
    username: string;
    displayName: string;
    email: string;
    role: string;
  }) => void;
}

export function AuthModal({
  isOpen,
  defaultTab = "login",
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  if (!isOpen) return null;

  const reset = () => {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setError("");
  };

  const switchTab = (t: AuthTab) => {
    setTab(t);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const body =
        tab === "login"
          ? { email, password }
          : { email, password, displayName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess(data.data);
        onClose();
        reset();
      } else {
        setError(data.error || "操作失败");
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md animate-fade-in-up">
        <div className="auth-modal-card">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border-color)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent-strong)]">
            <Mail className="h-3.5 w-3.5" />
            当前仅支持邮箱注册与登录
          </div>

          <div className="flex mb-6 border-b border-[var(--border-color)]">
            <button
              onClick={() => switchTab("login")}
              className={`auth-tab ${tab === "login" ? "auth-tab-active" : ""}`}
            >
              <LogIn className="w-4 h-4" />
              登录
            </button>
            <button
              onClick={() => switchTab("register")}
              className={`auth-tab ${tab === "register" ? "auth-tab-active" : ""}`}
            >
              <UserPlus className="w-4 h-4" />
              注册
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === "register" && (
              <div>
                <label className="admin-label">显示名称</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="admin-input"
                  placeholder="可选，用于论坛与前台展示"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="admin-label">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="admin-input"
                placeholder="请输入邮箱"
                required
                autoFocus={tab === "login"}
              />
            </div>

            <div>
              <label className="admin-label">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="admin-input"
                placeholder={tab === "register" ? "至少 6 位" : "请输入密码"}
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
              ) : tab === "login" ? (
                "邮 箱 登 录"
              ) : (
                "邮 箱 注 册"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted">
            {tab === "login" ? (
              <>
                还没有账号？{" "}
                <button onClick={() => switchTab("register")} className="text-[var(--accent)] hover:underline">
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？{" "}
                <button onClick={() => switchTab("login")} className="text-[var(--accent)] hover:underline">
                  去登录
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
