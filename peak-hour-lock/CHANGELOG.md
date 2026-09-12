# Changelog

本文件记录 `dsh-peak-hour-lock` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - `ctx.agents.resume({ resumeSessionId })` 返回值仍为 `AgentHandle`，`AgentHandle.agent` 公共字段保留（L268 `handle.agent` 不受影响）。
  - `ctx.agents.get(sessionId)` 返回 `Agent | undefined`，裸 `Agent` 对象的 `.followup(message)` 公共方法保留（L280 `agent.followup(entry.message)` 不受影响）。
  - `agent/pre-step` payload 顶层仍含 `agent: Agent`、`messages`、`turn`、`step`、`signal`，`payload.agent.id` / `payload.agent?.options` 仍可访问（L292 / L293 / L296 不受影响）。
  - slot key `conversation.input.dock` 未重命名（注册位置 `packages/client/ui-conversation/src/client/apply.ts`），客户端 status line slot 注册不受影响。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.3.4 → 0.3.5）

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
