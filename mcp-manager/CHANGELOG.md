# Changelog

本文件记录 `dsh-mcp-manager` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.0] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"MCP 管理"页面：列出 profile 中配置的所有 MCP 服务器，支持搜索与按启用状态分组。
- 连接状态展示：读取运行时状态区分"已连接 / 连接失败 / 已停用"。
- 工具清单：按 `mcp__<serverName>__` 前缀从已注册工具中筛选并展示。
- 端点与凭据摘要：`Authorization` 等请求头值与环境变量值只在宿主进程内读取，发送到浏览器前一律打码。
- 一键启用 / 停用：写入 web profile 的 `cordis.patch.yml`，解析时保留原有注释，采用临时文件 + 重命名的原子写。
- 启停需重启 DSH 后生效，界面为待生效条目显示"待重启"标记；启停的真实来源是 patch 文件而非运行时状态，重启前不会中断已建立的连接。
