"use client";

import { setLocale, useLocale, useMessages, type Locale } from "@/lib/i18n-client";

const LOCALES: Locale[] = ["zh-CN", "en-US"];

export function LanguageToggle() {
  const locale = useLocale();
  const t = useMessages();

  const toggleLocale = () => {
    const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length] ?? "zh-CN";
    setLocale(next);
  };

  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--card)] px-3 text-sm font-semibold text-[var(--foreground)] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]/35 hover:shadow-md"
      aria-label={t.common.switchLanguage}
      title={locale === "zh-CN" ? t.common.switchToEnglish : t.common.switchToChinese}
    >
      {locale === "zh-CN" ? "EN" : "中"}
    </button>
  );
}
