# sk-buy / sk-buy-tools 自动化改造执行清单

> 目标：把旧的“人工录入平台站点”模式，逐步切换为“`sk-buy-tools` 自动发现/筛选/注册/拿 key -> `sk-buy` 自动导入/检测/展示”的新链路。

## 总原则

- 跨库主键统一使用：**规范化后的 hostname**
- 数据分层：
  - `sk-buy-tools`：收集 / 初筛 / 注册 / 拿 key / 推送
  - `site-catalog.db`：官网公开站点目录
  - `sks.db`：凭据、探测、模型、状态、历史检测
  - `sk-buy.db`：用户、论坛、点评等社区数据，逐步与旧平台主数据脱钩
- 批量匿名操作必须统一走代理：
  - FOFA 粗筛后的公开探测
  - 批量初筛
  - 批量尝试注册
  - 批量申请 / 提取 key

---

## 0. 当前已完成

- [x] 确认新分层架构与职责边界
- [x] 确认多库独立维护，跨库主标识为规范化 hostname
- [x] 新建 `site-catalog` 数据层
- [x] 新增公共 API：
  - `GET /api/sites`
  - `GET /api/site/[siteKey]`
- [x] 新增内部导入 API：
  - `POST /api/internal/site-catalog/import`
- [x] 管理端导入入口已切到 `site-catalog -> sks` 新链路
- [x] `sk-buy-tools` 新增推送脚本：`shared/push-site-catalog.mjs`
- [x] 已补对接文档：`docs/site-catalog-sync.md`

---

## 1. 第 1 阶段：底座收口与验证

> 2026-04-05 验证结论：`site-catalog` 数据层、内部导入 API、公共列表/详情 API、`sk-buy-tools/shared/push-site-catalog.mjs` 已可用；`runInitialProbe` 的真实联通性验证与 `admin/sks/sites` 的管理态端到端验证留到下一轮。

### 1.1 类型与接口收口
- [x] 确认 `site-catalog` 新增 API 无 TypeScript 报错
- [x] 确认内部导入 API 的批量 `items` / 单条 payload 都能通过类型校验
- [ ] 确认 `admin/sks/sites` 新导入链路字段映射正确
- [x] 确认 `visibility` 与 `statusVisibility` 的映射符合预期

### 1.2 导入链路验证
- [x] 准备一份最小单条 payload
- [x] 验证：仅导入 `site-catalog`（无 key）
- [x] 验证：导入 `site-catalog + sks`（有 key）
- [x] 验证：重复导入同 hostname 时走幂等更新而不是重复入库
- [x] 验证：非法 `apiBaseUrl` 时正确报错
- [ ] 验证：开启 `runInitialProbe` 时可正常落首轮探测结果

### 1.3 数据回写验证
- [x] 确认 `hasCredential` 正确更新
- [x] 确认 `lastSksSyncAt` 正确回写
- [x] 确认站点详情页可从 `site-catalog + sks` 聚合拿到数据
- [x] 确认 recentFailures 正常输出

### 第 1 阶段完成标准
- [x] 新导入链路可用
- [x] 可用同一 payload 重复导入且结果稳定
- [x] 列表 API 与详情 API 至少能正确返回 1 条真实测试数据

---

## 2. 第 2 阶段：前台数据源切换

### 2.1 首页切换
- [x] 将首页 `src/app/page.tsx` 从旧 `/api/platforms` 切到 `/api/sites`
- [x] 保留现有版式，先替换数据来源
- [x] 将展示逻辑改为以 `site-catalog + sks + computed` 为主
- [x] 首页首屏已去除冗余 SKS 独立入口，改为直接展示站点状态
- [x] 首页站点状态与模型状态文案统一为「7天 xx%正常 / 平均延迟 xxms」，并补齐悬浮状态条展示

### 2.2 discover 切换
- [x] 将 `src/app/discover/page.tsx` 改为新目录源
- [x] 用新结构替代旧 `platform/config/connectivity` 组合模式
- [x] discover 数据集收口为“已接入 SKS 且有可用凭据”的站点
- [x] 把可筛选条件改成基于：
  - 站点状态
  - 站点标签（运营状态 / 推荐标签）
  - provider family（按 Claude、OpenAI、Gemini 优先排序）
  - 注册开放条件 / 邮箱验证 / 初始额度
- [x] 展开后支持模型已接入 SKS 悬浮状态浮层与 24 格状态条

### 2.3 compare 切换
- [x] 将 `src/app/compare/page.tsx` 改到 `/api/sites`
- [x] 比较维度重构为：
  - 网站名称 / 网址 / 访问与点评入口
  - 当前状态
  - 站点标签
  - 7天正常率 + 平均延迟
  - 供应商族（logo）
  - 支持模型（悬浮显示 7 天正常率 / 平均延迟 / 状态 / 24 格状态条）
  - 其他标签（注册开放 / 邮箱验证 / 初始额度）
- [x] 对比表格已支持固定字段列、最多 4 列满宽展示、超出后横向滚动

### 第 2 阶段完成标准
- [x] 首页、discover、compare 不再依赖旧平台主数据作为主来源
- [x] 前台核心展示改由 `site-catalog + sks` 聚合驱动
- [x] 首页 / discover / compare 的 SKS 关键指标展示已基本完成统一

---

## 3. 第 3 阶段：legacy 平台库退场

### 3.1 旧结构盘点
- [ ] 盘点 `platforms`、`platform_attribute_*`、`platform_models`、`connectivity_logs` 的实际依赖
- [ ] 标记哪些表：
  - 保留只读
  - 冻结不用
  - 迁移后归档
  - 可以直接废弃

### 3.2 旧字段迁移策略
- [ ] 废弃旧核心属性：
  - 线路
  - 付款方式
  - 分类级别
  - 主推模型
- [ ] 若需保留历史痕迹，则迁入 `legacy_meta_json`
- [ ] 保留论坛 / 点评 / 用户系统与站点的关联桥接方案

### 3.3 迁移脚本
- [ ] 设计 `platforms -> site-catalog` 迁移脚本
- [ ] 旧 `platformId` 与新 hostname 的映射表方案
- [ ] 为 review / forum review / visit 页面保留过渡兼容

### 第 3 阶段完成标准
- [ ] 旧平台库不再承担新站点主数据职责
- [ ] 旧页面最少具备 hostname 级别过渡兼容能力

---

## 4. 第 4 阶段：自动标签 / 自动状态体系

### 4.1 运营状态标签
- [ ] 自动产出：
  - 长期稳定
  - 正常运营
  - 略有波动
  - 新站上线
  - 疑似停运
- [ ] 明确判断规则（基于 7d / 15d / 30d 与最近状态）

### 4.2 推荐标签
- [ ] 自动产出：
  - 人气权威
  - 免费公益
  - 新站抢注
- [ ] 数据来源包括：
  - 是否免费 / 公益
  - 是否开放注册
  - 是否有初始额度
  - 点击数
  - 点评数
  - 讨论热度
  - SKS 稳定率

### 4.3 模型供应商族
- [ ] 统一 provider family 规则：
  - Anthropic
  - OpenAI
  - Gemini
  - xAI
  - 智谱
  - DeepSeek
  - Llama
  - 通义千问
  - MiniMax
  - Moonshot
  - 其他
- [ ] 模型名推断规则与手工覆盖规则并存

### 第 4 阶段完成标准
- [ ] 前台状态标签和推荐标签改为自动计算，不依赖人工写死

---

## 5. 第 5 阶段：检测与历史数据规则落地

### 5.1 检测调度
- [ ] 默认最少 60 分钟一次
- [ ] 后续预留 30 分钟 / 15 分钟调度能力

### 5.2 数据保留规则
- [ ] 记录当天实时数据（带日期时间）
- [ ] 第二天将前一天数据聚合为日均值（带具体日期）
- [ ] 每站点、每模型保留 30 天历史 + 当天实时
- [ ] 超过 30 天自动清理最旧记录

### 5.3 SKS 指标接口
- [ ] 输出：
  - 7天 %正常
  - 15天 %正常
  - 30天 %正常
  - 当天平均延时
  - 每次检测数据

### 第 5 阶段完成标准
- [ ] SKS 指标与历史保留规则按你定义的口径稳定运行

---

## 6. 第 6 阶段：sk-buy-tools 全自动流水

### 6.1 模块分层
- [ ] `fofa/`：粗筛库
- [ ] `getinfo/`：初筛库
- [ ] `newapi/` / `sub2api/`：注册、拿 key
- [ ] 成功拿 key 后自动推送 `sk-buy`

### 6.2 共享能力
- [ ] 抽统一 proxy 配置读取
- [ ] 抽统一 HTTP 请求封装
- [ ] 抽统一 hostname / URL 归一化
- [ ] 抽统一 payload 输出格式

### 6.3 自动流转
- [ ] `fofa粗筛库 -> 筛选库`
- [ ] `筛选库 -> 注册尝试`
- [ ] `注册成功 -> 自动申请 key`
- [ ] `有 key -> 正式进入 website + SKS`

### 第 6 阶段完成标准
- [ ] 至少一条完整自动化链路可以无人工介入跑通

---

## 7. 第 7 阶段：人工维护最小化

- [ ] 仅保留人工 override：
  - 站长认证
  - 手动隐藏 / 下线
  - 争议处理
  - 少量展示修正
- [ ] 后续管理后台增加站长认证与状态覆盖入口
- [ ] 明确禁止再走“人工录入主数据”老路

---

## 推荐执行顺序（严格按顺序推进）

1. **先做第 1 阶段：底座收口与验证**
2. **再做第 2 阶段：首页 / discover / compare 切换**
3. **再做第 3 阶段：legacy 平台库退场**
4. **再做第 4、5 阶段：自动标签 + 历史口径**
5. **最后做第 6、7 阶段：tools 全自动流水 + 人工 override 收口**

---

## 下一步建议

下一步只做一件事：

- **回补第 1 阶段剩余验证：优先完成 `admin/sks/sites` 管理态导入链路端到端验证，以及 `runInitialProbe` 首轮探测验证**

这样可以在前台切换已经落地的前提下，把新链路最后两项底座验证补齐，再进入第 3 阶段 legacy 平台库退场。
