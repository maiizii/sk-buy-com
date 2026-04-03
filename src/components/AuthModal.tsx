"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X, LogIn, UserPlus, Mail, ShieldCheck } from "lucide-react";

type AuthTab = "login" | "register";

interface AuthModalProps {
  isOpen: boolean;
  defaultTab?: AuthTab;
  initialNotice?: string;
  initialError?: string;
  initialVerificationEmail?: string;
  onClose: () => void;
  onSuccess: (user: {
    id: number;
    username: string;
    displayName: string;
    email: string;
    role: string;
  }) => void;
}

interface LoginSuccessPayload {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: string;
}

export function AuthModal({
  isOpen,
  defaultTab = "login",
  initialNotice = "",
  initialError = "",
  initialVerificationEmail = "",
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState(initialVerificationEmail);
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState(initialVerificationEmail);
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showVerificationBox, setShowVerificationBox] = useState(Boolean(initialVerificationEmail || initialNotice || initialError));

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialVerificationEmail) {
      setEmail(initialVerificationEmail);
      setVerificationEmail(initialVerificationEmail);
    }
    if (initialNotice) setNotice(initialNotice);
    if (initialError) setError(initialError);
    if (initialVerificationEmail || initialNotice || initialError) {
      setShowVerificationBox(true);
    }
  }, [initialError, initialNotice, initialVerificationEmail, isOpen]);

  const verifyTargetEmail = useMemo(() => verificationEmail || email, [verificationEmail, email]);

  if (!isOpen) return null;

  const reset = () => {
    setDisplayName("");
    setEmail(initialVerificationEmail || "");
    setPassword("");
    setVerificationEmail(initialVerificationEmail || "");
    setVerificationCode("");
    setError(initialError || "");
    setNotice(initialNotice || "");
    setShowVerificationBox(Boolean(initialVerificationEmail || initialNotice || initialError));
  };

  const switchTab = (t: AuthTab) => {
    setTab(t);
    setPassword("");
    setError("");
    setNotice("");
    if (t === "register") {
      setVerificationCode("");
      setShowVerificationBox(false);
    }
  };

  const resolveCurrentUser = async () => {
    const meRes = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
    });
    const meData = await meRes.json();
    if (meData.success) {
      onSuccess(meData.data as LoginSuccessPayload);
      onClose();
      reset();
      return true;
    }
    return false;
  };

  const handleVerifyCode = async () => {
    const targetEmail = verifyTargetEmail.trim().toLowerCase();
    const targetCode = verificationCode.trim();

    setVerifying(true);
    setError("");
    setNotice("");

    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: targetEmail,
          code: targetCode,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || "验证码验证失败");
        return;
      }

      setNotice(data.message || "邮箱验证成功，已自动登录");
      setVerificationCode("");
      await resolveCurrentUser();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

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
        if (tab === "login") {
          onSuccess(data.data as LoginSuccessPayload);
          onClose();
          reset();
        } else {
          const normalizedEmail = email.trim().toLowerCase();
          setVerificationEmail(normalizedEmail);
          setNotice(data.message || "注册成功，请前往邮箱验证后再登录");
          setTab("login");
          setPassword("");
          setShowVerificationBox(true);
          setVerificationCode("");
        }
      } else {
        const nextError = data.error || "操作失败";
        setError(nextError);
        if (tab === "login" && /未验证/.test(nextError)) {
          setVerificationEmail(email.trim().toLowerCase());
          setShowVerificationBox(true);
          setNotice("你也可以直接输入邮件中的 6 位验证码完成验证并自动登录。");
        }
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

          {notice && (
            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {notice}
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

          {showVerificationBox && (
            <div className="mt-5 rounded-xl border border-[var(--border-color)] bg-[var(--card)]/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <ShieldCheck className="h-4 w-4 text-[var(--accent)]" />
                输入邮箱验证码完成验证
              </div>
              <p className="mb-3 text-xs leading-6 text-[var(--muted)]">
                你可以点击邮件中的验证链接，或在这里输入 6 位数字验证码。验证成功后会自动登录。
              </p>
              <div className="space-y-3">
                <div>
                  <label className="admin-label">验证邮箱</label>
                  <input
                    type="email"
                    value={verifyTargetEmail}
                    onChange={(e) => {
                      setVerificationEmail(e.target.value);
                      if (!email) setEmail(e.target.value);
                    }}
                    className="admin-input"
                    placeholder="请输入接收验证码的邮箱"
                  />
                </div>
                <div>
                  <label className="admin-label">6 位验证码</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="admin-input"
                    placeholder="请输入邮箱中的 6 位验证码"
                  />
                </div>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleVerifyCode}
                  className="w-full btn-glass py-3 justify-center text-sm"
                >
                  {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "验 证 邮 箱"}
                </button>
              </div>
            </div>
          )}

          {tab === "login" && (
            <p className="mt-3 text-center text-xs text-muted">
              注册后可以通过邮箱验证链接或 6 位验证码完成验证。
            </p>
          )}

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
