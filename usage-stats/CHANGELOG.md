# Changelog

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.3] - 2026-09-03

### 修复

- **HeatmapCalendar 渲染异常 `Cannot read properties of undefined (reading 'day')`**：v0.3.0 重构把 `daySeries` 输出元素从 `{ day, ... }` 改成 `{ day, ... }`（day 字段保留），但 HeatmapCalendar 内部对 days 数组元素硬编码 `day.day` 访问——当 host 半段处于中间状态（老版本输出无 day 字段、或 byDay 数组为空但存在）时会抛 `undefined reading 'day'`。v0.3.3 三重修复：
    1. 客户端 `HeatmapCalendar(days, ...)` 内部所有 `day.day` / `days[di].day` 改用 `dayKey(d) = d.bucket != null ? d.bucket : d.day` 兼容 `{ day, ... }` / `{ bucket, ... }` 两种 shape（对齐 DayChart 已用的 `bucketKey` 策略）
    2. 客户端 `HeatmapCalendar(d.byDay || [], ...)` 加防御性 fallback，防止 host 半段未升级时 `d.byDay` 为 undefined
    3. host 半段 `daySeries` 输出元素同时给 `day` + `bucket` 两个 key（冗余），让客户端不论读哪个字段都能 work
- **诊断兜底**：每个 `days[di]` 加 `if (day == null) continue;` 守卫，防止老会话日志解析出的 null 元素造成渲染崩溃。

### 兼容性

- 客户端 100% 兼容（host 半段无论是 v0.2.x / v0.3.0 / v0.3.2 / v0.3.3 都能正常渲染）
- host 半段 daySeries 输出 shape 兼容 v0.3.0（仅多一个冗余 `bucket` 字段，老客户端不依赖新字段）

---

## [0.3.2] - 2026-09-03

### 变更

- **贡献热力图级别扩 5 → 7**（用户反馈"级别多一点"）：阈值细分（1-5% / 5-15% / 15-30% / 30-50% / 50-70% / 70-90% / ≥90%），中间多插 3 档让日常用量（1-30%）的明暗变化更细腻，避免"今天比昨天多一倍但显示同一档"的视觉扁平感。色阶（`#c6e6ce` / `#9be9a8` / `#7ac281` / `#40c463` / `#30a14e` / `#216e39` / `#0e4429`），仍单色相绿色（v0.3.1 设定延续）。

### 兼容性

- host half 不变
- `CACHE_VERSION` 不变（v4）
- 6 块独立隐藏 / 显示设置 / 美学度主对 不变
- HeatmapCalendar 组件 `levelFor` + `cellBgStyle` 函数加 2 case（7 case），legend 多渲染 2 个 scaleCell

---

## [0.3.1] - 2026-09-03

### 变更

- **贡献热力图调色板改为绿色单色相（用户反馈调整）**：之前 v0.2.2 用蓝-橙-rose 三色对（L1-L3 蓝主对浅→深 / L4 橙爆日复用 outputBar / L5 rose 异常日复用 peakLine），v0.3.1 改为 GitHub 经典贡献日历 5 级绿色明度梯度（L1 #9be9a8 / L2 #40c463 / L3 #30a14e / L4 #216e39 / L5 #0e4429），不切色相，视觉锚点统一为绿色系。L4 / L5 也不再复用蓝橙主对——之前"爆日 / 异常日"语义被 5 级明度梯度替代（原 L4=60-90% / L5=≥90% 阈值保留不变）。

### 兼容性

- host half 不变 — `lib/index.js` 零改动
- `CACHE_VERSION` 不变（v4）
- 6 块独立隐藏 / 增量缓存 / 美学度主对（蓝橙 + rose peak） 不变（热力图原本独立的色板 token 不影响图表区）
- 客户端代码逻辑不变 — 仅 `30-styles.js` 6 个 token 字面量替换，HeatmapCalendar 组件无需重写

---

## [0.3.0] - 2026-09-03

### 新增

- **子代理消耗归并**：host 端解析 DSH SessionHeader 的 `parentSession` / `delegationDepth` / `origin` 字段（schema 见 dsh-session-persistence-jsonl README § SessionHeader），把每个 subagent 的 token 沿 `parentSession` 链 rollup 到 root main session（**counts speak in main sessions only，token lands on its owner**）。`sessionCount` 改为 root 数；新增 `rawSessionCount` 保留原始 session 数（含被 rollup 的 subagent）供高级排查。`byModel.sessions` 字段语义相应改为"出现该模型的 main session 数"。
- **多粒度趋势**：host 端 `aggregateSession` 同时写入 `hours` / `minutes` / `modelHours` / `modelMinutes` 桶；summary 输出 `byTrend = { minute / hour / day / week }` 四种粒度零填充序列（minute = 24h 滚动 / hour = 7d 滚动 / day = 30d 滚动 / week = 全部按 ISO 周一折叠）。客户端 RANGES 加 7 个 range（兼容 v0.2.x 旧 key）：'all' / '7' / '1' 按日 / 'h7' / 'h1' 按小时 / 'm1' 按分钟 / 'w12' 按周。`DayChart` 接受 `granularity` 参数自适应（柱宽 minute 3px / hour 8px / day/week 22px），minute 模式 N=1440 时 `chartWrap` overflow-x auto 横向滚动，X 轴标签按粒度格式（`fmtBucket`：`MM-DD` / `MM-DD HH` / `MM-DD HH:mm` / 周一日期）。

### 兼容性

- 客户端 schema 新增 `byTrend` 顶层字段 + `rawSessionCount` — v0.2.x 客户端渲染不依赖这两个字段（`byDay` 保留向后兼容），所以升级平滑
- host 端聚合 shape 变化：`aggregateSession` 新增 `parentSession` / `delegationDepth` / `origin` / `hours` / `modelHours` / `minutes` / `modelMinutes` 字段，老字段全部保留
- `CACHE_VERSION` v2 → v4 跳号（中间 v3 不暴露），避免用户白经历一次缓存作废重算
- 增量缓存 `(size, mtimeMs)` 机制不变，z 8 多帧解析不变，美学度主对（蓝橙 + rose peak）不变
- 显示设置 7 块 schema + 热力图模型筛选不变

### bundle

- v0.2.2 client.js = 54968 字节 → v0.3.0 client.js = 59653 字节
- 净增 +4685 字节 / +4.6 KB（远低于 v0.2.2 → v0.3.0 估算的 +15 KB 误判；主要来自 DayChart 自适应 + fmtBucket + rangeSpec + banner）

---

## [0.2.2] - 2026-09-03

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.2] - 2026-09-03

### 新增

- **贡献热力图（GitHub 风格）**：设置页新增 53 周 × 7 日方格日历，按当日 token 量 5 级着色（L1-L3 蓝主对浅→深 / L4 橙爆日 / L5 rose 异常日）。严控色板膨胀，5 级颜色复用 v0.2.1 `inputBar` / `outputBar` / `peakLine` 同色，不引入新色板。Monday-on-top 对齐国际化 + 北京时间约定。超出 53 周自动左截（最近 53 周）。悬停 title 显示日期 + 输入/输出 + 请求数 + 当前筛选模型。
- **模型筛选**（独立持久化）：热力图正上方新增 `<select>` 下拉，切换后只显示该模型每日贡献的 input/output。localStorage key `dsh-usage-stats/heatmap-model-v1`，与 visibility 偏好解耦。`null` = 全部模型聚合。schema 单值，无版本号——任何非字符串值视为 null。
- **显示设置 7 块 schema 扩 `heatmap` 字段**：插在 `chart` 与 `byModel` 之间，隐式迁移（缺字段默认 `true`），老用户升级零感知。

### 兼容性

- host half 不变 — `aggregateSession` / `/api/usage-stats/summary` 输出不变；热力图直接消费现有 `byDay` + `byModel[].days`，无新字段
- `CACHE_VERSION` 不变（v2）— 无缓存作废重算
- bundle：v0.2.1 client.js = 39762 字节 → v0.2.2 client.js = 54968 字节，**净增 +15206 字节 / +15 KB**。超出 30 KB 拆分阈值（v0.2.1 已踩），但与仓库 `dsh-git-hub` 102 KB / `dsh-ui-tweaks` 264 KB / `dsh-task-pool` 46 KB 同范围
- 6 块独立隐藏 / 增量缓存 / 美学度 token / `beijingDayKey` UTC+8 约定 / zstd 多帧解析 全部不变

---

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
