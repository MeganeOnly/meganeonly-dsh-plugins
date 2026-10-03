# Changelog

本文件记录 `dsh-mcp-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.4] - 2026-10-03

### 修复

- **patch 解析补 `!!js` customTags（消除未解析标签警告、与内核写入方解析语义对齐的防御性一致性修复）**：`lib/index.js` 里两处 `parseDocument()` 调用此前均为裸调用，现统一传入 `customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value) => value }]`：
  - `patchDisabledIds()`（读停用集合，供 `/list` 判断开关状态）；
  - `setEnabled()`（启停改写，链路为解析 → 改 `disabled` → `String(doc)` 回写 patch 文件）。
  该选项收敛为模块级常量 `PATCH_PARSE_OPTIONS`，两处调用共用一份，避免后续新增入口再漏。
- 定性说明（据实测，**不是**崩溃修复，避免误读）：在 yaml 2.9.0 下不传 customTags **不会**抛错，`document.errors` 仍为 0；差别在于每个 `!!js` 都会记一条 `TAG_RESOLVE_FAILED` 警告（消息 `Unresolved tag: tag:yaml.org,2002:js`）——该节点在本插件读到的文档树里始终处于标签未解析状态，而本插件随后要整篇改写并回写该文件，未解析标签参与回写时其语义不由 yaml 保证。实测数据：
  - 内核自带层 `dsh-base/cordis.patch.yml`（16 处 `!!js`，20732 B 源文件）：裸解析 `errors=0 / warnings=16`；传 customTags 后 `errors=0 / warnings=0`；
  - 两种模式的整篇 round-trip 输出均为 20752 B 且**逐字节相同**，16 处 `!!js` 全部保留；
  - 对含 `!!js "!ctx.get('profileContext')"` 的 patch 走一遍「解析 → 改 `disabled` → `String(doc)` 回写」：不抛错，`errors/warnings` 均为 0，`!!js` 原样保留，回写文本再用同一选项重解析仍然干净（0 错误 / 0 警告）。
  即本次改动消除的是未解析标签警告与"回写语义不由 yaml 保证"这一隐患；对插件启停行为没有任何可观测改变——改写结果与改动前逐字节相同。
- 排查结论：本插件解析/回写 `cordis.patch.yml` 的入口只有上述两处，无其它遗漏——`lib/client.js` 仅在界面文案里提及该文件名，不涉及 YAML 处理；`yaml` 依赖也仅由 `lib/index.js` 使用。

### 兼容性

- 已对照 DSH v0.2.0-rc.2 安装包的源码逐条核验，本插件接口契约全部成立，无需改动：
  - client 半端仅用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口，该 slot key 在 0.2.0-rc.2 的 slot catalog 中仍存在且仍为 `list` 类型（`@deepseek-ai/dsh-client-ui-settings/lib/types/client/contract/slots.d.ts:72-76`，**未重命名**）；
  - 宿主半端 `ctx.tools.schemas(scope?)` 仍存在（`@deepseek-ai/dsh-tools/lib/types/index.d.ts:711`，签名 `schemas(scope?: ScopeKey): ToolSchema[]`）；
  - `ctx.loader.entries()` 仍存在（`@deepseek-ai/cordis-plugin-loader/lib/types/tree.d.ts:15`，返回 `Generator<Entry, void, void>`）；
  - 包清单契约 `dsh.bundle.patch` / `dsh.client.platform` / `exports["./client"]` 三项不变。
- 本次改动的参照实现即内核自身：`@deepseek-ai/dsh-plugin-manager/lib/types/patch.js`（`writePluginEnabled`）与 `@deepseek-ai/dsh-config-editor/lib/index.js`（配置编辑器写盘）写同一个 patch 文件时都传同一份 customTags（前者 23-25 行、后者 91-94 行），本插件此前与内核做法不一致。
- 注：本插件当前在 web profile 的 `cordis.patch.yml` 里被用户主动停用（`- id: mcp-manager / disabled: true`），发布本版本不改变该状态。

### 改动文件

- `lib/index.js`（新增 `PATCH_PARSE_OPTIONS` 常量；两处 `parseDocument` 传参）
- `package.json`（version 0.1.3 → 0.1.4）
- `CHANGELOG.md`（本段）

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口，该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列）。
  - 宿主半端走 `ctx.webServer.register` + `ctx.loader.entries()` + `ctx.tools.schemas()` + `ctx.cordis` 组合重启链路，与 § 三-1/2/3/4 列举的 agent / session / inbox API 变更无交集。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。
- 注：本插件当前在 web profile 的 `cordis.patch.yml` 里被用户主动停用（`- id: mcp-manager / disabled: true`），发布本版本不改变该状态。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/mcp-manager/list`、`/api/mcp-manager/set-enabled` 两条路由改为批量注册前先经本地 `routeTaken()` 查 `ctx.webServer.exact`——路径已被其他插件占用时告警并跳过该条，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由数量与顺序与之前完全一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `routeTaken()` 守卫 + 注册循环改造）
- `package.json`（version 0.1.2 → 0.1.3）

## [0.1.1] - 2026-09-04

### 变更

- 设置页条目改为响应式：当 dsh-manager-hub 的"管理"入口（id=`manager-hub`）存在时自动隐藏本页，缺席时自动恢复（兜底），避免设置页同时出现多个管理入口。

### 兼容性

- host 半端零改动；DSH 0.1.2-rc.1 下 `ctx.webServer.register` 与 `ctx.loader.entries()` 仍可用。本插件当前在 web profile 的 `cordis.patch.yml` 里被用户主动停用（`- id: mcp-manager / disabled: true`），发布本版本不改变该状态——用户重启 DSH 自行选择是否启用。

## [0.1.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"MCP 管理"页面：列出 profile 中配置的所有 MCP 服务器，支持搜索与按启用状态分组。
- 连接状态展示：读取运行时状态区分"已连接 / 连接失败 / 已停用"。
- 工具清单：按 `mcp__<serverName>__` 前缀从已注册工具中筛选并展示。
- 端点与凭据摘要：`Authorization` 等请求头值与环境变量值只在宿主进程内读取，发送到浏览器前一律打码。
- 一键启用 / 停用：写入 web profile 的 `cordis.patch.yml`，解析时保留原有注释，采用临时文件 + 重命名的原子写。
- 启停需重启 DSH 后生效，界面为待生效条目显示"待重启"标记；启停的真实来源是 patch 文件而非运行时状态，重启前不会中断已建立的连接。
