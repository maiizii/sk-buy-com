"use client";

import Link from "next/link";
import { useMessages } from "@/lib/i18n-client";

export function AppFooter() {
  const t = useMessages();

  const footerLinks = [
    { href: "/about", label: t.footer.about },
    { href: "/business", label: t.footer.business },
    { href: "/submit-site", label: t.footer.submitSite },
    { href: "/terms", label: t.footer.terms },
    { href: "/disclaimer", label: t.footer.disclaimer },
    { href: "/contact", label: t.footer.contact },
  ] as const;

  return (
    <footer className="mt-8 rounded-[20px] border border-[var(--border-color)] bg-[var(--card)] px-6 py-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold">{t.common.siteName}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.common.footerDescription}</p>
        </div>

        <nav
          aria-label={t.common.footerNav}
          className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]"
        >
          {footerLinks.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[var(--accent-strong)]">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>
          © 2026 {t.common.siteName}. {t.common.allRightsReserved}
        </p>
        <p>{t.common.footerNotice}</p>
      </div>
    </footer>
  );
}
