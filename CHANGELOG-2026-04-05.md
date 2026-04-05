# 更新说明（2026-04-05 / v0.1.1）

## 本次更新概览

本次版本以 **SKS 模块落地、站点联调、平台体验补充与后台能力完善** 为主。

相较于上一版本，本次主要完成了以下工作：

- 新增 SKS（站点/Key/模型/探测）相关能力：
  - 新增 `/sks` 与 `/sks/site/[siteKey]` 页面
  - 新增 `/api/sks/sites`、`/api/sks/site/[siteKey]` 公共接口
  - 新增 `/api/sks/admin/sites`、`/api/sks/admin/site/[siteKey]` 管理接口
  - 增加 `src/lib/sks/*` 下的数据结构、服务层、探测与数据库读写封装
  - 新增 `src/components/sks/SksUi.tsx` 以承载页面展示与调试交互
- 新增 SKS 本地调试与导入脚本：
  - `scripts/sks-import-sites.cjs`
  - `scripts/sks-import-sites-from-file.cjs`
  - `scripts/sks-report.cjs`
- 完成真实站点联调验证：
  - 已接入并测试 `newapi.577000.xyz`
  - 已接入并测试 `sub2api.577000.xyz`
  - 已验证模型列表抓取、单模型调用、数据库写入与探测结果回填链路
- 补充平台相关页面与链路：
  - 新增 `review`、`visit`、`forum/review` 等页面能力
  - 补充首页、发现页、对比页、平台接口与评分接口的配套更新
- 完善后台、导航与多语言内容：
  - 更新 `admin` 页面
  - 更新 `Navbar`
  - 更新 `zh-CN` / `en-US` 文案
- 补充项目文档与交接材料：
  - `docs/sks-module-design.md`
  - `sks_handoff.md`

---

## 与真实数据联调结果

本地调试阶段已完成以下验证：

- `newapi.577000.xyz`
  - 成功抓取模型列表
  - 首轮同步得到 35 个模型
  - 多个模型调用返回 HTTP 200
- `sub2api.577000.xyz`
  - 成功抓取模型列表
  - 首轮同步得到 4 个模型
  - 多个模型调用返回 HTTP 200

同时，SKS 数据库内已记录对应的：

- 站点信息
- 凭据状态
- 模型同步结果
- 模型列表探测结果
- 单模型推理探测结果

> 说明：真实 API Key 仅用于本地调试与验证，不写入 git 仓库。

---

## 本次版本包含的工程性调整

- 版本号从 `0.1.0` 升级为 `0.1.1`
- `eslint.config.mjs` 增加对 `scripts/**/*.cjs` 的 `require()` 规则豁免，便于本地调试脚本使用 CommonJS
- 本地导入数据位于 `data/` 目录，继续保持忽略，不进入版本库

---

## 验证结果

本次提交前已完成：

```bash
npm run lint
npm run build
```

验证结论：

- ESLint 通过
- Next.js 生产构建通过
- 当前代码可继续用于后续 SKS 与平台模块迭代

---

## 建议提交信息

```txt
feat: add sks module, review flows and release v0.1.1
```

---

## 备注

- 本次是一个小版本整理提交，重点是把当前已落地能力整理成可同步到 GitHub 的稳定节点。
- 下一步可继续围绕 SKS 的模型探测策略、站点评分、前台展示与管理端操作体验继续迭代。
