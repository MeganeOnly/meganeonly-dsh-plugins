# Changelog

dsh-test 的变更记录。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
