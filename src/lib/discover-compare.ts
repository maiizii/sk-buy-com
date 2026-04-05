export interface Platform {
  id: number;
  slug: string;
  reviewTopicId: number | null;
  name: string;
  url: string;
  baseUrl: string;
  visitUrl: string;
  visitCount: number;
  monitorEnabled: boolean;
  tag: "premium" | "free" | "stable" | "dead";
  tagLabel: string;
  billingRate: string;
  billingColor: string;
  models: string[];
  uptime: number;
  latency: number;
  joinDate: string;
  description: string;
  sortOrder: number;
  status: string;
}

export interface ConnectivityLog {
  id: number;
  platformId: number;
  success: boolean;
  latency: number;
  errorMessage: string;
  checkedAt: string;
}

export interface ConnectivitySummary {
  uptime: number;
  avgLatency: number;
  lastCheck: string | null;
  totalChecks: number;
}

export interface ConnectivityData {
  [platformId: number]: {
    logs: ConnectivityLog[];
    summary: ConnectivitySummary;
  };
}

export interface AttributeGroup {
  id: string;
  key: string;
  label: string;
  inputType: string;
  enabled: boolean;
  isFilterable?: boolean;
  isComparable?: boolean;
  isVisibleByDefault?: boolean;
  sortOrder?: number;
  boundField?: "none" | "site_tag" | "featured_models";
}

export interface AttributeOption {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color?: string;
  enabled: boolean;
  sortOrder?: number;
}

export interface AttributeValue {
  id: number;
  platformId: number;
  groupKey: string;
  optionValue: string;
  valueText: string;
}

export interface PlatformConfigData {
  groups: AttributeGroup[];
  options: AttributeOption[];
  values: AttributeValue[];
  models: Array<{ id: string; key: string; name: string; vendor: string; featured: boolean }>;
}

export const DEFAULT_TAG_COLOR = "#737373";

export function makeSoftTagStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}1A`, borderColor: `${safeColor}33` };
}

export function makeBadgeStyle(color?: string) {
  const safeColor = color || DEFAULT_TAG_COLOR;
  return { color: safeColor, backgroundColor: `${safeColor}14`, borderColor: `${safeColor}33` };
}

export function getBadgeClass(tag: Platform["tag"]) {
  if (tag === "premium") return "badge badge-premium";
  if (tag === "free") return "badge badge-free";
  if (tag === "dead") return "badge badge-dead";
  return "badge badge-stable";
}

export function clampTags<T>(items: T[], max: number) {
  if (items.length <= max) return { visible: items, hiddenCount: 0 };
  return { visible: items.slice(0, max), hiddenCount: items.length - max };
}

export function normalizeExternalUrl(url: string) {
  if (!url) return "#";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function parseBillingRateValue(input: string) {
  const normalized = input.trim().toLowerCase();
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;
  const value = Number(match[1]);
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  if (normalized.includes("%")) return value / 100;
  return value;
}
