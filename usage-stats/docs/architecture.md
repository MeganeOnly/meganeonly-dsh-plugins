# dsh-usage-stats 架构（v0.5.0）

本文件说明 **v0.5.0 起的 host 半段数据通路**：一次统计是怎么从磁盘上的会话日志变成
设置页上那几张图的，以及各层之间的契约（水位、锚、保留量、快照代次）。

读者：维护者、AI agent、code review 工具。改动这些层之前先读本文件与
[`../../docs/maintainability.md`](../../docs/maintainability.md)（通用 client bundle 规范）、
[`./maintainability.md`](./maintainability.md)（本插件 section/模块索引）。

## 一、为什么换架构

v0.4.x 的三条设计在真实数据上都不成立（本机 734 会话 / 约 440 MB 实测）：

| v0.4.x 做法 | 实测后果 |
| --- | --- |
| 以 `header.createdAt` 判定会话缓存命中 | 该字段会话创建后**永不变化** → 活跃会话被永久冻结在首次聚合状态。实测某活跃会话 46 次请求 / 5,576,193 token 在面板显示 0；近 12 个活跃会话覆盖率仅 73.8% |
| 每次刷新调用 `sessionQuery.listSessions()`（或加 TTL 掩盖） | 框架列表对每个会话解压首帧（`listArtifacts` + `historicalCorpusRevision`），734 会话约 30 秒；TTL 方案则冻结新会话发现 |
| 变更即整文件重解码 + 单体 JSON 整份重写 | 缓存版本 bump 触发全量重建，曾把 2 GB 堆打满导致 DSH SIGABRT；缓存文件 4.14 MB 且分钟桶永久累积 |

## 二、数据通路

```
GET /api/usage-stats/summary
        │  ① 立即返回「已发布快照」（payload.js 的 heavy 部分按代次 memo）
        │  ② 顺带触发扫描（不等待）
        ▼
scan.js 单飞扫描
   ├─ 发现 discover.js：listGenerations() 优先（readdir 选世代，零解压）
   │                   自走查回退（734 会话约 107ms）
   │                   最后才 sessionQuery.listSessions()（慢路径，仅兜底）
   ├─ 逐会话 statInfo()：修订令牌 dev:ino:size:mtimeNs:ctimeNs + 世代号
   │     ├─ 与记录一致 → 复用（零 I/O，一次解压都不做）
   │     └─ 变化/新会话 → 折叠
   ├─ 折叠 fold.js + frames.js：
   │     从记录 cursor.bytes 续读 → 结构扫描新增帧 → 只解完整帧 → 逐事件折叠
   └─ 落盘 store.js：每会话一条记录（原子写 + 2s 去抖）
        ▼
payload.js 归并 rollup.js（子代理沿 parentSession 归到 root）
        → series.js（日/时/分/周序列、按模型表、会话榜、工具榜）
```

实时支路（`live.js`）：`ctx.on('session/event')` 逐事件折叠本进程内的活跃会话，使
"当前会话用了多少"不必等 flush、也不必等下一次扫描。规则见下节。

## 二半、实时支路（live.js）

订阅 seam 与投影注册表相同（`ctx.on('session/event', (session, event) => …)`），折叠用的是
**同一套** `fold.js` 内核，因此口径与磁盘完全一致。三条规则保证它只会让数字更准：

1. **以磁盘为基**：条目创建时若已有该会话的记录，立即深拷贝记录 agg（含 `lastSeq`）作为基准，
   再往上叠加实时事件；`seq ≤ 水位` 的事件会被 fold 判为 duplicate，不会重复计。
2. **未播种只缓存不折叠**：插件在会话中途启动、磁盘还没折过该会话时，实时 agg 缺前半段 ——
   此时只把事件缓存起来（上限 `LIVE_BUFFER_MAX`，超限丢弃条目交给磁盘补齐），
   既不参与统计也不假装自己完整。扫描器折叠完该会话后调 `seedFrom(record)` 接上磁盘真相，
   再回放缓存事件。
3. **只在更全时采用**：payload 仅当实时 `lastSeq >` 磁盘水位时才用实时 agg 覆盖
   （`live.ahead` 计数即由此而来）。磁盘随时可能反超，此时实时条目让位。

内存有界：条目上限 `LIVE_MAX_ENTRIES`（LRU），被淘汰的数据由下一次扫描从磁盘补齐。
客户端在 `live.ahead > 0` 时保持 2 秒轮询，于是页面上的数字会随会话推进自己往上走。

## 三、磁盘契约

存储位置：`<web profile 根>/.usage-stats/`

```
.usage-stats/
  manifest.json                     { storeVersion, createdAt, lastScanAt }
  sessions/<safeKey>.json           一条记录 = 一个会话
  sessions/<safeKey>.json.bak-<ts>  校验失败记录的挽留位（backup-and-skip）
```

记录 schema（`STORE_VERSION = 1`，见 `lib/constants.js`）：

```json
{
  "v": 1,
  "key": "session-55ada503-…",           // header.id（缺 id 时回退目录名）
  "path": "…/sessions/<project>/<dir>/session.v4.jsonl.zstd",
  "gen": 4,                              // 日志世代号（v0 env / vN）
  "rev": "dev:ino:size:mtimeNs:ctimeNs", // 与框架 fileRevision 同构
  "cursor": { "bytes": 426159, "frames": 167, "lastSeq": 360 },
  "anchor": { "prefixBytes": 65536, "prefixSha256": "…" },
  "meta": { "id", "createdAt", "cwd", "preset", "parentSession", "delegationDepth", "origin", "title" },
  "legacy": false,                       // true = v0.4.x 旧缓存的临时占位（不落盘）
  "updatedAt": 1791030713031,
  "agg": { "totals": {}, "models": {}, "days": {}, "modelDays": {}, "hours": {}, "modelHours": {}, "minutes": {}, "modelMinutes": {}, "tools": {}, "steps": 0, "turns": 0, "llmMs": 0, "toolMs": 0, "lastTs": 0, "lastSeq": 360 }
}
```

### 水位（cursor）与幂等

- `cursor.bytes` = 已消费到的字节偏移，**必须落在帧边界**上（由结构扫描保证）。
- `cursor.lastSeq` = 已折叠的最大事件 seq。折叠时 `seq ≤ lastSeq` 的事件判为 duplicate：
  重读同一段字节不会重复计数（at-least-once 语义下的幂等基础）。
- 撕裂尾帧（写一半的 zstd frame）被丢弃、水位不推进，下次扫描续读 —— 因此**正在写入的
  会话也能安全折叠**。
- **seq 不稠密是常态**：实测 v0 世代会写 `assistant/chunk`（带 seq）与
  `tool-call-chunks` / `reasoning-chunks` / `text-chunks`（带 `seq0`/`time0`，无 seq），
  加上历史格式迁移丢掉的序号，可见 seq 序列天然跳号（实测 prev 17 → next 275）。
  因此**不做**"seq 连续性断言"——那会把 69% 的正常会话误判为异常。

### 锚（anchor）与"日志是否被改写"

水位本身不足以证明"文件只是被追加"。判定顺序：

1. `gen` 变化（世代迁移，例如 `session.jsonl.zstd` → `session.v4.jsonl.zstd`）→ 全量重折叠
2. 当前文件尺寸 < `cursor.bytes`（回缩）→ 全量重折叠
3. `anchor.prefixSha256` 与当前文件前 `prefixBytes` 字节不符 → 全量重折叠
4. 记录缺锚（例如刚导入的旧缓存占位）→ 全量重折叠

全量重折叠是**作用域内**的：只重算该会话，不波及其它会话；次数计入 `restartFolds` 诊断。

## 四、保留量（有界存储）

| 桶 | 窗口 | 依据 |
| --- | --- | --- |
| `minutes` / `modelMinutes` | 保留最近 48h（`MINUTE_KEEP_MS`） | 客户端分钟视图只显示 24h |
| `hours` / `modelHours` | 保留最近 15d（`HOUR_KEEP_MS`） | 客户端小时视图只显示 7d |
| `days` / `modelDays` / `models` / `tools` | 永久 | 热力图与"全部"图表依赖全历史 |

裁剪按**零填充键的字典序**进行（模型×时间键按 `|` 切开后比较时间后缀），在写记录前执行
（`pruneBuckets`）。注意 `aggregateSession` 兼容包装**不裁剪**，以保证"同一份事件流折叠结果
可复现"的确定性 —— 现有测试依赖这一点。

## 五、快照与代次

- 记录集合每次变化（折叠完成、删除清理）都会 `builder.invalidate()` 让代次 +1；
  下一次请求重建 heavy 部分。请求之间不重算。
- 响应里的 `scanning` / `scanProgress` / `dataAsOf` / `lastScanAt` / `errorCount` /
  `restartFolds` 属于轻部分，每次请求实时读取（轮询时进度是活的）。
- **顺序约束**：扫描收尾必须"先 invalidate 再置 running=false"（见 `scan.js`），
  否则轮询到 `scanning=false` 的那一帧可能拿到尚未失效的旧快照。

## 六、请求参数

| 参数 | 语义 |
| --- | --- |
| （无） | 返回已发布快照；若距上次扫描超过 15s（`SCAN_MIN_INTERVAL_MS`）则顺带起一次扫描 |
| `?force=1` | 绕过节流立即重新比对修订（**不做**全量重建：复用判定照常，只重折有变化的会话） |
| `?rebuild=1` | 旧存储整体改名 `.usage-stats.bak-<ts>` 后从零重算（界面显示进度） |
| `?diag=1` | 附诊断块：存储目录 / 记录数 / 扫描状态 / 折叠表 / 失败记忆 / zstd 能力，errors 不截断 |

响应中的 `live` 块（`{active, ahead, tracked}`）供客户端判断是否继续轮询：`ahead > 0`
表示当前有会话的实时增量领先于磁盘（见第二半节）。

## 七、失败与降级

| 场景 | 处理 |
| --- | --- |
| 记录解析失败 / 不合规 | 改名 `.bak-<ts>` + 告警 + 视为不存在（下次扫描重建） |
| `manifest.storeVersion` 不匹配 | 整目录改名 `.usage-stats.bak-<ts>`，从空重建 |
| 存储目录不可写 | 降级为"仅内存"统计（功能可用、刷新即丢）+ 告警一次 |
| 日志结构非法（坏魔数/保留位/字典帧/块尺寸越界） | 记为一次错误（`errorCount`），按 `(路径, 修订)` 记忆，同修订不重复报 |
| 无 `zlib.zstdDecompressSync`（Node < 22.15） | 帧级能力关闭，回退框架 `sessionQuery.readSession()`（慢但正确） |
| `listGenerations` 不可用（框架内部方法变更） | 回退自走查；再不可用回退 `sessionQuery.listSessions()` 并在诊断标注 |
| 会话日志被删除 | 记录删除、总量同步下降（`scanProgress.removed`） |
| 旧单体缓存 | 只读导入为占位记录（`legacy: true`，不落新库）供首屏显示；全量重算成功且无错误后才改名 `.legacy-<ts>` |

## 八、性能基线（本机实测，2026-10）

| 指标 | 数值 |
| --- | --- |
| 发现（自走查 734 会话 / 18 项目） | 107 ms |
| 734 次 `stat` 修订比较 | 81 ms |
| 首响应（空库、返回 scanning 快照） | 23 ms |
| 热 payload 组装（快照命中） | 3 ms |
| 全量重算（734 会话 / 439 MB） | 65-80 s（两次实测 65.0 s / 66.8 s），峰值 RSS 290-320 MB（起始约 52 MB） |
| 无变更时 `?force=1` 一趟 | 约 354 ms（发现 107 ms + 734 次 stat 81 ms + 至多一个变更会话的折叠；测量含 100 ms 轮询粒度） |

对照 v0.4.x：框架 `listSessions()` 约 30 s、全量重建 10-15 分钟且曾 OOM。

## 九、上游（DSH 框架）已知问题

DSH 自身的会话列表 / 搜索每次都要付约 30 秒：`sessionQuery.listSessions()` →
`persistence.list()` → `listArtifacts()` 对每个会话解压首帧，并在存在历史世代时再跑一遍
`historicalCorpusRevision()`（第二次全走查 + 每文件 `stat` + sha256）。
侧边栏与搜索走同一条路（`dsh-api-session-controller` 的 `list`）。

本插件的对策是**完全绕开该入口**（自建发现 + 帧级续读），但这条路径本身属于框架侧问题，
不在本插件范围内修复；如需上报，证据即上文两处调用点。

## 十、相关文件

- `lib/index.js` 入口（注入面 / 参数解析 / 兼容导出）
- `lib/discover.js` 发现 · `lib/frames.js` 帧级读取 · `lib/fold.js` 折叠与保留量
- `lib/store.js` 记录存储 · `lib/scan.js` 扫描调度 · `lib/rollup.js` 根归并
- `lib/series.js` 视图序列 · `lib/payload.js` 装配与快照 · `lib/http.js` HTTP 边界
- `lib/live.js` 实时事件折叠（见第二半节）
- `lib/client-src/*` 浏览器半端（见 `./maintainability.md`）
- 测试：`tests/test-v050-*.mjs`（真实 zstd 多帧日志 + 真实文件系统）
