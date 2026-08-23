# dsh-manager-hub 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分。

## 一、本插件的 section 索引

| 前缀                 | 角色                                                         |
| -------------------- | ------------------------------------------------------------ |
| `00-banner.js`       | 顶部 JSDoc 注释块（设计说明 + 与三个管理插件的关系）         |
| `10-loader-open.js`  | `__ModuleLoader__.load({...})` 开头 + `var React = require("react")` + `var inject = ["slots"]` |
| `20-constants.js`    | 常量（`API_PLUGIN` / `API_SKILL` / `API_MCP` / `MINE_AUTHOR` / `TABS`） |
| `30-styles.js`       | 共享样式对象 `S`（三个视图共用 + tab 栏样式）                 |
| `40-plugin-view.js`  | `PluginManagerPage`：插件管理视图（调 `/api/plugin-manager/*`，来自 dsh-plugin-manager） |
| `50-skill-view.js`   | `SkillManagerPage`：Skill 管理视图（调 `/api/skill-manager/*`，来自 dsh-skill-manager） |
| `60-mcp-view.js`     | `McpManagerPage`：MCP 管理视图（调 `/api/mcp-manager/*`，来自 dsh-mcp-manager） |
| `70-hub-page.js`     | `ManagerHubPage`：挂载时探测三个 API（404=对应插件停用→隐藏该 tab）+ 顶部 tab 栏（插件默认 / Skill / MCP）+ 切换渲染可用视图 + 聚合署名 |
| `Z0-apply.js`        | `apply(ctx)`：注册 `settings.section`（id=`manager-hub`, order=30, label=“管理”）+ exports |
| `Z9-loader-close.js` | 闭合 `load()` + `return module.exports` |

## 二、本插件特殊项

- **三个视图是复制**：`40/50/60-*.js` 是 plugin-manager / skill-manager / mcp-manager 三个插件客户端视图的适配副本（改共享样式引用、加 `res.ok` 守卫、去掉各自的 h3 标题）。数据源仍是三个老插件的宿主 API，**不要在 hub 里改业务逻辑**——业务改动应回到对应老插件，再同步到这里。
- **三个老插件的关系**：老插件的设置页条目在本插件（id=`manager-hub`）存在时自动隐藏、缺席时恢复（由那三个插件客户端实现）。本插件被停用时，三个老插件页面作为兜底重新出现。tab 按 API 可用性条件显示（停用→404→隐藏），所以某个老插件停用不会导致聚合页出现报错 tab。
- **渲染冒烟**：改动后跑 `npm run build:client` + `node --check lib/client.js` + mock 冒烟（`__ModuleLoader__.load` + fake `require("react")` + mock `ctx.slots`）。

## 三、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）
