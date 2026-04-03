import { zhCN } from "@/messages/zh-CN";
import { enUS } from "@/messages/en-US";

export const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type Locale = keyof typeof messages;

export const STORAGE_KEY = "sk-buy-locale";
export const DEFAULT_LOCALE: Locale = "zh-CN";

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en-US" || stored === "zh-CN" ? stored : DEFAULT_LOCALE;
}

export function getMessages(locale: Locale = getLocale()) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
