import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "管理后台 — sk-buy.com",
  description: "sk-buy.com 平台管理后台",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
