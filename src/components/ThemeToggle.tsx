"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "sk-buy-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = stored ? stored === "dark" : prefersDark;

    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    setMounted(true);
  }, []);

  const toggle = () => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    localStorage.setItem(STORAGE_KEY, nextDark ? "dark" : "light");
  };

  return (
    <button
      id="theme-toggle"
      type="button"
      onClick={toggle}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-md"
      aria-label="切换主题"
      title={mounted ? (dark ? "切换为浅色模式" : "切换为深色模式") : "切换主题"}
    >
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-[var(--accent-strong)]" />
      )}
    </button>
  );
}
