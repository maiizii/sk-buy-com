# 更新说明（2026-04-07 / v0.1.3)

## 本次更新概览

本次版本主要围绕 **检测链路代理接入、前台站点展示细节补充，以及收藏相关能力落地** 展开。

相较于 `v0.1.2`，本次主要完成了以下工作：

- 检测代理能力接入数据库配置：
  - 新增 `src/lib/proxy-config.ts`
  - 新增 `src/lib/proxied-request.ts`
  - 网站可达性检测、SKS 公开信息探测、模型列表抓取 / 模型探测统一支持检测代理
  - 检测代理改为从数据库 `app_settings` 中读取 `proxy.pool.detection`
  - 支持多行代理、格式规范化、去重与运行时随机选取
  - 默认写入一条 SOCKS5 检测代理，便于服务器部署后直接验证
- 检测相关链路收口：
  - `src/lib/monitor.ts` 已切换到代理请求封装
  - `src/lib/sks/site-public.ts` 已切换到代理请求封装
  - `src/lib/sks/probe.ts` 已切换到代理请求封装
- 前台与交互细节继续补充：
  - 首页 / discover / compare 页面继续做站点展示与筛选体验调整
  - 导航栏、语言切换与部分文案继续同步整理
- 收藏相关能力补充：
  - 新增 `src/app/api/favorites/route.ts`
  - 新增 `src/components/FavoriteSiteButton.tsx`
  - 新增 `src/lib/favorites-client.ts`
  - 新增 `src/components/NoticeModal.tsx`
- 后台代理设置页面暂未正式开放：
  - `src/app/api/admin/proxy-settings/route.ts` 当前返回未开放状态
  - 后续如需管理化，再补后台设置页即可

---

## 本次版本的发布重点

这次发布的核心，不是把代理管理页面做完，而是先确保：

- 线上服务器部署后，网站检测与模型检测已经可以稳定走代理
- 代理配置已从硬编码/临时参数收口到数据库设置项，便于后续继续扩展
- 即使后台尚未开放代理管理，也不会影响当前部署验证

---

## 验证结果

本次整理发布前已执行：

```bash
npm run lint
```

结果说明：

- 本次修改未引入新的 ESLint error
- 当前仓库仍存在少量历史 warning（主要在前台页面），不阻塞本次发布

---

## 版本调整

- 版本号从 `0.1.2` 升级为 `0.1.3`

---

## 建议提交信息

```txt
chore: release v0.1.3 with detection proxy support and frontend updates
```

---

## 备注

- 当前检测代理使用数据库键：`proxy.pool.detection`
- 支持按行维护多条代理，运行时随机选择一条使用
- 后续如果你要继续做后台管理，只需要补一个代理设置页面，把该键写回数据库即可
