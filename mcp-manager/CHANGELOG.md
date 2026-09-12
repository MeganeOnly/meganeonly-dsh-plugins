# Changelog

本文件记录 `dsh-mcp-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口，该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列）。
  - 宿主半端走 `ctx.webServer.register` + `ctx.loader.entries()` + `ctx.tools.schemas()` + `ctx.cordis` 组合重启链路，与 § 三-1/2/3/4 列举的 agent / session / inbox API 变更无交集。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。
- 注：本插件当前在 web profile 的 `cordis.patch.yml` 里被用户主动停用（`- id: mcp-manager / disabled: true`），发布本版本不改变该状态。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.1 → 0.1.2）

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
