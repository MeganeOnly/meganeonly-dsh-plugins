# Changelog

本文件记录 `dsh-plugin-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"插件管理"页面：列出 profile 中所有非系统常驻插件，显示名称、版本、描述与作者署名。
- 搜索与分组：按启用中 / 暂停中 / 系统插件分组展示。
- 一键启用 / 停用：按 id 定向覆盖写入 web profile 的 `cordis.patch.yml`，解析时保留原有注释，采用临时文件 + 重命名的原子写。
- 系统插件保护：`@deepseek-ai/*` 前缀的系统插件在列表中置底且不可在此启停。
- 启停后通常触发热重载即时生效；注册 HTTP 路由或挂载事件钩子的插件仍需重启 DSH 才能完全生效。
