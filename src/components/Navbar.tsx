"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { AuthModal } from "./AuthModal";

interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: "user" | "admin";
}

const NAV_ITEMS = [
  { label: "SK首页", href: "/", exact: true },
  { label: "福利羊毛", href: "/forum/c/welfare" },
  { label: "社区论坛", href: "/forum" },
  { label: "新手指南", href: "/forum/c/guide" },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const checkAuth = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setUser(data.data);
        else setUser(null);
      })
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setShowDropdown(false);
  }, [pathname]);

  const openLogin = () => {
    setAuthTab("login");
    setShowAuth(true);
    setMobileOpen(false);
  };

  const openRegister = () => {
    setAuthTab("register");
    setShowAuth(true);
    setMobileOpen(false);
  };

  const handleAuthSuccess = (u: { id: number; username: string; email: string; role: string }) => {
    setUser(u as UserInfo);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setShowDropdown(false);
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--background)]/80 border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left: Logo + Nav Links */}
          <div className="flex items-center gap-1">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/20">
                <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold tracking-tight font-mono">
                  sk-buy
                </span>
                <span className="text-[10px] text-muted font-mono">.com</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${
                    isActive(item.href, item.exact) ? "nav-link-active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: User Area */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {authChecked && !user && (
              <div className="hidden sm:flex items-center gap-2">
                <button onClick={openLogin} className="nav-auth-btn">
                  登录
                </button>
                <button
                  onClick={openRegister}
                  className="nav-auth-btn nav-auth-btn-primary"
                >
                  注册
                </button>
              </div>
            )}

            {authChecked && user && (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="nav-user-btn"
                >
                  <div className="nav-avatar">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-mono max-w-[80px] truncate">
                    {user.username}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted" />
                </button>

                {showDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="nav-dropdown">
                      <div className="px-3 py-2 border-b border-[var(--border-color)]">
                        <p className="text-xs font-mono font-semibold truncate">
                          {user.username}
                        </p>
                        <p className="text-[10px] text-muted">{user.email}</p>
                      </div>
                      {user.role === "admin" && (
                        <Link
                          href="/admin"
                          className="nav-dropdown-item"
                          onClick={() => setShowDropdown(false)}
                        >
                          <Settings className="w-3.5 h-3.5" />
                          管理后台
                        </Link>
                      )}
                      <button onClick={handleLogout} className="nav-dropdown-item w-full">
                        <LogOut className="w-3.5 h-3.5" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-[var(--border-color)] transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[var(--border-color)] bg-[var(--background)]">
            <nav className="flex flex-col py-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-link ${
                    isActive(item.href, item.exact) ? "mobile-nav-link-active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {authChecked && !user && (
              <div className="flex gap-2 px-4 py-3 border-t border-[var(--border-color)]">
                <button onClick={openLogin} className="flex-1 nav-auth-btn justify-center">
                  登录
                </button>
                <button
                  onClick={openRegister}
                  className="flex-1 nav-auth-btn nav-auth-btn-primary justify-center"
                >
                  注册
                </button>
              </div>
            )}

            {authChecked && user && (
              <div className="px-4 py-3 border-t border-[var(--border-color)] space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="nav-avatar">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="text-sm font-mono">{user.username}</span>
                </div>
                {user.role === "admin" && (
                  <Link href="/admin" className="mobile-nav-link">
                    <Settings className="w-4 h-4" />
                    管理后台
                  </Link>
                )}
                <button onClick={handleLogout} className="mobile-nav-link w-full text-left">
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuth}
        defaultTab={authTab}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
