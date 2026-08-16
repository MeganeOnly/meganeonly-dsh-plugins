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
 * 补发目标永远是消息被拦截时所在的那个会话：会话不活跃时先经
 * ctx.agents.resume({ resumeSessionId }) 从磁盘恢复（resume 失败的会话
 * 退避 10 分钟后重试，期间标记为 blocked 供 UI 提示手动处理）。
 *
 * 管理接口（GET/POST /api/peak-hour-lock/queue）：查看 / 编辑 / 删除 /
 * 立即发送单条暂存消息，配合浏览器半端的管理面板使用。
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
const RESUME_RETRY_MS = 10 * 60 * 1000 // 会话恢复失败后的退避时长
const STARTUP_GRACE_MS = 2 * 60 * 1000 // 启动遗留条目先等 2 分钟再自动补发（留出管理窗口）
const QUEUE_FILENAME = '.peak-hour-lock-queue.json'
const API_STATUS = '/api/peak-hour-lock/status'
const API_QUEUE = '/api/peak-hour-lock/queue'
const MAX_BODY_BYTES = 1024 * 1024

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

/** 暂存条目的纯文本视图（多个 text part 以换行拼接）。 */
function entryText(entry) {
  const parts = Array.isArray(entry.message?.content) ? entry.message.content : []
  return parts
    .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n')
}

/** 用新文本重建 content：非 text part（如图片）原样保留，text 合并为一个 part。 */
function contentWithText(content, text) {
  const rest = (Array.isArray(content) ? content : []).filter((part) => !(part && part.type === 'text'))
  return [...rest, { type: 'text', text }]
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

/** 读取请求 JSON body（带 1MB 上限），失败返回 undefined。 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        req.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

export function apply(ctx) {
  const queue = { entries: [] }
  const loadedAt = Date.now() // 插件本次启动时刻（启动遗留缓冲计时用）
  let lastInPeak = inPeakWindow() // 启动时刻的高峰状态
  let peakEndedAt = null // 本次高峰结束时刻（ms）；null = 尚未观察到出高峰
  const resumeFailedAt = new Map() // sessionId → 上次 resume 失败时刻（退避用）

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

  /**
   * 解析补发目标 agent：活跃会话直接取；否则从磁盘恢复。
   * manual = 用户在管理面板点了“立即发送”，跳过退避并强制重试一次。
   */
  async function resolveAgent(sessionId, manual) {
    const live = ctx.agents.get(sessionId)
    if (live) return live
    const failedAt = resumeFailedAt.get(sessionId)
    if (!manual && failedAt !== undefined && Date.now() - failedAt < RESUME_RETRY_MS) return undefined
    try {
      const handle = await ctx.agents.resume({ resumeSessionId: sessionId })
      resumeFailedAt.delete(sessionId)
      return handle.agent
    } catch {
      resumeFailedAt.set(sessionId, Date.now())
      return undefined
    }
  }

  /** 投递一条暂存消息；成功（已入队目标会话）返回 true。 */
  async function deliver(entry, manual) {
    const agent = await resolveAgent(entry.sessionId, manual)
    if (!agent) return false
    try {
      agent.followup(entry.message)
      return true
    } catch {
      return false
    }
  }

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
        // 会话已不存在于磁盘（被删除）→ 保留待手动处理，不打死循环
        if (await deliver(entry, false)) continue
        remain.push(entry)
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
    // 刚出高峰 → 等满 OFFSET 缓冲；启动遗留（进程外暂存的旧条目）→ 给
    // STARTUP_GRACE 缓冲，让用户先在管理面板查看/编辑/删除再自动补发
    if (peakEndedAt !== null) {
      if (Date.now() - peakEndedAt >= OFFSET_MS) flushPending()
    } else if (Date.now() - loadedAt >= STARTUP_GRACE_MS) {
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
      let blocked = 0
      if (queue.entries.length > 0) {
        if (inPeakWindow()) {
          const m = beijingMinutes()
          const end = m < PEAK_1_END ? PEAK_1_END : PEAK_2_END
          flushAt = beijingDateAt(end) + OFFSET_MS
        } else if (peakEndedAt !== null) {
          const t = peakEndedAt + OFFSET_MS
          if (t > Date.now()) flushAt = t
        } else {
          const t = loadedAt + STARTUP_GRACE_MS
          if (t > Date.now()) flushAt = t
        }
        if (flushAt === null) {
          // 非高峰且无未来补发点：要么正在补发，要么有会话恢复失败被退避
          for (const entry of queue.entries) {
            if (resumeFailedAt.has(entry.sessionId)) blocked += 1
          }
          if (blocked === 0 && queue.entries.length > 0) flushAt = Date.now() // 即将自动发出
        }
      }
      json(res, 200, { ok: true, inPeak: inPeakWindow(), queued: queue.entries.length, flushAt, blocked })
      return Promise.resolve()
    },
  })

  // 4) 管理 API：GET 列表；POST { action: 'update' | 'delete' | 'send', id, text }
  ctx.webServer.register({
    kind: 'exact',
    path: API_QUEUE,
    handler: (req, res) => {
      if (req.method === 'GET') {
        const entries = queue.entries.map((entry) => ({
          id: entry.message?.id,
          ts: entry.ts,
          sessionId: entry.sessionId,
          text: entryText(entry),
          blocked: resumeFailedAt.has(entry.sessionId),
        }))
        json(res, 200, { ok: true, entries })
        return Promise.resolve()
      }
      if (req.method !== 'POST') {
        json(res, 405, { ok: false, error: 'method-not-allowed' })
        return Promise.resolve()
      }
      const run = (async () => {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          json(res, 400, { ok: false, error: 'invalid-body' })
          return
        }
        const { action, id, text } = body
        if (action !== 'update' && action !== 'delete' && action !== 'send') {
          json(res, 400, { ok: false, error: 'unknown-action' })
          return
        }
        await serial(async () => {
          const index = queue.entries.findIndex((entry) => entry.message?.id === id)
          if (index === -1) {
            json(res, 404, { ok: false, error: 'not-found' })
            return
          }
          const entry = queue.entries[index]
          if (action === 'delete') {
            queue.entries.splice(index, 1)
            await saveQueue(ctx, queue)
            json(res, 200, { ok: true })
            return
          }
          if (action === 'update') {
            if (typeof text !== 'string' || text.trim().length === 0) {
              json(res, 400, { ok: false, error: 'empty-text' })
              return
            }
            entry.message.content = contentWithText(entry.message.content, text)
            await saveQueue(ctx, queue)
            json(res, 200, { ok: true })
            return
          }
          // action === 'send'：立即投递，成功才出队
          const sent = await deliver(entry, true)
          if (!sent) {
            json(res, 503, { ok: false, error: 'session-unavailable' })
            return
          }
          queue.entries.splice(queue.entries.indexOf(entry), 1)
          await saveQueue(ctx, queue)
          json(res, 200, { ok: true })
        })
      })()
      return run.catch(() => json(res, 500, { ok: false, error: 'internal' }))
    },
  })
}
