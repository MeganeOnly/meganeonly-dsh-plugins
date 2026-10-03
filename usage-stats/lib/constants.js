/**
 * dsh-usage-stats — 常量（v0.5.0）
 *
 * 全部可调参数集中在本文件：保留量窗口、扫描节奏、存储布局、榜单长度。
 * 历史原因分散在 lib/index.js 各处的字面量在此收口，改一个数只需改一处。
 */

/** 统计按北京时间分日（UTC+8 无夏令时）。 */
export const BEIJING_OFFSET_MS = 8 * 3600 * 1000

/** 分钟级桶保留窗口：客户端分钟视图只显示最近 24h，留 2 倍余量。 */
export const MINUTE_KEEP_MS = 48 * 3600 * 1000

/** 小时级桶保留窗口：客户端小时视图只显示最近 7d，留 2 倍余量。 */
export const HOUR_KEEP_MS = 15 * 24 * 3600 * 1000

/** 按日趋势窗口（零填充天数）。 */
export const DAY_WINDOW = 30

/** 会话用量榜单长度。 */
export const TOP_SESSIONS = 12

/** 工具调用榜单长度。 */
export const TOP_TOOLS = 10

/** payload.errors 默认返回条数（诊断模式不截断）。 */
export const MAX_ERRORS_REPORTED = 5

/** 记录 schema 版本；变更必须同时改 docs/architecture.md 与 fixture 测试。 */
export const STORE_VERSION = 1

/** 存储目录（相对 profile 根）。 */
export const STORE_DIR_NAME = '.usage-stats'

/** v0.4.x 单体缓存文件名（只读迁移源，重算成功后才改名）。 */
export const LEGACY_CACHE_FILENAME = '.usage-stats-cache.json'

/** 记录写入去抖：同一会话 2s 内的多次变更合并成一次落盘。 */
export const WRITE_DEBOUNCE_MS = 2000

/** 请求触发的扫描最小间隔（force / rebuild 不受限）。 */
export const SCAN_MIN_INTERVAL_MS = 15000

/** 单次时间片内最多折叠的事件数（之后让出事件循环，保证 DSH 主进程可交互）。 */
export const FOLD_SLICE_EVENTS = 20000

/** 实时折叠表上限（LRU），避免长跑进程无界增长。 */
export const LIVE_MAX_ENTRIES = 200

/** 未播种条目最多缓存多少事件（超限丢弃条目，交给磁盘扫描补齐）。 */
export const LIVE_BUFFER_MAX = 2000

/** "最近活跃"窗口：客户端据此决定是否继续轮询（实时会话在窗口内持续出数）。 */
export const LIVE_ACTIVE_WINDOW_MS = 60 * 1000

/** 失败记忆表上限（同一修订的确定性失败只报一次）。 */
export const FAILED_MEMO_MAX = 500

/** 聚合路由路径。 */
export const API_SUMMARY = '/api/usage-stats/summary'
