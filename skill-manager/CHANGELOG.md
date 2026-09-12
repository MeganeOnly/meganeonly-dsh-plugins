# Changelog

本文件记录 `dsh-skill-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - `ctx.agents.get(id)?.session?.header?.cwd` 访问链（L344）仍成立：`Agent` interface 保留 `readonly session: Session`（类型来自 `@deepseek-ai/dsh-session`），`Session.header: SessionHeader`，`SessionHeader.cwd?: string`（`packages/core/agent/src/runtime-types.ts` + `packages/core/session/src/index.ts` + `packages/core/session/src/types.ts`）。
  - `ctx.skills.registerProvider` + `ctx.sessions.list.getSnapshot()` API 在 v0.1.5-rc.1 保留（`AgentHandle.agent` / `Agent.followup` 等公共字段未变）。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.1 → 0.1.2）

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
