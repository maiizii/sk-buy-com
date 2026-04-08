# 代理功能说明文档

> 文档状态：当前实现说明
> 适用范围：sk-buy 当前代理池实现 + sk-buy-tools 后续接入参考
> 更新时间：2026-04-08

---

## 1. 当前目标

当前代理功能分两个阶段：

1. **已完成阶段**
   - 在 `sk-buy` 主仓库中实现双代理池管理
   - 后台支持添加、编辑、删除代理
   - 实现静态代理测试脚本与后台测试接口
   - 实现 SKS 静态代理开关，并接入实际探测请求链路

2. **后续阶段**
   - 将住宅动态代理接入 `sk-buy-tools`
   - 统一 FOFA 粗筛后的试探、注册、公开接口探测等行为

当前文档主要用于给后续开发 `sk-buy-tools` 时直接参考，避免再次重做代理方案设计。

---

## 2. 双代理池设计

### 2.1 代理池分类

当前统一分为两类：

- `static`
  - 用于 `sk-buy` / SKS
  - 主要承担：
    - 网站连通检测
    - `/v1/models` 模型列表获取
    - 1-token 推理测试
  - 目标：隐藏源服务器真实 IP，避免直接暴露主机出口

- `residential`
  - 预留给 `sk-buy-tools`
  - 未来主要承担：
    - FOFA 粗筛后的目标试探
    - 注册前公开接口探测
    - 敲门类、低副作用访问类动作
    - 注册链路中的部分请求
  - 目标：提高成功率，同时增强安全性

### 2.2 单条代理记录字段

当前每条代理统一结构如下：

- `id`
- `poolType`
- `name`
- `protocol`
- `host`
- `port`
- `username`
- `password`
- `enabled`
- `priority`
- `notes`
- `createdAt`
- `updatedAt`

### 2.3 支持协议

当前支持：

- `http`
- `https`
- `socks5`

其中：

- `socks5` 在 agent 实际创建时会转成 `socks5h://`
- 这样目标域名由代理侧解析，避免本机 DNS/TLS 前置问题

---

## 3. 当前存储方式

当前没有单独新建代理表，而是先使用主库 `app_settings` 保存结构化 JSON。

### 3.1 代理池配置 Key

- `proxy.pools.v1`

保存内容是一个 JSON 对象：

```json
{
  "version": 1,
  "entries": []
}
```

### 3.2 SKS 代理开关 Key

- `proxy.sks.enabled`

说明：

- `1` 表示开启
- `0` 或空表示关闭

### 3.3 为什么暂时不用独立表

当前阶段优先目标是：

- 先把双代理池管理跑通
- 先把静态代理测试和 SKS 接线跑通
- 降低 migration 风险

后续如果代理池规模扩大，再考虑单独拆表，例如：

- `proxy_pool_entries`
- `proxy_usage_logs`
- `proxy_health_checks`

---

## 4. 当前核心实现位置

### 4.1 服务层

- [proxy-pools.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/proxy-pools.ts)

职责：

- 代理池记录读写
- 代理 URL 构建与脱敏
- 代理 agent 创建
- 静态代理测试执行
- SKS 代理开关控制
- 当前生效静态代理选择

### 4.2 实际请求入口

- [proxied-request.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/proxied-request.ts)

职责：

- 统一封装需要“按 SKS 代理开关执行”的请求
- 开关关闭时走直连
- 开关开启时走静态代理池中当前生效代理
- 支持自动跟随重定向
- 输出脱敏后的错误上下文

### 4.3 后台管理 API

- [route.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/app/api/admin/proxy-settings/route.ts)

职责：

- 获取代理池列表
- 创建代理
- 更新代理
- 删除代理
- 切换 SKS 代理开关

### 4.4 后台测试 API

- [test/route.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/app/api/admin/proxy-settings/test/route.ts)

职责：

- 通过后台直接测试静态代理
- 支持：
  - 出口 IP 检查
  - `/v1/models`
  - 1-token 推理

### 4.5 后台页面

- [page.tsx](file:///c:/Users/yumac/AppData/Local/sk-buy/src/app/admin/page.tsx)

当前代理工作区包含：

- 代理录入表单
- 代理列表
- 静态代理测试表单
- SKS 代理开关
- 当前生效静态代理展示

### 4.6 测试脚本

- [test-static-proxy.mjs](file:///c:/Users/yumac/AppData/Local/sk-buy/scripts/test-static-proxy.mjs)
- [test-static-proxy-selfcheck.mjs](file:///c:/Users/yumac/AppData/Local/sk-buy/scripts/test-static-proxy-selfcheck.mjs)

---

## 5. 当前 SKS 接线方式

### 5.1 实际接线点

SKS 当前并不是每个探测函数自己判断代理，而是统一通过：

- [requestTextViaDetectionProxy](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/proxied-request.ts)

来执行。

### 5.2 当前已受开关控制的链路

目前以下调用链已经受 `proxy.sks.enabled` 控制：

- [sks/probe.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/sks/probe.ts)
  - `syncSksSiteModels`
  - `testSksModel`
  - `runSksFullProbe`

- [sks/site-public.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/sks/site-public.ts)
  - 站点公开信息识别

- [monitor.ts](file:///c:/Users/yumac/AppData/Local/sk-buy/src/lib/monitor.ts)
  - 平台健康检查请求

### 5.3 开关行为

- **关闭时**
  - `requestTextViaDetectionProxy(...)` 内部不绑定代理 agent
  - 请求走直连

- **开启时**
  - 从 `static` 代理池中选出当前优先级最高且启用的代理
  - 请求走该代理

### 5.4 当前代理选择策略

当前是最小可用策略：

- 仅从 `static` 池里选
- 仅选 `enabled = true`
- 按 `priority` 升序取第一条

后续可扩展：

- 轮询
- 失败熔断
- 健康检查淘汰
- 权重策略

---

## 6. 当前后台使用方式

### 6.1 代理录入

后台代理录入字段：

- 代理池类型：静态 / 住宅动态
- 名称
- 协议
- Host
- Port
- 用户名
- 密码
- 优先级
- 备注
- 启用状态

### 6.2 SKS 代理开关

后台中可直接切换：

- 已启用：SKS 探测走静态代理
- 已关闭：SKS 探测走直连

当前 UI 行为：

- 点选即保存
- **不需要额外点“保存”**

### 6.3 静态代理测试

支持后台直接测试：

- 出口 IP
- `/v1/models`
- 模型 1-token 推理

---

## 7. 命令行测试方式

### 7.1 脚本入口

见 [package.json](file:///c:/Users/yumac/AppData/Local/sk-buy/package.json)

当前脚本：

- `npm run proxy:test-static`
- `npm run proxy:test-static:selfcheck`

### 7.2 静态代理测试

示例：

```bash
npm run proxy:test-static -- --proxy-url=http://user:pass@host:port
```

带 API Base URL 和 Key：

```bash
npm run proxy:test-static -- --proxy-url=socks5://user:pass@host:port --api-base-url=https://example.com --api-key=sk-xxx
```

带 1-token 推理：

```bash
npm run proxy:test-static -- --proxy-url=socks5://user:pass@host:port --api-base-url=https://example.com --api-key=sk-xxx --model=gpt-4o-mini
```

### 7.3 本地自检

```bash
npm run proxy:test-static:selfcheck
```

这个脚本会：

- 起一个本地 mock API
- 起一个本地 HTTP 转发代理
- 自动调用测试脚本
- 验证：
  - 出口检查
  - models 请求
  - 1-token 推理

---

## 8. 当前已解决的问题

### 8.1 socks5 TLS 建连前断开

问题现象：

- `Client network socket disconnected before secure TLS connection was established`

解决方式：

- 将 `socks5://` 在 agent 使用时转成 `socks5h://`
- 让域名由代理侧解析

### 8.2 301/302 重定向导致测试误判失败

问题现象：

- `/v1/models` 返回 301，但实际站点可用

解决方式：

- 请求层支持自动跟随 `301 / 302 / 303 / 307 / 308`

### 8.3 错误信息不足

解决方式：

- 当前错误中会附带：
  - `url=`
  - `host=`
  - `protocol=`
  - `proxy=`（脱敏）
  - `message=`

---

## 9. sk-buy-tools 后续接入建议

### 9.1 设计目标

后续 `sk-buy-tools` 不建议每个模块各写一套代理逻辑，建议抽一个统一代理请求层。

建议先抽成共享模块，例如：

- `sk-buy-tools/shared/proxy-client.mjs`

### 9.2 建议提供的统一能力

建议至少暴露：

- `loadResidentialProxyConfig()`
- `selectResidentialProxy()`
- `buildProxyUrl(entry)`
- `createProxyAgent(entry)`
- `requestViaResidentialProxy(url, init)`

### 9.3 建议配置来源

后续 `sk-buy-tools` 可选两种方式：

#### 方案 A：直接读主仓库 API

通过内部接口获取 `residential` 池配置。

优点：

- 单一配置源
- 后台统一维护

缺点：

- tools 必须能访问主站后台接口

#### 方案 B：由主站导出或同步到 tools 本地配置

例如同步成：

- `.local/proxy-pools.json`

优点：

- tools 可离线跑
- 耦合更低

缺点：

- 要解决同步更新问题

### 9.4 当前推荐

建议先做：

- **主站后台维护代理池**
- **tools 通过内部接口拉取住宅动态代理配置**

后续如果 tools 需要长时间离线运行，再补本地同步缓存层。

---

## 10. sk-buy-tools 具体接入点建议

### 10.1 fofa

建议接入点：

- FOFA 结果粗筛后的目标探测请求
- 候选站点首页探测
- 注册页 / 公共接口探测

不建议代理的部分：

- FOFA 官方 API 本身是否走代理，可单独评估

### 10.2 getinfo

建议接入点：

- 单站点公开信息探测
- 批量筛选时所有外部站点请求

### 10.3 newapi

建议接入点：

- 注册前试探
- 登录、资产读取、模型查询
- 需要伪装成住宅访问的外部请求

不建议一开始就强制全量代理，建议：

- 先给命令增加 `--use-residential-proxy`
- 跑稳定后再改默认行为

---

## 11. 后续扩展建议

### 11.1 代理健康检查

后续可增加：

- 代理可用性打分
- 最近成功率
- 最近失败原因
- 最近出口 IP 变化

### 11.2 多代理轮询

后续可增加：

- round-robin
- 随机加权
- 失败自动切换

### 11.3 日志体系

建议后续记录：

- 哪次请求命中了哪条代理
- 代理成功/失败计数
- 最近失败原因分布

注意：

- 日志中只记录脱敏后的代理地址
- 不记录明文账号密码

### 11.4 独立表结构

如果后续代理规模变大，再升级为独立表：

- `proxy_pool_entries`
- `proxy_pool_health_logs`
- `proxy_pool_usage_logs`

---

## 12. 当前结论

截至目前，代理功能在 `sk-buy` 主仓库已完成：

- 双代理池后台管理
- 静态代理测试能力
- socks5 兼容修复
- 重定向兼容修复
- SKS 静态代理启停开关
- SKS 实际探测链路接线

其中真实验证已确认：

- 静态 socks5 代理出口正确
- `/v1/models` 正常
- 1-token 推理正常
- 开关开启/关闭可以切换是否走代理

因此，后续 `sk-buy-tools` 只需要在此设计基础上补一个“住宅动态代理请求层”，不需要再重做整套代理体系。
