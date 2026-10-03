/**
 * dsh-usage-stats — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * 设置 → "使用统计"页。全部数据来自宿主半端 /api/usage-stats/summary
 * （跨会话聚合：token 用量 / 按日趋势 / 按模型 / 会话与工具排行）。
 * 纯展示 + 手动刷新，零外部依赖（react 经 require 取自 shell 模块表）。
 *
 * v0.2.0 新增「显示设置」：页面右上角弹出复选框面板，可独立隐藏/展示
 * 6 个数据块（顶部元信息、指标卡、近 30 天用量图、按模型分解表、
 * 会话用量 Top、工具调用 Top），偏好持久化到 localStorage。
 *
 * v0.2.x 美术度升级：用量图新增 4 条参考线（25/50/75/100%）+ today
 * 竖线 + peak 浮动徽章 + 摘要脚注；图例移入图表顶部并加上 today
 * 日期加粗；图表专用色 token（peakLine 暖陶土、todayLine 中灰、
 * gridDashed/gridBase 浅虚线）。
 *
 * v0.2.1 调色板升级：原"灰+饱和绿"二元对比替换为「蓝-橙」主对
 * （#3b82f6 输入 / #f59e0b 输出），rose-600 单独强调峰值日。
 * 色盲安全（blue/orange 主对）+ 与非图表绿色 accent 拉开层次。
 * 见 `lib/client-src/30-styles.js` 头部注释的设计原则与参考来源。
 *
 * v0.2.2 新增「贡献热力图」：GitHub 风格 53 周 × 7 日方格日历。
 * v0.3.1 调色板改为绿色单色相（用户反馈"大的颜色不改变，只要绿色"）：5 级
 * 仅改明度，不切色相，对齐 GitHub 贡献日历视觉语言。
 * v0.3.2 级别扩 5 → 7（用户反馈"级别多一点"）：阈值细分
 * （1-5% / 5-15% / 15-30% / 30-50% / 50-70% / 70-90% / ≥90%），
 * 中间多插 3 档让日常用量（1-30%）明暗变化更细腻。色阶
 *（`#c6e6ce` / `#9be9a8` / `#7ac281` / `#40c463` / `#30a14e` /
 * `#216e39` / `#0e4429`）。
 * v0.3.3 修复 HeatmapCalendar 渲染异常：`Cannot read properties of undefined (reading 'day')`——
 * v0.3.0 重构 daySeries 后 HeatmapCalendar 内部硬编码 `day.day` 在 host 半段中间状态时抛错；
 * v0.3.3 客户端改用 `dayKey(d) = d.bucket != null ? d.bucket : d.day` 兼容 day/bucket 双 shape
 *（对齐 DayChart `bucketKey` 策略）+ 加 `days[di] == null` 守卫 + `HeatmapCalendar(d.byDay || [], ...)` 防御
 * + host `daySeries` 输出元素同时给 `day` + `bucket` 冗余字段。
 * v0.3.4 治本：所有 `d.X` 直接访问改用顶部声明的 `safeX = d.X || fallback` 兜底（safeByTrend / safeTotals / safeByModel / safeTopSessions / safeTools 五条路径全覆盖）+ catch block 加 `console.error` self-diagn dump d 的关键字段，下次出错 DevTools Console 直接打印哪个字段 undefined / 数组长度 / keys，根来源定位无需 stack trace。
 * 模型筛选独立持久化（localStorage `dsh-usage-stats/heatmap-model-v1`，
 * null = 全部模型聚合；非 null = 仅该模型贡献的 input/output）。
 * 显示设置 7 块 schema 扩 `heatmap` 字段，隐式迁移（缺字段默认 true）。
 * 详见 `lib/client-src/40-components.js` 的 HeatmapCalendar 与
 * `lib/client-src/50-config.js` 的 loadHeatmapModel / saveHeatmapModel。
 *
 * v0.3.0 两特性合并发布：
 *   (a) 子代理消耗归并 — host 解析 DSH SessionHeader 的 parentSession /
 *       delegationDepth / origin 字段（schema 见 dsh-session-persistence-jsonl
 *       README § SessionHeader），把每个 subagent 的 token 沿 parentSession
 *       chain rollup 到 root main session（counts speak in main sessions only，
 *       token lands on its owner）。sessionCount 现在是 root 数；新增
 *       rawSessionCount 保留原始 session 数供高级排查。
 *   (b) 多粒度趋势 — host 端 aggregateSession 同时写 hours / /minutes 桶，
 *       summary 输出 byTrend = { minute / /hour / /day / / /week } 四种粒度零填充序列。
 *       客户端 RANGES 加 7 个 range（兼容 v0.2.x 'all' / '30' / '7' / '1'）：
 *         'all' / '7' / '1' — 按日窗口（day）
 *         'h7' / 'h1' — 按小时（hour / minute）
 *         'm1' — 按分钟（minute）
 *         'w12' — 按周（week，ISO 周一折叠）
 *       DayChart 接受 granularity 参数自适应柱宽（minute 极窄 + overflow-x
 *       auto 滚动）+ X 轴标签按粒度格式（MM-DD / MM-DD HH / MM-DD HH:mm / 周一日期）。
 *       CACHE_VERSION v2 → v4 跳号（中间 v3 不暴露避免用户白经历一次缓存作废重算）。
 *
 * v0.3.6 host 半段 bugfix 审计（lib/index.js）：
 *   (a) 缓存从未被读回 → apply 启动时新增 cacheReady = loadCache(cachePath)
 *       门控所有 summary；DSH 重启后第二次起的请求不再全量重解码。
 *   (b) 跨项目 session 缓存键冲突 → file.id 从 sessionDir.name 升级为
 *       `<projectDir>/<sessionDir>`，CACHE_VERSION 4 → 5 强制一次重算。
 *   (c) tool/call 缺 callId 时不写 pendingCalls/callNames（仍计入 calls），
 *       避免 undefined 键与 tool/result 误配对污染 toolMs。
 *   (d) assistant/message 缺 event.time 时不进任何时间粒度桶，避免污染
 *       1970-01-01 的按日 / 按小时 / 按分钟三组数据。
 *   客户端无变更，但 bundle 仍走 build-client.cjs 重新生成以保持字节同步。
 *
 * v0.3.7 host 半段数字硬化（lib/index.js）：
 *   收敛所有数字入口到 toFiniteNumber(value) — 仅在 value 是有限 number 时
 *   返回原值；NaN / Infinity / -Infinity / 字符串 / null / undefined / 对象
 *   / 数组 / boolean 一律返回 0。修复 v0.3.6 残留的两个漏洞：
 *   (a) `usage.X || 0` 只挡 undefined / null / 0 / ""；对 Infinity / "abc"
 *       / "5" / NaN(侥幸) 仍有污染路径（Infinity 直传 → bucket 变 Infinity；
 *       "abc" → NaN；"5" → 误接受脏数据）。
 *   (b) `typeof event.time === 'number'` 守卫对 NaN / Infinity 都判 true
 *       （typeof 都返回 'number'），让 beijingDayKey(NaN) → "Invalid Da" 污染
 *       按日 / 按小时 / 按分钟桶；toolMs / llmMs 计算产生 NaN 让 UI 显示
 *       "NaN ms"。
 *   应用范围：addUsage 所有 token 字段 + assistant/message 的 usage 写入守卫
 *   + step/start.openStep.time + tool/call.pendingCalls 落库条件
 *   + tool/result.elapsed + assistant/message llmMs 增量 + lastTs 跟踪。
 *   客户端无变更（纯 host 端聚合硬化），bundle 仍走 build-client.cjs 重新生成
 *   以保持 banner 注释字节同步。
 *
 * v0.3.9 历史全量日序列 + 「全部」图表 / 热力图跨 30 天边界（host + client）：
 *   host 端在 summary payload 新增 `byDayAll` 字段——把所有 root.days 合并、
 *   按 yyyy-mm-dd 升序、**不零填充**输出；shape 与 daySeries 一致（`{ day, bucket, ... }`）。
 *   现版 byDay 是近 30 天零填充，超过 30 天的历史完全丢失，且活动稀疏时会出现
 *   一长串"今天用了 0 token"的视觉断点。byDayAll 解决这两个问题。
 *   客户端：
 *     (a) 「全部」图表改用 byDayAll，限最近 53 周（371 天）避免无限长 series
 *         把图压成色带（与热力图 53 周上限对齐）。
 *     (b) 热力图优先用 byDayAll；老 host（v0.3.8.x 及更早，无 byDayAll）回退 byDay
 *         ——完全向后兼容，无字段就退化到旧的"近 30 天"视图。
 *     (c) byTrend / RANGES 不动（h7 / m1 / week 等窗口仍走 byTrend）。
 *   行为：用户上次活动是 60 天前时，进「全部」图表能看到 60 天前那根柱、
 *   热力图能看到 8 周前那一格；之前这两个组件都因超过 30 天零填充而空白。
 *   `CACHE_VERSION` 不变（6 → 6）；aggregateSession 输出的 `agg.days` 始终完整，
 *   byDayAll 派生不需要重解码已有缓存——用户首次请求自然走 re-derive 路径。
 *
 * v0.5.0 架构切换（host 半段重写，客户端随之适配）：
 *   host 从"单体缓存 + 整文件重解码 + 每次请求重算"改为
 *   "每会话记录（水位 + 前缀锚）+ 帧级续读 + 快照 memo"：
 *     (a) 失效键从 header.createdAt（永不变化 → 活跃会话被永久冻结）
 *         改为文件修订令牌 dev:ino:size:mtimeNs:ctimeNs + 日志世代号；
 *     (b) 只读新增字节、只解新增 zstd 帧（水位 lastSeq 去重，撕裂尾帧丢弃重读）；
 *     (c) 分钟桶 48h / 小时桶 15d 裁剪，桶表不再无界增长；
 *     (d) 请求永远立即返回"已发布快照"，扫描在后台单飞推进。
 *   客户端因此新增：
 *     - ScanStatus 状态行（scanning 进度 / legacy 旧缓存占位 / idle 新鲜度 /
 *       errorCount 警示配色），渲染在标题行下方；
 *     - scanning 或 legacy 时 2s 轮询（上限 60 次），完成后自动停在最新数据；
 *     - 「刷新」= ?force=1（只重折有变化的会话）、「全量重算」= ?rebuild=1
 *       （旧存储整体改名后从零重算，界面显示进度）；
 *     - 元信息行改用 discovery / decoded / reused / dataAsOf（host 已移除 home 字段）。
 */