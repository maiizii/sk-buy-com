"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Settings,
  Shield,
  Sparkles,
  User,
  X,
  Search,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { AuthModal } from "./AuthModal";
import { getMessages } from "@/lib/i18n";
import { getUserDisplayName } from "@/lib/auth-schema";

interface UserInfo {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: "user" | "admin";
}

interface ForumCategory {
  id: string;
  name: string;
}

const t = getMessages();

const PRIMARY_NAV = [
  { label: t.common.home, href: "/", icon: LayoutDashboard, exact: true },
  { label: t.common.discover, href: "/discover", icon: Search },
  { label: t.common.forum, href: "/forum", icon: MessageCircle },
  { label: t.common.welfare, href: "/forum/c/welfare", icon: Sparkles },
  { label: t.common.guide, href: "/forum/c/guide", icon: Shield },
];

export function Navbar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [forumOpen, setForumOpen] = useState(true);
  const [categories, setCategories] = useState<ForumCategory[]>([]);

  const checkAuth = useCallback(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
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
    fetch("/api/forum/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCategories(data.data.slice(0, 8));
      })
      .catch(() => setCategories([]));
  }, [checkAuth]);


  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const forumCategoryLinks = useMemo(
    () =>
      categories.map((category) => ({
        label: category.name,
        href: `/forum/c/${category.id}`,
      })),
    [categories]
  );

  const openLogin = () => {
    setAuthTab("login");
    setShowAuth(true);
  };

  const openRegister = () => {
    setAuthTab("register");
    setShowAuth(true);
  };

  const handleAuthSuccess = (u: {
    id: number;
    username: string;
    displayName: string;
    email: string;
    role: string;
  }) => {
    setUser(u as UserInfo);
    setShowAuth(false);
    setShowDropdown(false);
    setMobileOpen(false);
    setAuthChecked(true);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    setUser(null);
    setShowDropdown(false);
  };

  return (
    <>
      <div className="app-shell">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="关闭侧边栏"
          />
        )}

        <aside
          className={`app-sidebar fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col p-4 transition-transform duration-300 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex items-center justify-between px-2 py-2">
            <Link href="/">
              <Image
                src="/logo200x54.png"
                alt="sk-buy.com"
                width={200}
                height={54}
                priority
              />
            </Link>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--accent-soft)] lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-6 overflow-y-auto pr-1">
            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]/80">
                Navigation
              </p>
              <nav className="space-y-1.5">
                {PRIMARY_NAV.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`sidebar-link ${isActive(item.href, item.exact) ? "sidebar-link-active" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}

                <button
                  type="button"
                  className={`sidebar-link ${pathname.startsWith("/forum") ? "sidebar-link-active" : ""}`}
                  onClick={() => setForumOpen((prev) => !prev)}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="flex-1 text-left">论坛板块</span>
                  {forumOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {forumOpen && (
                  <div className="space-y-1">
                    {forumCategoryLinks.length > 0 ? (
                      forumCategoryLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`sidebar-sub-link ${isActive(item.href) ? "sidebar-sub-link-active" : ""}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                          <span>{item.label}</span>
                        </Link>
                      ))
                    ) : (
                      <div className="px-6 py-2 text-xs text-[var(--muted)]">正在加载板块...</div>
                    )}
                  </div>
                )}
              </nav>
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:ml-[192px]">
          <header className="app-topbar sticky top-0 z-30">
            <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-sm lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted)]">
                  {t.common.workspace}
                </p>
                <h1 className="truncate text-lg font-semibold">{t.common.siteTitle}</h1>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />

                {authChecked && !user && (
                  <div className="hidden items-center gap-2 sm:flex">
                    <button onClick={openLogin} className="nav-auth-btn">{t.common.login}</button>
                    <button onClick={openRegister} className="nav-auth-btn nav-auth-btn-primary">{t.common.register}</button>
                  </div>
                )}

                {authChecked && user && (
                  <div className="relative">
                    <button className="nav-user-btn" onClick={() => setShowDropdown((v) => !v)}>
                      <span className="nav-avatar">
                        <User className="h-4 w-4" />
                      </span>
                      <span className="hidden max-w-[120px] truncate text-sm sm:inline">
                        {getUserDisplayName(user)}
                      </span>
                      <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                    </button>

                    {showDropdown && (
                      <>
                        <button className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} aria-label="关闭菜单" />
                        <div className="nav-dropdown">
                          <div className="border-b border-[var(--border-color)] px-4 py-3">
                            <p className="text-sm font-semibold">{getUserDisplayName(user)}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{user.email}</p>
                          </div>
                          {user.role === "admin" && (
                            <Link href="/admin" className="nav-dropdown-item" onClick={() => setShowDropdown(false)}>
                              <Settings className="h-4 w-4" />
                              {t.common.admin}
                            </Link>
                          )}
                          <button onClick={handleLogout} className="nav-dropdown-item">
                            <LogOut className="h-4 w-4" />
                            {t.common.logout}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>
      </div>

      <AuthModal
        isOpen={showAuth}
        defaultTab={authTab}
        onClose={() => setShowAuth(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
