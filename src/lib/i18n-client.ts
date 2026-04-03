"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getLocale, getMessages, STORAGE_KEY, type Locale } from "@/lib/i18n";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener("sk-buy-locale-change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener("sk-buy-locale-change", handleChange);
  };
}

export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  window.dispatchEvent(new Event("sk-buy-locale-change"));
}

export function useMessages() {
  const locale = useLocale();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return getMessages(locale);
}

export type { Locale };
