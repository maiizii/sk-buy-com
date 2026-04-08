export type SksProbeType = "site_connectivity" | "model_list" | "model_inference";

export type SksInternalStatus =
  | "ok"
  | "slow"
  | "reachable"
  | "timeout"
  | "auth_error"
  | "rate_limited"
  | "model_error"
  | "network_error"
  | "unknown";

export type SksDisplayStatus = "ok" | "slow" | "failed" | "unknown";

export type SksSourceType = "owner" | "community" | "system";

export type SksOwnershipStatus = "unclaimed" | "observed" | "probable_owner" | "claimed";

export type SksSubmissionStatus = "pending" | "approved" | "failed";

export type SksCallTemplateKey =
  | "badge"
  | "mini-grid"
  | "full-card"
  | "site-card-compact"
  | "site-card-large"
  | "json-feed";

export interface SksSiteRecord {
  id: string;
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  platformType: string;
  ownerUserId: number | null;
  ownershipStatus: SksOwnershipStatus;
  statusVisibility: "public" | "unlisted" | "private";
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SksCredentialRecord {
  id: string;
  siteId: string;
  sourceType: SksSourceType;
  submittedByUserId: number | null;
  apiKeyEncrypted: string;
  apiKeyHash: string;
  apiKeyPreview: string;
  apiBaseUrl: string;
  label: string | null;
  isEnabled: boolean;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  stabilityScore: number;
  priorityScore: number;
  successCount: number;
  failureCount: number;
  cooldownUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SksCredentialSafeView extends Omit<SksCredentialRecord, "apiKeyEncrypted"> {
  hasApiKey: boolean;
}

export interface SksSiteModelRecord {
  id: string;
  siteId: string;
  modelName: string;
  providerFamily: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isCurrentlyListed: boolean;
  isTestTarget: boolean;
  isHot: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SksProbeResultRecord {
  id: number;
  siteId: string;
  credentialId: string | null;
  probeType: SksProbeType;
  modelName: string | null;
  status: SksInternalStatus;
  httpStatus: number | null;
  ttfbMs: number | null;
  totalMs: number | null;
  responseChars: number | null;
  errorType: string | null;
  errorMessage: string | null;
  checkedAt: string;
  createdAt: string;
}

export interface SksWidgetRecord {
  id: string;
  siteId: string;
  createdByUserId: number | null;
  widgetToken: string;
  widgetType:
    | "badge"
    | "mini-grid"
    | "full-card"
    | "site-card-compact"
    | "site-card-large"
    | "json-feed";
  theme: string;
  stylePreset: string;
  allowedHostname: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SksGridCell {
  bucketStart: string;
  label: string;
  status: SksDisplayStatus;
  checkedAt: string | null;
  ttfbMs: number | null;
  totalMs: number | null;
  errorMessage: string | null;
}

export interface SksStatusSnapshot {
  status: SksDisplayStatus;
  checkedAt: string | null;
  ttfbMs: number | null;
  totalMs: number | null;
  errorMessage: string | null;
}

export interface SksProbeStats {
  total: number;
  okCount: number;
  slowCount: number;
  failedCount: number;
  successRate: number;
}

export interface SksModelStatusView {
  modelName: string;
  providerFamily: string | null;
  isHot: boolean;
  lastSeenAt: string;
  current: SksStatusSnapshot;
  stats7d: SksProbeStats;
  grid: SksGridCell[];
}

export interface SksSiteCardView {
  site: SksSiteRecord;
  current: SksStatusSnapshot;
  models: {
    count: number;
    hot: string[];
    all: string[];
  };
  stats7d: SksProbeStats;
  stats30d: SksProbeStats;
  grid: SksGridCell[];
  dailyGrid: SksGridCell[];
}

export interface SksSiteDetailView extends SksSiteCardView {
  widgetToken: string | null;
  modelStatuses: SksModelStatusView[];
}

export interface SksSiteAdminListItem {
  site: SksSiteRecord;
  credentialCount: number;
  enabledCredentialCount: number;
  modelCount: number;
  currentStatus: SksDisplayStatus;
  lastCheckedAt: string | null;
}

export interface SksSiteAdminView {
  site: SksSiteRecord;
  credentials: SksCredentialSafeView[];
  models: SksSiteModelRecord[];
  recentProbes: SksProbeResultRecord[];
  publicView: SksSiteDetailView | null;
}

export interface SksSiteImportInput {
  displayName?: string;
  homepageUrl?: string | null;
  apiBaseUrl: string;
  apiKey: string;
  platformType?: string;
  statusVisibility?: "public" | "unlisted" | "private";
  ownershipStatus?: SksOwnershipStatus;
  ownerUserId?: number | null;
  createdByUserId?: number | null;
  sourceType?: SksSourceType;
  submittedByUserId?: number | null;
  label?: string | null;
  isEnabled?: boolean;
  priorityScore?: number;
}

export interface SksSiteImportResult {
  site: SksSiteRecord;
  credential: SksCredentialSafeView;
}

export interface SksSyncModelsResult {
  site: SksSiteRecord;
  credential: SksCredentialSafeView;
  probe: SksProbeResultRecord;
  models: string[];
}

export interface SksModelTestResult {
  site: SksSiteRecord;
  credential: SksCredentialSafeView;
  probe: SksProbeResultRecord;
}

export interface SksFullProbeResult {
  site: SksSiteRecord;
  credential: SksCredentialSafeView;
  modelListProbe: SksProbeResultRecord | null;
  syncedModels: string[];
  testedModels: SksProbeResultRecord[];
}

export interface SksUserSubmissionRecord {
  id: string;
  userId: number;
  hostname: string;
  normalizedHostname: string;
  apiBaseUrl: string;
  homepageUrl: string | null;
  displayName: string | null;
  apiKeyPreview: string;
  apiKeyEncrypted: string | null;
  siteId: string | null;
  credentialId: string | null;
  status: SksSubmissionStatus;
  lastMessage: string | null;
  sourceType: SksSourceType;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
}

export interface SksCallOptionView {
  template: SksCallTemplateKey;
  label: string;
  description: string;
  fingerprint: string;
  statusPageUrl: string;
  previewUrl: string;
  jsonUrl: string;
  iframeUrl: string | null;
  scriptUrl: string | null;
  iframeSnippet: string | null;
  scriptSnippet: string | null;
  jsonSnippet: string;
}

export interface SksUserSubmissionView {
  submission: SksUserSubmissionRecord;
  site: SksSiteRecord | null;
  publicView: SksSiteDetailView | null;
  callOptions: SksCallOptionView[];
}
