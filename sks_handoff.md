# SKS Handoff

最后更新：2026-04-05

## 1. 当前开发进度

### 已完成

本轮已经完成 **SKS（SK Status）第一阶段可用版本**，核心方向已按需求收敛为：

- 模块名称确定为 **SKS（SK Status）**
- 已建立独立的 SKS 页面与接口
- **统一展示最近 24 小时状态方格**，固定 **24 个小方格**
- **每小时 1 格**，不做更细粒度的半小时/分钟分析
- 底层监控原始数据当前按 **7 天窗口**保留与聚合
- 展示重点偏向“**持续状态是否稳定**”而不是某次瞬时检测

### 已完成的功能点

#### 页面与路由

已新增并可访问：

- `/sks`：SKS 总览页
- `/sks/site/[siteKey]`：单站点详情页

已新增 loading：

- `src/app/sks/loading.tsx`
- `src/app/sks/site/[siteKey]/loading.tsx`

#### API

已新增接口：

- `/api/sks/sites`
- `/api/sks/site/[siteKey]`

用途：

- 提供 SKS 总览数据
- 提供单站点详情数据
- 方便后续独立前端、抓取、外部状态页或管理面板复用

#### 导航接入

已将 SKS 接入站点导航：

- `src/components/Navbar.tsx`

同时补齐了国际化文案：

- `src/messages/zh-CN.ts`
- `src/messages/en-US.ts`

#### 数据与服务层

已新增 SKS 服务目录：

- `src/lib/sks/types.ts`
- `src/lib/sks/service.ts`

当前服务层做的事情：

- 基于现有 platform / connectivity log 数据生成 SKS 视图模型
- 将原有监控日志转成 SKS 所需的：
  - 当前状态
  - 7 天成功率
  - 最近延迟
  - 24 小时状态格
  - 热门模型摘要
  - 最近失败原因摘要
- 通过 hostname / slug 解析站点详情

#### UI 组件

已新增：

- `src/components/sks/SksUi.tsx`

目前已包含：

- 状态 pill
- 通用 metric 卡片
- 24 小时状态格组件
- 站点卡片组件
- 时间/延迟格式化工具

#### 站点详情页展示内容

当前详情页已支持展示：

- 站点名称
- 当前状态
- hostname / API base
- 最近 24 小时状态格
- 7 天可用率
- 当前延迟
- 模型数量 / 热门模型摘要
- 最近失败原因
- 当前可用模型标签列表
- JSON 接口入口

## 2. 本轮顺手修复/调整的事项

### 2.1 国际化字段缺失

已补齐 `common.sks`，修复 Navbar 中 `t.common.sks` 的 TypeScript 报错。

涉及文件：

- `src/messages/zh-CN.ts`
- `src/messages/en-US.ts`

### 2.2 首页无障碍 lint 警告

已把首页卡片上的 `aria-expanded` 改为 `data-expanded`，消除 lint warning。

涉及文件：

- `src/app/page.tsx`

### 2.3 构建期误启动监控循环

已修正 `src/lib/monitor.ts` 中的构建阶段判断逻辑，避免 `next build` 时误触发监控自动启动。

## 3. 当前验证结果

### 已验证通过

- `npm run lint`：通过
- `npm run build`：通过
- `npm run dev`：已运行并访问过 `/sks`、`/sks/site/[siteKey]`

### 已确认能工作的路径

- `/sks`
- `/sks/site/newapi.577000.xyz`（开发中测试过）
- `/api/sks/sites`
- `/api/sks/site/[siteKey]`

## 4. 当前观察到的现象 / 待确认问题

### 4.1 开发环境下监控循环疑似重复启动

在 `npm run dev` 的日志里，出现了多次：

- `[Monitor] Starting monitor loop...`
- `[Monitor] Starting health check cycle...`

这说明 **开发模式下可能存在多实例/多模块上下文重复触发 side-effect import** 的情况。

虽然这 **不影响当前第一版 SKS 页面交付**，且构建已通过，但它是下一步建议优先处理的问题之一。

可能原因：

- `import "@/lib/monitor"` 被多个 server route / service 文件 side-effect 引入
- Next.js dev / Turbopack / 热更新环境下，模块可能被重新初始化
- 当前的 `monitorInterval` 只能保证“单个模块实例内单例”，不能保证“整个 dev server 进程全局只启动一次”

### 4.2 SKS 当前仍复用现有 connectivity 数据

这符合第一阶段目标，但目前还不是完全独立的 SKS 数据体系：

- 现在的 SKS 是从现有平台与连通性日志中派生展示
- 后续如果要演进成更完整的状态系统，可能需要独立的：
  - site registry
  - probe target
  - model-level probe
  - status aggregation
  - public/private visibility control

## 5. 与当前需求的对照结论

用户本轮确认的要求是：

- 项目名叫 **sks（SK Status）**
- 建立独立目录即可
- **初期统一展示 24 小时小方格，共 24 个**
- **一小时一个方格**
- **数据暂时保存 7 天**
- 更关注“持续状态”而不是密集分析

### 结论

以上要求在当前第一版中 **已基本落地**。

## 6. 关键文件清单

### 新增/核心 SKS 文件

- `src/lib/sks/types.ts`
- `src/lib/sks/service.ts`
- `src/components/sks/SksUi.tsx`
- `src/app/sks/page.tsx`
- `src/app/sks/loading.tsx`
- `src/app/sks/site/[siteKey]/page.tsx`
- `src/app/sks/site/[siteKey]/loading.tsx`
- `src/app/api/sks/sites/route.ts`
- `src/app/api/sks/site/[siteKey]/route.ts`

### 本轮相关改动文件

- `src/components/Navbar.tsx`
- `src/messages/zh-CN.ts`
- `src/messages/en-US.ts`
- `src/lib/monitor.ts`
- `src/app/page.tsx`
- `src/lib/db.ts`（与 connectivity 日志保留窗口相关）

## 7. 下一步计划（建议按顺序）

### P0：先处理监控循环重复启动问题

目标：避免开发环境或部分运行时上下文中重复启动监控。

建议方向：

1. 把 monitor 单例提升到 `globalThis` 级别，而不是只靠模块内变量
2. 重新梳理 `import "@/lib/monitor"` 的入口，收敛到更少的位置
3. 明确“谁负责启动监控”：
   - 应用启动时自动启动
   - 或仅某个特定 server entry 启动
   - 或后台手动触发
4. 在 dev / prod / build 三种环境分别验证日志行为

### P1：补 SKS 首页筛选/排序能力

建议做法：

- 支持按站点名 / hostname 搜索
- 支持按当前状态筛选（正常 / 偏慢 / 失败 / 未知）
- 支持按 7 天成功率排序
- 支持按最近延迟排序

### P2：整理 SKS 文案与视觉一致性

建议做法：

- 把状态说明 legend 抽成配置
- 统一中英文文案结构
- 补 metadata / SEO / OpenGraph 细节
- 视情况把部分硬编码中文迁到 messages 中

### P3：为 SKS 独立数据模型做准备

如果后续继续扩展，可考虑：

- 站点注册信息与公开状态解耦
- 模型级别状态记录独立化
- 探测目标可配置化
- 失败类型标准化（DNS / TLS / timeout / 401 / 403 / upstream 5xx 等）
- 为后续后台管理或白名单机制预留结构

## 8. 建议下次继续开发时的起手动作

建议新对话恢复后优先做下面几步：

1. 先读：`sks_handoff.md`
2. 再读：
   - `docs/sks-module-design.md`
   - `src/lib/sks/service.ts`
   - `src/components/sks/SksUi.tsx`
   - `src/lib/monitor.ts`
3. 优先处理：**监控循环重复启动**
4. 修完后再继续做 SKS 的筛选/排序和文案收口

## 9. 当前状态总结（一句话）

**SKS 第一阶段已经可用并通过 lint/build；当前最值得优先继续推进的是“监控循环单例化/避免重复启动”，然后再补首页筛选排序与更完整的数据模型。**
