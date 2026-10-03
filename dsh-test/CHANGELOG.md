# Changelog

dsh-test 的变更记录。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.4] - 2026-10-03

### 兼容性

- 已对照 DSH 0.2.0-rc.2 实际安装源码（`@deepseek-ai/dsh` 及同目录下的 `@deepseek-ai/*` 依赖包）核验，本插件无代码变更：
  - **包清单四项硬必需齐备**：`dsh.bundle.patch`（`./cordis.patch.yml`，文件存在）、`dsh.client.platform = "web"`、`exports["./client"]` 与 `lib/client.js` 均在位；客户端 bundle 以 `__ModuleLoader__.load({ id: "dsh-test", factory })` 信封收尾，`id` 与包名一致。
  - **host 契约未变**：`export const inject = ['webServer']` 的服务名在 0.2.0-rc.2 中仍可解析；`ctx.webServer.register({ kind: 'exact', path: '/api/test/hello' })` 的签名与 `exact` Map 形态未变，注册前查重守卫（`ctx.webServer.exact.has(path)` 命中则告警并跳过）继续成立；handler 的 `(req, res)` 形态与 405 方法守卫未变。
  - **客户端契约未变**：仅注入一枚徽标 DOM 并通过同源 `fetch('/api/test/hello')` 轮询，不使用 `ctx.slots` / `slots.inject` / `data-slot` 锚点，不命中 0.2.x 变更的任何 slot key。
- **本插件当前未安装进任何 profile**：本机两个 profile（`web` / `headless`）的 `dependencies` 与 `dsh.profile.bundles` 中都没有 `dsh-test`，profile 的 `cordis.patch.yml` 里也没有它的条目，因此运行实例上完全不加载——直接请求 `GET /api/test/hello` 得到 401 是未通过浏览器鉴权栅栏 / SPA fallback 的响应，不是路由级问题。启用需 `dsh plugin --profile web add dsh-test`，或手工把包名写进 profile 的 `dependencies` 与 `dsh.profile.bundles` 后重启 DSH。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.3 → 0.1.4）

### 验证

- `node tools/check-dsh-contract.cjs`：`PASS  dsh-test`

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 本插件为最小管道健康检查器（host / client bundle / cordis 名册三层探测），不调用 `ctx.agents` / `ctx.session` / `ctx.inbox` / `ctx.slots` / `ctx.subprocess` 等 § 三 列举的任何运行时 API。
  - 客户端仅一个徽标 DOM + fetch 同源 `/api/hello`，与 DSH 内核 API 解耦。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/test/hello` 改为经本地 `registerRoute()` 注册——先查 `ctx.webServer.exact`，路径已被其他插件占用时告警并跳过，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `registerRoute()` 守卫 + 调用点）
- `package.json`（version 0.1.2 → 0.1.3）

## [0.1.1] - 2026-09-08

### 维护

- **client bundle 注释精简**：移除 `lib/client.js` 中 1 处 restate 性质的行内注释 `// 异步获取 host 端响应，更新徽标状态`（与紧邻 `fetchHello().then(function (text) { setBadge(...) })` 重复说"做什么"而不是"为什么"）。保留：顶部 JSDoc banner、单文件 mini-section marker（`// ===== CSS =====` / `// ===== badge DOM =====` / `// ===== apply =====`）、3 处 WHY 注释（fetch 同源、CSS 失败兜底、body 未就绪不抛错）。规则参考 `dsh-ui-tweaks` v0.10.6。

### 兼容性

- 行为零变化——本次只删 1 行注释，不改任何运行时代码。

### 改动文件

- `lib/client.js`（-1 行注释）
- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.0 → 0.1.1）

## [0.1.0] - 2026-09-08

### 新增

- 初次入库：最小 DSH 插件管道健康检查器（host + client + cordis 三层验证）。
  - host 注册 `GET /api/test/hello`
  - client 在右下角注入状态徽标（绿=通 / 红=断 / 黑底 loading=超时）
  - 用于排查「插件失踪」时先确认管道本身是否健康
