# Changelog

本文件记录 `dsh-skill-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.4] - 2026-10-03

### 修复

- **修复既有死代码：`latestSessionCwd()` 恒返回 `undefined`，项目级 skill 视角恢复**。该函数原先只调 `ctx.sessions.list.getSnapshot()`，但 `ctx.sessions` 是 `SessionStore`，其 `list` **一直是方法**（`list(): Session[]`），`getSnapshot()` 并不存在——这不是升级引入的回归，而是自始未生效的死代码：调用抛错后被 `try/catch` 静默吞掉，函数恒返回 `undefined`，`/list` 的项目级分组与项目根目录扫描随之失效。现改走真实契约。

### 兼容性

- 主路径：`typeof ctx.sessions.list === 'function'` 时调用 `list()` 取 live session 数组（创建序），逐个读 `session.header.cwd`，取最后一个非空字符串。取证：`SessionStore.list()` 在 0.1.5-rc.1 与 0.2.0-rc.2 **均为方法**（0.1.5-rc.1 见 `dsh-session` 类型 `:424`；0.2.0-rc.2 见 `dsh-session/lib/types/index.d.ts:334-472`，`list(): Session[]` 在 `:452`、`Session.header` 在 `:119`）。
- 回退路径：`ctx.sessions.list` 非函数时保留对 `getSnapshot()` 对象形态的处理，仍按 ids 经 `ctx.agents.get(id)?.session?.header?.cwd` 解析，取值优先级不变（兼容更早或旁支版本）。
- 防御风格不变（整段 `try/catch`、可选链），解析不出时仍返回 `undefined`；host 半段其余代码零改动，client 半端不受影响。

### 改动文件

- `lib/index.js`（`latestSessionCwd()` 改走 `SessionStore.list()` + 双路径回退，注释标注取证来源）
- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.3 → 0.1.4）

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - `ctx.agents.get(id)?.session?.header?.cwd` 访问链（L344）仍成立：`Agent` interface 保留 `readonly session: Session`（类型来自 `@deepseek-ai/dsh-session`），`Session.header: SessionHeader`，`SessionHeader.cwd?: string`（`packages/core/agent/src/runtime-types.ts` + `packages/core/session/src/index.ts` + `packages/core/session/src/types.ts`）。
  - `ctx.skills.registerProvider` + `ctx.sessions.list.getSnapshot()` API 在 v0.1.5-rc.1 保留（`AgentHandle.agent` / `Agent.followup` 等公共字段未变）。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/skill-manager/list`、`/api/skill-manager/set-enabled` 两条路由改为批量注册前先经本地 `routeTaken()` 查 `ctx.webServer.exact`——路径已被其他插件占用时告警并跳过该条，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由数量与顺序与之前完全一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `routeTaken()` 守卫 + 注册循环改造）
- `package.json`（version 0.1.2 → 0.1.3）

## [0.1.1] - 2026-09-04

### 变更

- 设置页条目改为响应式：当 dsh-manager-hub 的"管理"入口（id=`manager-hub`）存在时自动隐藏本页，缺席时自动恢复（兜底），避免设置页同时出现多个管理入口。

### 兼容性

- host 半端零改动；DSH 0.1.2-rc.1 下 `ctx.skills.registerProvider` + `ctx.sessions.list.getSnapshot()` + `ctx.agents.get(id).session.header.cwd` 契约保持不变。

## [0.1.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"Skill 管理"页面：列出用户级 skill 并显示作者署名。
- 搜索与分组：按启用中 / 已停用 / 项目级 / 诊断分组展示。
- 一键启用 / 停用：停用通过注册高优先级的同名"影子"条目遮蔽原条目实现，不修改任何 `SKILL.md` 文件；按 skill 名全局生效，包含项目级同名 skill。
- 即时生效：变更后主动使 skill 缓存失效，无需重启 DSH。
- 扫描范围覆盖用户级 skill 目录（`DSH_HOME/skills`、`~/.agents/skills`）与最近会话的项目根目录。
