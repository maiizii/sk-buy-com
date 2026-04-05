# SKS 模块详细设计文档

> 文档状态：V1 设计稿  
> 适用范围：sk-buy 内部集成 + 未来可拆分独立项目部署  
> 模块代号：**sks**  
> 模块全名建议：**SKS (SK Status)** / **sks-monitor**

---

## 1. 背景与目标

### 1.1 背景

当前 sk-buy 已经有“测试网站连通性”的基础能力，但后续要做的不只是平台页面里的一个辅助功能，而是一个可独立演进的“第三方 API 状态观测模块”。

这个模块的定位，不是给平台自己做自监控，而是由 sk-buy 或 SKS 以第三方视角，对各平台的 API 进行低频、低成本、长期可视化的观测，并把结果展示给：

1. sk-buy 用户
2. 平台站长
3. 提供 key 的网友/贡献者
4. 外部站点（通过嵌入代码、iframe、script、JSON API 使用）

### 1.2 与 check-cx 的根本区别

`check-cx` 的本质是：

- 站点自己部署
- 站点自己提供 key
- 重点是“我自己的平台现在还能不能调通”

而 `sks` 的本质是：

- sk-buy / 独立服务统一部署
- 面向第三方平台做观测
- 重点是“这个平台在外部用户视角下是否稳定、支持哪些模型、模型真实可用性如何”

因此，`sks` 不应照搬 check-cx 的复杂机制，而应保留其“真实调用验证 + 历史记录 + 时间线展示”的核心思路，做更轻、更省钱、更产品化的版本。

### 1.3 核心目标

`sks` 第一阶段只聚焦 3 件事：

1. **站点连通性**
   - endpoint 是否可访问
   - key 是否有效
   - 基础网络/鉴权是否正常

2. **可用模型列表**
   - 平台当前返回的模型列表
   - 模型列表的最近发现时间
   - 模型上下线变化

3. **模型实际连通情况**
   - 针对模型做极简真实请求
   - 记录成功/失败、首包速度、总耗时
   - 展示最近 24~48 小时的小方格历史

### 1.4 产品目标

`sks` 同时服务两个方向：

#### A. sk-buy 内部使用

用于平台详情页、比较页、发现页等，展示某平台当前状态、模型覆盖、最近稳定性。

#### B. 独立对外模块

允许任何人申请一个状态展示接口或小组件，只要提供 API 地址与 key，就能生成自己的状态页/嵌入组件。

这意味着：

- sk-buy 只是 `sks` 的一个“调用方”
- 第三方站长/网友也是 `sks` 的调用方
- 未来 `sks` 可独立部署、独立仓库、独立数据库

---

## 2. 命名与域名建议

## 2.1 模块命名

由于 `status` 这个名字过于通用，且 `stat.sk-buy.com` 未来可能有别的用途，因此建议：

- 模块代号：`sks`
- 产品名：`SKS` 或 `SK Status`
- 仓库名建议：
  - `sks`
  - `sk-buy-sks`
  - `sk-status-module`

### 推荐

**内部代号统一使用 `sks`**。

原因：

- 短，适合做目录、包名、表前缀、服务名
- 后续拆仓库也自然
- 避免直接与通用 `status` 混淆

## 2.2 域名建议

不建议直接把模块主命名叫 `status`，推荐以下方案：

### 推荐主方案

- `sks.sk-buy.com`：模块主站
- `api.sks.sk-buy.com`：对外 API
- `embed.sks.sk-buy.com`：嵌入脚本/iframe

### 备选方案

- `monitor.sk-buy.com`
- `api-monitor.sk-buy.com`
- `health.sk-buy.com`
- `watch.sk-buy.com`

### 最终建议

优先使用：

- **产品入口：`sks.sk-buy.com`**
- **API：`api.sks.sk-buy.com`**
- **嵌入静态资源：`embed.sks.sk-buy.com`**

---

## 3. 设计原则

## 3.1 简洁优先

不做过多指标，不追求企业级复杂监控平台，而是聚焦用户最在意的信息：

- 能不能连
- 有哪些模型
- 哪些模型真能调
- 最近 24~48 小时稳不稳
- 快不快

## 3.2 真实调用优先于假 ping

纯 ping/纯 TCP/纯 HTTP 200 无法代表模型能用。

因此 `sks` 的检测必须以 **真实 API 请求** 为核心，只是在成本控制前提下做“极简调用”。

## 3.3 成本敏感

由于检测会消耗 key 额度，因此设计上必须：

- 降低检测频率
- 控制 token 消耗
- 控制模型覆盖策略
- 支持 key 轮换与优先级策略

## 3.4 Hostname 纯净化

未来 sk-buy 主站、sks 模块、独立站点之间交换核心归属信息时，统一使用 **纯净 Hostname** 作为跨系统主关联键。

例如：

- `api.example.com`
- `example.com`
- `chat.example.com`

而不是用带路径、scheme、query 的 URL。

## 3.5 无感认证

站长不需要做复杂验证，也不需要额外插 meta、上传文件、手工埋代码验证。

系统通过：

- 站长是否真的将 `sks` 组件应用到了同 hostname 的站点上
- 该组件调用是否可识别出创建来源用户
- 调用行为是否持续稳定

来完成“无感所有权认证”。

## 3.6 自用与第三方同源

不需要特别区分“sk-buy 自用”和“第三方站点调用”。

本质上：

- sk-buy 是 `sks` 的一个内部客户
- 外部站长/网友也是 `sks` 的外部客户

差别只在权限和展示定制，不在核心数据结构与调用链路。

---

## 4. 模块边界与职责

`sks` 建议拆成 6 个子能力：

1. **Site Registry（站点注册）**
   - 注册目标站点
   - 规范化 hostname
   - 管理站点归属、别名、状态

2. **Credential Pool（凭据池）**
   - 存储不同来源提供的 key
   - 维护来源优先级、稳定性评分、可用性
   - 支持自动切换

3. **Probe Engine（探测引擎）**
   - 执行站点探测、模型列表拉取、模型调用验证
   - 记录延迟、错误、结果

4. **History & Aggregation（历史与聚合）**
   - 存储 24~48h 原始点位
   - 生成小方格展示数据
   - 计算可用率、平均耗时、模型覆盖率

5. **Embed & API（对外接口）**
   - 生成 iframe/script/API 嵌入方案
   - 输出统一的状态 JSON

6. **Ownership Recognition（无感归属识别）**
   - 基于嵌入调用与 hostname 对齐
   - 判定是否为实际站长/运营者
   - 赋予 sk-buy 平台管理权限

---

## 5. 系统架构建议

## 5.1 第一阶段架构

第一阶段建议仍放在 `sk-buy` 仓库内，但目录设计按未来可拆分方式组织。

建议目录：

```txt
src/
  sks/
    core/
    probes/
    widgets/
    api/
    db/
    types/
    services/
```

或者直接根目录独立：

```txt
modules/
  sks/
    README.md
    docs/
    src/
```

### 推荐

如果暂时不改动工程结构，可先采用：

```txt
src/lib/sks/
src/app/api/sks/
src/components/sks/
```

等模块成熟后再单独抽仓库。

## 5.2 第二阶段架构

成熟后可拆成独立服务：

### 服务划分

1. **sks-web**
   - 状态页
   - 申请页
   - 管理后台
   - 组件预览页

2. **sks-api**
   - 对外 JSON API
   - 嵌入数据接口
   - webhook / site binding API

3. **sks-worker**
   - 定时拉取模型列表
   - 模型探测
   - key 健康检查
   - 数据聚合

4. **sks-db**
   - 独立数据库
   - 与 sk-buy 仅交换 hostname / 归属关系 / 摘要数据

## 5.3 与 sk-buy 的数据交换

sk-buy 和 sks 之间应尽量少耦合，只通过干净字段交换。

### 交换主键

- `hostname`

### 可同步的数据

- 站点归属用户 ID
- 站点展示状态摘要
- 最近活跃检测结果
- 是否已识别为站长
- 可公开展示的模型列表摘要

### 不建议直接共享的数据

- 原始 API key
- 全量内部探测日志
- 明细请求/响应内容
- 敏感错误堆栈

---

## 6. 核心业务对象

## 6.1 Site（站点）

表示一个被观测的平台站点。

核心字段：

- `id`
- `hostname`
- `normalized_hostname`
- `display_name`
- `homepage_url`
- `api_base_url`
- `platform_type`
- `status_visibility`
- `owner_user_id`（可空）
- `ownership_status`
- `created_by_user_id`
- `created_at`
- `updated_at`

说明：

- `hostname` 是跨模块核心关联字段
- `ownership_status` 用于表示是否已被系统认定为站长控制

## 6.2 Credential（凭据）

表示用于检测该站点的一组 API 访问凭据。

来源分 3 类：

1. `owner`：站长提供
2. `community`：网友提供
3. `system`：sk-buy / sks 自有

核心字段：

- `id`
- `site_id`
- `source_type` (`owner/community/system`)
- `submitted_by_user_id`
- `api_key_encrypted`
- `api_base_url`
- `label`
- `is_enabled`
- `first_verified_at`
- `last_verified_at`
- `last_success_at`
- `last_failure_at`
- `stability_score`
- `priority_score`
- `failure_count`
- `success_count`
- `cooldown_until`
- `created_at`

## 6.3 Site Model（站点模型）

表示在某个站点上发现过的模型。

核心字段：

- `id`
- `site_id`
- `model_name`
- `provider_family`
- `first_seen_at`
- `last_seen_at`
- `is_currently_listed`
- `is_test_target`
- `last_list_source_credential_id`

## 6.4 Probe Result（探测结果）

每一次检测结果。

核心字段：

- `id`
- `site_id`
- `credential_id`
- `probe_type`
- `model_name`（可空）
- `status`
- `ttfb_ms`
- `total_ms`
- `response_chars`
- `http_status`
- `error_type`
- `error_message`
- `checked_at`

### probe_type 建议值

- `site_connectivity`
- `model_list`
- `model_inference`

### status 建议值

- `ok`
- `slow`
- `timeout`
- `auth_error`
- `rate_limited`
- `model_error`
- `network_error`
- `unknown`

## 6.5 Widget（展示组件）

表示对外提供给站长/调用者使用的展示实例。

核心字段：

- `id`
- `site_id`
- `created_by_user_id`
- `widget_token`
- `widget_type`
- `theme`
- `style_preset`
- `allowed_hostname`
- `is_public`
- `created_at`
- `updated_at`

### widget_type 建议值

- `badge`
- `mini-grid`
- `full-card`
- `json-feed`

## 6.6 Ownership Signal（归属信号）

用于无感识别站长。

核心字段：

- `id`
- `site_id`
- `user_id`
- `widget_id`
- `observed_hostname`
- `observed_at`
- `confidence_score`
- `signal_type`

### signal_type 建议值

- `embed_runtime_match`
- `iframe_referrer_match`
- `script_referrer_match`
- `long_term_usage_match`

---

## 7. 数据库表设计建议

以下为第一版最小表结构建议。

## 7.1 `sks_sites`

```sql
id uuid pk
hostname text unique not null
normalized_hostname text unique not null
display_name text not null
homepage_url text null
api_base_url text not null
platform_type text null
owner_user_id uuid null
ownership_status text not null default 'unclaimed'
status_visibility text not null default 'public'
created_by_user_id uuid null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 7.2 `sks_credentials`

```sql
id uuid pk
site_id uuid not null references sks_sites(id)
source_type text not null
submitted_by_user_id uuid null
api_key_encrypted text not null
api_base_url text not null
label text null
is_enabled boolean not null default true
first_verified_at timestamptz null
last_verified_at timestamptz null
last_success_at timestamptz null
last_failure_at timestamptz null
stability_score numeric(10,4) not null default 0
priority_score numeric(10,4) not null default 0
success_count integer not null default 0
failure_count integer not null default 0
cooldown_until timestamptz null
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 7.3 `sks_site_models`

```sql
id uuid pk
site_id uuid not null references sks_sites(id)
model_name text not null
provider_family text null
first_seen_at timestamptz not null default now()
last_seen_at timestamptz not null default now()
is_currently_listed boolean not null default true
is_test_target boolean not null default true
last_list_source_credential_id uuid null references sks_credentials(id)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
unique(site_id, model_name)
```

## 7.4 `sks_probe_results`

```sql
id bigint generated always as identity pk
site_id uuid not null references sks_sites(id)
credential_id uuid null references sks_credentials(id)
probe_type text not null
model_name text null
status text not null
http_status integer null
ttfb_ms integer null
total_ms integer null
response_chars integer null
error_type text null
error_message text null
checked_at timestamptz not null
created_at timestamptz not null default now()
```

## 7.5 `sks_widgets`

```sql
id uuid pk
site_id uuid not null references sks_sites(id)
created_by_user_id uuid null
widget_token text unique not null
widget_type text not null
theme text not null default 'auto'
style_preset text not null default 'default'
allowed_hostname text null
is_public boolean not null default true
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

## 7.6 `sks_ownership_signals`

```sql
id bigint generated always as identity pk
site_id uuid not null references sks_sites(id)
user_id uuid not null
widget_id uuid null references sks_widgets(id)
observed_hostname text not null
signal_type text not null
confidence_score numeric(10,4) not null default 0
observed_at timestamptz not null default now()
created_at timestamptz not null default now()
```

## 7.7 聚合表（可选）

### `sks_site_status_hourly`

按小时聚合站点级状态。

### `sks_model_status_hourly`

按小时聚合模型级状态，供小方格快速查询。

第一阶段如果数据量不大，可以先不做聚合表，后续再补。

---

## 8. Hostname 规范化规则

由于 Hostname 是核心连接键，必须有严格规则。

## 8.1 规范化目标

把以下内容统一成稳定值：

- `https://api.example.com/v1`
- `https://api.example.com/v1/chat/completions`
- `http://api.example.com/`

最终提取为：

- `api.example.com`

## 8.2 规则建议

1. 去掉 scheme（http/https）
2. 去掉 path/query/hash
3. 统一转小写
4. 去掉默认端口
5. 保留子域名，不强制归并到主域
6. 特殊情况下可另存 `root_domain`

## 8.3 存储建议

同时存两种：

- `hostname`：纯 hostname
- `root_domain`：根域名（可选）

例如：

- `api.example.com` -> root_domain: `example.com`
- `chat.example.com` -> root_domain: `example.com`

这样后续可以同时支持：

- 精确主机名匹配
- 根域级别归并展示

---

## 9. 检测策略设计

## 9.1 检测分层

`sks` 的检测应分 3 层：

### 第一层：站点级连通性检测

目标：判断该站点“整体上是否还可用”。

典型手段：

- 请求 `/models`
- 请求兼容的模型列表接口
- 或发起一个极简测试请求

输出：

- 站点可连通 / 不可连通
- 鉴权是否正常
- 当前站点基础健康状态

### 第二层：模型列表采集

目标：判断这个站点“当前有哪些模型可用”。

典型手段：

- 定时拉取 `/models`
- 记录新增/消失模型
- 标记热门模型、长尾模型

输出：

- 当前模型列表
- 模型上下线变化
- 哪些模型需要纳入实测

### 第三层：模型级真实请求检测

目标：判断“每个模型是不是真的能跑”。

典型手段：

- 极短 prompt
- 1 token 或尽可能小响应
- 记录成功/失败、首包耗时、总耗时

输出：

- 模型可用性
- 速度表现
- 最近 24/48h 时间格子

## 9.2 检测频率建议

考虑成本，建议默认低频策略：

### 站点级

- 每 30~60 分钟一次

### 模型列表

- 每 2~6 小时一次
- 或站点级失败恢复后立即补采一次

### 模型实测

分层执行：

#### 热门模型

- 每 1~2 小时一次

#### 普通模型

- 每 4~8 小时一次

#### 长尾模型

- 每 12~24 小时轮询一次

## 9.3 时间片展示建议

页面只需要展示最近 24~48 小时的小方格，不需要特别密。

### 推荐方案 A

- 48 小时
- 每格 1 小时
- 共 48 格

### 推荐方案 B

- 24 小时
- 每格 30 分钟
- 共 48 格

### 最终建议

第一版优先：

- **默认 48 小时 × 1 小时/格**

这样用户易理解，后端压力也较小。

## 9.4 状态分级建议

第一版简化成 4 种颜色即可：

- `ok`：正常
- `slow`：成功但慢
- `failed`：失败
- `unknown`：没有数据

后端内部可细分更多错误类型，但前端主展示不需要太复杂。

## 9.5 延迟指标建议

不要只保留一个 latency。

建议至少记录：

- `ttfb_ms`：首包/首 token 时间
- `total_ms`：总耗时

前端可默认展示：

- 当前首包速度
- 最近 24/48h 平均首包速度

---

## 10. 探测实现建议

## 10.1 OpenAI 兼容优先

第一阶段以 **OpenAI 兼容协议** 为主，因为大部分第三方平台都声称兼容该协议。

优先支持接口：

- `GET /v1/models`
- `POST /v1/chat/completions`
- 必要时兼容 `POST /v1/responses`

## 10.2 第一阶段支持范围

建议先支持以下类型：

1. `openai-compatible`
2. `anthropic-compatible`（如果业务上确有必要）
3. `gemini-compatible`（按实际平台情况）
4. `endpoint-only`（只做连通性，不做模型调用）

### 实际建议

第一版重点做好：

- **OpenAI compatible**

因为这已经覆盖绝大多数第三方站点场景。

## 10.3 模型检测请求建议

要省钱、稳定、易比较。

### 建议 prompt

```txt
Reply with only: 1
```

或：

```txt
Only output number 1.
```

### 参数建议

- `max_tokens: 1` 或尽可能小
- `temperature: 0`
- `stream: true`（若需要测首包）

## 10.4 为什么不用复杂 challenge

check-cx 用随机数学题，是为了防止假站点返回固定答案。

但 `sks` 的目标不是审计假站，而是低成本、持续观测。因此第一阶段没必要上复杂 challenge，可改为：

- 超轻 prompt
- 简单回复校验
- 更关注真实调用成功与速度

如后续发现大量伪造站点，再升级为 challenge 机制。

## 10.5 模型选择策略

同一站点模型很多时，不建议全量高频探测。

建议分类：

### 核心模型

例如：

- `gpt-4o`
- `gpt-4.1`
- `claude-*`
- `gemini-*`
- `deepseek-*`

高频检测。

### 常见模型

中频检测。

### 长尾模型

低频轮询或按需检测。

---

## 11. Key 来源与使用策略

这是 `sks` 最核心的业务规则之一。

## 11.1 Key 来源优先级

同一站点可有多个 key，调用顺序为：

1. **站长提供**
2. **网友提供**
3. **系统自有**

即：

```txt
owner > community > system
```

## 11.2 多个网友 key 的选取规则

当同一站点有多个网友提供 key 时，优先使用：

1. 使用时间更久
2. 历史稳定性更高
3. 最近成功率更高
4. 最近失败率更低
5. 最近未触发限流/鉴权错误

可综合成 `stability_score + priority_score`。

## 11.3 失效轮换规则

如果当前 key 失效：

- 标记本 key 进入 cooldown
- 自动切换到下一可用 key
- 保留失效记录
- 后续再低频重试该 key，看是否恢复

## 11.4 为什么要有 system key

有些站点没有站长或网友提交 key，但 sk-buy 仍想监控重点平台。

因此系统仍应允许维护一批内部 key。

## 11.5 安全要求

所有 key 必须：

- 加密存储
- 后台解密使用
- 不对前端暴露
- 不进入日志
- 不出现在公开 API

---

## 12. 无感站长认证机制

## 12.1 目标

不要求站长做复杂验证，而是在其使用 `sks` 组件时，系统自动判断其是否为同 hostname 的实际控制者。

## 12.2 核心思想

**谁把某个 site 的 `sks` 组件稳定地应用到了同 hostname 的站点上，谁就更可能是该站点的实际站长/运营者。**

## 12.3 可用信号

### 信号 1：脚本/iframe 引用来源

嵌入组件被加载时，可以观察：

- `document.location.hostname`
- `document.referrer`
- `allowed_hostname`
- `widget_token` 对应创建用户

若组件被实际运行在与 `site.hostname` 相同或规则允许的 hostname 上，可记一条 ownership signal。

### 信号 2：持续使用时长

如果一个用户创建的 widget：

- 连续多天在该 hostname 上被真实调用
- 且流量稳定
- 且与站点目标一致

则提高其归属置信度。

### 信号 3：站点与 API Hostname 对齐

如果：

- 用户申请的 site 绑定 `api.example.com`
- widget 真正运行在 `www.example.com` / `example.com`

则可判定为根域一致。

## 12.4 所有权状态建议

- `unclaimed`：无人认领
- `observed`：已观察到相关嵌入
- `probable_owner`：高概率站长
- `verified_owner`：系统认定为站长
- `disputed`：存在冲突，需人工处理

## 12.5 自动升级规则建议

例如：

- 首次同域使用：`observed`
- 连续 3 天真实调用：`probable_owner`
- 连续 7~14 天稳定调用 + 多次命中同域：`verified_owner`

## 12.6 风险控制

因为这是“无感认证”，不是强实名认证，所以必须保留回退机制：

- 被举报可回退
- 存在多个冲突用户时转人工处理
- 重要高价值平台可人工二次确认

---

## 13. 页面与产品形态设计

## 13.1 对公众展示页

每个站点应有一个公开状态页，例如：

- `/sks/site/[hostname]`

展示内容：

1. 站点当前状态
2. 最近更新时间
3. 当前可用模型列表
4. 热门模型状态卡片
5. 24/48h 小方格图
6. 最近失败原因摘要

## 13.2 sk-buy 内部平台页集成

在平台详情页嵌入 `sks` 摘要卡：

- 当前连通状态
- 最近 24h 稳定性
- 模型数
- 热门模型表现
- 跳转至完整状态页

## 13.3 站长控制台

站长进入后可看到：

- 站点状态总览
- 已提交 key 列表
- 当前生效 key 来源
- 可用模型变化
- 嵌入组件管理
- 活动/码号发布权限入口

## 13.4 申请页

任何人都可提交：

- 站点名称
- API 地址
- Key
- 可选官网地址
- 可选备注

提交后立即触发一次初步探测。

---

## 14. 嵌入方式设计

## 14.1 目标

做到：

- 易接入
- 多样式
- 可主题化
- 可识别来源用户与目标站点

## 14.2 方式一：iframe

优点：

- 接入最简单
- 样式隔离好
- 安全边界清晰

示例：

```html
<iframe
  src="https://embed.sks.sk-buy.com/widget/abc123"
  width="320"
  height="120"
  loading="lazy"
  style="border:0"
></iframe>
```

适合：

- 徽章
- 迷你卡片
- 站点小窗

## 14.3 方式二：script

优点：

- 可更灵活地适配站点样式
- 可自动根据容器渲染
- 方便采集 runtime hostname 做无感认证

示例：

```html
<div id="sks-status"></div>
<script
  src="https://embed.sks.sk-buy.com/widget.js"
  data-widget="abc123"
  data-user="u_xxx"
  data-site="api.example.com"
></script>
```

## 14.4 方式三：JSON API

适合站长自行渲染。

示例：

```txt
GET https://api.sks.sk-buy.com/public/widgets/abc123/status
```

返回：

- 当前状态
- 模型摘要
- 时间格子数据
- 更新时间

## 14.5 模板建议

第一版至少提供 3 套：

1. **Badge**
   - 只显示当前状态
2. **Mini Grid**
   - 当前状态 + 24/48h 小方格
3. **Full Card**
   - 当前状态 + 模型摘要 + 方格图 + 更新时间

---

## 15. API 设计建议

## 15.1 内部 API

### 站点注册

- `POST /api/sks/sites`

### 提交 key

- `POST /api/sks/sites/:siteId/credentials`

### 触发一次探测

- `POST /api/sks/sites/:siteId/probe`

### 获取站点详情

- `GET /api/sks/sites/:siteId`

### 获取模型列表

- `GET /api/sks/sites/:siteId/models`

### 获取检测结果

- `GET /api/sks/sites/:siteId/probes`

## 15.2 公开 API

### 公开状态摘要

- `GET /api/sks/public/sites/:hostname`

### 公开模型状态

- `GET /api/sks/public/sites/:hostname/models`

### widget 数据

- `GET /api/sks/public/widgets/:token/status`

### widget 小方格数据

- `GET /api/sks/public/widgets/:token/grid?range=48h`

## 15.3 返回结构建议

状态摘要：

```json
{
  "site": {
    "hostname": "api.example.com",
    "displayName": "Example API"
  },
  "current": {
    "status": "ok",
    "ttfbMs": 820,
    "checkedAt": "2026-04-05T11:00:00Z"
  },
  "models": {
    "count": 126,
    "hot": ["gpt-4o", "claude-3.7-sonnet", "gemini-2.5-pro"]
  },
  "grid": {
    "range": "48h",
    "bucket": "1h",
    "items": []
  }
}
```

---

## 16. 前端展示建议

## 16.1 小方格的视觉语义

建议颜色：

- 绿色：正常
- 黄色：慢
- 红色：失败
- 灰色：无数据

## 16.2 Tooltip 内容

每个格子 hover 时展示：

- 时间
- 状态
- 首包耗时
- 总耗时
- 错误摘要

## 16.3 模型展示策略

不要一次性展示所有模型状态。

建议：

- 默认展示热门模型
- 支持展开查看全部模型
- 支持搜索模型名

## 16.4 sk-buy 站内摘要卡

站内调用只需展示：

- 当前状态
- 最近 24h 稳定性
- 模型总数
- 热门模型 3~5 个

---

## 17. Worker / 调度策略

## 17.1 第一阶段

可先使用单 worker + cron/定时器。

例如：

- 每 30 分钟处理一批站点级检测
- 每 2 小时处理模型列表拉取
- 每 1 小时处理热门模型实测

## 17.2 任务类型

拆成 3 类队列：

1. `site-connectivity`
2. `model-list-sync`
3. `model-probe`

## 17.3 调度顺序

优先级建议：

1. 公开展示中的活跃站点
2. 已认领站长站点
3. sk-buy 核心收录平台
4. 普通申请站点

## 17.4 限流与预算

必须对每个站点控制预算，例如：

- 每日最大检测次数
- 每日最大模型探测数
- 每日最大失败重试次数

---

## 18. 数据保留策略

## 18.1 原始记录

建议保留：

- 24~48 小时高频原始点
- 7~30 天低频聚合结果

## 18.2 聚合策略

例如：

- 原始点：保留 7 天
- 小时级聚合：保留 30 天
- 日级聚合：长期保留

## 18.3 第一阶段简化

第一版可直接保留：

- 48h 原始展示数据
- 30d 汇总统计

---

## 19. 权限与角色设计

## 19.1 普通游客

可查看公开状态页。

## 19.2 提交者

可提交站点和 key，但不自动拥有站点管理权。

## 19.3 已识别站长

可管理：

- 站点资料
- 展示组件
- 优先 key
- 发布活动/码号等站内权益

## 19.4 管理员

可处理：

- 归属冲突
- key 风控
- 站点合并/拆分
- 黑名单/异常平台

---

## 20. 风险与边界

## 20.1 Key 风险

用户提交的 key 可能：

- 很快失效
- 权限不足
- 被撤回
- 有额度风险

因此必须支持：

- 快速失效检测
- 自动降级/切换
- 来源评分

## 20.2 假站 / 套壳站

第一阶段不重点解决，但要预留：

- 更严格 challenge
- 多 endpoint 比对
- 模型能力抽检

## 20.3 无感认证误判

这是最大的产品风险之一。

所以系统要支持：

- 置信度分级
- 人工回退
- 投诉处理

## 20.4 成本失控

如果探测频率过高或模型过多，会迅速烧掉额度。

必须从第一版就控制：

- 频率
- 热门模型集合
- 重试次数
- 预算上限

---

## 21. 第一阶段 MVP 范围

## 21.1 必做

1. 站点注册
2. Hostname 规范化
3. 提交 key
4. 站点级连通性检测
5. 模型列表采集
6. 热门模型极简实测
7. 48h 小方格展示
8. 公开状态页
9. iframe/script/JSON 三种嵌入方式
10. 基于嵌入调用的无感归属识别基础版

## 21.2 可以延后

1. 复杂 challenge
2. 多协议 provider 深度兼容
3. 多节点选主
4. 完整预算系统
5. 高级风控
6. 完整人工审核流
7. 更复杂的图表分析

---

## 22. 推荐开发顺序

### 第 1 步：数据层

- 建表
- Hostname 规范化
- key 加密存储

### 第 2 步：探测核心

- `/models` 拉取
- 热门模型 1-token 探测
- 结果入库

### 第 3 步：展示层

- 站点状态摘要页
- 模型状态小方格
- JSON API

### 第 4 步：嵌入层

- iframe
- script
- widget token

### 第 5 步：无感认证

- embed 调用日志
- hostname 对齐
- ownership 信号评分

### 第 6 步：sk-buy 集成

- 平台详情页接入
- 站长权限联动
- 活动/码号入口联动

---

## 23. 推荐目录结构（仓库内版本）

```txt
src/
  app/
    api/
      sks/
        public/
        sites/
        widgets/
  components/
    sks/
      status-badge.tsx
      status-mini-grid.tsx
      status-full-card.tsx
  lib/
    sks/
      core/
        hostname.ts
        scoring.ts
        ownership.ts
      db/
        sites.ts
        credentials.ts
        probes.ts
        widgets.ts
      probes/
        openai-compatible.ts
        models-sync.ts
        model-probe.ts
      services/
        site-status.ts
        model-status.ts
        widget-service.ts
      types/
        index.ts
```

---

## 24. 推荐目录结构（未来独立仓库版本）

```txt
apps/
  web/
  worker/
  embed/
packages/
  core/
  db/
  probe-openai/
  shared-types/
```

---

## 25. 最终结论

`sks` 不是 check-cx 的复制品，而是一个：

- 面向第三方视角
- 以真实 API 调用为核心
- 成本敏感
- 以 Hostname 为跨系统主键
- 兼顾 sk-buy 内部使用与外部嵌入分发
- 支持无感站长认证

的轻量状态观测模块。

它的最小价值闭环是：

1. 用户或站长提交 API 地址与 key
2. `sks` 低频真实探测站点与模型
3. 生成公开状态页与小组件
4. 若组件被应用到同 hostname 的站点，则逐步无感识别为站长
5. sk-buy 基于该归属关系开放更多平台权限和运营能力

这个方案既能服务 sk-buy 主站，也天然具备将来拆成独立服务/独立项目的条件。

---

## 26. 下一阶段开发输入建议

在下一次正式开发会话中，建议直接从以下 3 份产物开始：

1. **数据库 migration 草案**
   - 建立 `sks_*` 系列表
2. **MVP API 清单**
   - 先确定创建站点、提交 key、公开状态接口
3. **MVP 页面/组件清单**
   - 站点状态页
   - Mini Grid 组件
   - Widget embed 接口

如果按此文档推进，下一会话可以直接进入：

- 表结构设计
- API 路由设计
- `src/lib/sks` 初始目录落地
- 第一版 worker 任务实现
