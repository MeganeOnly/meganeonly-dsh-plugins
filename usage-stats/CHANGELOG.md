# Changelog

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.1] - 2026-08-27

### 变更

- **用量图调色板升级**（仅美术，不影响数据 / 行为）：原"灰柱 + 饱和绿"二元对比替换为**蓝-橙主对**（`inputBar: #3b82f6` / `outputBar: #f59e0b`），峰值色由暖陶土 `#b06a3a` 替换为更醒目的 rose `#e11d48`（同时新增 `peakText`/`peakSoft`/`peakBorder` 的 rose 版本）。设计原则与来源参考写在 `lib/client-src/30-styles.js` 顶部注释（data-viz-color / data-viz-techniques 的现代色板与色盲安全 blue/orange 主对）。**通用 accent（绿 `#16a34a`）保留**给图表外元素（btnPrimary / panel 复选框 / 输出总计 / 模型比值列）——图表不再吃绿色，避免"什么都是绿色"的扁平感。灰色 hierarchy 仅用于 hairline / text / 网格 / today 竖线，参考线不应抢数据色。

## [Unreleased]

### 新增

- 用量图美术度升级：在原堆叠柱基础上叠加 4 条参考线（25/50/75% 虚线 + 100% 实线基线）、today 竖线（指向末位日期）、peak 浮动徽章（陶土色，显示「峰值 X.X K · MM-DD」）、摘要脚注（总量 + 输出 + 峰值日）；图例从图表下方移至顶部，今日日期加粗；图表高度由 84px 提至 100px 给网格留白；新增 7 个图表专用色 token（peakLine / peakText / peakSoft / peakBorder / todayLine / gridDashed / gridBase）。
- 设置页右上角新增「显示」按钮：弹出复选框面板，可独立隐藏/展示 6 个数据块（顶部元信息、指标卡、近 30 天用量图、按模型分解表、会话用量 Top、工具调用 Top），并提供「全选 / 全不选」快捷按钮。
- 显示偏好持久化到 `localStorage`（key: `dsh-usage-stats/visible-v1`），刷新页面后保留选择；浏览器不支持 `localStorage` 时降级为进程内有效并输出警告。
- 全部数据块关闭时显示空态提示，引导用户重新打开显示设置。
- `lib/client.js` 已按仓库通用规范拆分为 `lib/client-src/`（10 个 section 文件），新增 `lib/build-client.cjs` + `lib/verify-client.cjs` + `npm run {build,verify}:client`。本插件的 section 索引与差异说明见 `docs/maintainability.md`。

### 修复

- 修复会话表渲染时 `sessionRows.map(function (s) { ... })` 的形参 `s` 遮蔽外层样式对象 `var s`，导致 `s.tdName` / `s.td` / `s.num` 等样式引用失效的问题（形参改名为 `sess`）。

### 维护

- **section marker 对齐通用规范 § 三半**：7 个 section 文件首行 marker 补 4 空格缩进（`    // ===== X =====`），与其余已拆插件一致；bundle 净增 28 字节。
- **补 `prepare` 脚本**：`npm install` / 发布时自动执行 `node lib/build-client.cjs`，保证 `lib/client.js` 与 `lib/client-src/` 始终同步（对齐其余已拆插件）。

## [0.1.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"使用统计"页面：总量卡片展示输入、输出、推理、缓存读取 token 数以及请求数与生成速度。
- 趋势与分解视图：近 30 天用量柱状图、按模型分解表、会话用量排行与工具调用排行。
- 数据源为 `~/.dsh/sessions` 下的会话日志，token 数取自助手消息的 `usage` 字段，为模型侧返回的精确值而非估算。
- 会话日志解析支持 zstd 多帧拼接容器：先结构性扫描帧边界再逐帧解压，使用 Node 内置模块实现，无额外运行时依赖。
- 增量缓存：按 `(size, mtimeMs)` 记录每个会话文件的解析结果，以原子写方式保存到 web profile 目录下的 `.usage-stats-cache.json`，未变更的文件不重复解析。
- 宿主半段注册 `/api/usage-stats/summary` 聚合路由，并在启动时预热一次缓存。
