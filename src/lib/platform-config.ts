export interface PlatformAttributeGroup {
  id: string;
  key: string;
  label: string;
  inputType: "single_select" | "multi_select" | "boolean" | "model_selector";
  enabled: boolean;
  isFilterable: boolean;
  isComparable: boolean;
  isVisibleByDefault: boolean;
  sortOrder: number;
  boundField?: "none" | "site_tag" | "featured_models";
}

export interface PlatformAttributeOption {
  id: string;
  groupKey: string;
  value: string;
  label: string;
  color?: string;
  enabled: boolean;
  sortOrder: number;
}

export interface ModelRegistryItem {
  id: string;
  key: string;
  name: string;
  vendor: string;
  featured: boolean;
}

export const platformAttributeGroupsSeed: PlatformAttributeGroup[] = [
  {
    id: "group_route_type",
    key: "route_type",
    label: "线路",
    inputType: "single_select",
    enabled: true,
    isFilterable: true,
    isComparable: true,
    isVisibleByDefault: true,
    sortOrder: 1,
    boundField: "site_tag",
  },
  {
    id: "group_payment_methods",
    key: "payment_methods",
    label: "付款方式",
    inputType: "multi_select",
    enabled: true,
    isFilterable: true,
    isComparable: true,
    isVisibleByDefault: false,
    sortOrder: 2,
    boundField: "none",
  },
  {
    id: "group_featured_models",
    key: "featured_models",
    label: "主推模型",
    inputType: "model_selector",
    enabled: true,
    isFilterable: true,
    isComparable: true,
    isVisibleByDefault: true,
    sortOrder: 3,
    boundField: "featured_models",
  },
];

export const platformAttributeOptionsSeed: PlatformAttributeOption[] = [
  { id: "option_route_cn_direct", groupKey: "route_type", value: "cn_direct", label: "中国直连", enabled: true, sortOrder: 1 },
  { id: "option_route_global", groupKey: "route_type", value: "global_route", label: "国际线路", enabled: true, sortOrder: 2 },
  { id: "option_payment_alipay", groupKey: "payment_methods", value: "alipay", label: "支付宝", enabled: true, sortOrder: 1 },
  { id: "option_payment_wechat", groupKey: "payment_methods", value: "wechat_pay", label: "微信支付", enabled: true, sortOrder: 2 },
  { id: "option_payment_crypto", groupKey: "payment_methods", value: "crypto", label: "加密货币", enabled: true, sortOrder: 3 },
];

export const modelRegistrySeed: ModelRegistryItem[] = [
  { id: "model_gpt_4o", key: "gpt_4o", name: "GPT-4o", vendor: "openai", featured: true },
  { id: "model_claude_3_7_sonnet", key: "claude_3_7_sonnet", name: "Claude 3.7 Sonnet", vendor: "anthropic", featured: true },
  { id: "model_gemini_2_5_pro", key: "gemini_2_5_pro", name: "Gemini 2.5 Pro", vendor: "google", featured: true },
  { id: "model_deepseek_v3", key: "deepseek_v3", name: "DeepSeek V3", vendor: "deepseek", featured: true },
];
