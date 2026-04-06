# 会话交接手册（2026-04-06）

> 用途：给新会话直接续上当前 `sk-buy / sk-buy-tools` 自动化改造进度，不需要重新梳理整套架构。

## 1. 当前项目目标

当前改造方向已经比较明确：

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

### 2.1 新数据层与聚合链路

已落地独立网站目录层：

- `data/site-catalog.db`
- 核心文件：
  - `src/lib/site-catalog/db.ts`
  - `src/lib/site-catalog/types.ts`
  - `src/lib/site-catalog/service.ts`
  - `src/lib/site-catalog/discover-compare.ts`
- 职责：承载官网公开站点资料，并聚合 `site-catalog + sks` 输出前台可直接消费的数据

### 2.2 新服务与 API

已落地：

- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/api/internal/site-catalog/import/route.ts`
- `src/lib/internal-api.ts`
- `src/lib/sks/site-public.ts`
- `src/lib/sks/monitor.ts`

能力包括：

- `GET /api/sites`
  - 返回公开站点列表
  - 聚合 `site-catalog + sks + computed`
- `GET /api/site/[siteKey]`
  - 返回站点详情
  - 包含 SKS 详情与 `recentFailures`
- `POST /api/internal/site-catalog/import`
  - 支持单条导入
  - 支持 `{ items: [...] }` 批量导入
  - 有 `apiKey` 时自动同步进 `sks.db`
  - 支持内部 token 校验
  - 支持可选首轮探测 `runInitialProbe`

### 2.3 前台核心页面切换已完成

本轮已经把前台主展示链路切到新目录源：

- 首页 `src/app/page.tsx` 已切到 `/api/sites`
- discover `src/app/discover/page.tsx` 已切到 `/api/sites`
- compare `src/app/compare/page.tsx` 已切到 `/api/sites`

同时完成的前台展示收口包括：

- 首页首屏去掉冗余 SKS 独立入口，改为直接展示站点状态
- 首页 / discover / compare 的 SKS 指标文案基本统一为：
  - `7天 xx%正常`
  - `平均延迟 xxms`
- 展开后模型支持悬浮状态浮层
- 浮层中直接展示：
  - 7 天正常率
  - 平均延迟
  - 当前状态（正常 / 偏慢 / 异常 / 未知）
  - 24 格状态条
- compare 表格支持固定字段列、最多 4 列满宽展示、超出后横向滚动
- discover 综合筛选已按站点状态、站点标签、供应商、其他标签重新组织
- 供应商筛选顺序已统一为 Claude / OpenAI / Gemini 优先

### 2.4 相关页面与辅助脚本

本轮还补了：

- `src/app/review/site/[siteKey]/page.tsx`
- `src/components/Tracker.tsx`
- `scripts/sks-backfill-display-names.cjs`
- `next.config.ts` 中 jsDelivr 图标白名单
- `src/messages/zh-CN.ts` / `src/messages/en-US.ts` 文案同步调整

### 2.5 文档与远端快照

已整理的关键文档：

- `docs/automation-migration-checklist.md`
- `docs/site-catalog-sync.md`
- `CHANGELOG-2026-04-06.md`

当前远端已存在两笔关键提交：

1. `c2fad12`  
   `docs: add site-catalog migration notes and release changelog`
2. `dd48811`  
   `feat: snapshot site-catalog frontend migration and sks ui alignment`

其中 `dd48811` 可以视为当前“第 2 阶段前台切换完成”的代码快照基线。

## 3. 当前验证结果

已实际验证 / 确认通过：

- TypeScript 类型检查通过
- ESLint 关键页面与配置检查通过
- 无 key 导入：只进入 `site-catalog`
- 有 key 导入：进入 `site-catalog + sks`
- 同 hostname 重复导入：幂等更新正常
- 非法 `apiBaseUrl`：正确返回 400
- `/api/sites`：能返回聚合数据
- `/api/site/[siteKey]`：能返回详情与 `recentFailures`
- `hasCredential`、`lastSksSyncAt`：已验证会正确回写
- 首页 / discover / compare 当前主数据来源已不再依赖旧 `platforms` 作为主来源

本轮验证命令在变更说明中已有记录：

```bash
npm exec eslint src/app/page.tsx src/app/discover/page.tsx src/app/compare/page.tsx next.config.ts src/messages/zh-CN.ts src/messages/en-US.ts
npx tsc --noEmit --pretty false
```

## 4. 当前未完成 / 待继续

### 4.1 第 1 阶段剩余验证

虽然第 2 阶段前台切换已经完成，但第 1 阶段还有两项底座验证没有补齐：

1. `admin/sks/sites` 管理态导入链路的端到端验证
2. `runInitialProbe` 用真实可用站点做首轮探测验证

这两项仍然建议优先补掉，因为它们决定“新导入链路 + 首轮探测”是否真正闭环。

### 4.2 下一阶段主任务

下一阶段建议正式进入 **legacy 平台库退场收口**，但顺序建议是：

1. 先回补上面两项第 1 阶段剩余验证
2. 再开始第 3 阶段 legacy 收口：
   - 盘点 `platforms`、`platform_attribute_*`、`platform_models`、`connectivity_logs` 的真实依赖
   - 标记哪些表保留只读 / 冻结 / 归档 / 可废弃
   - 设计 `platformId` → hostname 映射方案
   - 设计 `platforms` → `site-catalog` 迁移脚本
   - 为 `review / forum review / visit` 等 legacy 页面保留 hostname 级别过渡兼容

## 5. 新会话建议优先查看的文件

### 文档

- `docs/automation-migration-checklist.md`
- `docs/site-catalog-sync.md`
- `docs/session-handoff-2026-04-06.md`
- `CHANGELOG-2026-04-06.md`
- `docs/sks-module-design.md`
- `sks_handoff.md`

### site-catalog / API

- `src/lib/site-catalog/types.ts`
- `src/lib/site-catalog/db.ts`
- `src/lib/site-catalog/service.ts`
- `src/lib/site-catalog/discover-compare.ts`
- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/api/internal/site-catalog/import/route.ts`
- `src/lib/internal-api.ts`

### SKS 关联层

- `src/lib/sks/db.ts`
- `src/lib/sks/service.ts`
- `src/lib/sks/utils.ts`
- `src/lib/sks/site-public.ts`
- `src/lib/sks/monitor.ts`
- `src/lib/sks/probe.ts`
- `src/components/Tracker.tsx`
- `src/app/api/sks/admin/sites/route.ts`

### 前台页面 / legacy 过渡相关

- `src/app/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/compare/page.tsx`
- `src/app/review/site/[siteKey]/page.tsx`
- `src/app/review/[platformId]/page.tsx`
- `src/app/forum/review/[platformId]/page.tsx`
- `src/app/visit/[platformId]/page.tsx`
- `src/app/api/platforms/route.ts`

## 6. 已知注意事项

1. **不要再按旧 `platforms` 思路扩展主数据**
   - 旧平台库视为 legacy
   - 新主模型应是 `site-catalog + sks`

2. **Next.js 版本特殊**
   - 仓库 `AGENTS.md` 明确要求：写 Next.js 相关代码前，先参考 `node_modules/next/dist/docs/` 对应文档

3. **PowerShell 下复杂命令容易被引号和路径干扰**
   - `curl ... @file`、带多层引号的 `git commit -m`、以及包含 `[]` 的路径都容易踩坑
   - 更推荐：
     - 用 `node` 小脚本 / `.mjs` 发送请求
     - 必要时用 `cmd /c` 包一层执行 Git 命令

4. **测试用 `.tmp/` 文件只作为本地验证辅助**
   - 不要把它们当正式系统设计的一部分
   - 当前本地仍可见 `.tmp/` 目录，默认不应作为正式发布物

5. **前台已切完，但 legacy 页面兼容还没收口**
   - 新首页 / discover / compare 已切到新链路
   - 但 `review / forum review / visit` 等旧路由仍需要过渡兼容策略

## 7. 建议的新会话起手任务

建议新会话第一步按这个顺序做：

1. 先阅读：
   - `docs/automation-migration-checklist.md`
   - `docs/site-catalog-sync.md`
   - `docs/session-handoff-2026-04-06.md`
   - `CHANGELOG-2026-04-06.md`
2. 再阅读：
   - `src/app/api/internal/site-catalog/import/route.ts`
   - `src/app/api/sks/admin/sites/route.ts`
   - `src/lib/sks/probe.ts`
   - `src/app/page.tsx`
   - `src/app/discover/page.tsx`
   - `src/app/compare/page.tsx`
3. 先决定本轮优先级：
   - 若先补底座验证：就先做 `admin/sks/sites` 导入验证 + `runInitialProbe` 实测
   - 若直接推进第 3 阶段：就先盘点 legacy 平台库依赖，并给出迁移 / 兼容清单

## 8. 可直接复制给新会话的说明

下面这段可以直接发给新会话：

---

我现在要继续 `sk-buy / sk-buy-tools` 自动化改造，请直接接着现有进度往下做，不要从头重想架构。

先读这几个文件获取上下文：

- `docs/automation-migration-checklist.md`
- `docs/site-catalog-sync.md`
- `docs/session-handoff-2026-04-06.md`
- `CHANGELOG-2026-04-06.md`
- `src/lib/site-catalog/types.ts`
- `src/lib/site-catalog/db.ts`
- `src/lib/site-catalog/service.ts`
- `src/lib/site-catalog/discover-compare.ts`
- `src/app/api/sites/route.ts`
- `src/app/api/site/[siteKey]/route.ts`
- `src/app/api/internal/site-catalog/import/route.ts`
- `src/app/page.tsx`
- `src/app/discover/page.tsx`
- `src/app/compare/page.tsx`

当前已完成：

- `site-catalog.db` 独立数据层已建好
- `/api/sites`、`/api/site/[siteKey]`、`/api/internal/site-catalog/import` 已完成
- 首页 / discover / compare 已切到 `/api/sites`
- 前台 SKS 指标展示已基本统一为“7天正常率 + 平均延迟 + 模型悬浮状态浮层 + 24 格状态条”
- 当前代码快照已推到远端：`dd48811`

当前优先目标：

- 先回补第 1 阶段剩余验证：
  - `admin/sks/sites` 管理态导入链路端到端验证
  - `runInitialProbe` 首轮真实探测验证
- 然后进入第 3 阶段：legacy `platforms` 退场与兼容收口

约束：

- 跨库唯一主标识使用规范化 hostname
- 批量匿名操作必须走代理（主要在 `sk-buy-tools` 执行层落实）
- 不要再把旧 `platforms` 当未来主数据继续扩展
- 写 Next.js 相关代码前先参考 `node_modules/next/dist/docs/`

请先完成代码和文档上下文阅读，然后给出一个紧贴当前代码的执行方案，优先说明：

1. 剩余第 1 阶段验证怎么补
2. legacy 平台库依赖要怎么盘点
3. 下一步应先做验证还是先做迁移兼容

---
