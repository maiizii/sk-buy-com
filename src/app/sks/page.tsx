import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { SksSubmitClient } from "@/components/sks/SksSubmitClient";
import { listSksUserSubmissionViews } from "@/lib/sks/submission";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "提交API中转站到SKS（SK Status）— sk-buy.com",
  description:
    "提交你的 API 中转站到 SKS，只需网址和 API SKY；检测通过后自动收录，并生成状态页、JSON 接口和嵌入模板。",
  keywords: ["SKS", "SK Status", "申请", "收录", "监控", "状态页"],
};

export default async function SksIndexPage() {
  const user = await getCurrentUser();
  const items = user ? listSksUserSubmissionViews(user.id) : [];

  return <SksSubmitClient initialItems={items} isLoggedIn={Boolean(user)} />;
}
