import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a date string (from SQLite or ISO) to a relative time string.
 * SQLite uses space between date and time instead of "T", so we normalize.
 */
export function timeAgo(dateStr: string): string {
  // SQLite format: "2026-04-02 08:10:42" → normalize to ISO
  const normalized = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const date = new Date(normalized.endsWith("Z") ? normalized : normalized + "Z");

  if (isNaN(date.getTime())) return dateStr; // fallback

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return date.toLocaleDateString("zh-CN");
}
