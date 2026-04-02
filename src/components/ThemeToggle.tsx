"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sk-buy-theme");
    if (stored === "light") {
      setDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("sk-buy-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("sk-buy-theme", "light");
    }
  };

  return (
    <button
      id="theme-toggle"
      onClick={toggle}
      className="relative flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-105 active:scale-95 cursor-pointer dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      aria-label="切换主题"
    >
      {dark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300" />
      )}
    </button>
  );
}
