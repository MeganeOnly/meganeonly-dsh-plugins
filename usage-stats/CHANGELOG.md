# Changelog

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"使用统计"页面：总量卡片展示输入、输出、推理、缓存读取 token 数以及请求数与生成速度。
- 趋势与分解视图：近 30 天用量柱状图、按模型分解表、会话用量排行与工具调用排行。
- 数据源为 `~/.dsh/sessions` 下的会话日志，token 数取自助手消息的 `usage` 字段，为模型侧返回的精确值而非估算。
- 会话日志解析支持 zstd 多帧拼接容器：先结构性扫描帧边界再逐帧解压，使用 Node 内置模块实现，无额外运行时依赖。
- 增量缓存：按 `(size, mtimeMs)` 记录每个会话文件的解析结果，以原子写方式保存到 web profile 目录下的 `.usage-stats-cache.json`，未变更的文件不重复解析。
- 宿主半段注册 `/api/usage-stats/summary` 聚合路由，并在启动时预热一次缓存。
