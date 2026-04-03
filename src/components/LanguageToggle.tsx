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
      className="topbar-icon-btn"
      aria-label={t.common.switchLanguage}
      title={locale === "zh-CN" ? t.common.switchToEnglish : t.common.switchToChinese}
    >
      <span className="text-xs font-semibold">{locale === "zh-CN" ? "EN" : "中"}</span>
    </button>
  );
}
