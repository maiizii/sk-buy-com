import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { AppFooter } from "@/components/AppFooter";
import { getMessages } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const t = getMessages();

export const metadata: Metadata = {
  title: t.metadata.rootTitle,
  description: t.metadata.rootDescription,
  keywords: [...t.metadata.rootKeywords],
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
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="min-w-0 w-full px-4 pt-24 sm:px-6 lg:w-[calc(100%-192px)] lg:ml-[192px] lg:px-8 lg:pt-8">
          <div className="flex min-h-[calc(100vh-96px)] flex-col">
            <div className="flex-1 pb-8">{children}</div>

            <AppFooter />
          </div>
        </main>
      </body>
    </html>
  );
}
