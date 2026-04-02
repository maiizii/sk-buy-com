"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Database,
  LayoutDashboard,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Radar,
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
  id: string;
  name: string;
  url: string;
  baseUrl?: string;
  tag?: "premium" | "free" | "stable" | "dead";
  tagLabel?: string;
  billingRate?: string;
  billingColor?: string;
  models?: string[];
  joinDate?: string;
  description?: string;
  sortOrder?: number;
  monitorEnabled: boolean;
  status: string;
}

interface GroupRecord {
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

interface OptionRecord {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color?: string;
  enabled: boolean;
  sortOrder?: number;
}

interface ConfigSummary {
  groups: GroupRecord[];
  options: OptionRecord[];
  models: Array<{ id: string; key: string; name: string; vendor: string; featured: boolean }>;
  values?: Array<{ id: number; platformId: string; groupKey: string; optionValue: string; valueText?: string }>;
}

const t = getMessages();

const emptyGroupForm: {
  id: string;
  label: string;
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
  value: "",
  color: DEFAULT_TAG_COLOR,
  enabled: true,
  sortOrder: 0,
};

const emptyPlatformForm = {
  id: "",
  name: "",
  url: "",
  baseUrl: "",
  tag: "stable" as const,
  tagLabel: "",
  billingRate: "",
  billingColor: "text-foreground",
  modelsText: "",
  joinDate: new Date().toISOString().split("T")[0],
  description: "",
  sortOrder: 0,
  monitorEnabled: false,
  status: "active",
};

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

type AdminWorkspaceKey = "overview" | "platforms" | "attributes" | "models" | "monitoring" | "search";

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

  const loadDashboard = async () => {
    const [platformRes, configRes] = await Promise.all([
      fetch("/api/platforms"),
      fetch("/api/platforms/config"),
    ]);
    const platformData = await platformRes.json();
    const configData = await configRes.json();
    if (platformData.success) setPlatforms(platformData.data);
    if (configData.success) setConfigSummary(configData.data);
  };

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
  }, [user]);

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
    return (configSummary.values || []).reduce<Record<string, Record<string, string[]>>>((acc, item) => {
      acc[item.platformId] ??= {};
      acc[item.platformId][item.groupKey] ??= [];
      if (item.optionValue) acc[item.platformId][item.groupKey].push(item.optionValue);
      return acc;
    }, {});
  }, [configSummary.values]);

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

      const payload = {
        id: platformForm.id,
        name: platformForm.name,
        url: platformForm.url,
        baseUrl: platformForm.baseUrl,
        tag: siteTagOption ? (["premium", "free", "stable", "dead"].includes(siteTagOption.value) ? siteTagOption.value : "stable") : platformForm.tag,
        tagLabel: siteTagOption?.label || platformForm.tagLabel,
        billingRate: platformForm.billingRate,
        billingColor: platformForm.billingColor,
        models: featuredModelsGroup ? featuredModelNames : platformForm.modelsText,
        joinDate: platformForm.joinDate,
        description: platformForm.description,
        sortOrder: Number(platformForm.sortOrder || 0),
        monitorEnabled: platformForm.monitorEnabled,
        status: platformForm.status,
        attributeValues,
      };

      const res = await fetch("/api/platforms", {
        method: platformForm.id && platforms.some((item) => item.id === platformForm.id) ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "保存平台失败");
      setMessage(platforms.some((item) => item.id === platformForm.id) ? "平台已更新" : "平台已创建");
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
      name: platform.name,
      url: platform.url,
      baseUrl: platform.baseUrl || "",
      tag: platform.tag || "stable",
      tagLabel: platform.tagLabel || "",
      billingRate: platform.billingRate || "",
      billingColor: platform.billingColor || "text-foreground",
      modelsText: (platform.models || []).join(", "),
      joinDate: platform.joinDate || new Date().toISOString().split("T")[0],
      description: platform.description || "",
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

  const removePlatform = async (id: string) => {
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="admin-stat-card"><span className="text-xs text-muted">平台总数</span><span className="text-2xl font-bold font-mono">{platforms.length}</span></div>
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
            <label className="space-y-2 md:col-span-2"><span className="admin-label">分组名称</span><input className="admin-input" value={groupForm.label} onChange={(e) => setGroupForm((s) => ({ ...s, label: e.target.value }))} required /></label>
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
            <label className="space-y-2"><span className="admin-label">标签名称</span><input className="admin-input" value={optionForm.label} onChange={(e) => setOptionForm((s) => ({ ...s, label: e.target.value }))} required /></label>
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
                    <button className="btn-glass" onClick={() => setGroupForm({ id: group.id, label: group.label, key: group.key, inputType: group.inputType, enabled: group.enabled, isFilterable: !!group.isFilterable, isComparable: !!group.isComparable, isVisibleByDefault: !!group.isVisibleByDefault, sortOrder: group.sortOrder || 0, boundField: group.boundField || "none" })}><Pencil className="h-4 w-4" />编辑</button>
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
                      <button className="text-[var(--muted)] hover:text-foreground" onClick={() => setOptionForm({ id: option.id, groupKey: option.groupKey, label: option.label, value: option.value, color: option.color || DEFAULT_TAG_COLOR, enabled: option.enabled, sortOrder: option.sortOrder || 0 })}><Pencil className="h-3.5 w-3.5" /></button>
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

      {activeWorkspace === "platforms" && (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_1.4fr]">
          <div className="admin-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--accent-strong)]" />
              <h3 className="text-base font-semibold">平台新增 / 编辑</h3>
            </div>
            <form onSubmit={submitPlatform} className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2"><span className="admin-label">平台 ID</span><input className="admin-input" value={platformForm.id} onChange={(e) => setPlatformForm((s) => ({ ...s, id: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">平台名称</span><input className="admin-input" value={platformForm.name} onChange={(e) => setPlatformForm((s) => ({ ...s, name: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">访问域名</span><input className="admin-input" value={platformForm.url} onChange={(e) => setPlatformForm((s) => ({ ...s, url: e.target.value }))} required /></label>
              <label className="space-y-2"><span className="admin-label">Base URL</span><input className="admin-input" value={platformForm.baseUrl} onChange={(e) => setPlatformForm((s) => ({ ...s, baseUrl: e.target.value }))} /></label>
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
              <label className="space-y-2 md:col-span-2"><span className="admin-label">描述</span><textarea className="admin-input min-h-24" value={platformForm.description} onChange={(e) => setPlatformForm((s) => ({ ...s, description: e.target.value }))} /></label>
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
                <button type="submit" disabled={submitting} className="btn-glass btn-glass-primary">{platforms.some((item) => item.id === platformForm.id) ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{platforms.some((item) => item.id === platformForm.id) ? "保存平台" : "新增平台"}</button>
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
    </div>
  );
}
