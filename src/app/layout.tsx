import type { Metadata } from "next";
import Link from "next/link";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sk-buy.com — AI API 中转站评测聚合",
  description:
    "极客级 AI API 中转站实时评测平台。对比连通率、延迟、计费倍率，找到最优性价比的 AI API 中转服务。",
  keywords: ["AI API", "中转站", "评测", "GPT", "Claude", "连通率", "延迟"],
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Navbar />
        <main className="min-w-0 w-full px-4 pt-24 sm:px-6 lg:w-[calc(100%-192px)] lg:ml-[192px] lg:px-8 lg:pt-8">
          <div className="flex min-h-[calc(100vh-96px)] flex-col">
            <div className="flex-1 pb-8">
              {children}
            </div>

            <footer className="mt-8 rounded-[20px] border border-[var(--border-color)] bg-[var(--card)] px-6 py-5 shadow-[var(--shadow-sm)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold">sk-buy.com</p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  AI API 中转站评测聚合、论坛交流与站点导航。
                </p>
              </div>

              <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
                <Link href="/" className="hover:text-[var(--accent-strong)]">SK-首页</Link>
                <Link href="/forum" className="hover:text-[var(--accent-strong)]">社区论坛</Link>
                <Link href="/forum/c/guide" className="hover:text-[var(--accent-strong)]">新手指南</Link>
                <Link href="/forum/c/welfare" className="hover:text-[var(--accent-strong)]">福利羊毛</Link>
                <Link href="/admin" className="hover:text-[var(--accent-strong)]">管理后台</Link>
              </nav>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 sk-buy.com. All rights reserved.</p>
              <p>数据仅供参考，请以平台官方信息为准。</p>
            </div>
          </footer>
          </div>
        </main>
      </body>
    </html>
  );
}
