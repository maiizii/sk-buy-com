import type {
  SksDisplayStatus,
  SksFullProbeResult,
  SksOwnershipStatus,
  SksProbeStats,
  SksSiteCardView,
  SksSiteDetailView,
  SksSiteImportResult,
  SksSourceType,
} from "@/lib/sks/types";

export type SiteCatalogSystemType =
  | "newapi"
  | "sub2api"
  | "openai-compatible"
  | "unknown"
  | "other";

export type SiteCatalogSourceStage = "fofa" | "screening" | "sks" | "website";

export type SiteCatalogVisibility = "public" | "unlisted" | "private";

export type SiteCatalogStatus = "active" | "pending" | "hidden" | "archived";

export interface SiteCatalogSiteRecord {
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  siteSystem: SiteCatalogSystemType;
  sourceStage: SiteCatalogSourceStage;
  sourceModule: string;
  catalogStatus: SiteCatalogStatus;
  visibility: SiteCatalogVisibility;
  summary: string;
  description: string;
  registrationOpen: boolean | null;
  emailVerificationRequired: boolean | null;
  inviteCodeRequired: boolean | null;
  hasInitialQuota: boolean | null;
  hasCredential: boolean;
  tags: string[];
  metaJson: string;
  manualOverrideJson: string;
  importedAt: string;
  lastSksSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteCatalogImportInput {
  displayName?: string;
  homepageUrl?: string | null;
  apiBaseUrl: string;
  siteSystem?: SiteCatalogSystemType;
  platformType?: string;
  sourceStage?: SiteCatalogSourceStage;
  sourceModule?: string;
  visibility?: SiteCatalogVisibility;
  catalogStatus?: SiteCatalogStatus;
  summary?: string;
  description?: string;
  registrationOpen?: boolean | null;
  emailVerificationRequired?: boolean | null;
  inviteCodeRequired?: boolean | null;
  hasInitialQuota?: boolean | null;
  tags?: string[];
  meta?: Record<string, unknown>;
  manualOverrides?: Record<string, unknown>;
  ownershipStatus?: SksOwnershipStatus;
  ownerUserId?: number | null;
  createdByUserId?: number | null;
  apiKey?: string | null;
  sourceType?: SksSourceType;
  submittedByUserId?: number | null;
  label?: string | null;
  isEnabled?: boolean;
  priorityScore?: number;
  runInitialProbe?: boolean;
  initialProbeModelLimit?: number;
  forceModels?: string[];
}

export interface SiteCatalogImportResult {
  catalogSite: SiteCatalogSiteRecord;
  sksImport: SksSiteImportResult | null;
  initialProbe: SksFullProbeResult | null;
  probeError: string | null;
}

export interface SiteCatalogComputedView {
  displayStatus: SksDisplayStatus;
  operationalStatusLabel: string;
  recommendationTags: string[];
  providerFamilies: string[];
  stats7d: SksProbeStats | null;
}

export interface SiteCatalogSiteCardView {
  catalogSite: SiteCatalogSiteRecord;
  sks: SksSiteCardView | null;
  computed: SiteCatalogComputedView;
}

export interface SiteCatalogSiteDetailView extends SiteCatalogSiteCardView {
  sksDetail: SksSiteDetailView | null;
}
