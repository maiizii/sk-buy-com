# 更新说明（2026-04-06 / v0.1.2)

## 本次更新概览

本次版本主要围绕 **site-catalog 新链路收口、首页 / discover / compare 前台切换，以及 SKS 指标展示统一** 展开。

相较于 `v0.1.1`，本次主要完成了以下工作：

- 完成 `site-catalog + sks` 聚合链路在前台核心页面的落地：
  - 首页 `src/app/page.tsx` 已切换到 `/api/sites`
  - discover `src/app/discover/page.tsx` 已切换到 `/api/sites`
  - compare `src/app/compare/page.tsx` 已切换到 `/api/sites`
- 新增 / 收口站点目录相关能力：
  - 新增 `GET /api/sites`
  - 新增 `GET /api/site/[siteKey]`
  - 新增 `POST /api/internal/site-catalog/import`
  - 新增 `src/lib/site-catalog/*` 聚合、DB 与展示适配逻辑
  - 新增 `src/lib/internal-api.ts`
- 首页展示进一步对齐 SKS：
  - 去掉冗余的 SKS 独立入口按钮，改为直接展示站点状态
  - 站点状态文案统一为「7天 xx%正常 / 平均延迟 xxms」
  - 展开后模型支持悬浮浮层，直接展示 7 天正常率、平均延迟、当前状态与 24 格状态条
- discover 页完成综合筛选与展开交互优化：
  - 综合属性筛选卡片按站点状态、站点标签、供应商、其他标签组织
  - 供应商筛选项统一按 Claude、OpenAI、Gemini 优先排序
  - 站点列表展开后支持模型可直接悬浮查看 SKS 状态浮层与 24 格状态条
- compare 页完成结构重构：
  - 以“网站名称 / 当前状态 / 站点标签 / 7天正常率+平均延迟 / 供应商 / 支持模型 / 其他标签”为主维度
  - 支持模型改为悬浮查看 SKS 状态浮层
  - 表格支持固定字段列、最多 4 列满宽展示、超出后横向滚动
- 视觉与工程细节补充：
  - `Tracker` 组件与相关状态条展示逻辑同步更新
  - `next.config.ts` 已补充 jsDelivr 图标白名单
  - 补充 `scripts/sks-backfill-display-names.cjs`
  - 更新 `src/messages/zh-CN.ts` / `src/messages/en-US.ts` 文案
  - 更新 `docs/site-catalog-sync.md`
  - 更新 `docs/automation-migration-checklist.md`
  - 更新 `docs/session-handoff-2026-04-05.md`

---

## 本次版本的文档结论

`docs/automation-migration-checklist.md` 已根据当前真实进度补充第 2 阶段说明，明确记录：

- 首页已完成站点状态替代冗余 SKS 入口
- discover 已收口到“已接入 SKS 且有可用凭据”的站点数据集
- 供应商筛选顺序已统一为 Claude / OpenAI / Gemini 优先
- compare 当前维度、模型悬浮状态浮层与横向滚动策略已更新到清单中

---

## 验证结果

本次整理发布前已完成：

```bash
npm exec eslint src/app/page.tsx src/app/discover/page.tsx src/app/compare/page.tsx next.config.ts src/messages/zh-CN.ts src/messages/en-US.ts
npx tsc --noEmit --pretty false
```

验证目标：

- 关键前台页面与相关配置文件通过 ESLint 检查
- TypeScript 类型检查通过

---

## 版本调整

- 版本号从 `0.1.1` 升级为 `0.1.2`

---

## 建议提交信息

```txt
feat: release v0.1.2 with site-catalog frontend migration and sks ui alignment
```

---

## 备注

- 这次版本重点不是新增单一页面，而是把 `site-catalog -> sks -> 前台展示` 这条链路收口到一个可发布的阶段性节点。
- 下一步建议继续回补第 1 阶段剩余验证项，尤其是 `admin/sks/sites` 管理态导入链路与 `runInitialProbe` 首轮探测验证。
