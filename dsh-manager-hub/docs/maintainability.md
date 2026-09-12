# dsh-manager-hub 拆分清单

本插件的 client bundle 在 `lib/client.js` 已拆分为 `lib/client-src/` 多文件结构。通用规范（marker 约定、ES5 编码风格、构建脚本格式、字节验证、阈值）写在 [`../../docs/maintainability.md`](../../docs/maintainability.md)——**那是本仓库所有 DSH 插件共用的规范**。

本文件只列**本插件**的具体 section 拆分与维护约定。

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
| `70-hub-page.js`     | `ManagerHubPage`：挂载时调 `/api/plugin-manager/list`，按返回 `entries` 里 `id === 'skill-manager'` / `id === 'mcp-manager'` 的 `enabled` 字段决定 tab 是否显示；plugin-manager 自身 404 视为 hub 失去支点，三个 tab 全不可用 + 顶部 tab 栏（插件默认 / Skill / MCP）+ 切换渲染可用视图 + 聚合署名 |
| `Z0-apply.js`        | `apply(ctx)`：注册 `settings.section`（id=`manager-hub`, order=30, label="管理"）+ exports |
| `Z9-loader-close.js` | 闭合 `load()` + `return module.exports` |

## 二、注释约定（v0.1.2 起的精简规范）

本插件本就注释很少（v0.1.1 总共约 18 行 `//` 注释 + 1 个 JSDoc）；v0.1.2 顺手按 `dsh-ui-tweaks` v0.10.6 的同样规则再精简一档。

1. **版本历程只在 `CHANGELOG.md`**——任何"v0.X.Y 修了这个 / 加了这个"的叙述都进 changelog；source 文件 header / inline 注释不带版本号（`[perf]` 不写成 `[perf v0.x]`）。
2. **保留的注释类型**：
   - JSDoc 段（`/** ... */`）说明函数做什么、参数 / 返回含义
   - 行内 `//` 说明非显然的设计决策（"为什么"不是"做了什么"）
   - `[perf]` 优化解释（说明 WHY，例如 60-mcp-view 的 `_searchHayLower` 预计算、70-hub-page 的 mount-time only-probe-default-tab）
   - field-level inline WHY（如 `70-hub-page.js` 里 `avail[0][t.id] === true` 的可用性条件分支）
3. **移除的注释类型**：
   - 段落级版本历程（v0.X.Y 起 + 修复 + 根因 + 修法 + 兼容性 + 改动文件列表）
   - 重复 banner 已讲过的设计要点（如 `TABS` 数据结构的 tab 可用性逻辑——已在 00-banner.js 里讲清）
   - 单字段 / 单行的 label-only 注释（如 `// 乐观显示` 这类只是标注下一行做什么的）
4. **CHANGELOG.md 是版本历程的唯一来源**——git log + CHANGELOG 段能完整还原任何版本的修复动机 + 文件影响，source 文件不再重复。
5. **通用规范 `docs/maintainability.md` § 三三"注释规范"**继续适用——JSDoc 用单行 `/** ... */`，inline `// why not what`，不要在生成的 bundle 文件里写 linter-disable 行。

## 三、本插件特殊项

- **三个视图是复制**：`40/50/60-*.js` 是 plugin-manager / skill-manager / mcp-manager 三个插件客户端视图的适配副本（改共享样式引用、加 `res.ok` 守卫、去掉各自的 h3 标题）。数据源仍是三个老插件的宿主 API，**不要在 hub 里改业务逻辑**——业务改动应回到对应老插件，再同步到这里。
- **三个老插件的关系**：老插件的设置页条目在本插件（id=`manager-hub`）存在时自动隐藏、缺席时恢复（由那三个插件客户端实现）。本插件被停用时，三个老插件页面作为兜底重新出现。tab 可用性以 plugin-manager /list 的 `enabled` 字段为单一真源——`skill-manager` / `mcp-manager` 被用户在 plugin-manager 里暂停（patch `disabled: true`）时，对应 tab 立即隐藏；恢复启用需**重启 DSH**才重新可见，与子插件启停的"重启后生效"约定一致。
- **渲染冒烟**：改动后跑 `npm run build:client` + `node --check lib/client.js` + mock 冒烟（`__ModuleLoader__.load` + fake `require("react")` + mock `ctx.slots`）。

## 四、相关

- 通用规范：[`../../docs/maintainability.md`](../../docs/maintainability.md)
- 构建脚本：`lib/build-client.cjs`
- 字节校验：`lib/verify-client.cjs`
- 版本历程（注释精简后唯一来源）：`CHANGELOG.md`
- DSH 插件作者 skill：`dsh-persistent-plugin-authoring`（DSH skill 目录下）