# site-catalog / SKS 自动化对接说明

## 当前目标

`sk-buy` 侧开始从旧的人工 `platforms` 模型，过渡到：

- `site-catalog.db`：官网站点目录与公开展示字段
- `sks.db`：Key、探测结果、模型状态、历史检测
- `sk-buy-tools`：发现 / 粗筛 / 注册 / 拿 Key / 标准化导入

跨层主键统一使用：**规范化后的 hostname**。

---

## 已落地能力

### 1. 新网站目录库

- SQLite：`data/site-catalog.db`
- 表：`site_catalog_sites`
- 负责承载：
  - 展示名
  - homepage / apiBaseUrl
  - 站点系统类型（`newapi` / `sub2api` / `openai-compatible`）
  - 数据来源阶段（`fofa` / `screening` / `sks` / `website`）
  - 注册开放、邮箱验证、邀请码、初始额度等公开字段
  - 自动标签、meta、人工 override 预留

### 2. 官网公共 API

- `GET /api/sites`
  - 返回公开站点目录列表
  - 自动聚合 site-catalog + SKS 当前状态
- `GET /api/site/[siteKey]`
  - 返回公开站点详情
  - 包含 SKS 详情与 recentFailures

### 3. 内部导入 API

- `POST /api/internal/site-catalog/import`
- 认证方式：
  - `Authorization: Bearer <token>`
  - 或 `x-sk-internal-token`
- Token 环境变量：
  - `SK_INTERNAL_API_TOKEN`
  - 或兼容别名 `SK_IMPORT_TOKEN`

该接口支持：

- 单条导入
- `items` 批量导入
- 有 `apiKey` 时自动同步入 `sks.db`
- 可选首轮探测 `runInitialProbe`

---

## 推荐导入 Payload

```json
{
  "items": [
    {
      "displayName": "Example API",
      "homepageUrl": "https://example.com",
      "apiBaseUrl": "https://example.com",
      "siteSystem": "newapi",
      "sourceStage": "website",
      "sourceModule": "newapi-register",
      "visibility": "public",
      "catalogStatus": "active",
      "summary": "自动筛选导入",
      "registrationOpen": true,
      "emailVerificationRequired": true,
      "inviteCodeRequired": false,
      "hasInitialQuota": true,
      "tags": ["免费公益", "新站抢注"],
      "meta": {
        "providerFamilies": ["openai", "anthropic"]
      },
      "apiKey": "sk-xxx",
      "platformType": "newapi",
      "sourceType": "system",
      "label": "auto-register",
      "priorityScore": 100,
      "runInitialProbe": true,
      "initialProbeModelLimit": 3
    }
  ]
}
```

---

## sk-buy-tools 调用方式

已提供脚本：`sk-buy-tools/shared/push-site-catalog.mjs`

示例：

```powershell
node .\shared\push-site-catalog.mjs --file .\payload.json --endpoint http://127.0.0.1:3000 --token your-token
```

也可用环境变量：

```powershell
$env:SK_BUY_INTERNAL_BASE_URL="http://127.0.0.1:3000"
$env:SK_INTERNAL_API_TOKEN="your-token"
node .\shared\push-site-catalog.mjs --file .\payload.json
```

---

## 自动化约束

### 代理要求

批量匿名操作必须统一走代理，至少包括：

- FOFA 粗筛后的初步公开探测
- 批量注册尝试
- 批量拿 Key / 试注册

这条规则优先在 `sk-buy-tools` 执行链落实，`sk-buy` 只负责接收标准化结果。

### 数据分层建议

- `fofa/`：只维护 FOFA 粗筛库
- `getinfo/`：维护初筛结果 / screening payload
- `newapi/` / `sub2api/`：维护注册与 key 获取结果
- 成功拿到 key 后，再调用 `sk-buy` 内部导入接口进入 website + SKS 链路

---

## 下一阶段清单

1. 将首页 / discover / compare 逐步切到 `/api/sites`
2. 设计 legacy `platforms` → `site-catalog` 的迁移脚本
3. 用 SKS 历史数据自动反推：状态标签、推荐标签、模型供应商族
4. 在 `sk-buy-tools` 中补齐统一 proxy / payload 输出 / 自动推送流水
5. 只保留人工 override：站长认证、隐藏/下线、争议处理
