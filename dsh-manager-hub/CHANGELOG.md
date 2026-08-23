# Changelog

本文件记录 `dsh-manager-hub` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 修复

- tab 切换失效：修复当前视图选择把 plugin 设为无条件最高优先级导致点击 Skill / MCP 无法切换的问题（现改为优先呈现用户选中且可用的 tab，默认仍落在插件页）。

### 变更

- 插件视图新增"预设组件（.mjs）"分组：预设组合行（`.mjs` 相对路径）从常规分组移出，带"预设"徽标、说明文字且不可在此启停（与 dsh-plugin-manager 同步）。
- tab 按服务可用性条件显示：某管理插件被停用（其 API 返回 404）时对应 tab 自动隐藏，其余 tab 不受影响；重新启用后刷新页面即恢复显示。

## [0.1.0] - 2026-08-21

作为独立 npm 包发布的初始版本。

### 新增

- 设置页唯一"管理"入口（settings.section id=`manager-hub`，order=30），替代原来的 插件管理 / Skill 管理 / MCP 管理 三个独立设置页。
- 顶部 tab：插件（默认）/ Skill / MCP，点击切换三个管理视图；数据源分别来自 `/api/plugin-manager`、`/api/skill-manager`、`/api/mcp-manager`。
- 三个管理视图是三个老插件客户端视图的适配副本（共享样式、`res.ok` 守卫、去掉各自标题）。
- client bundle 按通用规范拆分为 `lib/client-src/` 多文件（10 个 section）+ build/verify 脚本。
