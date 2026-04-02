import { zhCN } from "@/messages/zh-CN";
import { enUS } from "@/messages/en-US";

export const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type Locale = keyof typeof messages;

export function getLocale(): Locale {
  return "zh-CN";
}

export function getMessages(locale: Locale = getLocale()) {
  return messages[locale] ?? messages["zh-CN"];
}
