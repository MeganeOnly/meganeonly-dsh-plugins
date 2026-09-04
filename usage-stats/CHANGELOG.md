# Changelog

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.7] - 2026-09-05

### 修复

v0.3.6 host 半段审计的 4 bug 修复完成后，进一步发现并修复 v0.3.6 残留的 2 个**数字入口硬化漏洞**——仅涉及 `lib/index.js` host 端聚合层：

- **`addUsage` 仍接受 `Infinity` / 字符串 / NaN 路径**：`usage.X || 0` 只挡 undefined / null / 0 / `""`（这 4 种 falsy）。漏洞矩阵：
  - `Infinity || 0` = `Infinity`（truthy → `bucket += Infinity` → bucket 变 Infinity）
  - `"5" || 0` = `"5"`（truthy → `bucket += "5"` → bucket 误接受脏数据变 5）
  - `"abc" || 0` = `"abc"`（truthy → `bucket += "abc"` → bucket 变 NaN）
  - `NaN || 0` = `0`（NaN 视为 falsy，恰好兜住——但语义脆弱）
  - `{}` / `[]` / `true` 同样 truthy 直传 → 桶污染成 NaN / 数值串接

  修复：新增 `toFiniteNumber(value) = typeof value === 'number' && Number.isFinite(value) ? value : 0`，对所有 token 字段（inputTokens / outputTokens / cacheReadTokens / cacheWriteTokens / reasoningTokens）统一收敛。

- **`typeof event.time === 'number'` 守卫对 NaN / Infinity 失效**：v0.3.6 在 `assistant/message` / `lastTs` 用了 `typeof event.time === 'number'`，但 NaN / Infinity 的 typeof 都是 `'number'`（历史 JS 设计）。后果：
  - NaN 事件穿透守卫 → `beijingDayKey(NaN)` → `new Date(NaN).toISOString().slice(0,10)` = `"Invalid Da"`，污染按日 / 按小时 / 按分钟三粒度
  - Infinity 事件穿透守卫 → `new Date(Infinity).toISOString()` = `"Invalid Date"`
  - tool/call `event.time != null` 对 NaN / Infinity 都判 true → pendingCalls 落 NaN → `(NaN - dispatched) = NaN` → `Math.max(0, NaN) = NaN` → toolMs / 工具耗时被污染
  - step/start 的 `openStep.time = event.time` 直存 NaN → llmMs 计算产生 NaN 让 UI 显示 "NaN ms"

  修复：所有数字入口收敛到 `Number.isFinite(event.time)` 守卫 + `toFiniteNumber(event.time)` 兜底。覆盖 6 处：
  - lastTs 跟踪
  - assistant/message usage 写入（守卫 + day 桶 + 小时桶 + 分钟桶）
  - step/start.openStep.time
  - tool/call pendingCalls 落库条件
  - tool/result.elapsed
  - assistant/message llmMs 增量

### 兼容性

- 客户端无变更（仅 host 端聚合硬化）
- 行为变化：之前会被污染成 NaN / Infinity 的脏数据，现在收敛为 0（host 输出 `totals.inputTokens` 等字段对脏事件**不再反映**，这是预期——v0.3.6 的设计原则就是不让脏事件污染真实数据）
- `CACHE_VERSION` 不变（仍 v5）—— v0.3.6 的老缓存结构未改，无需作废重算

### 验证

- `tests/test-add-usage-harden.mjs`：29 项新增硬化测试全过（覆盖 NaN / Infinity / -Infinity / "abc" / "5" / null / undefined / {} / [] / true 在所有 5 个 token 字段 + 6 处时间入口的污染防御；以及正常数字 / 负数 / 浮点 / 零不被误杀）
- `tests/audit-repro.mjs`：14 项 v0.3.6 audit 复现全过（确认未退化）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS
- `node --check lib/index.js` / `node --check lib/client.js`：均通过
- `npm run verify:client`：DIFFERS（预期，banner 仅追加 v0.3.7 注释段，bundle 净增 1215 字节纯注释，无功能变更）

---

## [0.3.6] - 2026-09-05

### 修复

审计 `lib/index.js` host 半段发现的 4 个 bug，全部在 host 端：

- **缓存从未被读回（性能 bug）**：`apply()` 里 `let cache = { sessions: {} }` 之后再也没有调用 `loadCache(cachePath)`，导致每次 DSH 进程重启都会全量重解码所有 session 日志（缓存文件虽然写出去但永远读不回来）。修复：`apply` 启动时新增 `cacheReady = loadCache(cachePath).then(c => cache = c)`，并让 `summary()` 在 `cacheReady` 解决之后再 `buildSummary`，避免第一次请求在空 cache 上假命中。
- **跨项目 session 缓存键冲突（数据正确性 bug）**：`collectSessionFiles` 用 `sessionDir.name`（仅 `session-XXX`）作 `file.id`，导致两个项目各自一个同名 session 目录时 `cache.sessions[file.id]` 互相覆盖，size/mtimeMs 假匹配还会跳过真实解码。修复：`file.id` 改为 `<projectDir>/<sessionDir>`，bump `CACHE_VERSION` 4 → 5 强制一次缓存作废重算（避免老 v4 缓存的孤儿键污染新键空间）。同步在 buildSummary 的 cache 命中判定处加 `cached.agg && typeof cached.agg === 'object'` 防御，挡住升级后第一次加载老缓存时的半写入文件。
- **`tool/call` 缺 `callId` 时污染 `pendingCalls` / `callNames`**：原代码无脑 `callNames.set(event.data.callId, name)` + `pendingCalls.set(event.data.callId, time)`，把键设为 `undefined`，导致任何 `tool/result` 的 `source.callId === undefined` 都会"匹配"到第一个未配对的 tool/call，把别人的耗时算到错误工具的 `ms` 上。修复：缺 `callId` 时仍把 calls 计入 top tools（保证工具次数准确），但不写入 `pendingCalls` / `callNames`，彻底切断误配对路径。
- **`assistant/message` 缺 `event.time` 污染 1970-01-01 桶**：原代码 `beijingDayKey(event.time ?? 0)` 把无 time 的事件落到 `1970-01-01`，几个孤立事件就能让"今天用了 0 token"的图表出现"1970-01-01 用了 N token"的幽灵柱（按日 / 按小时 / 按分钟三粒度全中）。修复：`usage != null && typeof event.time === 'number'` 守卫，把所有 `addUsage` 调用移到守卫内，缺 time 的事件既不进 `models` 也不进任何时间粒度桶；`llmMs` 计算仍允许 `?? 0` 兜底（不会变负）。

### 兼容性

- 客户端无变更（host 半段修复不影响 client bundle 的形状；本版本仍走 `lib/build-client.cjs` 重新生成 `lib/client.js`，bundle 字节数不变）
- `CACHE_VERSION` 4 → 5：升级后第一次请求会全量重解码（一次性的 cost，与首次安装等价）；后续恢复增量
- 老的 v4 缓存文件不会被自动删除，下次 save 时原地覆盖

### 验证

- `tests/audit-repro.mjs`：14 项 audit 复现测试全过（覆盖 4 个 bug 的修复点 + cache load 端到端：cross-project 串扰、第二次 reused ≥ 2、删除后 liveIds 修剪）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS（`renderCount = 4`）
- `node --check lib/index.js` / `node --check lib/client.js`：均通过

---

## [0.3.4] - 2026-09-03

### 修复

- **UsageStatsPageBody 渲染异常治本**：用户实测报 `Cannot read properties of undefined (reading 'day')`，stack trace 列号与 client.js 实际 line 不匹配（强说明浏览器缓存了中间版本）。v0.3.4 把所有 `d.X` 直接访问改用顶部声明的 `safeX = d.X || fallback` 局部变量兜底，覆盖所有 d.X 路径：
    - `safeByTrend`（line 95 `d.byTrend[r.granularity]`）
    - `safeTotals`（line 102 `d.totals` / line 185 `d.totals.outputTokens`）
    - `safeByModel`（line 194 `.map` / line 265 `.length` / line 282 select `.map`）
    - `safeTopSessions`（line 212 `.map` / line 341 `.length`）
    - `safeTools`（line 226 `.map` / line 367 `.length`）
- **自诊断 catch block**：v0.3.4 在 catch 内加 `console.error("[usage-stats] render exception; d shape:", { byDay / byTrend / byModel / totals / sessionCount / rawSessionCount / topSessions / tools / errors }, e)`，下次出错时 DevTools Console 会**直接打印 d 的精确字段状态**（哪个字段缺失、byModel 元素 keys、byTrend 各粒度长度），无需用户报告 stack trace 即可定位 root cause。

### 兼容性

- 客户端 100% 向后兼容（所有 d.X 路径都有 safeX 兜底）
- host 半段 v0.2.x / v0.3.0 / v0.3.3 都能正常渲染（host 不需要重启）
- self-diagn  log 是 dev-only console.error，生产环境无副作用

---

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

## [0.3.5] - 2026-09-04

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

### 兼容性

- DSH 0.1.2-rc.1 实测：`SessionSeq` 与 `SessionLogOffset` 强类型区分保持向前兼容（DSH 0.1.2 release notes 已声明）；本插件直接读磁盘 zstd 日志，不依赖 `Session.events` 运行时 API（DSH 0.1.2 已替换为 `seq`/`eventAt()`/`snapshotEvents()`）。会话日志中 `assistant/message.usage` 字段（inputTokens / outputTokens / cacheRead / cacheWrite / reasoningTokens）与 `request/header.data.header.config` (provider / model) 等 schema 字段未变，前向解析稳定。DSH 0.1.2 新增"回答末尾 token 显示"是 UI 层（不在 `conversation.composer.dock` slot），不影响本插件 `data-fetching`。

## [0.1.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"使用统计"页面：总量卡片展示输入、输出、推理、缓存读取 token 数以及请求数与生成速度。
- 趋势与分解视图：近 30 天用量柱状图、按模型分解表、会话用量排行与工具调用排行。
- 数据源为 `~/.dsh/sessions` 下的会话日志，token 数取自助手消息的 `usage` 字段，为模型侧返回的精确值而非估算。
- 会话日志解析支持 zstd 多帧拼接容器：先结构性扫描帧边界再逐帧解压，使用 Node 内置模块实现，无额外运行时依赖。
- 增量缓存：按 `(size, mtimeMs)` 记录每个会话文件的解析结果，以原子写方式保存到 web profile 目录下的 `.usage-stats-cache.json`，未变更的文件不重复解析。
- 宿主半段注册 `/api/usage-stats/summary` 聚合路由，并在启动时预热一次缓存。
