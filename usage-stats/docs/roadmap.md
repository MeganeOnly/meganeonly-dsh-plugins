# dsh-usage-stats 后续实施规划

本文档记录 `dsh-usage-stats` 在 v0.2.1 之后拟推进的三个特性的设计取舍、数据源改动、与现有架构的兼容性边界，以及实施顺序。每一节给出**目标 / 数据源 / 聚合改动 / 前端要点 / 兼容性 / 参考实现**六块。

> **范围**：本文件只锁定**设计意图与边界**，不写实现代码。代码改动按本文件落地时，按仓库通用规范 `docs/maintainability.md`（marker 约定 / 阈值 / 字节校验）+ 本插件 `docs/maintainability.md`（section 索引 / 6 块独立隐藏 / 美学度 token）执行。

## 状态

| 特性 | 状态 | 发布版本 |
|---|---|---|
| § 一 子代理消耗归并 | ✅ 已实施 | v0.3.0（2026-09-03） |
| § 二 多粒度趋势 | ✅ 已实施 | v0.3.0（2026-09-03） |
| § 三 GitHub 风格贡献热力图 | ✅ 已实施 | v0.2.2（2026-09-03） |
| § 三 调色板调整为绿色单色相 | ✅ 已实施（用户反馈后） | v0.3.1（2026-09-03） |
| § 三 级别扩 5 → 7 | ✅ 已实施（用户反馈后） | v0.3.2（2026-09-03） |
| § 三 HeatmapCalendar 渲染异常修复 | ✅ 已实施（用户实测反馈） | v0.3.3（2026-09-03） |
| 用 UsageStatsPageBody 渲染异常治本（所有 d.X safeX 兜底 + self-diagn） | ✅ 已实施（用户实测反馈） | v0.3.4（2026-09-03） |
| **§ 四 增量账本架构重构（会话级水位 + 帧级续读 + 快照 memo + 保留量）** | ✅ 已实施 | **v0.5.0（2026-10-04）** |
| **§ 五 上游会话列表 30s 问题（框架侧，本插件已绕开）** | ⚠️ 记录在案，不在本插件范围 | — |

---

## 四、增量账本架构重构（v0.5.0，已实施）

本规划在 v0.4.5 之后追加：v0.4.x 的三条核心设计（`createdAt` 判缓存命中、每次刷新走框架
`listSessions()`、变更即整文件重解码 + 单体 JSON 重写）在真实数据上均不成立，实测证据与
替代方案见 `CHANGELOG.md` 的 `[0.5.0]` 条目与 [`architecture.md`](./architecture.md)。

实施顺序与落地情况（每步一个 commit）：

1. 复现活跃会话漏统计的 characterization 测试（`test-v050-undercount`，随后翻转为目标断言）
2. `lib/frames.js` 帧级增量解码内核
3. `lib/fold.js` 水位折叠 + 保留量裁剪
4. `lib/store.js` 会话级记录 + 修订失效
5. `lib/discover.js` 廉价发现（`listGenerations` 优先 + 自走查回退）
6. `lib/scan.js` 单飞扫描 + 时间片 + 进度
7. `lib/rollup.js` + `lib/payload.js`（归并 + 快照 memo）+ 入口切换
8. 客户端扫描状态行 + 轮询 + 按钮语义
9. 文档与版本（architecture.md / README / CHANGELOG / maintainability / roadmap）

实测结果（734 会话 / 439 MB）：首响应 23 ms、热 payload 3 ms、全量重算 65.0 s、
峰值 RSS 320 MB、无变更刷新约 190 ms（`decoded = 0`）。

**过程中发现并修正的两个非预期问题**（原规划未预见到）：

1. **seq 非稠密**：真实日志的可见 seq 序列天然跳号（v0 世代写 `assistant/chunk` 与带
   `seq0` 的 `*-chunks` 分片，加上历史迁移丢掉的序号），按"空洞"处理会误伤 69% 的会话 ——
   最终删掉 gap 概念，水位只做去重，改写识别完全交给字节层（世代/尺寸/前缀锚）。
2. **Map 与普通对象混用**：`series.js` 的聚合 Map 误用面向普通对象的取桶辅助函数，
   症状是"派生视图静默全零"（`Map.entries()` 恒空），已改为 Map 原生取桶并加非零断言。

## 五、上游会话列表 30s（框架侧，已绕开）

`ctx.sessionQuery.listSessions()` → `persistence.list()` → `listArtifacts()` 对每个会话解压
首帧；语料里存在历史世代时还会再跑一遍 `historicalCorpusRevision()`（第二次全走查 +
每文件 `stat` + sha256）。本机 734 会话约 30 秒，且 DSH 侧边栏与搜索走同一条路
（`dsh-api-session-controller` 的 `list`）。

本插件自 v0.5.0 起完全绕开该入口（自建发现 + 帧级续读），但**这不是插件能修的**：
若上游愿意修，切入点是把"列表所需的 header 元数据"落成索引（或让 `listArtifacts` 走
缓存/并行），而不是每次列表都解压首帧。详细证据见 `architecture.md` § 九。

---

## 一、子代理消耗归并（Subagent Rollup）

### 1.1 目标

当前 v0.2.1 的"会话 Top"把每个子代理会话当独立条目展示，导致两件事：

1. 用户看到的"会话 X 用 50k token"实际上是 1 个主会话 + N 个 subagent 的总和，但排行榜只显示主会话的 own usage——**重复看**或**看不到**两种偏差同时存在。

2. 用户无法直观知道"**今天最贵的那 5 个 main session**"——按当前实现排出来的前 5 全是 subagent。

期望：

- **展示维度**：排行榜 / 按模型表 / 按日趋势全部按 **root main session** 聚合；counts（会话数、回合数、步数）只统计 main session。
- **底层归属**：每个 subagent 的 token **真实归属**仍是它对应的 main session（不是凭空消失或摊到根）。
- **可解释性**：在 main session 行上能展开看到 subagent 的明细（可选，v1 可不做）。

### 1.2 数据源

DSH 会话日志里 subagent 通过 `parentSession` / `session.parentId` 等关系链组织。**具体字段名以 DSH checkout 实际事件为准**，实施前需在 `lib/index.js` 加一个轻量探针打印一次会话事件 key 集合确认。

预期：

- 每个 session 起始事件（`type: 'session'`）携带 `id` + `parentId` / `parentSession`。
- 子代理的 `assistant/message` 事件**仍包含** provider 返回的精确 usage——v0.2.1 的解析逻辑无须改事件读取，只改聚合归属。

### 1.3 聚合改动

v0.2.1 `aggregateSession(events)` 返回的 `{ id, totals, models, days, modelDays, tools, ... }` 加上一个字段：

```
parentChain: { rootMainId, parentIds: [...] }   // 供上层汇总决定 rollup 目标
```

汇总层 `apply()` 内新增：

```
- 第一次遍历所有 agg，建立 `id -> parentChain` 索引
- 第二次遍历所有 agg，把每个 subagent 的 totals / models / days / modelDays / tools **rollup** 到 rootMainId 的 bucket
- 输出里两个开关：
    rollupByMainSession: true（默认开启，UI 渲染层走这份聚合）
    rawBySession: <保留 v0.2.1 行为，可选关闭，给高级排查用>
```

**关键边界**：

- 一个 main session 自己**不算自己的子代理**——`rootMainId === id` 时不触发 rollup。
- 子代理 token 数 → owner 的 totals 增加 = v0.2.1 的真实 cost。**不要重新减扣**——v0.2.1 现在是 subagent 独立展示，rollup 后 subagent 行的数据要隐藏（不再展示）而不是再扣 main session（避免重复扣）。
- `topSessions` 排序使用 rollup 后的 totals；subagent 自身不出现在 top 列表（除非用户开启 `rawBySession` 模式）。

### 1.4 前端要点

- `topSessions` 表格的 `tokens` 列**改用 rollup 值**——这是用户能直接感知到的变化，必须明示 "已合并 subagent"（右上角小问号 tooltip）。
- "按模型表" 列里的 `sessions` 字段从"出现该模型的 session 数"改为"出现该模型的 main session 数（含 rollup 后被吃掉的 subagent）"——否则数字会突降，让用户疑惑。
- v0.2.1 的 6 块独立隐藏 / localStorage key / 显示偏好**保持不变**——rollup 是底层逻辑，不影响前端可见性。

### 1.5 兼容性

| 项 | 兼容性 | 说明 |
|---|---|---|
| `CACHE_VERSION` | **+1**（v2 → v3） | 聚合 shape 变了，旧缓存整体作废重算 |
| `/api/usage-stats/summary` 响应 | shape 新增字段，不删旧字段 | 前端可平滑切换；v0.2.1 字段全部保留 |
| 增量缓存 `(size, mtimeMs)` 机制 | 不变 | 文件级 mtime 不受聚合 shape 影响 |
| zstd 多帧解析 | 不变 | 数据源解析层不动 |
| 美学度（蓝橙主对 + rose peak + today line） | 不变 | rollup 后的 totals 仍走同一图表组件 |
| 设置页 UI | 不变 | 不需要新增配置项；rollup 默认开启 |

### 1.6 参考实现

caiyfa/dsh-token-stats 的 README 表述直接对应这个特性：

> "subagent tokens and anomalies roll up along the `parentSession` chain to their **root main session** — counts speak in main sessions only, while every subagent token lands on its owner"

实施细节以 DSH 会话日志的 `parentSession` 字段实际名称为准；上述措辞仅作为语义对齐参考。

---

## 二、多粒度趋势（Multi-Granularity Trend）

### 2.1 目标

v0.2.1 只有一个 30 天日级柱状图（`byDay`）。用户高频反馈场景（来自参考实现的描述）：

- "今天 token 突然爆了，是哪个时段？" → 需要**分钟级**视图
- "这周 vs 上周，哪个模型涨了？" → 需要**周累计曲线**
- "3 个月走势是涨是跌？" → 需要**日累计曲线 + 自动周聚合**（>90 天）

期望：

- 三种粒度：**分钟**（最近 24h）/ **小时**（最近 7d）/ **天**（全部）
- 三种模式：**柱状**（含 v0.2.1 蓝橙主对 + rose peak）/ **4 色堆叠**（input / cache-read / cache-write / output 分层）/ **累计曲线**（烧钱视角的累计值）
- 超过 90 天自动切换为周级粒度（与参考实现的"auto-weekly beyond 90 days"对齐）

### 2.2 数据源

v0.2.1 `aggregateSession` 已经把每个 `assistant/message` 写入 `days`（按 `beijingDayKey` 分桶）。扩展点：在 `aggregateSession` 同时写入三个新桶：

```
hours: 'YYYY-MM-DDTHH'  → bucket   // 小时级（24h 滚动）
minutes: 'YYYY-MM-DDTHH:mm'  → bucket   // 分钟级（最近 24h 才有意义）
```

`days` 保留——日级视图继续用。天级粒度在 `summary` 层做周级折叠（每 7 天一个 `weekStart` key）。

### 2.3 聚合改动

v0.2.1 `daySeries(aggs)` 升级为：

```
granularitySeries(aggs, granularity):
  'minute'  → minutes 桶，24h 滚动（北京时间）
  'hour'    → hours 桶，7d 滚动
  'day'     → days 桶，全部；>90 天切换为 week 折叠
  'week'    → days 桶按 ISO week 折叠
```

输出 shape：

```
byTrend: {
  granularity: 'day' | 'hour' | 'minute' | 'week',
  series: [
    { bucket: 'YYYY-MM-DD' | 'YYYY-MM-DDTHH' | 'YYYY-MM-DDTHH:mm' | 'YYYY-Www',
      ...bucket }, ...
  ]
}
```

**关键边界**：

- 分钟级**只返回 24h 滚动窗口**——更长的分钟级数据膨胀严重且无意义（chart density 撑爆）。
- 周级折叠按**周一为周开始**对齐（DSH 已有 `beijingDayKey` UTC+8 约定保持一致）。
- 4 色堆叠时 `cacheReadTokens` + `cacheWriteTokens` 独立成层**不要合并**——两者计费规则不同（whale-en 的 README 强调 hit/miss gap 在调价后拉大）。

### 2.4 前端要点

- 复用 v0.2.1 的 `DayChart` 组件（`40-components.js`），新增 props：`granularity` / `mode`（bars / stacked / cumulative）/ `colors`。
- v0.2.1 已有的 7 个 chart token（`peakLine / peakText / peakSoft / peakBorder / todayLine / gridDashed / gridBase`）直接复用，**不引入新色板**——保持美学一致性。
- 累计曲线**Y 轴单位**自动从 token 改为 K / M 阶梯（v0.2.1 的 `fmtTokens` 已支持）。
- 6 块独立隐藏设置保留；新增"趋势图（多粒度）"作为现有"近 30 天用量图"的**替代呈现**——共享同一 visibility 槽位（v0.2.1 的 `chart` key），不是新增独立块（避免数据块膨胀）。

### 2.5 兼容性

| 项 | 兼容性 | 说明 |
|---|---|---|
| `CACHE_VERSION` | **+1**（v3 → v4；与 § 一合并到一次 +1） | `aggregateSession` shape 加字段 |
| `byDay`（v0.2.1 字段） | 保留 | 不破坏现有调用方 |
| `byTrend`（新增） | 顶层并列 | 前端按可用性回退——v0.2.1 渲染仍走 `byDay` |
| `RANGES`（`50-config.js`） | 扩展 | 增加 `minute: 24*60` / `hour: 7*24` / `week: 12` 等常量 |
| `fmtTokens` / `fmtDate` / `fmtTime` | 扩展 | 桶 key 格式自适应 |

### 2.6 参考实现

caiyfa/dsh-token-stats：

> "Granularity (minute·24h / hour·7d / day·all, auto-weekly beyond 90 days) × mode (**bars** / **4-color stacked composition** — watch your cache-hit structure evolve / **cumulative curve** — the budget-burn view); dashed Y contour lines with a peak label, hover for per-bucket detail"

---

## 三、GitHub 风格贡献热力图（Contribution Heatmap）

### 3.1 目标

v0.2.1 的 30 天柱状只展示**近 30 天**——超过一年的勤奋度看不到。GitHub 风格 53 周 × 7 日 方格日历是 DSH 用量统计的"标配"视觉名片（参考实现里至少 3 家做了）。

期望：

- 53 周 × 7 日 方格布局（按周列、按日行，**周一在上**或**周日在上**对齐 DSH 国际化风格——v0.2.1 的北京时间约定决定采用周一在上）
- 颜色按当日 token 量分级（**复用 v0.2.1 蓝橙主对**：`#3b82f6 / #f59e0b` 衍生 5 级渐变，不引入新色——避免色板膨胀）
- 悬浮（hover）显示当日明细：日期 + 输入/输出/缓存 + 当日主要模型
- 可选模型筛选（默认全部；切换后只显示该模型贡献的日——复用 v0.2.1 的 `modelInView` 工具函数模式）

### 3.2 数据源

`days` 桶直接够用——已经有 365 天以上的日级数据（前提是会话历史够长）。无须新增聚合。

**边界**：DSH 启动时间之前没有数据，方格左侧自然为空（与 GitHub 自己的行为一致，不补"零"灰）。

### 3.3 聚合改动

无。直接消费 `byDay` 即可。如果未来要叠加模型维度，用 v0.2.1 已经有的 `modelDays` 桶做模型过滤。

### 3.4 前端要点

- 新增 `40-components.js` 组件 `HeatmapCalendar`（`50-config.js` 决定是否显示，复用 `VisibilityPanel` 的 6 块协议）
- SVG 实现：53 周列 × 7 日行，每格 `width = 11px / height = 11px / gap = 2px`（与 GitHub 原版接近），整图宽 ~720px
- 5 级颜色 token（基于 v0.2.1 蓝橙主对）：

```
heatmapL0: <空格子，>            // 与 panel 背景同
heatmapL1: #dbeafe (input 蓝 极淡)
heatmapL2: #93c5fd
heatmapL3: #3b82f6 (主蓝)
heatmapL4: #f59e0b (主橙，超过主蓝阈值，提示"爆日")
heatmapL5: #e11d48 (rose，超过主橙阈值，提示"异常日")
```

**复用 v0.2.1 美学度**：L4/L5 直接用现有的 `peakText` / `peakSoft` 衍生 token，避免硬编码新颜色值。

- hover tooltip 复用 v0.2.1 的 `DayChart` tooltip 渲染逻辑（同色 / 同字体 / 同一 floating 协议）
- localStorage 持久化模型筛选偏好：key 沿用 `dsh-usage-stats/visible-v1` schema，新增 `heatmap: boolean` + `heatmapModel: string|null`，**走隐式迁移**（缺字段默认 `true` / `null`）

### 3.5 兼容性

| 项 | 兼容性 | 说明 |
|---|---|---|
| `CACHE_VERSION` | 不变 | 不依赖新的聚合字段 |
| 6 块独立隐藏 schema | 扩展 | 新增 `heatmap` 字段，**隐式迁移**（缺字段默认 true） |
| v0.2.1 `chart`（30 天柱状） | 保留 | 热力图作为独立数据块，与 30 天柱状并列存在 |
| `peakLine` / `peakText` / `peakSoft`（v0.2.1 token） | 复用 | 不引入新色板 |
| bundle 字节 | **预算紧** | v0.2.1 已 33372 字节，距 30 KB 阈值还有空间但需谨慎；热力图组件预估 +3-4 KB（SVG 渲染 + tooltip + 模型筛选） |

### 3.6 参考实现

yokesky/dsh-usage-lens / TenMilesSwordGod/dsh-token-stats / Make0209/dsh-usage-stats 三家都做了。差异化定位：**美学度对齐 v0.2.1 蓝橙主对 + rose peak**，不照搬 GitHub 绿（DSH web 整体偏冷色调，绿色突兀）。

---

## 四、实施顺序

按依赖关系和数据/前端改动量排序：

```
§ 一 子代理消耗归并  →  § 二 多粒度趋势  →  § 三 热力图
       ↓                       ↓                       ↓
   CACHE v3                CACHE v4 (合并到 v3 一次 bump)    CACHE 不变
   aggregateSession 改     aggregateSession 扩字段          只加前端组件
   apply 汇总层 rollup     granularitySeries 新函数         复用现有 days
   topSessions 排序         RANGES 扩展                       modelDays 过滤
   byModel.sessions 语义   fmtTokens 扩展                    peak token 复用
```

**推荐批次 1**：§ 一（子代理归并）+ § 二（多粒度趋势）**同一次 bump**（`CACHE_VERSION` 从 2 直接到 4；中间 v3 跳过不暴露）。

理由：两者都改 `aggregateSession` shape，分两次等于让用户白经历一次缓存作废重算。一次 bump + 一个 CHANGELOG entry 同时讲清两件事。— ✅ **已在 v0.3.0 实施**（2026-09-03）。CACHE v2 → v4 跳号完成；实际增量 +4.6 KB（远低于 § 五 原估的 +15 KB 误判；v0.3.0 主机端改动量比 v0.2.2 客户端改动量小）。

**推荐批次 2**：§ 三（热力图）— ✅ **已在 v0.2.2 实施**（2026-09-03）。纯前端，`CACHE_VERSION` 不动（v2 不变）。实际净增 +15206 字节 / +15 KB（roadmap 原估 +3-4 KB，偏低的根因是 HeatmapCalendar 内部循环 + 53 周对齐 + 详细 JSDoc 占的字节，比"画 53 个 div"的直觉多不少）。最终 client.js = 54968 字节，与 `dsh-git-hub` 102 KB / `dsh-task-pool` 46 KB 同范围。

---

## 五、兼容性总览

| 改动 | host half | client half | bundle 字节 | `CACHE_VERSION` | 6 块 schema | 美学 token |
|---|---|---|---|---|---|---|
| § 一 子代理归并 | 改 `aggregateSession` + `apply()` rollup | `topSessions` / `byModel` 渲染切换 | +~300B（host） | 2 → 4 | 不变 | 不变 |
| § 二 多粒度趋势 | 扩 `aggregateSession` 字段 + 新 `granularitySeries` | `DayChart` 扩 props + 模式切换器 | +~800B（host + client） | （同上） | `RANGES` 扩 | 不变 |
| § 三 热力图 | 不改 | 新 `HeatmapCalendar` 组件 + model 筛选 | +~3-4 KB（client） | 不变 | `heatmap` / `heatmapModel` | 5 级 heatmap token（复用蓝橙） |

**bundle 阈值警戒**：v0.2.1 = 33372 字节，距 30 KB（30720 字节）已**超** 2652 字节——已经踩红线。三特性合计预估净增 ~4-5 KB，最终 ~38 KB。**建议分两次发布**（v0.3.0 = § 一 + § 二；v0.3.1 = § 三），每次低于 35 KB。

---

## 六、不在本规划内

以下方向用户已明确排除（来自本次会话确认），不进入路线图：

- ❌ HUD 浮窗（右下角常驻实时压力）
- ❌ 多厂商定价（DeepSeek / OpenRouter / GLM / Kimi 等单价 + 折算花费）
- ❌ 异常感知 + 红绿标记 + 异常原因聚类（z-score / IQR / 异常日 hover 工具）
- ❌ 每模型能力画像（cap-profile：成功率 / 重试率 / 错误率）
- ❌ 预算 + 警告阈值（80% / 95% 浏览器 toast）
- ❌ TTFT / TPS 性能维度
- ❌ 多窗口 / 多 profile 总览
- ❌ CSV / JSON 导出
- ❌ 自动生成日报 / 周报 Markdown（Neural Ledger）

未来需要时另起新规划文件，不在本文件范围内。

---

## 七、踩坑

- (1) **DSH 会话日志的 subagent 字段名**：当前以 DSH checkout 实际事件为准。实施前在 `lib/index.js` 加一个 `console.warn(JSON.stringify(Object.keys(events[0])))` 一次性打印确认，避免凭推测写错 key。
- (2) **缓存版本合并 bump**：§ 一 + § 二 同一次 `CACHE_VERSION` 跳到 4 而不是 3，避免用户白经历一次作废重算。
- (3) **bundle 字节已超 30 KB**：三特性累计 ~4-5 KB 净增，最终 ~38 KB。**建议分两次发布**（v0.3.0 / v0.3.1），单次不超过 35 KB。
- (4) **热力图色板严格复用蓝橙主对**：不要照搬 GitHub 绿——DSH web 整体冷色调下绿色突兀。复用 `peakText` / `peakSoft` 衍生，避免色板膨胀。
- (5) **多粒度 4 色堆叠时 `cacheRead` + `cacheWrite` 独立成层**：不要合并——whale-en 已强调两者计费规则不同（调价后 hit/miss gap 拉大）。
- (6) **周末位置**：周一在上 / 周日在上要在 v0.3.0 决策里锁死，国际化策略。v0.2.1 已有 `beijingDayKey` UTC+8 约定延续。
- (7) **子代理 token 归属而非摊销**：rollup 是把所有 token 加到 root main session（owner），**不是把 token 按比例分摊给祖先链上的每个 main session**——caiyfa 的描述明确是 "lands on its owner"。