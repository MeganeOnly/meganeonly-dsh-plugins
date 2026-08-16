/**
 * dsh-peak-hour-lock — Host 半端（作者：MeganeOnly）
 *
 * 拦截点：agent/pre-step（waterfall）。返回 { kind: 'reject' } 即拒绝该步，
 * 模型不会被调用，因此高峰期不会产生任何模型费用。
 * 只拒绝包含用户真实输入（source.kind === 'user'）的步；工具续步/上下文步放行，
 * 避免误杀高峰开始前已在运行的任务。
 *
 * 暂存补发：高峰期被拦截的用户消息不再丢弃，按会话暂存到持久化队列
 * （profile 目录 .peak-hour-lock-queue.json）；高峰期结束后默认再等 2 分钟
 * 缓冲，经 agent.followup 逐条自动补发（每条独立成轮）。
 *
 * 北京时间 = UTC+8（无夏令时），用当日分钟数表示时刻。
 */
import { readFile, writeFile, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const name = 'peak-hour-lock'

export const inject = ['timer', 'webServer', 'agents']

const PEAK_1_START = 530 // 8:50
const PEAK_1_END = 720 // 12:00
const PEAK_2_START = 830 // 13:50
const PEAK_2_END = 1080 // 18:00
const OFFSET_MINUTES = 2 // 高峰期结束后再等 2 分钟补发
const OFFSET_MS = OFFSET_MINUTES * 60 * 1000
const QUEUE_FILENAME = '.peak-hour-lock-queue.json'
const API_STATUS = '/api/peak-hour-lock/status'

function beijingMinutes() {
  const now = new Date(Date.now() + 8 * 3600 * 1000)
  return now.getUTCHours() * 60 + now.getUTCMinutes()
}

function inPeakWindow() {
  const m = beijingMinutes()
  return (m >= PEAK_1_START && m < PEAK_1_END) || (m >= PEAK_2_START && m < PEAK_2_END)
}

/** 当日北京时间的某个分钟数 → 绝对毫秒时间戳。 */
function beijingDateAt(minutes) {
  const beijingNow = new Date(Date.now() + 8 * 3600 * 1000)
  const startOfDayUtc = Date.UTC(beijingNow.getUTCFullYear(), beijingNow.getUTCMonth(), beijingNow.getUTCDate())
  return startOfDayUtc - 8 * 3600 * 1000 + minutes * 60 * 1000
}

/** 解析 profile 根目录（loader 的 baseUrl 即 profile 目录）。 */
function profileRoot(ctx) {
  const base = ctx.baseUrl
  if (typeof base === 'string' && base.startsWith('file://')) return fileURLToPath(base)
  if (typeof base === 'string' && base.length > 0) return base
  return process.cwd()
}

function queuePathOf(ctx) {
  return join(profileRoot(ctx), QUEUE_FILENAME)
}

/** 把 UserMessage 序列化成可持久化记录（id/role/content/source 均为纯 JSON）。 */
function toRecord(msg) {
  return { id: msg.id, role: msg.role, content: msg.content, source: msg.source }
}

async function loadQueue(ctx) {
  try {
    const raw = await readFile(queuePathOf(ctx), 'utf8')
    const data = JSON.parse(raw)
    if (data && Array.isArray(data.entries)) return { entries: data.entries }
  } catch {
    // 文件不存在或损坏 → 空队列
  }
  return { entries: [] }
}

async function saveQueue(ctx, queue) {
  const path = queuePathOf(ctx)
  const tmp = `${path}.tmp`
  await writeFile(tmp, JSON.stringify(queue, null, 2), 'utf8')
  await rename(tmp, path)
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  const queue = { entries: [] }
  let lastInPeak = inPeakWindow() // 启动时刻的高峰状态
  let peakEndedAt = null // 本次高峰结束时刻（ms）；null = 尚未观察到出高峰

  // 串行化所有队列读写（拦截写入与补发清空不能交错，避免覆盖丢数据）
  let chain = Promise.resolve()
  function serial(task) {
    const run = chain.then(task, task)
    chain = run.catch(() => {})
    return run
  }

  // 启动时先载入持久化队列（首个拦截/补发会 await 本链）
  serial(async () => {
    const loaded = await loadQueue(ctx)
    queue.entries = loaded.entries
  }).catch(() => {})

  // 1) 高峰期拦截：暂存用户消息，不调用模型
  ctx.on('agent/pre-step', async (payload, next) => {
    if (!inPeakWindow()) return next()
    const userMsgs = payload.messages.filter((msg) => msg.source?.kind === 'user')
    if (userMsgs.length === 0) return next()
    const sessionId = payload.agent.id
    await serial(async () => {
      for (const msg of userMsgs) {
        queue.entries.push({ sessionId, message: toRecord(msg), ts: Date.now() })
      }
      await saveQueue(ctx, queue)
    })
    return { kind: 'reject' }
  })

  // 2) 高峰期结束（+OFFSET 缓冲）后自动补发暂存消息
  function flushPending() {
    serial(async () => {
      if (queue.entries.length === 0) return
      const snapshot = queue.entries.slice()
      const remain = []
      for (const entry of snapshot) {
        const agent = ctx.agents.get(entry.sessionId)
        if (!agent) {
          remain.push(entry) // 会话不存在（可能已删除/重建），保留待后续补发
          continue
        }
        try {
          agent.followup(entry.message)
        } catch {
          remain.push(entry)
        }
      }
      queue.entries = remain
      await saveQueue(ctx, queue)
    }).catch(() => {})
  }

  ctx.timer.interval(() => {
    const nowInPeak = inPeakWindow()
    if (nowInPeak) {
      lastInPeak = true
      return
    }
    if (lastInPeak) {
      lastInPeak = false
      peakEndedAt = Date.now() // 刚出高峰，开始缓冲计时
    }
    if (queue.entries.length === 0) return
    // 一直非高峰（含启动遗留）→ 立即补发；刚出高峰 → 等满 OFFSET 缓冲
    if (peakEndedAt === null || Date.now() - peakEndedAt >= OFFSET_MS) {
      flushPending()
    }
  }, 10000)

  // 3) 状态 API：客户端轮询显示“已暂存 N 条 / 预计补发时刻”
  ctx.webServer.register({
    kind: 'exact',
    path: API_STATUS,
    handler: (req, res) => {
      if (req.method !== 'GET') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      let flushAt = null
      if (queue.entries.length > 0) {
        if (inPeakWindow()) {
          const m = beijingMinutes()
          const end = m < PEAK_1_END ? PEAK_1_END : PEAK_2_END
          flushAt = beijingDateAt(end) + OFFSET_MS
        } else if (peakEndedAt !== null) {
          flushAt = peakEndedAt + OFFSET_MS
        } else {
          flushAt = Date.now() // 启动遗留，立即补发
        }
      }
      json(res, 200, { ok: true, inPeak: inPeakWindow(), queued: queue.entries.length, flushAt })
      return Promise.resolve()
    },
  })
}
