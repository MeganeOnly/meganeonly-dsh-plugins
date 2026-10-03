# Changelog

本文件记录 `dsh-usage-stats` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.5.0] - 2026-10-04

### 变更（架构）

**host 半段从"单体缓存 + 整文件重解码 + 每次请求重算"改为"每会话记录（水位 + 锚）+ 帧级续读 + 快照 memo"。** 三条 v0.4.x 设计在真实数据上都不成立：

| v0.4.x 做法 | 实测后果 |
| --- | --- |
| 以 `header.createdAt` 判定缓存命中 | 该字段会话创建后**永不变化** → 活跃会话被永久冻结在首次聚合状态。实测某活跃会话 46 次请求 / 5,576,193 token 在面板显示 `0`；近 12 个活跃会话覆盖率仅 73.8% |
| 每次刷新 `sessionQuery.listSessions()`（或加 30s TTL 掩盖） | 框架列表对每个会话解压首帧（`listArtifacts` + `historicalCorpusRevision`），734 会话约 30 秒；TTL 方案则冻结新会话发现 |
| 变更即整文件重解码 + 单个 JSON 整份重写 | 缓存版本 bump 触发全量重建（曾 OOM 打崩 DSH）；缓存文件 4.14 MB 且分钟桶永久累积 |

v0.5.0 的替代方案：

- **失效键 = 文件修订令牌**（`dev:ino:size:mtimeNs:ctimeNs`，与框架 `fileRevision` 同构）+ 日志世代号 → 会话追加内容立刻可见。
- **帧级续读**：DSH 日志是追加式多帧 zstd 容器，因此只从 `cursor.bytes` 起读新增字节、只解新增帧；撕裂尾帧丢弃且不推进水位（正在写入的会话也能安全折叠）。
- **水位去重**：`seq ≤ lastSeq` 的事件判为 duplicate，重读同一段字节无副作用（幂等）。**不做 seq 连续性断言** —— 实测 v0 世代会写 `assistant/chunk`（带 seq）与 `tool-call-chunks` / `reasoning-chunks` / `text-chunks`（带 `seq0`/`time0`），可见 seq 序列天然跳号（prev 17 → next 275），按"空洞"处理会误伤 69% 的正常会话。
- **改写识别走字节层**：世代号变化 / 文件尺寸回缩 / 前缀锚 SHA-256 不符 / 记录缺锚 → **作用域内**全量重折叠该会话（只重算它一个），计入 `restartFolds` 诊断。
- **保留量有界**：分钟桶 48h、小时桶 15d、日/模型×日/工具永久（客户端分钟视图只看 24h、小时视图只看 7d，留 2 倍余量）。
- **每会话一条记录**：`<web profile 根>/.usage-stats/sessions/<id>.json`，临时文件 + rename 原子写、2 秒去抖合并；解析失败或不符 schema 的记录改名 `.bak-<ts>` 跳过；`manifest.storeVersion` 不匹配时整目录改名 `.usage-stats.bak-<ts>` 后从空重建；存储目录不可用时降级为仅内存统计。
- **请求永不阻塞**：`/api/usage-stats/summary` 立即返回已发布快照（heavy 部分按记录代次 memo），扫描在后台单飞推进；`?force=1` 只绕过节流重新比对修订（不做全量重建），新增 `?rebuild=1` 才整库重建，`?diag=1` 返回诊断块。
- **实时支路**：直接订阅框架的 `session/event` 提交事件流（与投影注册表同一个 seam），用与磁盘折叠**同一套**内核逐事件折叠活跃会话。三条规则保证它只会让数字更准：以磁盘记录为基（深拷贝 agg + 回放缓存事件）、未播种时只缓存不折叠（插件中途启动时实时 agg 缺前半段，不参与统计）、只在 `lastSeq` 领先于磁盘水位时采用。内存有界（LRU 200 条 + 缓存上限 2000 事件），被淘汰的数据由下一次扫描从磁盘补齐。
- **旧缓存只读迁移**：`.usage-stats-cache.json` 仅作为首屏占位显示（`legacy: true`，不写入新库），全量重算成功且无错误后才改名 `.usage-stats-cache.json.legacy-<ts>`（原件保留可回滚）。
- **入口依赖收敛**：`inject` 从 `['webServer','sessionQuery']` 收敛为 `['webServer']`；`sessionPersistence` / `sessionQuery` 经 `ctx.get()` 可选获取，框架服务缺失时功能降级而不是启动失败。`apply()` 内只做纯 fs 工作，不再有启动期框架异步调用。
- **host 半段拆模块**：`index.js`（入口）· `discover.js`（发现）· `frames.js`（帧级读取）· `fold.js`（折叠/保留量）· `store.js`（记录存储）· `scan.js`（调度）· `rollup.js`（根归并）· `series.js`（视图）· `payload.js`（装配/快照）· `http.js`（HTTP 边界）。`aggregateSession` / `beijingDayKey` / `withSessionHeaderEvent` / `granularitySeries` / `rootsDaysAll` 继续从 `lib/index.js` 导出（签名与语义不变）。
- **无新增依赖**：仅 `node:` 内置模块。实测插件目录无法解析 `zod` / `@deepseek-ai/*`，故不注册投影单元、不使用 storageDomain 写入。

### 新增（客户端）

- **扫描状态行**（标题下方）：后台重算进度（`done/total` + 进度条）、旧缓存占位提示、数据截至时间、上次扫描耗时、改写重折叠与失败会话计数；有失败时切警示配色。
- **自动轮询**：`scanning` 或 `legacy` 时每 2 秒追平一次（上限 60 次，卸载即清理），完成后自动停在最新数据。
- **按钮语义**：「刷新」= `?force=1`（只重折有变化的会话）、「全量重算」= `?rebuild=1`（替换原「强制重算」）。
- **元信息行**改用 `discovery` / `decoded` / `reused` / `dataAsOf` —— v0.4.0 起 host 已移除 `home` 字段，旧代码会渲染成"数据源 undefined"。

### 性能（本机实测，734 会话 / 439 MB）

| 指标 | v0.4.x | v0.5.0 |
| --- | --- | --- |
| 首响应 | 挂到全量重建完成（分钟级） | **23 ms**（立即返回扫描中快照） |
| 热 payload 组装 | 每次请求重新归并 692 条聚合 | **3 ms**（快照命中） |
| 无变更刷新 | 每次仍要付 `listSessions` 的 30 s（或 TTL 冻结） | 约 190 ms（734 次 stat），`decoded = 0` |
| 全量重算 | 10-15 分钟，曾有 2 GB OOM | 65.0 s，峰值 RSS 320 MB |
| 存储 | 单文件 4.14 MB 且无界增长 | 每会话记录 + 48h/15d 裁剪，有界 |

### 兼容性

- **DSH 版本要求**：核对 DSH 0.2.0-rc.2（`session/event`、`sessionPersistence.listGenerations`、Node 22 的 `zlib.zstdDecompressSync`）。缺少同步 zstd 解码（Node < 22.15）时自动降级到框架 `sessionQuery.readSession()` 全量路径（正确但慢），诊断里标注能力探测结果。
- **HTTP 契约**：路径不变，v0.4.x 全部 payload 字段保留，只新增字段（`scanning` / `scanProgress` / `legacy` / `dataAsOf` / `stale` / `discovery` / `storeVersion` / `retention` / `restartFolds` / `errorCount`）。老客户端在新 host 下可用（新字段被忽略）。
- **磁盘格式**：`.usage-stats-cache.json`（v8）→ `.usage-stats/`（`STORE_VERSION = 1`）。旧文件保名保留，重算成功后才改名 `.legacy-<ts>`；回滚到 v0.4.x 只需把 `.legacy-<ts>` 改回原名。

### 测试

- 新增 8 个测试文件：`test-v050-frames`（帧级扫描/撕裂/非法结构）、`test-v050-fold-incremental`（增量 ≡ 全量的 property、幂等、非稠密 seq、保留量边界、与旧实现逐字段等价）、`test-v050-store`（往返/去抖/损坏跳过/版本重建/legacy 只读）、`test-v050-discover`（三级来源与降级）、`test-v050-scan`（真实 zstd 多帧日志 + 真实文件系统：零 I/O 复用、追加即见、撕裂尾帧、改写重折叠、删除清理、失败记忆、单飞/节流/rebuild、折叠优先级、legacy 导入与退役）、`test-v050-summary`（快照 memo、字段完整性、归并、保留量、force/rebuild、diag、legacy 首屏覆盖）、`test-v050-client-status`（状态行三态、轮询、按钮 URL、ES5/marker 规范）。
- `test-v050-undercount` 由 characterization 翻转为**目标断言**：会话被观测后追加的 usage 现在计入（1 请求 / 507 token）。
- `test-header-rollup` 端到端部分改为真实会话树（不再 mock `sessionQuery`），`test-byDayAll` 静态断言改指 `lib/series.js` / `lib/payload.js`。
- 删除 `test-v040-official.mjs`：其前提（mock `sessionQuery` 的旧缓存协议）已不存在，覆盖迁至 `test-v050-scan` 与 `test-v050-summary`。
- 全套 14 个文件、435 项断言。

### 已知问题（上游）

DSH 自身的会话列表与搜索每次要付约 30 秒（`sessionQuery.listSessions()` → `listArtifacts()` 逐会话解压首帧 + `historicalCorpusRevision()` 二次全走查）。本插件已完全绕开该入口，但侧边栏/搜索仍受影响 —— 属于框架侧问题，见 `docs/architecture.md` § 九。

## [0.4.5] - 2026-10-03

### 修复

- **全量重建打爆 V8 堆导致 DSH 进程 SIGABRT（OOM 崩溃循环）**：v0.4.5 把 `CACHE_VERSION` 7→8 后，全部落盘缓存作废，启动预热的 `buildSummary` 用一次性 `Promise.allSettled` 并发 `readSession` 所有 cache miss——缓存全 miss 时（版本 bump / 首次安装）等于把**所有** session 的解码事件同时拽在堆上。本机实测 373 个 session（磁盘 440MB zstd）→ Node 默认 2GB 堆打满 → `Ineffective mark-compacts near heap limit` → 整个 DSH 进程 abort（exit 134），且 OOM 死在 `saveCache` 之前、缓存永远写不回去 → 每次重启重复全量重建 → 无限崩溃循环。修复：miss 解码改为 `DECODE_CONCURRENCY = 4` 分批（对齐 libuv 线程池宽度），每个 batch 聚合完即可被 GC，堆上界 ≈ 4 × 单 session 解码体积；代价是全量重建从"理论并行"变为约 10-15 分钟的串行批次（仅发生在缓存版本 bump / 首次安装，之后仍走增量缓存）。
- **移除启动期 prewarm，改为首次 HTTP 请求触发构建**：apply() 内立刻发起的重建在 DSH 0.2.0-rc.2 上会被 cordis 以 fiber 级失败回收——路由整体消失（`/api/usage-stats/summary` 404）、无任何控制台日志、进程照常存活，且与重建是否完成无关（实测复现 3/4 次启动；同进程内 git-hub 等排在后面的插件不受影响）。推定为 framework（sessionQuery 启动窗口内的异步 rejection）被 AsyncLocalStorage 归因到调用方 fiber。改为按需构建：设置页打开即调用 summary，彼时框架已完全就绪；冷启动首次多等一次全量重建（之后走增量缓存），换加载期稳定。
- **json() 客户端断连防护**：请求方在响应前断开（刷新页面、代理超时）后往已销毁 socket 写响应会触发无监听的 `error` 事件，cordis 把它算到本插件 fiber 头上——插件被整体卸载、路由消失，只能重启恢复。写前检查 `writableEnded` / `socket.destroyed` + 挂空 `error` 监听 + try/catch，断开视为"响应作废"而非故障。

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口（Z0-apply.js），该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列）。
  - 数据源走 DSH 官方 `sessionQuery` 服务（zstd 解码 / replay validation 由框架负责，plugin 只在事件流上做业务聚合）；`sessionQuery` API 与 § 三-1（V3 会话格式）/ § 三-2（SessionHandle 持久化）兼容（plugin 直接读 zstd 日志，不依赖 `Session.events` 运行时 API）。
  - 不涉及 `ctx.agents` / `ctx.inbox` / `ctx.subprocess` 字段访问，`§ 三` 其余条目均不命中。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/usage-stats/summary` 改为经本地 `registerRoute()` 注册——先查 `ctx.webServer.exact`，路径已被其他插件占用时告警并跳过，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由与之前完全一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `registerRoute()` 守卫 + 调用点）
- `package.json`（version 0.4.3 → 0.4.4）

## [0.4.2] - 2026-09-06

### 修复

**v0.4.0.3 引入的"启动后新 session 永远不进汇总"bug**：plugin 自己 cache framework `listSessions()` 结果避免 437 sessions × ~70ms / zstd frame = 30+ 秒延迟。但 `getRecords(force)` 只在 `force=true` 或首次（`recordsCache === null`）时刷新——DSH 启动之后浏览器每次刷新都复用 module-level recordsCache，**新生成的 session 永远进不了 recordsCache**，进而 `cache.sessions` 不增长、`cacheDirty=false`、`saveCache` 永不触发。

实测：用户报告"两天经常使用，但数据里显示 0"。磁盘会话目录（`<DSH_HOME>/sessions/<项目>/`）下 9/6 12:03 之后有 5 个 UUID session（2dea2dc6 / b52ec907 / 806b447c / 6ccde05b / d175b366，全部是 subagent rollup 到 `session-8f12230b-...`）+ 9/6 12:47 / 13:59 两个 main session（8f12230b / 993044e5），但 `.usage-stats-cache.json` 最后修改时间是 2026-09-06 12:00:49（与 session-86095a1e 写入时间一致），**之后 4 小时 0 次 cache 更新**。plugin 看到的 session 数永远停在 457。

修复：新增 `RECORDS_CACHE_TTL_MS = 30 * 1000`。`getRecords(force)` 条件加 `(now - recordsCacheFetchedAt) >= RECORDS_CACHE_TTL_MS`——30 秒内复用 listSessions 结果（保留 v0.4.0.3 优化），超过 30 秒后下一次 summary 自动重新 listSessions 发现新 session。`force=true` 仍立即重新 list。

- **未变**：client 半段（5 段堆叠 / 热力图 / 7 块显示设置）零改动；CACHE_VERSION 不变（仍 7）。
- **缓存语义**：30 秒内 cache hit（< 1 秒响应，v0.4.0.3 优化保留）；30 秒后下一次 summary 自动重新 list（发现新 session 后增量 build）。
- **性能**：常规刷新延迟 < 1 秒（同 v0.4.0.3）；30 秒一次"自动 list"开销 ~30 秒——但只在 recordsCache TTL 到期后发生，**用户无感知**（不是每次刷新都付）。
- **验证**：test-v040-official 新增 9.x 6 项（prewarm + 30s 内复用 + force 重新 list）；harden 42 / byDayAll 26 / all-range 16 / smoke 全过；总计 111 + 1 smoke 全过。

### 用户行为

- DSH 重启后 plugin 首次 listSessions ~30 秒（启动延迟，框架持久层第一次扫盘）。
- 之后 30 秒内浏览器刷新 < 1 秒。
- 30 秒后下一次刷新会重新 listSessions（~30 秒）并把新 session 纳入 cache，**用户不需要点"强制重算"按钮**。
- 仍可通过右上角「强制重算」按钮跳过 30 秒 TTL 立即重新 list。

## [0.4.1] - 2026-09-05

### 变更

#### 客户端：图表视觉密度提升

用户反馈 v0.4.0 的图表"看起来比较稀疏"——柱状图每根柱只用 input + output 两段（5 个 token 字段只用 2 个颜色），热力图 cell 11×11 + gap 2 也偏松。v0.4.1 把图表信息密度提升一档：

- **柱状图（`DayChart`）5 段堆叠**：每根柱从底向上叠 5 段，按"色温从冷到暖"梯度：
  - `cacheWrite` `#93c5fd`（最便宜）
  - `cacheRead` `#60a5fa`（折扣）
  - `inputMiss` `#3b82f6`（全价）
  - `output` `#f59e0b`（生成）
  - `reasoning` `#fbbf24`（推理，黄色封顶）

  数学约定：reasoning ⊂ output，所以 `output 段高 = max(0, output - reasoning)`——5 段总高 = `cacheWrite + cacheRead + inputMiss + output` = `totalTokensOf()`，不重复算 reasoning（防御性 `Math.min(reasoning, output)` 兜底 provider 报异常）。

- **柱宽收紧**：minute 3→2 / hour 8→6 / day|week 22→18；同步 override `s.chartBar` 的 `minWidth: 4px` → 跟随 `pxPerBar`，否则 minute 模式柱宽被 minWidth 撑回 4px。
- **图例**：4 项 → 5 项（推理 / 输出 / 未命中 / 命中 / 缓存写）。
- **tooltip**：原来只显示 input/output + cacheRead/reasoning；现在 5 项全显示（未命中 · 命中 · 缓存写 · 输出 · 推理）+ 请求数。
- **峰值 / 摘要**：peakTotal / chartSummary 总量都改走 totalTokensOf 等价口径（`input + output + cacheRead + cacheWrite`），不再少算 cacheRead。chartSummary 多一行 "命中" + "推理"。
- **热力图（`HeatmapCalendar`）cell 缩 11→9 + gap 2→1**：53 周宽度 689px → 530px，密度 +20%。同步：
  - `s.heatmapCell` 11×11 → 9×9
  - `s.heatmapScaleCell`（图例单元）同步
  - `s.heatmapdowLabel` height 11→9（行错位防护）
  - `s.heatmapGrid` / `s.heatmapWeekCol` gap 2→1
  - `HeatmapCalendar` 内硬编码 `weekColWidth=11 / weekGap=2` → 9 / 1（月份标签 left 坐标要跟着 stride 走）

#### 未变

- **host 半段零改动**：`lib/index.js` 0 字节 diff。
- **缓存协议零改动**：`CACHE_VERSION` 仍 7，v0.4.0 cache 文件继续可用。
- **client 字节**：69290 → 75879（+6589 / +9.5%）。增量全部来自 5 段堆叠 + 图例 + tooltip + 热力图缩小。

### 兼容性

- **DSH 版本要求不变**：DSH 0.1.2-rc.1+。
- **客户端 → 老 host 兼容**：v0.4.1 客户端在 v0.4.0 host 下仍正常工作（payload schema 未变，5 个 token 字段 v0.4.0 已经输出）。
- **老 client → v0.4.1 host 兼容**：v0.4.0 客户端在 v0.4.1 host 下仍正常工作（payload schema 不变）。

## [0.4.0] - 2026-09-05

### 变更

#### host 半段：用 DSH 官方 `ctx.sessionQuery` 替手写 zstd 解码器

DSH 0.1.2-rc.1 引入了官方 session 查询框架（`@deepseek-ai/dsh-session-query-sqlite`），web profile 已挂载 `ctx.sessionQuery` 服务。本版本迁移 plugin 到官方 API：

- **`inject` 数组扩展**：`['webServer']` → `['webServer', 'sessionQuery']`，framework 的 sessionQuery 自己依赖 `sessions` / persistence，cordis 自动链式注入。
- **删除手写代码**（~150 行）：
  - `scanZstdFrames()`（zstd 容器 frame 头解析，~45 行）
  - `decodeSessionEvents()`（zstd 多帧解压 + JSONL 解析，~15 行）
  - `parsePlainJsonl()`（明文 JSONL 兜底，~12 行）
  - `collectSessionFiles()`（`~/.dsh/sessions` 文件枚举，~29 行）
  - `resolveDshHome()`（DSH 主目录查找，~17 行）
  - `pathExists()` / `profileRoot()`（profile 路径工具，~15 行）
  - `isUsableAggregate()`（v0.3.8.1 治本 — 已不必要，framework 兜底）
  - `identity()` / `projectOf()` / `byJsonIdByProject`（跨项目撞车工程 — SessionId 全局唯一后多余）
- **新增官方 API 接入**：
  - `ctx.sessionQuery.listSessions()` — 列出所有 session header（含 `createdAt` / `cwd` / `parentSession` / `delegationDepth` / `origin`，由 framework 的 JSONL 持久化层提供）。
  - `ctx.sessionQuery.readSession(id)` — 读完整事件流（zstd 解压 + replay validation 全部由 framework 的 `PersistenceCoordinator` 完成，plugin 不再处理坏文件）。
  - `ctx.sessionQuery.traceSession(id)` — 走 `parentSession` 链查 root（替代 `rollupByMainSession` 内的手写父链遍历；orphan subagent / cycle detect 由 framework 处理）。
- **缓存语义升级**：
  - cache key 从 `<projectDir>/<sessionDir>`（v0.3.8 fileId）升到 `SessionId`（DSH 生成，全局唯一 UUID，跨项目也唯一）。
  - 失效字段从 `(size, mtimeMs)` 升到 `(header.createdAt)`（session 创建后 `createdAt` 不变，append events 不影响）。
  - `CACHE_VERSION` 6 → 7（让旧 v6 cache 一次性作废重算）。
  - 删 `isUsableAggregate()` 治本逻辑（v0.3.8.1 治的"partial agg 防御"已被 framework 的 replay validation 兜底）。
- **`rollupByMainSession` 升级为 async**：内部走 `ctx.sessionQuery.traceSession(id)`（async 契约），替代 `byJsonIdByProject` 手写工程。counts speak in main sessions only 的业务语义保留不变。
- **payload 字段微调**：移除 `home` 字段（plugin 不再自己解析 DSH 主目录，路径由 framework 管理）。
- **未变**：`aggregateSession()` 纯函数、`rootsDaysAll()` / `granularitySeries()` / `modelTable()` / `topSessions()` / `toolTable()` / `daySeries()` 全部保持原 export 签名。
- **未变**：客户端 bundle（v0.3.9 = 69290 字节不变）；`?force=1` 强制重算语义保留（v0.3.8.2 inflight 协议不动）。

#### 测试重构

v0.3.x 的 `tests/test-v038-fixes.mjs` / `tests/test-v0381-inflight.mjs` / `tests/audit-repro.mjs` 全部依赖文件系统扫描 mock（构造 tmp `sessions/` 目录 + `DSH_HOME` env + plugin 自己枚举文件）。v0.4.0 后 plugin 不再读文件系统——这些 fixture 测试失去前提。

- 删 `tests/test-v038-fixes.mjs`（bug C/D/E/F 端到端测试不再适用；bug A/B 已被 `test-add-usage-harden.mjs` / `test-byDayAll.mjs` 全面覆盖）。
- 删 `tests/test-v0381-inflight.mjs`（force / inflight 协议改走 mock sessionQuery 重写）。
- 删 `tests/audit-repro.mjs`（临时审计脚本，"audit 完成后删除"）。
- 新增 `tests/test-v040-official.mjs`（21 项）：mock `ctx.sessionQuery` 验证 v0.4.0 核心路径——happy path（subagent rollup 到 main）、cache 命中 / 失效（`createdAt` 改变触发重 build）、force 语义（cache 命中条件下仍重 build）、inflight 协议保留（force in prewarm 不被吞，chain 上 ≥ 2 次 saveCache）、error 隔离（单个 session 报错不影响其他）。

### 用户可感行为变化

| 场景 | v0.3.9 | v0.4.0 |
| --- | --- | --- |
| 第一次启动（prewarm + 后续请求） | 374 sessions / 45s | 同等规模；首次略快（framework 的 PersistenceCoordinator 有 preparation LRU cache） |
| 子代理 token 归属 | 手写 `byJsonIdByProject` 防撞车（v0.3.8.1 治本） | `ctx.sessionQuery.traceSession()` 官方实现 |
| 跨项目同名 session 撞车 | fileId prefix 防御（v0.3.8 工程） | SessionId 全局唯一，不再需要 prefix |
| 「强制重算」按钮 | 走 `?force=1` + inflight 协议保留 | 同等（v0.3.8.2 修复不被退化） |
| 缓存失效字段 | `(size, mtimeMs)` | `(header.createdAt)` |
| 宿主依赖 | plugin 自己读 `~/.dsh/sessions/*/session.jsonl.zstd` | 走 `ctx.sessionQuery`（zstd / replay / 跨项目隔离由 framework 兜底） |
| 客户端 UI | 不变 |  |

### 兼容性

- **最低 DSH 版本**：DSH 0.1.2-rc.1+（需要 `ctx.sessionQuery` 服务）。DSH 0.1.1 及更早版本下 plugin 启动时会因 `inject: ['sessionQuery']` 解析失败而被 cordis 拒载（明确的错误信号，不会静默降级）。
- **web profile 必须挂载**：`@deepseek-ai/dsh-session-query-sqlite`（DSH 0.1.2-rc.1 默认 web profile 已挂载，无需手动配置）。
- **客户端完全兼容**：v0.4.0 客户端 bundle 与 v0.3.9 字节级一致（69290 字节），用户无需清缓存。
- **客户端 → 旧 host 兼容**：v0.3.9 客户端在 v0.4.0 host 下仍正常工作（payload schema 仅删除 `home` 字段，客户端从未读取该字段）。
- **旧 host → 新客户端**：v0.4.0 客户端在 v0.3.9 host 下应仍工作（v0.3.9 host 输出包含 `byDayAll` 字段，客户端走 `d.byDayAll || d.byDay` fallback 路径）。
- **缓存作废**：`CACHE_VERSION` 6 → 7，旧 v6 cache（fileId 形式 key）一次性作废重算，升级后第一次请求会全量重 build（与首次安装等价；374 sessions ≈ 45s）。
- **bundle 字节**：客户端不变（69290 字节）；host 半段 `lib/index.js` 估从 47571 字节 → 38000 字节（-20%）。

### 验证

- `tests/test-v040-official.mjs`（新增 21 项）：happy path / cache 命中 / 失效 / force 语义 / inflight 协议保留 / error 隔离 / Beijing 锚点回归 / byDayAll 升序不零填充——全过。
- `tests/test-add-usage-harden.mjs`（42 项）、`tests/test-byDayAll.mjs`（26 项）、`tests/test-all-range.mjs`（16 项）、`tests/smoke.mjs`（smoke）——全部保留并全过。
- **总计 105 项测试 + 1 smoke 全过**。

## [0.3.9] - 2026-09-05

### 变更

#### host 半段：新增 `byDayAll` —— 历史全量日序列

把 `/api/usage-stats/summary` 的 `byDay`（近 30 天零填充）和 `byTrend.day`（同样是近 30 天零填充）补齐为一个**不裁剪、不零填充**的历史全量序列：

- 新导出函数 `rootsDaysAll(rootList)`（`lib/index.js`）：合并所有 root 的 `days`，按 `yyyy-mm-dd` 升序排序，输出 `[{ day, bucket, inputTokens, ... }]`——shape 与 daySeries 一致，`day` / `bucket` 双字段兼容 v0.3.3。
- 新增 payload 字段 `byDayAll = rootsDaysAll(rootList)`：覆盖 root 数 0 / 1 / N 全场景。
- 与 `byDay`（`daySeries`）的关系：`byDay` 仍是「近 30 天零填充」，客户端 `7` / `1` / 窗口类 RANGE 仍用之；`byDayAll` 给客户端 `全部` tab 图表与热力图使用。
- 不 bump `CACHE_VERSION`：`aggregateSession` 输出的 `agg.days` 始终完整；`byDayAll` 是派生字段，存量的 v6 缓存仍可派生（用户首次请求时由 `rootList` 重新 merge — 无需重解码）。

#### client 半段：「全部」tab 与热力图跨 30 天边界

彻底解决「上次活动距今超过 30 天时图表与热力图都空白」的用户痛点。

- `70-page.js` 'all' tab：图表改走 `d.byDayAll`（最近 53 周 / 371 天为上限，避免图被无限压扁），不再走 `byDay.slice(-30)`。
- `70-page.js` 热力图：优先 `d.byDayAll`，老 host（v0.3.8.x 及更早，无 `byDayAll` 字段）回退 `d.byDay`——完全向后兼容。
- `rangeTotals` 不变（仍按 `r.window` 决定走 `safeTotals` 全程还是 `sumBuckets(winSeries)` 切片）。
- `byTrend` 不变：h7 / m1 / w12 / h1 等窗口类 RANGE 仍走 `byTrend[r.granularity]`，颗粒度切换不受影响。

### 用户可感行为变化

| 场景 | v0.3.5 / v0.3.8.x | v0.3.9 |
| --- | --- | --- |
| 上次活动 100 天前 | 全部 tab 图表空白（30 天切了 100 天前的全部数据）；热力图同样空白 | 全部 tab 显示 100 天前那根柱（最近 53 周内就显示，超 53 周左截）；热力图同样渲染 100 天前那格 |
| 2 个月没用，零星 1 次 | 「全部」图表显示「近 30 天」一堆 0 柱，中间夹 1 根非零柱 | 「全部」图表显示从上次活动到现在的真实数据，中间无填充 |
| 长期用户（3 年用量） | 图表受限于 30 天 | 图表显示最近 371 天（53 周），更宽就溢出滚动 |

### 兼容性

- 向后兼容老 client / 老 host：
  - 老 client（v0.3.8.x 及更早，看不到新字段）：不变，仍按 `byTrend.day` 渲染 30 天
  - 老 host（无 `byDayAll`）：新 client（v0.3.9）走 fallback 路径渲染 `byTrend.day`，行为与 v0.3.8 等价
- `CACHE_VERSION` 不变（仍 v6）
- 不 bump version 必要性：老 v6 缓存重派生 `byDayAll` 不需要重解码（`aggregateSession` 仍输出完整 `days`）
- bundle 大小变化：v0.3.8.2 = 66603 字节 → v0.3.9 = 69290 字节（净增 +2687 字节：banner v0.3.9 段 + 70-page.js byDayAll 优先级逻辑 + heatmapSource 派生）

### 验证

- `tests/test-byDayAll.mjs`（新增）：26 项全过
  - **A 静态**（4 项）：host 端 `rootsDaysAll` 已 export；buildSummary 输出 `byDayAll`；升序 sort；不零填充（无 `windowMs` / `stepMs`）
  - **B 静态**（4 项）：client 端 `'all' tab` 优先 `d.byDayAll`；heatmap 优先 `d.byDayAll` + 回退 `d.byDay`；`HEATMAP_WEEKS=53` / `HEATMAP_DAYS=HEATMAP_WEEKS*7` 常量；`'all' tab` 独立分支（不污染其它 tab）
  - **C 行为**（4 项）：`rootsDaysAll` 多个 root 合并 + 升序 + 同 key 累加 + day/bucket 双字段
  - **D 行为**（3 项）：**核心用户痛点**——所有会话事件都早于 30 天前时，`byDayAll` 仍保留 100 天前的数据（v0.3.5 之前会被 30 天窗口 cut 全空）
  - **E 行为**（5 项）：真实 bundle 加载 + React 渲染路径——
    - E.1：**100 天前的数据在 `all` 图表里有 1 根柱**（v0.3.9 之前会因 30 天窗全空）
    - E.3：**热力图渲染包含 100 天前日期的格子**（v0.3.5 / v0.3.8 之前不会显示）
    - E.5 / E.6：老 host（无 `byDayAll`）fallback 到 `safeByTrend.day`，仍正常渲染（向后兼容）
    - E.7：老 host `byDayAll` 缺失时 render errors 为空（不抛错）
  - **F 行为**（3 项）：`byDayAll > 371` 元素时被裁剪到 371（53 周上限），`rootsDaysAll` 不裁剪（裁是 client 责任）
  - node --check `lib/client.js` 语法检查
- `tests/test-all-range.mjs`：16 项全过（已更新：'all' tab 静态与行为断言改走 byDayAll，老的 `slice(-30)` 检查被替换为 `d.byDayAll 优先级` + `HEATMAP_DAYS 裁剪`；N=60 chart 桶数反映 byDayAll 路径）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS（`renderCount = 4`）
- `node --check lib/index.js` / `node --check lib/client.js`：均通过
- `node lib/build-client.cjs`：rebuild 成功（10 sources → 69290 bytes）

## [0.3.8.2] - 2026-09-05

### 修复

v0.3.8.1 复核后发现的 1 个 host 端并发 inflight bug（仅 `lib/index.js`）：

- **`summary(force)` 单 inflight slot 吞掉 force=1 请求**：
  原版 `function summary(force) { if (inflight !== null) return inflight; ... }` 用单一 Promise 槽存储 inflight，不分 force 标志。启动预热 `chain = chain.then(() => summary(false))` 进行中（inflight = prewarm 的 regular buildSummary(false)），HTTP handler 收到 `?force=1` 时直接 `return inflight`——把 prewarm 的 `summary(false)` 结果当作用户的"强制重算"返回。prewarm 走 `cache.sessions[id].size/mtimeMs` 命中 → `reused=1`、`decoded=0`，用户拿到的不是新数据。客户端通过 `?force=1` 显式发起的"忽略缓存"语义被静默丢掉。

  修复：inflight 改为 `{ force: boolean, promise: Promise } | null`，按 force 标志分别共享。规则：

  - 普通请求（`!force`）可复用任意 inflight（含 force）—— 单 inflight 已存在就 return，避免重复 build
  - force 请求遇 force inflight → 共享（多 force 共享同一次 force build）
  - force 请求遇 regular inflight → 等其结束后再启动一次 force build（`prev.then(() => buildSummary(true), () => buildSummary(true))` 两条路径都触发，避免 prewarm 抛错时也吞掉 force）

  finally 清理用 `if (inflight === entry) inflight = null` 守卫，避免 force 链覆盖 regular 链后 regular 的 finally 把 force inflight 误清掉。

### 缓存语义

- **不 bump `CACHE_VERSION`**：本次修复只改 inflight 共享策略，不动 cache 内容 schema；prewarm 与 force 都写同一份 cache（force 绕过 size/mtimeMs 但仍更新 `cache.sessions[id] = { size, mtimeMs, agg }`），第二次普通请求仍能命中 force 留下的最新缓存。

### 兼容性

- 客户端无变更（仅 host 端 `summary(force)` inflight 共享逻辑）
- 行为变化：force=1 不再被 prewarm / 之前的普通 inflight 吞掉；prewarm 进行中的 force=1 会等到 prewarm 结束再启动一次新 build（开销 ≈ 1 次额外 buildSummary，但避免静默吞掉显式 force 请求）
- `CACHE_VERSION` 不变（仍 v6）

### 验证

- `tests/test-v0381-inflight.mjs`：**12 项全过**
  - G.1（3 项）force 在 prewarm 进行中不被吞（cache `.tmp` 文件至少被观察到 2 次出现 / ok=true / decoded=30，**主断言靠 `.usage-stats-cache.json.tmp` 文件 1ms 轮询的出现次数做客观信号**——`saveCache` 内部 `writeFile(.tmp)` → `rename`，force 修复后 chain 上 prewarm + force 各一次 saveCache，`.tmp` 至少被观察到 2 次出现；不修复时只有 prewarm 的 saveCache，`.tmp` 严格只出现 1 次。30 个 session 文件的延迟 fixture 让两个 saveCache 之间留出 ms 级别窗口）
  - G.2（2 项）两个并发 force=1 共享同一 force build（generatedAt 相同 / decoded=1）
  - G.3（2 项）force inflight 进行中的普通请求复用 force 结果（generatedAt 相同 / decoded=1 而不是 reused=1）
  - G.4（3 项）D.4 行为回归（首次 decoded=1 / 第二次 reused=1 / force=1 decoded=1）
  - G.5（2 项）串行 force 每次都新建 build（inflight 正确清理 / generatedAt 严格递增）
- `tests/test-v038-fixes.mjs`：37 项全过（确认未退化）
- `tests/test-add-usage-harden.mjs`：40 项全过（确认未退化）
- `tests/audit-repro.mjs`：14 项全过（确认未退化）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS（`renderCount = 4`）
- `node --check lib/index.js` / `node --check lib/client.js`：均通过
- `node lib/verify-client.cjs`：BYTE-IDENTICAL ✓（client bundle 未改）

## [0.3.8.1] - 2026-09-05

### 修复

v0.3.8 后的**复核审计**发现 2 个聚合层残留 bug + 1 个已自然处理的行为需要锁定（全部 host 端 `lib/index.js`）：

- **`rollupByMainSession` 父链遍历仍按 JSONL `agg.id` 全局覆盖，跨项目子代理会被错误归并**：
  v0.3.8 只把 rollup **实体键**（root / identity）升级到 `agg.fileId`，但父链遍历（`rootAggOf` 内的 `byJsonId.get(parentSession)`）仍用一份全局 `Map<jsonlId, agg>`。DSH 保证 JSONL `agg.id` 单项目内唯一、不保证跨项目唯一——所以跨项目场景下：
    - projA/main（id='sameid'） + projA/sub（id='sub-a', parentSession='sameid'）
    - projB/main（id='sameid'，与 projA/main 同 JSONL id）

  按 readdir 顺序，`byJsonId['sameid']` 被 projB/main 覆盖。`rootAggOf(projA/sub)` 走到 `byJsonId.get('sameid')` 时拿到的是 **projB 的 main**，让 projA 的子代理被错误归并到 projB 的 root（`topSessions[projB]` 偷走 projA/sub 的 token）。

  修复：把 `byJsonId` 按 `projectDir` 前缀（`fileId` 第一个 `/` 之前）分桶，`rootAggOf` 只在同一项目的 byJsonId 内查 parentSession。缺失 project 信息的 agg 落到 `_global` 桶，保留向后兼容；orphan subagent 仍走"回退到自身 identity"语义不变。

- **`cached.agg` 是 partial 对象（缺 `totals` / `id` / `fileId` / token 字段非有限）时让 summary 崩溃**：
  旧 cache hit 守卫只查 `cached.agg && typeof cached.agg === 'object'`，放过手编辑 / 半写入 / schema drift 缓存——`rollupByMainSession` 在 `mergeBucket(root.totals, agg.totals)` 访问 `undefined.inputTokens` 抛 `Cannot read properties of undefined (reading 'inputTokens')`，整个 `/api/usage-stats/summary` 返回 `{ ok: false, error }`。修复两层：
  1. **入口挡**：新增 `isUsableAggregate(agg)` 在 cache hit 处挡 partial / 非有限字段（identity + totals 对象 + 5 个 token 字段都是 `Number.isFinite`），视为 miss 触发重解码
  2. **内部防御**：`rollupByMainSession` / `topSessions` 对 `agg.totals` 用 `|| emptyBucket()` 兜底（defense in depth，避免未来其他入口绕过 cache guard 喂入 partial 时再次崩溃）

- **`assistant/message` 非有限 time + openStep 有效 → llmMs 是否会贡献？** 已自然安全，但加测试锁定：
  现有代码 `llmMs += Math.max(0, toFiniteNumber(event.time) - openStep.time)`：非有限 event.time → `toFiniteNumber = 0`，`0 - openStep.time`（有限正数）= 负数，`Math.max(0, 负数) = 0`，`llmMs += 0` 不贡献——但现有断言只检查 `=== 500`（实际等于证明第一步没贡献）。新增 bug J.5 矩阵 6 个 case 显式锁住：NaN / Infinity / -Infinity / 字符串数字 / undefined / null 与 valid 步骤混合的累加正确性。

### 缓存语义

- **不 bump `CACHE_VERSION`**：v0.3.6+ `aggregateSession` 产出的所有 `agg` 必然完整（`totals` 由 `emptyBucket()` 初始化并加和保证）。本次修复只挡"异常来源"（手编辑 / schema drift），不需要让所有用户重解码自己的合法 v6 缓存。

### 兼容性

- 客户端无变更（仅 host 端聚合硬化）
- 行为变化：
  - 跨项目同名 JSONL id 的子代理终于归属到本项目 root（之前会错误归并到另一项目）
  - 任何 partial / 手编辑 / schema-drifted 缓存自动触发重解码，不再让 summary 崩溃
- `CACHE_VERSION` 不变（仍 v6）

### 验证

- `tests/test-v038-fixes.mjs`：**37 项全过**（29 项 v0.3.8 + 8 项 v0.3.8.1 新增：bug E 跨项目父链作用域 3 项 / bug F usable aggregate guard 5 项含 F.1 partial totals / F.2 token 字段非有限 / F.3 无 identity / F.4 端到端重解码）
- `tests/test-add-usage-harden.mjs`：**40 项全过**（34 项 v0.3.7+v0.3.8 硬化 + 6 项 v0.3.8.1 新增 bug J.5 矩阵：openStep 有效 + 非有限 time 6 种形态都不贡献）
- `tests/audit-repro.mjs`：14 项 v0.3.6 audit 复现全过（确认未退化）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS（`renderCount = 4`）
- `node --check lib/index.js` / `node --check lib/client.js`：均通过

## [0.3.8] - 2026-09-05

### 修复

v0.3.7 数字硬化后又发现 3 个**聚合层**高置信 bug，全部在 host 端 `lib/index.js`：

- **`step/start` 无有效 baseline 时把 valid epoch assistant time 当 duration**：
  v0.3.7 用 `openStep.time = toFiniteNumber(event.time)` 兜底——`toFiniteNumber(NaN) = 0`，结果下一步真实 `assistant/message` 的 `(1.7e12 - 0)` 就把 `llmMs` 单事件推到 ~1.7e12。修复：无 baseline（缺 `event.time` 或 `event.time` 非有限数字：`undefined` / `null` / `NaN` / `Infinity` / `-Infinity` / 字符串 / 对象）的 `step/start` 直接 `openStep = null`，`openStep != null` 短路让 valid epoch assistant time 完全不入 `llmMs`。覆盖矩阵：缺 `step/start` / `time=NaN` / `time=undefined` / `time=null` / `time=Infinity` / `time='1700000000000'` 字符串。

- **`granularitySeries` 日序列锚到 UTC 午夜而非 Beijing 日界**：
  旧 `anchorMs = now - (now % stepMs)` 对齐 UTC 午夜。在 Beijing 16:00–24:00 UTC（= 当日 Beijing 00:00–08:00）窗口内，anchor 对应的 Beijing day 还是"昨天"——今天的 bucket 永远不出现在日序列里（day 粒度"今天"的视觉断点）。修复：`anchorMs = now - ((now + BEIJING_OFFSET_MS) % stepMs)`。对 minute(60s) / hour(3600s) 与旧版等价（`BEIJING_OFFSET_MS` 是它们 stepMs 的整数倍）；只修正 day 锚点。导出 `now` 形参供单测注入。

- **`rollupByMainSession` 用 JSONL `agg.id` 作跨项目根 id**：
  `agg.id` 由 DSH 生成但**只保证单项目内唯一**，跨项目时撞车：两个项目各含一条 `event.id === 'sameid'` 的会话会被合并成同一 root（`sessionCount` 失真）。修复：实体键改为 `agg.fileId ?? agg.id`——`agg.fileId` 是 `<projectDir>/<sessionDir>`，磁盘上每条会话唯一。`aggregateSession(events, fileId)` 接受外部注入，`buildSummary` 把 `file.id` 注入；父链遍历仍走 JSONL id（DSH 保证单项目内 parent 引用一致）。

### 缓存语义

- `CACHE_VERSION` 5 → 6：v5 缓存里的 `agg` 没有 `fileId` 字段，强行读取时 `identity()` fallback 到 `agg.id` 跨项目仍撞车，bump version 强制一次缓存作废重算。
- 现有 `loadCache` / `saveCache` / `cached.agg` 类型守卫 / `force=1` 路径全部经过新测试覆盖（29 项 v0.3.8 测试 + 14 项 audit-repro）——行为不变（按需保留），无需改代码。

### 兼容性

- 客户端无变更（仅 host 端聚合硬化 + 锚点修正 + rollup 键升级）
- 行为变化：今天（Beijing）的桶终于出现在 day 序列末位；跨项目同名 session 终于各自成 root
- `CACHE_VERSION` 5 → 6：升级后第一次请求会全量重解码（一次性的 cost）；后续恢复增量

### 验证

- `tests/test-v038-fixes.mjs`：29 项 v0.3.8 新增全过（bug A 8 项 / bug B 6 项 / bug C 5 项 / 缓存 D 4 大类 9 项）
- `tests/test-add-usage-harden.mjs`：34 项 v0.3.7 + v0.3.8 硬化全过（含 bug J 重写：`step/start.time=NaN` → `openStep=null` → `valid epoch 不入 llmMs`，断言收紧到 `=== 0` 而不是仅 `>= 0` / finite；新增 bug J.1–J.4 覆盖缺事件 / undefined / Infinity / 字符串 / 多步骤混合 / 正常累加不被误杀）
- `tests/audit-repro.mjs`：14 项 v0.3.6 audit 复现全过（确认未退化）
- `tests/smoke.mjs`：client bundle 渲染路径 PASS（`renderCount = 4`）
- `node --check lib/index.js` / `node --check lib/client.js`：均通过

---

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
