# Changelog

本文件记录 `dsh-peak-hour-lock` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.3.7] - 2026-10-03

### 兼容性

- 已对照本机安装的 DSH v0.2.0-rc.2 源码逐条核验本插件用到的宿主 API，形状全部未变，**无需改动任何代码**：
  - `ctx.timer.interval(callback, delay)`：`@deepseek-ai/cordis-plugin-timer/lib/types/index.d.ts:21`（`interval(callback: () => void, delay: number): () => void`），`interface Context extends Pick<TimerService, 'interval' | ...>`（同文件 L3）；`inject` 里的服务名 `'timer'` 仍可解析。调用点 `lib/index.js:361-379`（`ctx.timer.interval(fn, 10000)`）不受影响。
  - `ctx.webServer`：`exact` / `prefixes` 仍是实例上的两个 `Map`（`@deepseek-ai/dsh-host-webserver/lib/index.js:148-149`），`register(route)` 仍按 `route.kind === "exact" ? this.exact : this.prefixes` 选表，重复 `(kind, path)` 仍直接抛错（同文件 L177-180：`webserver: duplicate ${route.kind} route "${route.path}"`；类型声明见 `lib/types/index.d.ts:84-90`）。本插件 `lib/index.js:222-231` 的 `registerRoute()` 守卫（先查 `ctx.webServer.exact` / `.prefixes` 的 `.has(path)`，命中则告警跳过）因此依旧成立；两条路由 `/api/peak-hour-lock/status`（L382-384）与 `/api/peak-hour-lock/queue`（L435-437）仍统一经守卫注册。注：`.d.ts` 把 `exact` / `prefixes` 标为 `private readonly`（`lib/types/index.d.ts:70-71`），但运行时确为实例自有 `Map`，守卫的读取路径可用。
  - `ctx.on('agent/pre-step', ...)`（本插件 L306）的 payload 字段逐字未变：`{ agent, messages, turn, step, signal }`（`@deepseek-ai/dsh-agent/lib/types/runtime-types.d.ts:304-310`）。`payload.agent?.options`（本插件 L310-311）对应运行时 `Agent.options: AgentOptions`（同文件 L141）；`payload.agent.id`（本插件 L314）与 `Agent.session`（同文件 L143）同样保留；`payload.messages[].source.kind === 'user'`（本插件 L312）对应 `@deepseek-ai/dsh-session/lib/types/types.d.ts:149`（`readonly kind: 'user'`）。
  - `ctx.agents.get(id)` 仍返回裸 `Agent | undefined`（`@deepseek-ai/dsh-agent/lib/types/index.d.ts:343`；同文件 L138-139 明确 `ctx.agents.get(id)` still returns a bare `Agent`）——本插件 L279 不受影响。`ctx.agents.resume({ resumeSessionId })` 仍返回 `AgentHandle`（同文件 L286），`ResumeAgentOptions.resumeSessionId` 仍在（L109-111），`AgentHandle.agent` 公共字段保留（L143-146）——本插件 L284-286 的 `handle.agent` 不受影响。
  - `agent.followup(message: UserMessage): void` 仍是 `Agent` 的公共方法（`runtime-types.d.ts:192`）——本插件 L298 不受影响。
  - 服务名与其它宿主面同样未变：`export const inject = ['timer', 'webServer', 'agents']`（本插件 L41）三个名字在离线契约自检的服务名表中均可解析；`ctx.logger.warn`（本插件 L226 守卫告警路径）仍可用；`ctx.baseUrl`（本插件 L133，用于定位 profile 目录下的 `.peak-hour-lock-queue.json`）仍由 loader 提供（`@deepseek-ai/cordis-plugin-loader/lib/index.js:596`）。
  - 客户端状态行注册的 slot 仍存在且未改名：`conversation.input.dock` 在 0.2.0-rc.2 的 slot catalog 中仍为 `list` / `session`（`@deepseek-ai/dsh-cordis-client-runner/lib/client.js:3004-3006`）。**该 slot 在 0.2.0-rc.2 新增了第三个占位者**：`@deepseek-ai/dsh-client-ui-goal` 的 `GoalDock`（`dsh-client-ui-goal/lib/client.js:557-561`：`name: "conversation.input.dock"`, `id: "goal"`, `order: 10`）；0.1.5-rc.1 时同 slot 只有 queue（order 20）/ todo（order 0）。本插件状态行 `order: -10`（本插件 `lib/client.js:627`），仍在全部占位者之前，渲染位置不受影响。
- 注：本插件当前在 web profile 的 `cordis.patch.yml` 里被用户主动停用（`- id: peak-hour-lock / disabled: true`），因此其两条路由不会被注册——未加载时探测这两个路径不会得到本插件的响应（返回 401 属正常，表示插件未加载）。发布本版本不改变该停用状态。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.3.6 → 0.3.7）

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - `ctx.agents.resume({ resumeSessionId })` 返回值仍为 `AgentHandle`，`AgentHandle.agent` 公共字段保留（L268 `handle.agent` 不受影响）。
  - `ctx.agents.get(sessionId)` 返回 `Agent | undefined`，裸 `Agent` 对象的 `.followup(message)` 公共方法保留（L280 `agent.followup(entry.message)` 不受影响）。
  - `agent/pre-step` payload 顶层仍含 `agent: Agent`、`messages`、`turn`、`step`、`signal`，`payload.agent.id` / `payload.agent?.options` 仍可访问（L292 / L293 / L296 不受影响）。
  - slot key `conversation.input.dock` 未重命名（注册位置 `packages/client/ui-conversation/src/client/apply.ts`），客户端 status line slot 注册不受影响。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/peak-hour-lock/status`、`/api/peak-hour-lock/queue` 两条路由改为统一经本地 `registerRoute()` 注册——先查 `ctx.webServer.exact`，路径已被其他插件占用时告警并跳过该条，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由数量与顺序与之前完全一致。本插件当前在 web profile 里被主动停用，此改动为重新启用时兜底。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `registerRoute()` 守卫 + 2 处调用点）
- `package.json`（version 0.3.5 → 0.3.6）

## [0.3.4] - 2026-09-08

### 维护

- 注释精简：review `lib/client.js`，review found nothing redundant——所有现有注释（顶部 banner / `// ---------- X ----------` section marker / 函数 JSDoc / `// why` WHY 注释 / `[perf]` perf WHY / 分钟常量尾注）均符合 dsh-ui-tweaks v0.10.6 起精简规范，无需移除。Host 半端 `lib/index.js` 不在本任务内（ES2015+ 风格不同，通用规范 § 三三 ES5-only 规则不适用）。

## [0.3.3] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 高峰时段拦截：北京时间 8:50–12:00 与 13:50–18:00（含高峰前 10 分钟缓冲）内，拦截包含用户真实输入的步骤；高峰前已在运行的任务不受影响。
- provider / model 白名单：仅拦截 `config.lockModels` 中命中的组合，默认只锁 `deepseek-official`，`model` 写 `*` 表示该 provider 下全部模型。
- 消息暂存：被拦截的消息按会话暂存到 web profile 目录下的 `.peak-hour-lock-queue.json`，以原子写方式落盘。
- 自动补发：高峰结束后等待约 2 分钟缓冲，逐条补发回原会话；会话不活跃时先从磁盘恢复再投递，恢复失败退避后重试。
- 暂存管理面板：位于输入框上方，可查看、编辑、删除或立即发送单条暂存消息；状态横幅显示当前锁定的 provider / model。
- 陈旧条目清理：启动时自动清理超过 `staleAfterMs`（默认 7 天）的暂存条目，状态接口返回清理数量供界面展示；设为 `0` 可关闭该行为。
