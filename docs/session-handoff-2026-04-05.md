# 会话交接手册（2026-04-05）

> 用途：给新会话直接续上当前 `sk-buy / sk-buy-tools` 自动化改造，不需要从头重新理解。

## 1. 当前项目目标

当前改造方向已经明确：

- `sk-buy-tools` 负责：FOFA 收集、初筛、注册、拿 key、推送结果
- `sk-buy` 负责：
  - `site-catalog` 官网公开站点目录
  - `SKS` 检测、状态、模型、凭据
  - 官网展示、论坛、点评、用户系统
- 跨库唯一主标识统一使用：**规范化后的 hostname**
- 批量匿名操作必须统一走代理，尤其是：
  - FOFA 后公开探测
  - 批量初筛
  - 批量注册
  - 批量申请 / 获取 key

## 2. 当前已完成内容

### 2.1 新数据层

已新增独立网站目录库：

- `data/site-catalog.db`
- 核心文件：`src/lib/site-catalog/db.ts`
- 职责：承载官网公开站点资料，不再沿用旧 `platforms` 作为未来主数据模型

### 2.2 新服务与 API

已落地：

- `src/lib/site-catalog/types.ts`
- `src/lib/site-catalog/service.ts`
- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/api/internal/site-catalog/import/route.ts`
- `src/lib/internal-api.ts`

能力包括：

- `GET /api/sites`
  - 返回公开站点列表
  - 聚合 `site-catalog + sks`
- `GET /api/site/[siteKey]`
  - 返回站点详情
  - 带 `recentFailures`
- `POST /api/internal/site-catalog/import`
  - 支持单条导入
  - 支持 `{ items: [...] }` 批量导入
  - 有 `apiKey` 时自动同步进 `sks.db`
  - 支持内部 token 校验

### 2.3 sk-buy-tools 对接

已新增：

- `../sk-buy-tools/shared/push-site-catalog.mjs`
- `docs/site-catalog-sync.md`

用途：让 `sk-buy-tools` 用标准 JSON 直接推送到 `sk-buy` 内部导入接口，而不是直接写 SQLite。

### 2.4 已修复的问题

本轮已修复的关键问题：

1. **内部导入接口误接收非法 payload**
   - 之前 `toImportInput()` 只要是对象就可能放行，后来又要兼容批量默认值合并
   - 现在改为：对象可进，但真正是否合法由数据层校验，非法 `apiBaseUrl` 会正确报错

2. **`normalizeApiBaseUrl()` 过宽松**
   - 之前像 `not-a-valid-url` 会被强行变成 `https://not-a-valid-url`
   - 现在已增加合法 hostname / 协议校验
   - 非法地址现在会返回空字符串，并在导入时得到 `apiBaseUrl 无效`

3. **`site-catalog` 输出结构混入底层字段**
   - `rowToSiteCatalogSite()` 原来直接 `...row`
   - 现在已改成显式字段映射，减少结构污染

## 3. 当前验证结果

已实际验证通过：

- TypeScript 无报错
- ESLint 无报错
- 无 key 导入：只进入 `site-catalog`
- 有 key 导入：进入 `site-catalog + sks`
- 同 hostname 重复导入：幂等更新正常
- 非法 `apiBaseUrl`：正确返回 400
- `/api/sites`：能返回聚合数据
- `/api/site/[siteKey]`：能返回详情与 `recentFailures`
- `hasCredential`、`lastSksSyncAt`：已验证会正确回写

已使用的测试文件：

- `.tmp/phase1-import-no-key.json`
- `.tmp/phase1-import-with-key.json`
- `.tmp/phase1-import-invalid.json`
- `.tmp/phase1-validate.mjs`

## 4. 当前未完成 / 待继续

### 第 1 阶段剩余

还没做完的只剩两项：

1. `admin/sks/sites` 管理态导入链路的端到端验证
2. `runInitialProbe` 用真实可用站点做首轮探测验证

### 下一阶段主任务

**下一步优先做第 2 阶段：首页切换。**

目标：

- 将 `src/app/page.tsx` 从旧 `/api/platforms` 切换到新 `/api/sites`
- 尽量不改版式，只替换数据源
- 展示逻辑改为基于：
  - `catalogSite`
  - `sks`
  - `computed`

然后再继续：

- `src/app/discover/page.tsx` 切换到新目录源
- `src/app/compare/page.tsx` 切换到新目录源

## 5. 新会话建议优先查看的文件

### 文档

- `docs/automation-migration-checklist.md`
- `docs/site-catalog-sync.md`
- `docs/session-handoff-2026-04-05.md`
- `docs/sks-module-design.md`
- `sks_handoff.md`

### 新数据层 / API

- `src/lib/site-catalog/types.ts`
- `src/lib/site-catalog/db.ts`
- `src/lib/site-catalog/service.ts`
- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/api/internal/site-catalog/import/route.ts`
- `src/lib/internal-api.ts`

### SKS 关联层

- `src/lib/sks/db.ts`
- `src/lib/sks/service.ts`
- `src/lib/sks/utils.ts`
- `src/lib/sks/probe.ts`
- `src/app/api/sks/admin/sites/route.ts`

### 待切换页面

- `src/app/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/compare/page.tsx`

## 6. 已知注意事项

1. **不要再按旧 `platforms` 思路扩展主数据**
   - 旧平台库视为 legacy
   - 新主模型应是 `site-catalog + sks`

2. **Next.js 版本特殊**
   - 仓库 `AGENTS.md` 明确要求：写 Next.js 相关代码前，先参考 `node_modules/next/dist/docs/` 对应文档

3. **PowerShell 下 `curl ... @file` 容易踩坑**
   - 直接在 PowerShell 里用 `--data-binary @file.json` 容易被解释出错
   - 更推荐：
     - 用 `node ../sk-buy-tools/shared/push-site-catalog.mjs ...`
     - 或用 Node 小脚本 / `.mjs` 发送 fetch

4. **测试用 `.tmp/` 文件只作为本地验证辅助**
   - 不要把它们当正式系统设计的一部分

5. **当前首页/发现页/对比页还在调用旧接口**
   - 从 dev log 可以看出仍在打：
     - `/api/platforms`
     - `/api/platforms/config`
   - 这是下一轮要真正切掉的部分

## 7. 建议的新会话起手任务

建议新会话第一步就做：

1. 先阅读：
   - `docs/automation-migration-checklist.md`
   - `docs/session-handoff-2026-04-05.md`
2. 再阅读：
   - `src/app/page.tsx`
   - `src/app/discover/page.tsx`
   - `src/app/compare/page.tsx`
   - `src/app/api/platforms/route.ts`
   - `src/app/api/sites/route.ts`
3. 然后开始实施：
   - 先把首页切到 `/api/sites`
   - 保留版式，先完成数据源替换与字段映射

## 8. 可直接复制给新会话的说明

下面这段可以直接发给新会话：

---

我现在要继续 `sk-buy / sk-buy-tools` 自动化改造，请直接接着现有进度往下做，不要从头重想架构。

先读这几个文件获取上下文：

- `docs/automation-migration-checklist.md`
- `docs/session-handoff-2026-04-05.md`
- `docs/site-catalog-sync.md`
- `src/lib/site-catalog/types.ts`
- `src/lib/site-catalog/db.ts`
- `src/lib/site-catalog/service.ts`
- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/compare/page.tsx`

当前已完成：

- `site-catalog.db` 独立数据层已建好
- `/api/sites`、`/api/site/[siteKey]`、`/api/internal/site-catalog/import` 已完成
- `sk-buy-tools/shared/push-site-catalog.mjs` 已完成
- 第 1 阶段基础验证基本完成：tsc / eslint / 无 key 导入 / 有 key 导入 / 幂等更新 / 非法 URL 报错 / 列表与详情 API 验证都已过

当前下一步目标：

- 先做第 2 阶段，把首页 `src/app/page.tsx` 从旧 `/api/platforms` 切到新 `/api/sites`
- 要求：尽量不大改版式，只替换数据来源和字段映射
- 然后再继续处理 `discover` 和 `compare`

约束：

- 跨库唯一主标识使用规范化 hostname
- 批量匿名操作必须走代理（主要在 `sk-buy-tools` 执行层落实）
- 不要再把旧 `platforms` 当未来主数据继续扩展
- 写 Next.js 相关代码前先参考 `node_modules/next/dist/docs/`

请先完成代码上下文阅读，然后给出一个紧贴当前代码的执行方案，并直接开始实现首页切换。

---
