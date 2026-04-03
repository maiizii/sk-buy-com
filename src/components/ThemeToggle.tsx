"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useMessages } from "@/lib/i18n-client";

const STORAGE_KEY = "sk-buy-theme";

function getPreferredDark() {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return stored ? stored === "dark" : prefersDark;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener("sk-buy-theme-change", handleChange);
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("sk-buy-theme-change", handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

export function ThemeToggle() {
  const t = useMessages();
  const dark = useSyncExternalStore(subscribe, getPreferredDark, () => false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggle = () => {
    const nextDark = !dark;
    localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextDark);
    window.dispatchEvent(new Event("sk-buy-theme-change"));
  };

  return (
    <button
      id="theme-toggle"
      type="button"
      onClick={toggle}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-md"
      aria-label={t.common.switchTheme}
      title={dark ? t.common.switchToLight : t.common.switchToDark}
    >
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--accent-strong)]" />
      )}
    </button>
  );
}
