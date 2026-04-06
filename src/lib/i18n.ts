import { zhCN } from "@/messages/zh-CN";
import { enUS } from "@/messages/en-US";

type DeepWidenLiteral<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? ReadonlyArray<DeepWidenLiteral<U>>
        : T extends object
          ? { [K in keyof T]: DeepWidenLiteral<T[K]> }
          : T;

export type Messages = DeepWidenLiteral<typeof zhCN>;

export const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} satisfies Record<"zh-CN" | "en-US", Messages>;

export type Locale = keyof typeof messages;

export const STORAGE_KEY = "sk-buy-locale";
export const DEFAULT_LOCALE: Locale = "zh-CN";

export function getLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "en-US" || stored === "zh-CN" ? stored : DEFAULT_LOCALE;
}

export function getMessages(locale: Locale = getLocale()): Messages {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
