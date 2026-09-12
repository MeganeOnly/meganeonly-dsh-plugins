# Changelog

本文件记录 `dsh-plugin-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口，该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列，`settings.section` 不受影响）。
  - 宿主半端（`lib/index.js`）走 web profile `cordis.patch.yml` 文件读写 + `ctx.cordis` 组合重启链路，与 § 三-1/2/3/4 列举的 agent / session / inbox API 变更无交集。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.3.0 → 0.3.1）

## [0.3.0] - 2026-09-04

### 新增

- 插件清单新增"预设组件（.mjs）"分组：把 agent 预设组合里的相对路径 `.mjs` 行（如 `./tool-bootstrap.mjs`、`./custom-bash.mjs`）从"启用中 / 暂停中"挪到独立分组，带"预设"徽标并附说明；宿主 API 同步标记这些条目为 `presetMjs` 并拒绝对其启停（id 定向覆盖写不进预设组合，此前会误导性提示"已暂停"）。

### 变更

- 设置页条目改为响应式：当 dsh-manager-hub 的"管理"入口（id=`manager-hub`）存在时自动隐藏本页，缺席时自动恢复（兜底），避免设置页同时出现多个管理入口。
- npm scope 风格 id（`@scope/name`）的展示优化：标题旁新增灰色 `@scope` 徽标（等宽字体）传达 publisher 信息；当插件 `name` 字段缺失但 id 是 scoped 时，仅取包名作为标题（不再把 `@scope/name` 整段作为标题），避免和徽标重复显得笨重；副标题"作者：xxx"行在 scope 与 author 名称一致时跳过以避免冗余。

### 修复

- 路由守卫：注册 `/api/plugin-manager/*` 前检测路由是否已被其他插件占用（如 `@linxin666/dsh-client-ui-plugin-manager`），占用则跳过注册并打警告，避免 duplicate exact route 导致 DSH 启动崩溃。
- scoped npm id（`@scope/name`）的作者解析此前因早返回始终为空，现已放开：候选路径 `node_modules/<id>/package.json`（即 `node_modules/@scope/name/package.json`）直接生效，可正常读取这些插件的 `author` 字段。

### 兼容性

- host 半端零新增破坏性改动；client bundle 是单文件 100 行级别不受 § 三三 拆分阈值约束。
- DSH 0.1.2-rc.1 实测：路由守卫对 `/api/plugin-manager/list` 在 web-ui-plugin-manager 已占用时正确跳过（web profile 当前同时启用了自建 dsh-plugin-manager 与 linxin 版——按 cordis.patch.yml line 64-65，linxin 版已禁用，本路由唯一）。

## [0.2.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"插件管理"页面：列出 profile 中所有非系统常驻插件，显示名称、版本、描述与作者署名。
- 搜索与分组：按启用中 / 暂停中 / 系统插件分组展示。
- 一键启用 / 停用：按 id 定向覆盖写入 web profile 的 `cordis.patch.yml`，解析时保留原有注释，采用临时文件 + 重命名的原子写。
- 系统插件保护：`@deepseek-ai/*` 前缀的系统插件在列表中置底且不可在此启停。
- 启停后通常触发热重载即时生效；注册 HTTP 路由或挂载事件钩子的插件仍需重启 DSH 才能完全生效。
