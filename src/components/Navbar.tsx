"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  MessageSquare,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { AuthModal } from "./AuthModal";
import { useMessages } from "@/lib/i18n-client";
import { getUserDisplayName } from "@/lib/auth-schema";
import { PixelAvatar } from "./PixelAvatar";
import { NoticeModal } from "./NoticeModal";
import { getFavoritesOnlyFromStorage, setFavoritesOnlyToStorage, FAVORITES_CHANGED_EVENT, subscribeFavoritesOnly } from "@/lib/favorites-client";

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

function getIsDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function Navbar() {
  const t = useMessages();
  const PRIMARY_NAV = [
    { label: t.common.home, href: "/", icon: LayoutDashboard, exact: true },
    { label: t.common.discover, href: "/discover", icon: Search },
    { label: t.common.sks, href: "/sks", icon: Activity },
    { label: t.common.forum, href: "/forum", icon: MessageCircle },
    { label: t.common.welfare, href: "/forum/c/welfare", icon: Sparkles },
    { label: t.common.guide, href: "/forum/c/guide", icon: Shield },
  ];

  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [forumOpen, setForumOpen] = useState(true);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [authNotice, setAuthNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [favoriteCount, setFavoriteCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const currentUser = user;
  const favoritesOnly = useSyncExternalStore(subscribeFavoritesOnly, getFavoritesOnlyFromStorage, () => false);
  const currentUserDisplayName = currentUser
    ? getUserDisplayName(currentUser)
    : "";

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

  useEffect(() => {
    const syncTheme = () => setIsDarkMode(getIsDarkMode());
    syncTheme();
    window.addEventListener("sk-buy-theme-change", syncTheme);
    window.addEventListener("storage", syncTheme);
    return () => {
      window.removeEventListener("sk-buy-theme-change", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    const syncFavorites = async () => {
      if (!currentUser) {
        setFavoriteCount(0);
        return;
      }
      try {
        const response = await fetch("/api/favorites", { credentials: "include", cache: "no-store" });
        const result = await response.json();
        setFavoriteCount(Array.isArray(result.data?.favorites) ? result.data.favorites.length : 0);
      } catch {
        setFavoriteCount(0);
      }
    };

    syncFavorites();
    const handleChanged = () => {
      void syncFavorites();
    };
    window.addEventListener(FAVORITES_CHANGED_EVENT, handleChanged);
    window.addEventListener("storage", handleChanged);
    return () => {
      window.removeEventListener(FAVORITES_CHANGED_EVENT, handleChanged);
      window.removeEventListener("storage", handleChanged);
    };
  }, [currentUser]);

  useEffect(() => {
    const verificationStatus = searchParams.get("emailVerification");
    const message = searchParams.get("message") || "";
    const email = searchParams.get("email") || "";

    if (!verificationStatus) return;

    const timer = window.setTimeout(() => {
      setAuthTab("login");
      setVerificationEmail(email);

      if (verificationStatus === "success") {
        setAuthNotice(message || "邮箱验证成功，已自动登录");
        setAuthError("");
        checkAuth();
      } else {
        setAuthNotice("");
        setAuthError(message || "邮箱验证失败");
        setShowAuth(true);
      }
    }, 0);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("emailVerification");
    nextParams.delete("message");
    nextParams.delete("email");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });

    return () => window.clearTimeout(timer);
  }, [checkAuth, pathname, router, searchParams]);

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
    setAuthNotice("");
    setAuthError("");
    setVerificationEmail("");
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

  const handleFavoritesToggle = () => {
    if (!currentUser) {
      setNoticeMessage(t.common.favoritesFeatureLoginRequired);
      return;
    }
    const nextValue = !favoritesOnly;
    setFavoritesOnlyToStorage(nextValue);
  };

  useEffect(() => {
    if (!showDropdown) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showDropdown]);

  return (
    <>
      <div className="app-shell">
        {mobileOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label={t.common.closeSidebar}
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
                src={isDarkMode ? "/logo200x54_d.png" : "/logo200x54.png"}
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
                {t.common.navigation}
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
                  <span className="flex-1 text-left">{t.common.forumSections}</span>
                  {forumOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
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
                      <div className="px-6 py-2 text-xs text-[var(--muted)]">
                        {t.common.loadingSections}
                      </div>
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
                <h1 className="truncate text-lg font-semibold">
                  {t.common.siteTitle}
                </h1>
              </div>

              <div className="flex items-center gap-2">
                {authNotice && !showAuth && (
                  <div className="hidden max-w-[320px] rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 sm:block">
                    {authNotice}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleFavoritesToggle}
                  title={t.common.favorites}
                  aria-label={t.common.favorites}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-sm transition ${favoritesOnly ? "border-amber-400/45 text-amber-400" : "hover:bg-[var(--accent-soft)]"}`}
                >
                  <span className="relative inline-flex">
                    <Star className={`h-4.5 w-4.5 ${favoritesOnly ? "fill-current" : ""}`} />
                    {currentUser && favoriteCount > 0 ? (
                      <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-white">
                        {favoriteCount > 99 ? "99+" : favoriteCount}
                      </span>
                    ) : null}
                  </span>
                </button>
                <LanguageToggle />
                <ThemeToggle />

                {authChecked && !currentUser && (
                  <div className="hidden items-center gap-2 sm:flex">
                    <button onClick={openLogin} className="nav-auth-btn">
                      {t.common.login}
                    </button>
                    <button
                      onClick={openRegister}
                      className="nav-auth-btn nav-auth-btn-primary"
                    >
                      {t.common.register}
                    </button>
                  </div>
                )}

                {authChecked && currentUser && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      className="nav-user-btn"
                      onClick={() => setShowDropdown((v) => !v)}
                    >
                      <PixelAvatar
                        seed={currentUser.username || currentUser.email || currentUser.id}
                        alt={currentUserDisplayName}
                        size={30}
                        className="nav-avatar overflow-hidden"
                      />
                      <span className="hidden max-w-[120px] truncate text-sm sm:inline">
                        {currentUserDisplayName}
                      </span>
                      <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
                    </button>

                    {showDropdown && (
                      <div className="nav-dropdown">
                          <div className="border-b border-[var(--border-color)] px-4 py-3">
                            <p className="text-sm font-semibold">
                              {currentUserDisplayName}
                            </p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {currentUser.email}
                            </p>
                          </div>
                          {currentUser.role === "admin" && (
                            <Link
                              href="/admin"
                              className="nav-dropdown-item"
                              onClick={() => setShowDropdown(false)}
                            >
                              <Settings className="h-4 w-4" />
                              {t.common.admin}
                            </Link>
                          )}
                          <button
                            onClick={handleLogout}
                            className="nav-dropdown-item"
                          >
                            <LogOut className="h-4 w-4" />
                            {t.common.logout}
                          </button>
                        </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>
      </div>

      <NoticeModal open={!!noticeMessage} message={noticeMessage} onClose={() => setNoticeMessage("")} />

      <AuthModal
        isOpen={showAuth}
        defaultTab={authTab}
        initialNotice={authNotice}
        initialError={authError}
        initialVerificationEmail={verificationEmail}
        onClose={() => {
          setShowAuth(false);
          setAuthError("");
        }}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
