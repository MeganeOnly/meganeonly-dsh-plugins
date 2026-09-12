# Changelog

本文件记录 `dsh-manager-hub` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口（Z0-apply.js + client.js 两处都使用同一 slot），该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列）。
  - 本插件仅做 UI 聚合（顶部 tab 切换 + 插件存在性探测），数据源全部下沉到 plugin-manager / skill-manager / mcp-manager 三个子插件，自身不调用 `ctx.agents` / `ctx.session` / `ctx.inbox`。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.2 → 0.1.3）

## [0.1.2] - 2026-09-06

### 维护

- 注释精简：移除少量冗余注释（3 行），保留 `[perf]` / WHY / section marker——按 `dsh-ui-tweaks` v0.10.6 的同套规则。具体：
  - `20-constants.js`：`TABS` 上方 2 行 tab 可用性解释（已在 `00-banner.js` 中讲过）。
  - `70-hub-page.js`：`[perf v0.x]` 改回 `[perf]`（去掉版本号），并合并 2 行乐观显示注释 + 删掉尾部单字 `// 乐观显示` label。
- `docs/maintainability.md` 新增 § 二「注释约定」，把本插件的注释精简规则落到文档里。

### 兼容性

- 行为零变化；纯注释 / 文档调整。

## [0.1.1] - 2026-09-04

### 修复

- tab 切换失效：修复当前视图选择把 plugin 设为无条件最高优先级导致点击 Skill / MCP 无法切换的问题（现改为优先呈现用户选中且可用的 tab，默认仍落在插件页）。

### 变更

- 插件视图新增"预设组件（.mjs）"分组：预设组合行（`.mjs` 相对路径）从常规分组移出，带"预设"徽标、说明文字且不可在此启停（与 dsh-plugin-manager 同步）。
- tab 按服务可用性条件显示：某管理插件被停用（其 API 返回 404）时对应 tab 自动隐藏，其余 tab 不受影响；重新启用后刷新页面即恢复显示。

### 兼容性

- host 半端零副作用占位保持；client bundle 仍是单文件 + 拆包两套（v0.1.0 已拆）。
- DSH 0.1.2-rc.1 实测：聚合 tab 调用三个老插件 API，启停响应 manager-hub（与 dsh-plugin-manager v0.3.0 / dsh-skill-manager v0.1.1 / dsh-mcp-manager v0.1.1 同步发布）。

## [0.1.0] - 2026-08-21

作为独立 npm 包发布的初始版本。

### 新增

- 设置页唯一"管理"入口（settings.section id=`manager-hub`，order=30），替代原来的 插件管理 / Skill 管理 / MCP 管理 三个独立设置页。
- 顶部 tab：插件（默认）/ Skill / MCP，点击切换三个管理视图；数据源分别来自 `/api/plugin-manager`、`/api/skill-manager`、`/api/mcp-manager`。
- 三个管理视图是三个老插件客户端视图的适配副本（共享样式、`res.ok` 守卫、去掉各自标题）。
- client bundle 按通用规范拆分为 `lib/client-src/` 多文件（10 个 section）+ build/verify 脚本。
