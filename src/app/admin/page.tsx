"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Database,
  Key,
  LayoutDashboard,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Radar,
  RefreshCw,
  Settings,
  Shapes,
  Shield,
  Trash2,
} from "lucide-react";
import { getMessages } from "@/lib/i18n";
import { getUserDisplayName } from "@/lib/auth-schema";

interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  role: "user" | "admin";
}

interface Platform {
  id: number;
  slug: string;
  reviewTopicId?: number | null;
  name: string;
  url: string;
  baseUrl?: string;
  visitUrl?: string;
  visitCount?: number;
  tag?: "premium" | "free" | "stable" | "dead";
  tagLabel?: string;
  billingRate?: string;
  billingColor?: string;
  models?: string[];
  joinDate?: string;
  description?: string;
  descriptionZh?: string;
  descriptionEn?: string;
  sortOrder?: number;
  monitorEnabled: boolean;
  status: string;
}

interface GroupRecord {
  id: string;
  key: string;
  label: string;
  labelZh?: string;
  labelEn?: string;
  inputType: string;
  enabled: boolean;
  isFilterable?: boolean;
  isComparable?: boolean;
  isVisibleByDefault?: boolean;
  sortOrder?: number;
  boundField?: "none" | "site_tag" | "featured_models";
}

interface OptionRecord {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  labelZh?: string;
  labelEn?: string;
  color?: string;
  enabled: boolean;
  sortOrder?: number;
}

interface ConfigSummary {
  groups: GroupRecord[];
  options: OptionRecord[];
  models: Array<{ id: string; key: string; name: string; vendor: string; featured: boolean }>;
  values?: Array<{ id: number; platformId: number; groupKey: string; optionValue: string; valueText?: string }>;
}

interface SiteCatalogAdminRecord {
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  siteSystem: string;
  sourceStage: string;
  sourceModule: string;
  catalogStatus: string;
  visibility: "public" | "unlisted" | "private";
  hasCredential: boolean;
  updatedAt: string;
}

interface SksSiteRecord {
  id: string;
  hostname: string;
  normalizedHostname: string;
  displayName: string;
  homepageUrl: string | null;
  apiBaseUrl: string;
  statusVisibility: "public" | "unlisted" | "private";
  ownershipStatus: string;
}

interface SksCredentialSafeView {
  id: string;
  sourceType: string;
  apiKeyPreview: string;
  label: string | null;
  isEnabled: boolean;
  lastVerifiedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  stabilityScore: number;
  priorityScore: number;
  successCount: number;
  failureCount: number;
}

interface SksSiteModelRecord {
  id: string;
  modelName: string;
  providerFamily: string | null;
  isCurrentlyListed: boolean;
  isHot: boolean;
  lastSeenAt: string;
}

interface SksProbeResultRecord {
  id: number;
  probeType: string;
  modelName: string | null;
  status: string;
  httpStatus: number | null;
  totalMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

interface SksSiteAdminListItem {
  site: SksSiteRecord;
  credentialCount: number;
  enabledCredentialCount: number;
  modelCount: number;
  currentStatus: "ok" | "slow" | "failed" | "unknown";
  lastCheckedAt: string | null;
}

interface SksSiteAdminView {
  site: SksSiteRecord;
  credentials: SksCredentialSafeView[];
  models: SksSiteModelRecord[];
  recentProbes: SksProbeResultRecord[];
  publicView: {
    current: {
      status: string;
      checkedAt: string | null;
      totalMs: number | null;
      errorMessage: string | null;
    };
    models: {
      count: number;
      hot: string[];
    };
    stats7d: {
      successRate: number;
      total: number;
      failedCount: number;
    };
  } | null;
}

const t = getMessages();

const emptyGroupForm: {
  id: string;
  label: string;
  labelZh: string;
  labelEn: string;
  key: string;
  inputType: string;
  enabled: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isVisibleByDefault: boolean;
  sortOrder: number;
  boundField: "none" | "site_tag" | "featured_models";
} = {
  id: "",
  label: "",
  labelZh: "",
  labelEn: "",
  key: "",
  inputType: "single_select",
  enabled: true,
  isFilterable: true,
  isComparable: true,
  isVisibleByDefault: false,
  sortOrder: 0,
  boundField: "none",
};

const DEFAULT_TAG_COLOR = "#737373";

const emptyOptionForm = {
  id: "",
  groupKey: "",
  label: "",
  labelZh: "",
  labelEn: "",
  value: "",
  color: DEFAULT_TAG_COLOR,
  enabled: true,
  sortOrder: 0,
};

const emptyPlatformForm = {
  id: 0,
  slug: "",
  name: "",
  url: "",
  baseUrl: "",
  visitUrl: "",
  tag: "stable" as const,
  tagLabel: "",
  billingRate: "",
  billingColor: "text-foreground",
  modelsText: "",
  joinDate: new Date().toISOString().split("T")[0],
  description: "",
  descriptionZh: "",
  descriptionEn: "",
  sortOrder: 0,
  monitorEnabled: false,
  status: "active",
};

const emptySksEditForm: {
  displayName: string;
  homepageUrl: string;
  apiBaseUrl: string;
  statusVisibility: "public" | "unlisted" | "private";
  ownershipStatus: string;
} = {
  displayName: "",
  homepageUrl: "",
  apiBaseUrl: "",
  statusVisibility: "public",
  ownershipStatus: "unclaimed",
};

function parseAdminTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withTimezone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAdminDateTime(value: string | null | undefined) {
  const parsed = parseAdminTimestamp(value);
  if (!parsed) return "—";
  return parsed.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

function formatAdminLatency(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value} ms` : "—";
}

function getSksStatusMeta(status: string) {
  switch (status) {
    case "ok":
      return {
        label: "正常",
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "slow":
      return {
        label: "偏慢",
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "unknown":
      return {
        label: "未知",
        className:
          "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
      };
    default:
      return {
        label: "失败",
        className:
          "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
  }
}

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        onLogin(data.data);
        window.location.replace("/admin");
      } else setError(data.error);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md admin-card p-8">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/20">
            <Shield className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono">{t.admin.title}</h1>
            <p className="text-xs text-muted">管理员邮箱登录</p>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="admin-label">邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="admin-input" required />
          </div>
          <div>
            <label className="admin-label">密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input" required />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-glass btn-glass-primary py-3 justify-center text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "登 录"}
          </button>
        </form>
      </div>
    </div>
  );
}

type AdminWorkspaceKey = "overview" | "platforms" | "attributes" | "models" | "monitoring" | "sks" | "search";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<AdminWorkspaceKey>("attributes");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [configSummary, setConfigSummary] = useState<ConfigSummary>({ groups: [], options: [], models: [], values: [] });
  const [groupForm, setGroupForm] = useState(emptyGroupForm);
  const [optionForm, setOptionForm] = useState(emptyOptionForm);
  const [platformForm, setPlatformForm] = useState(emptyPlatformForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [siteCatalogSites, setSiteCatalogSites] = useState<SiteCatalogAdminRecord[]>([]);
  const [sksSites, setSksSites] = useState<SksSiteAdminListItem[]>([]);
  const [selectedSksSiteKey, setSelectedSksSiteKey] = useState("");
  const [sksDetail, setSksDetail] = useState<SksSiteAdminView | null>(null);
  const [sksEditForm, setSksEditForm] = useState(emptySksEditForm);
  const [sksDetailLoading, setSksDetailLoading] = useState(false);
  const [siteCatalogActionLoading, setSiteCatalogActionLoading] = useState<"" | "hide" | "restore" | "delete">("");
  const [sksActionLoading, setSksActionLoading] = useState<"" | "edit" | "pause" | "resume" | "delete" | "probe">("");

  const loadDashboard = useCallback(async () => {
    const [platformRes, configRes, sksRes, siteCatalogRes] = await Promise.all([
      fetch("/api/platforms", { cache: "no-store" }),
      fetch("/api/platforms/config", { cache: "no-store" }),
      fetch("/api/sks/admin/sites", { cache: "no-store" }),
      fetch("/api/site-catalog/admin/sites", { cache: "no-store" }),
    ]);
    const [platformData, configData, sksData, siteCatalogData] = await Promise.all([
      platformRes.json(),
      configRes.json(),
      sksRes.json(),
      siteCatalogRes.json(),
    ]);
    if (platformData.success) setPlatforms(platformData.data);
    if (configData.success) setConfigSummary(configData.data);
    if (sksData.success) {
      setSksSites(sksData.data);
    } else {
      setSksSites([]);
    }
    if (siteCatalogData.success) {
      setSiteCatalogSites(siteCatalogData.data);
    } else {
      setSiteCatalogSites([]);
    }
  }, []);

  const loadSksSiteDetail = useCallback(async (siteKey: string) => {
    if (!siteKey) {
      setSksDetail(null);
      return;
    }

    setSksDetailLoading(true);

    try {
      const res = await fetch(`/api/sks/admin/site/${encodeURIComponent(siteKey)}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "获取 SKS 站点详情失败");
      }

      const detail = data.data as SksSiteAdminView;
      setSksDetail(detail);
      setSksEditForm({
        displayName: detail.site.displayName || "",
        homepageUrl: detail.site.homepageUrl || "",
        apiBaseUrl: detail.site.apiBaseUrl || "",
        statusVisibility: detail.site.statusVisibility,
        ownershipStatus: detail.site.ownershipStatus || "unclaimed",
      });
    } catch (error) {
      setSksDetail(null);
      setMessage(error instanceof Error ? error.message : "获取 SKS 站点详情失败");
    } finally {
      setSksDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data.role === "admin") setUser(data.data);
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadDashboard().catch(console.error);
  }, [user, loadDashboard]);

  useEffect(() => {
    if (!user) return;
    if (sksSites.length === 0) {
      setSelectedSksSiteKey("");
      setSksDetail(null);
      return;
    }

    const exists = sksSites.some(
      (item) => item.site.id === selectedSksSiteKey || item.site.normalizedHostname === selectedSksSiteKey
    );

    if (!exists) {
      setSelectedSksSiteKey(sksSites[0].site.normalizedHostname || sksSites[0].site.id);
    }
  }, [user, sksSites, selectedSksSiteKey]);

  useEffect(() => {
    if (!user || !selectedSksSiteKey) return;
    loadSksSiteDetail(selectedSksSiteKey).catch(console.error);
  }, [user, selectedSksSiteKey, loadSksSiteDetail]);

  const groupedOptions = useMemo(() => {
    return configSummary.groups.map((group) => ({
      group,
      options: configSummary.options.filter((option) => option.groupKey === group.key),
    }));
  }, [configSummary]);

  const optionsByGroupKey = useMemo(() => {
    return configSummary.options.reduce<Record<string, OptionRecord[]>>((acc, option) => {
      acc[option.groupKey] ??= [];
      acc[option.groupKey].push(option);
      return acc;
    }, {});
  }, [configSummary.options]);

  const siteTagGroup = useMemo(
    () => configSummary.groups.find((group) => group.boundField === "site_tag" && group.enabled),
    [configSummary.groups]
  );

  const featuredModelsGroup = useMemo(
    () => configSummary.groups.find((group) => group.boundField === "featured_models" && group.enabled),
    [configSummary.groups]
  );

  const valuesByPlatform = useMemo(() => {
    return (configSummary.values || []).reduce<Record<number, Record<string, string[]>>>((acc, item) => {
      acc[item.platformId] ??= {};
      acc[item.platformId][item.groupKey] ??= [];
      if (item.optionValue) acc[item.platformId][item.groupKey].push(item.optionValue);
      return acc;
    }, {});
  }, [configSummary.values]);

  const sksOverview = useMemo(() => {
    return {
      siteCount: sksSites.length,
      enabledCredentialCount: sksSites.reduce((sum, item) => sum + item.enabledCredentialCount, 0),
      modelCount: sksSites.reduce((sum, item) => sum + item.modelCount, 0),
      failedCount: sksSites.filter((item) => item.currentStatus === "failed").length,
      degradedCount: sksSites.filter((item) => item.currentStatus === "slow").length,
    };
  }, [sksSites]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const submitGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/platforms/config/groups", {
        method: groupForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "保存分组失败");
      setGroupForm(emptyGroupForm);
      setMessage(groupForm.id ? "分组已更新" : "分组已创建");
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存分组失败");
    } finally {
      setSubmitting(false);
    }
  };

  const submitOption = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("/api/platforms/config/options", {
        method: optionForm.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optionForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "保存选项失败");
      setOptionForm(emptyOptionForm);
      setMessage(optionForm.id ? "选项已更新" : "选项已创建");
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存选项失败");
    } finally {
      setSubmitting(false);
    }
  };

  const removeGroup = async (id: string) => {
    if (!confirm("删除分组会同时删除其标签与平台属性值，确认继续吗？")) return;
    const res = await fetch(`/api/platforms/config/groups?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setMessage("分组已删除");
      if (groupForm.id === id) setGroupForm(emptyGroupForm);
      await loadDashboard();
    } else {
      setMessage(data.error || "删除失败");
    }
  };

  const removeOption = async (id: string) => {
    if (!confirm("确认删除该标签选项吗？")) return;
    const res = await fetch(`/api/platforms/config/options?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setMessage("选项已删除");
      if (optionForm.id === id) setOptionForm(emptyOptionForm);
      await loadDashboard();
    } else {
      setMessage(data.error || "删除失败");
    }
  };

  const buildPlatformAttributeValues = () => {
    return configSummary.groups.flatMap((group) => {
      const raw = (platformForm as Record<string, unknown>)[`attr_${group.key}`];
      if (["multi_select", "model_selector"].includes(group.inputType)) {
        const values = Array.isArray(raw) ? raw : [];
        return values.map((optionValue) => ({ groupKey: group.key, optionValue: String(optionValue) }));
      }
      if (typeof raw === "string" && raw) {
        return [{ groupKey: group.key, optionValue: raw }];
      }
      return [];
    });
  };

  const submitPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const attributeValues = buildPlatformAttributeValues();
      const siteTagValue = siteTagGroup
        ? attributeValues.find((item) => item.groupKey === siteTagGroup.key)?.optionValue || ""
        : "";
      const siteTagOption = siteTagGroup
        ? configSummary.options.find((option) => option.groupKey === siteTagGroup.key && option.value === siteTagValue)
        : null;
      const featuredModelKeys = featuredModelsGroup
        ? attributeValues.filter((item) => item.groupKey === featuredModelsGroup.key).map((item) => item.optionValue)
        : [];
      const featuredModelNames = featuredModelKeys
        .map((key) => {
          if (!featuredModelsGroup) return key;
          return configSummary.options.find((option) => option.groupKey === featuredModelsGroup.key && option.value === key)?.label || key;
        })
        .filter(Boolean);

      const isEditing = platformForm.id > 0 && platforms.some((item) => item.id === platformForm.id);
      const payload = {
        id: isEditing ? platformForm.id : undefined,
        slug: platformForm.slug,
        name: platformForm.name,
        url: platformForm.url,
        baseUrl: platformForm.baseUrl,
        visitUrl: platformForm.visitUrl,
        tag: siteTagOption ? (["premium", "free", "stable", "dead"].includes(siteTagOption.value) ? siteTagOption.value : "stable") : platformForm.tag,
        tagLabel: siteTagOption?.label || platformForm.tagLabel,
        billingRate: platformForm.billingRate,
        billingColor: platformForm.billingColor,
        models: featuredModelsGroup ? featuredModelNames : platformForm.modelsText,
        joinDate: platformForm.joinDate,
        description: platformForm.descriptionZh || platformForm.description || platformForm.descriptionEn,
        descriptionZh: platformForm.descriptionZh || platformForm.description || "",
        descriptionEn: platformForm.descriptionEn || "",
        sortOrder: Number(platformForm.sortOrder || 0),
        monitorEnabled: platformForm.monitorEnabled,
        status: platformForm.status,
        attributeValues,
      };

      const res = await fetch("/api/platforms", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "保存平台失败");
      setMessage(isEditing ? "平台已更新" : "平台已创建");
      setPlatformForm(emptyPlatformForm);
      await loadDashboard();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存平台失败");
    } finally {
      setSubmitting(false);
    }
  };

  const editPlatform = (platform: Platform) => {
    const next: Record<string, unknown> = {
      ...emptyPlatformForm,
      id: platform.id,
      slug: platform.slug,
      name: platform.name,
      url: platform.url,
      baseUrl: platform.baseUrl || "",
      visitUrl: platform.visitUrl || "",
      tag: platform.tag || "stable",
      tagLabel: platform.tagLabel || "",
      billingRate: platform.billingRate || "",
      billingColor: platform.billingColor || "text-foreground",
      modelsText: (platform.models || []).join(", "),
      joinDate: platform.joinDate || new Date().toISOString().split("T")[0],
      description: platform.description || "",
      descriptionZh: platform.descriptionZh || platform.description || "",
      descriptionEn: platform.descriptionEn || "",
      sortOrder: platform.sortOrder || 0,
      monitorEnabled: !!platform.monitorEnabled,
      status: platform.status || "active",
    };

    const ownValues = valuesByPlatform[platform.id] || {};
    for (const group of configSummary.groups) {
      next[`attr_${group.key}`] = ["multi_select", "model_selector"].includes(group.inputType)
        ? ownValues[group.key] || []
        : (ownValues[group.key] || [""])[0] || "";
    }

    setPlatformForm(next as typeof emptyPlatformForm & Record<string, unknown>);
    setActiveWorkspace("platforms");
  };

  const removePlatform = async (id: number) => {
    if (!confirm("确认删除该平台吗？相关动态属性值也会一起删除。")) return;
    const res = await fetch(`/api/platforms?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      setMessage("平台已删除");
      if (platformForm.id === id) setPlatformForm(emptyPlatformForm);
      await loadDashboard();
    } else {
      setMessage(data.error || "删除平台失败");
    }
  };

  const refreshSksWorkspace = async (siteKey: string = selectedSksSiteKey) => {
    await loadDashboard();
    if (siteKey) {
      await loadSksSiteDetail(siteKey);
    }
  };

  const updateSiteCatalogVisibility = async (siteKey: string, mode: "hide" | "restore") => {
    setSiteCatalogActionLoading(mode);
    setMessage("");
    try {
      const res = await fetch("/api/site-catalog/admin/sites", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey, mode }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "更新首页目录站点失败");
      }
      await loadDashboard();
      setMessage(mode === "hide" ? "首页目录站点已隐藏" : "首页目录站点已恢复");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新首页目录站点失败");
    } finally {
      setSiteCatalogActionLoading("");
    }
  };

  const removeSiteCatalogSite = async (siteKey: string) => {
    if (!confirm(`确认删除首页目录站点 ${siteKey} 吗？删除后首页将不再显示该站点。`)) {
      return;
    }

    setSiteCatalogActionLoading("delete");
    setMessage("");
    try {
      const res = await fetch(`/api/site-catalog/admin/sites?siteKey=${encodeURIComponent(siteKey)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "删除首页目录站点失败");
      }
      await loadDashboard();
      setMessage("首页目录站点已删除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除首页目录站点失败");
    } finally {
      setSiteCatalogActionLoading("");
    }
  };

  const updateSksSiteMeta = async (
    mode: "edit" | "pause" | "resume",
    siteKey: string = selectedSksSiteKey
  ) => {
    if (!siteKey) {
      setMessage("请先选择一个 SKS 站点");
      return;
    }

    setSksActionLoading(mode);
    setMessage("");
    try {
      const res = await fetch(`/api/sks/admin/site/${encodeURIComponent(siteKey)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          displayName: sksEditForm.displayName,
          homepageUrl: sksEditForm.homepageUrl || null,
          apiBaseUrl: sksEditForm.apiBaseUrl,
          statusVisibility: sksEditForm.statusVisibility,
          ownershipStatus: sksEditForm.ownershipStatus,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "更新 SKS 站点失败");
      }

      const detail = data.data as SksSiteAdminView;
      setSelectedSksSiteKey(siteKey);
      setSksDetail(detail);
      setSksEditForm({
        displayName: detail.site.displayName || "",
        homepageUrl: detail.site.homepageUrl || "",
        apiBaseUrl: detail.site.apiBaseUrl || "",
        statusVisibility: detail.site.statusVisibility,
        ownershipStatus: detail.site.ownershipStatus || "unclaimed",
      });
      await loadDashboard();
      setMessage(mode === "edit" ? "SKS 站点已更新" : mode === "pause" ? "SKS 站点已暂停" : "SKS 站点已恢复");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新 SKS 站点失败");
    } finally {
      setSksActionLoading("");
    }
  };

  const removeSksSite = async (siteKey: string = selectedSksSiteKey) => {
    if (!siteKey) {
      setMessage("请先选择一个 SKS 站点");
      return;
    }

    if (!confirm(`确认删除 SKS 站点 ${siteKey} 吗？该操作会同时删除关联凭据、模型与探测记录。`)) {
      return;
    }

    setSksActionLoading("delete");
    setMessage("");
    try {
      const res = await fetch(`/api/sks/admin/site/${encodeURIComponent(siteKey)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "删除 SKS 站点失败");
      }

      if (siteKey === selectedSksSiteKey) {
        setSksDetail(null);
        setSelectedSksSiteKey("");
      }
      await loadDashboard();
      setMessage("SKS 站点已删除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除 SKS 站点失败");
    } finally {
      setSksActionLoading("");
    }
  };

  const refreshSksSiteProbe = async (siteKey: string = selectedSksSiteKey) => {
    if (!siteKey) {
      setMessage("请先选择一个 SKS 站点");
      return;
    }

    setSksActionLoading("probe");
    setMessage("");
    try {
      const res = await fetch(`/api/sks/admin/site/${encodeURIComponent(siteKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_probe" }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "刷新检测失败");
      }

      await refreshSksWorkspace(siteKey);
      setSelectedSksSiteKey(siteKey);
      setMessage("SKS 站点已重新执行全量检测");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新检测失败");
    } finally {
      setSksActionLoading("");
    }
  };


  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  const menuCards: Array<{
    key: AdminWorkspaceKey;
    title: string;
    desc: string;
    icon: typeof LayoutDashboard;
  }> = [
    { key: "overview", title: t.admin.overview, desc: "查看当前后台建设进度、数据规模与下一步重点。", icon: LayoutDashboard },
    { key: "platforms", title: t.admin.platformManagement, desc: "后续把平台新增/编辑表单接入动态属性值与模型绑定。", icon: Database },
    { key: "attributes", title: t.admin.attributeManagement, desc: "当前已可配置分组与标签，作为筛选/对比的基础设施。", icon: Shapes },
    { key: "models", title: t.admin.modelRegistry, desc: "模型数量巨大，建议走独立模型库与平台绑定体系。", icon: Boxes },
    { key: "monitoring", title: t.admin.monitoringCenter, desc: "连通率、延迟将逐步由实测聚合数据自动计算。", icon: Radar },
    { key: "sks", title: "SKS 工作台", desc: "管理用户提交后已收录的 SKS 站点，并在后台做编辑、暂停、恢复与删除。", icon: Activity },
    { key: "search", title: t.admin.searchWorkbench, desc: "前台搜索工作台将由这些配置动态生成。", icon: Settings },
  ];

  return (
    <div className="space-y-6 py-8">
      <section className="shell-panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Admin workspace</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{t.admin.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">已登录管理员：{getUserDisplayName(user)}（{user.email}）</p>
          </div>
          <button onClick={handleLogout} className="btn-glass">退出登录</button>
        </div>
      </section>

      {!!message && <section className="admin-card px-4 py-3 text-sm text-[var(--accent-strong)]">{message}</section>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="admin-stat-card"><span className="text-xs text-muted">平台总数</span><span className="text-2xl font-bold font-mono">{platforms.length}</span></div>
        <div className="admin-stat-card"><span className="text-xs text-muted">首页目录站点</span><span className="text-2xl font-bold font-mono text-cyan-400">{siteCatalogSites.length}</span></div>
        <div className="admin-stat-card"><span className="text-xs text-muted">已启用监控</span><span className="text-2xl font-bold font-mono text-emerald-400">{platforms.filter((p) => p.monitorEnabled).length}</span></div>
        <div className="admin-stat-card"><span className="text-xs text-muted">属性分组</span><span className="text-2xl font-bold font-mono text-blue-400">{configSummary.groups.length}</span></div>
        <div className="admin-stat-card"><span className="text-xs text-muted">标签选项</span><span className="text-2xl font-bold font-mono text-violet-400">{configSummary.options.length}</span></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {menuCards.map((item) => {
          const Icon = item.icon;
          const isActive = activeWorkspace === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveWorkspace(item.key)}
              className={`admin-card p-6 text-left transition-all ${isActive ? "ring-2 ring-[var(--accent)] bg-[var(--accent-soft)]/60" : "hover:-translate-y-0.5 hover:border-[var(--accent)]/40"}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isActive ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent-strong)]"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    {isActive && <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] text-white">当前</span>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </section>

      <section className="admin-card px-4 py-3 text-sm">
        当前工作区：
        <span className="ml-2 font-semibold text-[var(--accent-strong)]">
          {menuCards.find((item) => item.key === activeWorkspace)?.title}
        </span>
      </section>

      {(activeWorkspace === "overview" || activeWorkspace === "attributes") && (
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="admin-card p-6 space-y-4">
          <div className="flex items-center gap-2"><Shapes className="h-4 w-4 text-[var(--accent-strong)]" /><h3 className="text-base font-semibold">新增 / 编辑属性分组</h3></div>
          <form onSubmit={submitGroup} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2"><span className="admin-label">分组名称（中文）</span><input className="admin-input" value={groupForm.labelZh} onChange={(e) => setGroupForm((s) => ({ ...s, labelZh: e.target.value, label: e.target.value }))} required /></label>
            <label className="space-y-2"><span className="admin-label">分组名称（英文）</span><input className="admin-input" value={groupForm.labelEn} onChange={(e) => setGroupForm((s) => ({ ...s, labelEn: e.target.value }))} placeholder="Route type" /></label>
            <label className="space-y-2"><span className="admin-label">Key（可选）</span><input className="admin-input" value={groupForm.key} onChange={(e) => setGroupForm((s) => ({ ...s, key: e.target.value }))} placeholder="route_type" /></label>
            <label className="space-y-2"><span className="admin-label">类型</span><select className="admin-input" value={groupForm.inputType} onChange={(e) => setGroupForm((s) => ({ ...s, inputType: e.target.value }))}><option value="single_select">单选</option><option value="multi_select">多选</option><option value="boolean">布尔</option><option value="model_selector">模型选择器</option></select></label>
            <label className="space-y-2"><span className="admin-label">排序</span><input type="number" className="admin-input" value={groupForm.sortOrder} onChange={(e) => setGroupForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))} /></label>
            <label className="space-y-2"><span className="admin-label">绑定平台字段</span><select className="admin-input" value={groupForm.boundField} onChange={(e) => setGroupForm((s) => ({ ...s, boundField: e.target.value as typeof s.boundField }))}><option value="none">仅作为普通标签分组</option><option value="site_tag">绑定站点标签类型 / 文案</option><option value="featured_models">绑定主推模型</option></select></label>
            <div className="md:col-span-2 rounded-2xl border border-[var(--border-color)] bg-[var(--background)]/40 p-3 text-xs leading-6 text-[var(--muted)]">
              设计建议：<br />
              1）“分类级别/站点标签”分组可绑定 <span className="font-semibold text-foreground">站点标签类型</span>；<br />
              2）“主推模型”分组可绑定 <span className="font-semibold text-foreground">featured_models</span>；<br />
              3）普通线路、付款方式等保持“仅标签分组”即可。
            </div>
            <div className="md:col-span-2 grid gap-2 sm:grid-cols-4 text-sm">
              {[
                ["enabled", "启用"],
                ["isFilterable", "可筛选"],
                ["isComparable", "可对比"],
                ["isVisibleByDefault", "默认显示"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2">
                  <input type="checkbox" checked={Boolean(groupForm[key as keyof typeof groupForm])} onChange={(e) => setGroupForm((s) => ({ ...s, [key]: e.target.checked }))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-glass btn-glass-primary">{groupForm.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{groupForm.id ? "保存修改" : "新建分组"}</button>
              <button type="button" className="btn-glass" onClick={() => setGroupForm(emptyGroupForm)}>重置</button>
            </div>
          </form>
        </div>

        <div className="admin-card p-6 space-y-4">
          <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-[var(--accent-strong)]" /><h3 className="text-base font-semibold">新增 / 编辑标签选项</h3></div>
          <form onSubmit={submitOption} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2"><span className="admin-label">所属分组</span><select className="admin-input" value={optionForm.groupKey} onChange={(e) => setOptionForm((s) => ({ ...s, groupKey: e.target.value }))} required><option value="">请选择分组</option>{configSummary.groups.map((group) => <option key={group.id} value={group.key}>{group.label}（{group.key}）</option>)}</select></label>
            <label className="space-y-2"><span className="admin-label">标签名称（中文）</span><input className="admin-input" value={optionForm.labelZh} onChange={(e) => setOptionForm((s) => ({ ...s, labelZh: e.target.value, label: e.target.value }))} required /></label>
            <label className="space-y-2"><span className="admin-label">标签名称（英文）</span><input className="admin-input" value={optionForm.labelEn} onChange={(e) => setOptionForm((s) => ({ ...s, labelEn: e.target.value }))} placeholder="Global route" /></label>
            <label className="space-y-2"><span className="admin-label">值编码（可选）</span><input className="admin-input" value={optionForm.value} onChange={(e) => setOptionForm((s) => ({ ...s, value: e.target.value }))} placeholder="cn_direct" /></label>
            <label className="space-y-2"><span className="admin-label">标签颜色</span><input type="color" className="admin-input h-11" value={optionForm.color || DEFAULT_TAG_COLOR} onChange={(e) => setOptionForm((s) => ({ ...s, color: e.target.value || DEFAULT_TAG_COLOR }))} /></label>
            <label className="space-y-2 md:col-span-2"><span className="admin-label">缺省颜色统一为 {DEFAULT_TAG_COLOR}</span><input className="admin-input" value={optionForm.color} onChange={(e) => setOptionForm((s) => ({ ...s, color: e.target.value || DEFAULT_TAG_COLOR }))} placeholder={DEFAULT_TAG_COLOR} /></label>
            <label className="space-y-2"><span className="admin-label">排序</span><input type="number" className="admin-input" value={optionForm.sortOrder} onChange={(e) => setOptionForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))} /></label>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2 mt-7">
              <input type="checkbox" checked={optionForm.enabled} onChange={(e) => setOptionForm((s) => ({ ...s, enabled: e.target.checked }))} />
              <span>启用该标签</span>
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className="btn-glass btn-glass-primary">{optionForm.id ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{optionForm.id ? "保存修改" : "新增标签"}</button>
              <button type="button" className="btn-glass" onClick={() => setOptionForm(emptyOptionForm)}>重置</button>
            </div>
          </form>
        </div>
      </section>
      )}

      {(activeWorkspace === "overview" || activeWorkspace === "attributes") && (
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-4"><h3 className="text-sm font-semibold">属性分组列表</h3></div>
          <div className="divide-y divide-[var(--border-color)]">
            {configSummary.groups.map((group) => (
              <div key={group.id} className="px-6 py-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{group.label}</p>
                    <p className="text-xs text-[var(--muted)]">{group.key} · {group.inputType}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">筛选：{group.isFilterable ? "是" : "否"} · 对比：{group.isComparable ? "是" : "否"} · 默认显示：{group.isVisibleByDefault ? "是" : "否"}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">字段绑定：{group.boundField === "site_tag" ? "站点标签" : group.boundField === "featured_models" ? "主推模型" : "无"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-glass" onClick={() => setGroupForm({ id: group.id, label: group.label, labelZh: group.labelZh || group.label, labelEn: group.labelEn || "", key: group.key, inputType: group.inputType, enabled: group.enabled, isFilterable: !!group.isFilterable, isComparable: !!group.isComparable, isVisibleByDefault: !!group.isVisibleByDefault, sortOrder: group.sortOrder || 0, boundField: group.boundField || "none" })}><Pencil className="h-4 w-4" />编辑</button>
                    <button className="btn-glass" onClick={() => removeGroup(group.id)}><Trash2 className="h-4 w-4" />删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-4"><h3 className="text-sm font-semibold">标签选项列表</h3></div>
          <div className="divide-y divide-[var(--border-color)]">
            {groupedOptions.map(({ group, options }) => (
              <div key={group.id} className="px-6 py-4 text-sm space-y-3">
                <div>
                  <p className="font-semibold">{group.label}</p>
                  <p className="text-xs text-[var(--muted)]">{group.key}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {options.length === 0 ? <span className="text-xs text-[var(--muted)]">暂无标签</span> : options.map((option) => (
                    <div key={option.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] px-3 py-1.5">
                      <span className="soft-tag" style={{ color: option.color || DEFAULT_TAG_COLOR, backgroundColor: `${(option.color || DEFAULT_TAG_COLOR)}1A`, borderColor: `${(option.color || DEFAULT_TAG_COLOR)}33` }}>{option.label}</span>
                      <span className="text-xs text-[var(--muted)]">{option.value}</span>
                      {option.color && <span className="text-xs text-[var(--muted)]">{option.color}</span>}
                      <button className="text-[var(--muted)] hover:text-foreground" onClick={() => setOptionForm({ id: option.id, groupKey: option.groupKey, label: option.label, labelZh: option.labelZh || option.label, labelEn: option.labelEn || "", value: option.value, color: option.color || DEFAULT_TAG_COLOR, enabled: option.enabled, sortOrder: option.sortOrder || 0 })}><Pencil className="h-3.5 w-3.5" /></button>
                      <button className="text-[var(--muted)] hover:text-rose-400" onClick={() => removeOption(option.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {(activeWorkspace === "overview" || activeWorkspace === "platforms" || activeWorkspace === "models" || activeWorkspace === "monitoring" || activeWorkspace === "search") && (
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="admin-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-4"><h3 className="text-sm font-semibold">邮箱制与扩展规划</h3></div>
          <div className="space-y-4 px-6 py-5 text-sm text-[var(--muted)] leading-6">
            <div className="flex items-start gap-3"><Mail className="mt-0.5 h-4 w-4 text-[var(--accent-strong)]" /><p>当前登录注册已切换为邮箱主入口，用户名退化为系统内部兼容字段，显示名称用于前台展示。</p></div>
            <p>现在已经能管理属性分组与标签，下一步直接把平台新增/编辑表单接入属性值保存。</p>
            <p>监控数据仍保留当前探测流程，但连通率与延迟会继续朝“完全由实测聚合驱动”的方向收口。</p>
          </div>
        </div>

        <div className="admin-card overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-6 py-4"><h3 className="text-sm font-semibold">当前平台属性覆盖</h3></div>
          <div className="px-6 py-5 text-sm text-[var(--muted)] leading-7">
            <p>已记录属性值：{configSummary.values?.length || 0} 条</p>
            <p>这意味着前台已经可以基于真实“分组 + 标签”做动态筛选，而不是写死线路/付款方式等固定字段。</p>
            <p>主推模型仍建议单独走模型库 + 平台模型绑定，不与普通标签完全混用。</p>
          </div>
        </div>
      </section>
      )}

      {(activeWorkspace === "overview" || activeWorkspace === "platforms") && (
        <section className="admin-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">首页目录站点管理</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">这里才是首页展示网站的数据源。删除或隐藏这里的测试站点后，首页就不会再显示。</p>
            </div>
            <button type="button" className="btn-glass" onClick={() => loadDashboard().catch(console.error)}>
              <RefreshCw className="h-4 w-4" />刷新
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {siteCatalogSites.map((site) => (
              <div key={site.normalizedHostname} className="rounded-2xl border border-[var(--border-color)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{site.displayName}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{site.normalizedHostname}</p>
                  </div>
                  <span className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] text-[var(--muted)]">{site.catalogStatus}</span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                  <p>可见性：<span className="text-[var(--foreground)]">{site.visibility}</span></p>
                  <p>来源：<span className="text-[var(--foreground)]">{site.sourceStage}/{site.sourceModule}</span></p>
                  <p className="break-all">API Base：<span className="text-[var(--foreground)]">{site.apiBaseUrl}</span></p>
                  <p>更新时间：<span className="text-[var(--foreground)]">{formatAdminDateTime(site.updatedAt)}</span></p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-glass"
                    disabled={siteCatalogActionLoading !== ""}
                    onClick={() => updateSiteCatalogVisibility(site.normalizedHostname, site.catalogStatus === "hidden" || site.visibility === "private" ? "restore" : "hide")}
                  >
                    {site.catalogStatus === "hidden" || site.visibility === "private" ? "恢复首页显示" : "从首页隐藏"}
                  </button>
                  <button
                    type="button"
                    className="btn-glass"
                    disabled={siteCatalogActionLoading !== ""}
                    onClick={() => removeSiteCatalogSite(site.normalizedHostname)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {siteCatalogSites.length === 0 ? <p className="text-sm text-[var(--muted)]">当前没有首页目录站点数据。</p> : null}
          </div>
        </section>
      )}

      {activeWorkspace === "platforms" && (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
          <div className="admin-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--accent-strong)]" />
              <h3 className="text-base font-semibold">平台新增 / 编辑</h3>
            </div>
            <form onSubmit={submitPlatform} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="admin-label">内部 ID（自动生成）</span><input className="admin-input" value={platformForm.id ? String(platformForm.id) : "创建后自动生成"} readOnly disabled /></label>
              <label className="space-y-2"><span className="admin-label">平台 slug</span><input className="admin-input" value={platformForm.slug} onChange={(e) => setPlatformForm((s) => ({ ...s, slug: e.target.value }))} placeholder="openrouter-pro" required /></label>
              <label className="space-y-2"><span className="admin-label">平台名称</span><input className="admin-input" value={platformForm.name} onChange={(e) => setPlatformForm((s) => ({ ...s, name: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">访问域名</span><input className="admin-input" value={platformForm.url} onChange={(e) => setPlatformForm((s) => ({ ...s, url: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">Base URL</span><input className="admin-input" value={platformForm.baseUrl} onChange={(e) => setPlatformForm((s) => ({ ...s, baseUrl: e.target.value }))} /></label>
              <label className="space-y-2 md:col-span-2"><span className="admin-label">访问链接（可选，留空则默认跳到访问域名）</span><input className="admin-input" value={platformForm.visitUrl} onChange={(e) => setPlatformForm((s) => ({ ...s, visitUrl: e.target.value }))} placeholder="https://example.com/register?ref=xxx" /></label>
              {siteTagGroup ? (
                <label className="space-y-2 md:col-span-2"><span className="admin-label">站点标签（已绑定分组：{siteTagGroup.label}）</span><div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-color)] p-3">{configSummary.options.filter((option) => option.groupKey === siteTagGroup.key && option.enabled).map((option) => { const current = ((platformForm as Record<string, unknown>)[`attr_${siteTagGroup.key}`] || "") as string; const active = current === option.value; const color = option.color || DEFAULT_TAG_COLOR; return <button key={option.id} type="button" onClick={() => setPlatformForm((prev) => ({ ...prev, [`attr_${siteTagGroup.key}`]: option.value }))} className={`soft-tag ${active ? "opacity-100 ring-2 ring-[var(--accent)]/20" : "opacity-90"}`} style={{ color, backgroundColor: `${color}1A`, borderColor: `${color}33` }}>{option.label}</button>; })}</div></label>
              ) : (
                <>
                  <label className="space-y-2"><span className="admin-label">站点标签类型</span><select className="admin-input" value={platformForm.tag} onChange={(e) => setPlatformForm((s) => ({ ...s, tag: e.target.value as typeof s.tag }))}><option value="premium">premium</option><option value="free">free</option><option value="stable">stable</option><option value="dead">dead</option></select></label>
                  <label className="space-y-2"><span className="admin-label">站点标签文案</span><input className="admin-input" value={platformForm.tagLabel} onChange={(e) => setPlatformForm((s) => ({ ...s, tagLabel: e.target.value }))} required /></label>
                </>
              )}
              <label className="space-y-2"><span className="admin-label">倍率</span><input className="admin-input" value={platformForm.billingRate} onChange={(e) => setPlatformForm((s) => ({ ...s, billingRate: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">倍率样式类</span><input className="admin-input" value={platformForm.billingColor} onChange={(e) => setPlatformForm((s) => ({ ...s, billingColor: e.target.value }))} /></label>
              <label className="space-y-2"><span className="admin-label">加入日期</span><input type="date" className="admin-input" value={platformForm.joinDate} onChange={(e) => setPlatformForm((s) => ({ ...s, joinDate: e.target.value }))} /></label>
              <label className="space-y-2"><span className="admin-label">排序</span><input type="number" className="admin-input" value={platformForm.sortOrder} onChange={(e) => setPlatformForm((s) => ({ ...s, sortOrder: Number(e.target.value) }))} /></label>
              {featuredModelsGroup ? (
                <div className="space-y-2 md:col-span-2"><span className="admin-label">主推模型（已绑定分组：{featuredModelsGroup.label}）</span><div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-color)] p-3">{(optionsByGroupKey[featuredModelsGroup.key] || []).filter((option) => option.enabled).map((option) => { const selected = (((platformForm as Record<string, unknown>)[`attr_${featuredModelsGroup.key}`] as string[]) || []).includes(option.value); const color = option.color || DEFAULT_TAG_COLOR; return <button key={option.id} type="button" onClick={() => setPlatformForm((prev) => { const key = `attr_${featuredModelsGroup.key}`; const current = Array.isArray((prev as Record<string, unknown>)[key]) ? ((prev as Record<string, unknown>)[key] as string[]) : []; const next = current.includes(option.value) ? current.filter((item) => item !== option.value) : [...current, option.value]; return { ...prev, [key]: next }; })} className={`soft-tag ${selected ? "opacity-100 ring-2 ring-[var(--accent)]/20" : "opacity-90"}`} style={{ color, backgroundColor: `${color}1A`, borderColor: `${color}33` }}>{option.label}</button>; })}{(optionsByGroupKey[featuredModelsGroup.key] || []).filter((option) => option.enabled).length === 0 && <span className="text-xs text-[var(--muted)]">当前绑定分组下还没有可选标签，请先到“标签选项”里新增。</span>}</div></div>
              ) : (
                <label className="space-y-2 md:col-span-2"><span className="admin-label">主推模型（逗号分隔）</span><textarea className="admin-input min-h-24" value={platformForm.modelsText} onChange={(e) => setPlatformForm((s) => ({ ...s, modelsText: e.target.value }))} /></label>
              )}
              <label className="space-y-2 md:col-span-2"><span className="admin-label">描述（中文）</span><textarea className="admin-input min-h-24" value={platformForm.descriptionZh} onChange={(e) => setPlatformForm((s) => ({ ...s, descriptionZh: e.target.value, description: e.target.value }))} /></label>
              <label className="space-y-2 md:col-span-2"><span className="admin-label">描述（英文）</span><textarea className="admin-input min-h-24" value={platformForm.descriptionEn} onChange={(e) => setPlatformForm((s) => ({ ...s, descriptionEn: e.target.value }))} /></label>
              <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2"><input type="checkbox" checked={platformForm.monitorEnabled} onChange={(e) => setPlatformForm((s) => ({ ...s, monitorEnabled: e.target.checked }))} /><span>启用监控</span></label>
                <label className="space-y-2"><span className="admin-label">状态</span><select className="admin-input" value={platformForm.status} onChange={(e) => setPlatformForm((s) => ({ ...s, status: e.target.value }))}><option value="active">active</option><option value="archived">archived</option></select></label>
              </div>
              <div className="md:col-span-2 space-y-4 rounded-2xl border border-[var(--border-color)] p-4">
                <div>
                  <p className="text-sm font-semibold">动态属性值</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">已启用的单选 / 多选分组会在这里直接绑定到平台。</p>
                </div>
                {configSummary.groups.filter((group) => group.enabled && ["single_select", "multi_select"].includes(group.inputType) && !["site_tag", "featured_models"].includes(group.boundField || "none")).map((group) => {
                  const options = configSummary.options.filter((option) => option.groupKey === group.key && option.enabled);
                  const currentValue = (platformForm as Record<string, unknown>)[`attr_${group.key}`];
                  return (
                    <div key={group.id} className="space-y-2">
                      <p className="text-sm font-medium">{group.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {options.map((option) => {
                          const active = group.inputType === "multi_select"
                            ? Array.isArray(currentValue) && currentValue.includes(option.value)
                            : currentValue === option.value;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setPlatformForm((prev) => {
                                const key = `attr_${group.key}`;
                                const prevValue = (prev as Record<string, unknown>)[key];
                                if (group.inputType === "multi_select") {
                                  const current = Array.isArray(prevValue) ? prevValue.map(String) : [];
                                  const next = current.includes(option.value)
                                    ? current.filter((item) => item !== option.value)
                                    : [...current, option.value];
                                  return { ...prev, [key]: next };
                                }
                                return { ...prev, [key]: prevValue === option.value ? "" : option.value };
                              })}
                              className={`soft-tag text-xs transition ${active ? "ring-2 ring-[var(--accent)]/20 opacity-100" : "opacity-90 hover:opacity-100"}`}
                              style={{ color: option.color || DEFAULT_TAG_COLOR, backgroundColor: `${(option.color || DEFAULT_TAG_COLOR)}1A`, borderColor: `${(option.color || DEFAULT_TAG_COLOR)}33` }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" disabled={submitting} className="btn-glass btn-glass-primary">{platformForm.id > 0 ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{platformForm.id > 0 ? "保存平台" : "新增平台"}</button>
                <button type="button" className="btn-glass" onClick={() => setPlatformForm(emptyPlatformForm)}>重置</button>
              </div>
            </form>
          </div>

          <div className="admin-card p-6 space-y-4">
            <h3 className="text-base font-semibold">平台列表</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {platforms.map((platform) => (
                <div key={platform.id} className="rounded-2xl border border-[var(--border-color)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{platform.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{platform.id}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-glass" onClick={() => editPlatform(platform)}><Pencil className="h-4 w-4" />编辑</button>
                      <button className="btn-glass" onClick={() => removePlatform(platform.id)}><Trash2 className="h-4 w-4" />删除</button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)]">状态：{platform.status}</p>
                  <p className="text-sm text-[var(--muted)]">监控：{platform.monitorEnabled ? "开启" : "关闭"}</p>
                  <p className="text-sm text-[var(--muted)]">访问次数：{platform.visitCount || 0}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {configSummary.groups.filter((group) => group.enabled).map((group) => {
                      const own = valuesByPlatform[platform.id]?.[group.key] || [];
                      return own.map((value) => {
                        const option = configSummary.options.find((item) => item.groupKey === group.key && item.value === value);
                        return option ? (
                          <span key={`${platform.id}-${group.key}-${value}`} className="soft-tag" style={{ color: option.color || DEFAULT_TAG_COLOR, backgroundColor: `${(option.color || DEFAULT_TAG_COLOR)}1A`, borderColor: `${(option.color || DEFAULT_TAG_COLOR)}33` }}>
                            {option.label}
                          </span>
                        ) : null;
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeWorkspace === "models" && (
        <section className="admin-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">模型库规划</h3>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            主推模型不建议直接混入普通标签。更合理的做法是：模型库独立维护、平台与模型做绑定，再额外标记 featured / enabled / remark，这样搜索、筛选、对比、排序都更强。
          </p>
          <div className="text-sm text-[var(--muted)]">当前已入库模型数：{configSummary.models.length}</div>
        </section>
      )}

      {activeWorkspace === "monitoring" && (
        <section className="admin-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Radar className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">监控中心规划</h3>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            连通率和延迟不应再作为手工固定字段维护，而应由 probe task + connectivity logs + aggregates 聚合计算得到。当前监控开关和日志基础已在，下一步可以补时间窗口、目标粒度与展示面板。
          </p>
        </section>
      )}

      {activeWorkspace === "search" && (
        <section className="admin-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-[var(--accent-strong)]" />
            <h3 className="text-base font-semibold">搜索工作台规划</h3>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">
            首页顶部建议替换为搜索工作台：支持关键词、动态分组筛选、主推模型筛选、列显示控制、单列排序、结果对比。后台这里的分组/标签配置就是它的核心驱动数据。
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>搜索条件由 enabled + isFilterable 的分组动态生成</li>
            <li>结果列表列由 isComparable + isVisibleByDefault 控制</li>
            <li>模型维度建议走独立模型库，不与普通标签平铺混用</li>
          </ul>
        </section>
      )}

      {activeWorkspace === "sks" && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="admin-stat-card"><span className="text-xs text-muted">SKS 站点</span><span className="text-2xl font-bold font-mono">{sksOverview.siteCount}</span></div>
            <div className="admin-stat-card"><span className="text-xs text-muted">已启用凭据</span><span className="text-2xl font-bold font-mono text-emerald-400">{sksOverview.enabledCredentialCount}</span></div>
            <div className="admin-stat-card"><span className="text-xs text-muted">已记录模型</span><span className="text-2xl font-bold font-mono text-blue-400">{sksOverview.modelCount}</span></div>
            <div className="admin-stat-card"><span className="text-xs text-muted">当前异常站点</span><span className="text-2xl font-bold font-mono text-rose-400">{sksOverview.failedCount + sksOverview.degradedCount}</span></div>
          </section>

          <section className="admin-card p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold">已登记 SKS 站点</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">点击站点即可查看凭据、模型、近期探测结果，并在后台做维护。</p>
                </div>
                <button type="button" className="btn-glass" onClick={() => refreshSksWorkspace().catch(console.error)}>
                  <RefreshCw className="h-4 w-4" />刷新
                </button>
              </div>

              {sksSites.length > 0 ? (
                <div className="grid gap-3">
                  {sksSites.map((item) => {
                    const siteKey = item.site.normalizedHostname || item.site.id;
                    const isActive = selectedSksSiteKey === siteKey;
                    const isPaused = item.site.statusVisibility === "private";
                    const statusMeta = getSksStatusMeta(item.currentStatus);
                    return (
                      <div
                        key={item.site.id}
                        className={`rounded-2xl border p-4 transition ${isPaused ? "border-slate-400/30 bg-slate-200/60 text-slate-700 dark:border-slate-700/60 dark:bg-slate-800/70 dark:text-slate-300" : ""} ${isActive ? "border-[var(--accent)] bg-[var(--accent-soft)]/40 ring-2 ring-[var(--accent)]/15" : isPaused ? "" : "border-[var(--border-color)] hover:border-[var(--accent)]/40 hover:bg-[var(--card-hover)]"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSksSiteKey(siteKey);
                            }}
                            className="flex-1 cursor-pointer text-left"
                          >
                            <div>
                              <p className="font-semibold text-[var(--foreground)]">{item.site.displayName}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">{item.site.hostname}</p>
                            </div>
                          </button>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${isPaused ? "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:border-slate-600/50 dark:bg-slate-700/40 dark:text-slate-300" : statusMeta.className}`}>{isPaused ? "已暂停" : statusMeta.label}</span>
                            <button type="button" className="btn-glass" onClick={() => refreshSksSiteProbe(siteKey)} disabled={sksActionLoading !== ""}>
                              {sksActionLoading === "probe" && selectedSksSiteKey === siteKey ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              刷新检测
                            </button>
                            <button type="button" className="btn-glass" onClick={() => updateSksSiteMeta(item.site.statusVisibility === "private" ? "resume" : "pause", siteKey)} disabled={sksActionLoading !== ""}>
                              {item.site.statusVisibility === "private" ? "恢复" : "暂停"}
                            </button>
                            <button type="button" className="btn-glass" onClick={() => removeSksSite(siteKey)} disabled={sksActionLoading !== ""}>
                              删除
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                          <span>启用凭据：{item.enabledCredentialCount}/{item.credentialCount}</span>
                          <span>模型数：{item.modelCount}</span>
                          <span>可见性：{item.site.statusVisibility}</span>
                          <span>最近检查：{formatAdminDateTime(item.lastCheckedAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">当前还没有 SKS 站点。后续用户提交并收录后，这里会显示可维护的站点列表。</p>
              )}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <section className="admin-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">站点详情与当前状态</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">这里会联动展示站点基础信息、凭据池、模型列表与公开状态摘要。</p>
                  </div>
                  {sksDetail ? (
                    <div className="flex flex-wrap gap-2">
                      <a href={`/sks/site/${encodeURIComponent(sksDetail.site.normalizedHostname || sksDetail.site.id)}`} target="_blank" rel="noreferrer" className="btn-glass">
                        查看状态页
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                      <a href={`/api/sks/site/${encodeURIComponent(sksDetail.site.normalizedHostname || sksDetail.site.id)}`} target="_blank" rel="noreferrer" className="btn-glass">
                        查看 JSON
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  ) : null}
                </div>

                {sksDetailLoading ? (
                  <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" /></div>
                ) : sksDetail ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{sksDetail.site.displayName}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">{sksDetail.site.hostname}</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getSksStatusMeta(sksDetail.publicView?.current.status || "unknown").className}`}>{getSksStatusMeta(sksDetail.publicView?.current.status || "unknown").label}</span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="space-y-2">
                            <span className="admin-label">站点名称</span>
                            <input className="admin-input" value={sksEditForm.displayName} onChange={(e) => setSksEditForm((prev) => ({ ...prev, displayName: e.target.value }))} />
                          </label>
                          <label className="space-y-2">
                            <span className="admin-label">站点首页</span>
                            <input className="admin-input" value={sksEditForm.homepageUrl} onChange={(e) => setSksEditForm((prev) => ({ ...prev, homepageUrl: e.target.value }))} placeholder="https://example.com" />
                          </label>
                          <label className="space-y-2 md:col-span-2">
                            <span className="admin-label">API Base URL</span>
                            <input className="admin-input" value={sksEditForm.apiBaseUrl} onChange={(e) => setSksEditForm((prev) => ({ ...prev, apiBaseUrl: e.target.value }))} />
                          </label>
                          <label className="space-y-2">
                            <span className="admin-label">可见性</span>
                            <select className="admin-input" value={sksEditForm.statusVisibility} onChange={(e) => setSksEditForm((prev) => ({ ...prev, statusVisibility: e.target.value as typeof prev.statusVisibility }))}>
                              <option value="public">public</option>
                              <option value="unlisted">unlisted</option>
                              <option value="private">private</option>
                            </select>
                          </label>
                          <label className="space-y-2">
                            <span className="admin-label">归属状态</span>
                            <select className="admin-input" value={sksEditForm.ownershipStatus} onChange={(e) => setSksEditForm((prev) => ({ ...prev, ownershipStatus: e.target.value }))}>
                              <option value="unclaimed">unclaimed</option>
                              <option value="observed">observed</option>
                              <option value="probable_owner">probable_owner</option>
                              <option value="claimed">claimed</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 space-y-2 text-xs leading-6 text-[var(--muted)]">
                          <p>当前记录 API Base：<span className="break-all text-[var(--foreground)]">{sksDetail.site.apiBaseUrl}</span></p>
                          <p>当前记录 Homepage：<span className="break-all text-[var(--foreground)]">{sksDetail.site.homepageUrl || "—"}</span></p>
                          <p>可见性：<span className="text-[var(--foreground)]">{sksDetail.site.statusVisibility}</span> · 归属状态：<span className="text-[var(--foreground)]">{sksDetail.site.ownershipStatus}</span></p>
                          <p>最近检查：<span className="text-[var(--foreground)]">{formatAdminDateTime(sksDetail.publicView?.current.checkedAt)}</span></p>
                          <p>当前延迟：<span className="text-[var(--foreground)]">{formatAdminLatency(sksDetail.publicView?.current.totalMs)}</span></p>
                          <p>7 天成功率：<span className="text-[var(--foreground)]">{sksDetail.publicView ? `${sksDetail.publicView.stats7d.successRate.toFixed(1)}%` : "—"}</span></p>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" disabled={sksActionLoading !== ""} className="btn-glass" onClick={() => updateSksSiteMeta("edit")}>
                            {sksActionLoading === "edit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}保存修改
                          </button>
                          <button type="button" disabled={sksActionLoading !== ""} className="btn-glass" onClick={() => updateSksSiteMeta(sksDetail.site.statusVisibility === "private" ? "resume" : "pause")}>
                            {sksActionLoading === "pause" || sksActionLoading === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            {sksDetail.site.statusVisibility === "private" ? "恢复站点" : "暂停站点"}
                          </button>
                          <button type="button" disabled={sksActionLoading !== ""} className="btn-glass" onClick={() => removeSksSite()}>
                            {sksActionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}删除站点
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-[var(--accent-strong)]" />
                          <p className="font-semibold text-[var(--foreground)]">凭据池</p>
                        </div>
                        <div className="mt-3 space-y-3">
                          {sksDetail.credentials.length > 0 ? sksDetail.credentials.map((credential) => (
                            <div key={credential.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--background)]/60 p-3 text-xs text-[var(--muted)]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-[var(--foreground)]">{credential.label || credential.apiKeyPreview}</p>
                                  <p className="mt-1">{credential.apiKeyPreview} · {credential.sourceType}</p>
                                </div>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${credential.isEnabled ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300"}`}>{credential.isEnabled ? "启用" : "停用"}</span>
                              </div>
                              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                <span>优先级：{credential.priorityScore}</span>
                                <span>稳定度：{credential.stabilityScore.toFixed(1)}%</span>
                                <span>成功：{credential.successCount}</span>
                                <span>失败：{credential.failureCount}</span>
                                <span>最近验证：{formatAdminDateTime(credential.lastVerifiedAt)}</span>
                                <span>最近成功：{formatAdminDateTime(credential.lastSuccessAt)}</span>
                              </div>
                            </div>
                          )) : <p className="text-xs text-[var(--muted)]">当前没有已保存凭据。</p>}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">当前模型列表</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">这里展示该站点当前已记录的模型清单。</p>
                        </div>
                        <span className="text-xs text-[var(--muted)]">共 {sksDetail.models.length} 个模型</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {sksDetail.models.length > 0 ? sksDetail.models.map((model) => (
                          <span
                            key={model.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--background)]/70 px-3 py-1 text-xs text-[var(--muted)]"
                          >
                            <span>{model.modelName}</span>
                            {model.isHot ? <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] text-white">hot</span> : null}
                          </span>
                        )) : <span className="text-xs text-[var(--muted)]">当前暂无模型记录。</span>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">请先在上方选择一个 SKS 站点。</p>
                )}
              </section>
            </div>

            <div className="space-y-6">
              <section className="admin-card p-6 space-y-4">
                <div>
                  <h3 className="text-base font-semibold">近期探测记录</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">包含模型列表抓取与单模型推理结果，便于定位鉴权、模型、网络与限流问题。</p>
                </div>
                {sksDetail?.recentProbes?.length ? (
                  <div className="space-y-2">
                    {sksDetail.recentProbes.slice(0, 12).map((probe) => (
                      <div key={probe.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-hover)] p-3 text-xs text-[var(--muted)]">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${getSksStatusMeta(probe.status).className}`}>{getSksStatusMeta(probe.status).label}</span>
                              <span className="font-medium text-[var(--foreground)]">{probe.probeType}</span>
                              {probe.modelName ? <span className="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px] text-[var(--foreground)]">{probe.modelName}</span> : null}
                            </div>
                            <p className="mt-2 leading-6">HTTP：{probe.httpStatus ?? "—"} · 延迟：{formatAdminLatency(probe.totalMs)} · 检查时间：{formatAdminDateTime(probe.checkedAt)}</p>
                            {probe.errorMessage ? <p className="mt-1 text-rose-500">{probe.errorMessage}</p> : null}
                          </div>
                          <span className="text-[10px] uppercase tracking-[0.15em] text-[var(--muted)]">{probe.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">当前还没有探测记录。</p>
                )}
              </section>
            </div>

          </section>
        </>
      )}
    </div>
  );
}
