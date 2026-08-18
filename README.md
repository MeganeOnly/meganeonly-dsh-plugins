# dsh-plugins — DSH 常驻插件集

一组面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) web profile 的**常驻插件**。每个插件都遵循同一套结构：宿主半段（Cordis 插件）+ 浏览器半段（`__ModuleLoader__` bundle），可手写、无需构建工具。

## 仓库结构

| 目录 | npm 包名 | 功能 |
| --- | --- | --- |
| `plugin-manager` | `dsh-plugin-manager` | 设置页"插件管理"：列出所有非系统常驻插件，一键启用/暂停 |
| `skill-manager` | `dsh-skill-manager` | 设置页"Skill 管理"：列出用户级 skill，一键启用/停用（即时生效） |
| `mcp-manager` | `dsh-mcp-manager` | 设置页"MCP 管理"：列出所有 MCP 服务器（连接状态 + 工具清单），一键启用/停用（重启生效） |
| `peak-hour-lock` | `dsh-peak-hour-lock` | 北京时间高峰时段拦截发送，消息暂存，结束后自动补发，避免高峰双倍模型费用 |
| `usage-stats` | `dsh-usage-stats` | 使用统计：跨会话汇总 token 用量、按日趋势、按模型分解、会话与工具排行 |
| `dsh-update-checker` | `dsh-update-checker` | 更新检查：显示当前版本 / npm latest / 是否有更新；含完整 semver（含 prerelease）对比；一键升级 |
| `dsh-task-pool` | `dsh-task-pool` | 任务池：右上角 FAB + 右侧 380px 抽屉，本地收集想法（localStorage 持久化，零 token 消耗），卡片可"发送到当前对话" |
| `dsh-git-hub` | `dsh-git-hub` | Git/GitHub 管理面板：右上角 FAB + 右侧 420px 抽屉，扫描本地 git 仓库列表，一键调 daily-push.cjs 推送，把仓库摘要发到当前对话 |
| `dsh-ui-tweaks` | `dsh-ui-tweaks` | 外观微调合集：对话列永久右缩让位 + 简洁模式（隐藏思考/工具调用 + 极简状态行） |

## 环境要求

- DeepSeek Harness **web profile**（DSH 安装时会自动建立）
- Node.js 22+、pnpm
- 浏览器端依赖（react、dsh-client-* 等）由 DSH shell 模块表提供，无需单独安装

## 安装（每个插件相同步骤）

1. 把插件目录（或 clone 整个仓库的子目录）放到本机任意位置，例如 `<your-dsh-plugins-dir>/<plugin-name>`；
2. 编辑你的 web profile 的 `package.json`：
   - `dependencies` 中加一行：`"dsh-<包名>": "file:<相对路径到上面目录>"`
   - `dsh.profile.bundles` 数组中加入 `"dsh-<包名>"`
3. 安装依赖（Windows 下 pnpm 脚本可能被策略拦截，走 cmd shim）：

   ```bat
   cmd /c "cd /d <your-profile-dir> && pnpm install --no-frozen-lockfile"
   ```

4. **重启 DSH** 使宿主半段与插件名册生效；浏览器 bundle 的改动刷新页面即可生效。

安装后可到 **设置 → 插件管理**（plugin-manager）/ **Skill 管理**（skill-manager）/ **MCP 管理**（mcp-manager）统一查看与启停。

## 插件说明

### plugin-manager — 插件管理

设置页新增"插件管理"页：搜索、分组（启用中 / 暂停中 / 系统插件）、一键启用 / 暂停。启停通过读写 web profile `cordis.patch.yml` 中的 id 定向覆盖实现（用 `yaml` 的 `parseDocument` 保留注释，临时文件 + rename 原子写）。系统插件（`@deepseek-ai/*`）在列表中置底且不可在此启停，避免误关基础能力。作者为 `MeganeOnly` 的插件行首标绿并带"我的"标记。

### skill-manager — Skill 管理

设置页新增"Skill 管理"页：搜索、分组（启用中 / 已停用 / 项目级 / 诊断）、一键启用 / 停用。停用通过向 `ctx.skills` 注册高优先级 provider 注入同名"影子"条目遮蔽原条目实现，**不改动任何 SKILL.md 文件**；停用按 skill 名全局生效（含项目级）。变更后调用 `control.invalidate()` 即时生效，无需重启 DSH（与插件启停需重启不同）。管理范围：用户级目录（`DSH_HOME/skills`、`~/.agents/skills`）+ 最近会话的项目根。

### mcp-manager — MCP 管理

设置页新增"MCP 管理"页：搜索、分组（启用中 / 已停用）、一键启用 / 停用。连接状态实时读 fiber 生命周期，工具清单按 `mcp__<serverName>__` 前缀过滤 `ctx.tools.schemas()`——有工具即"已连接"，fiber 失败即"连接失败"。**重启 DSH 后生效**，行内显示"待重启"徽章。启停真源是 patch 文件而非 loader 实时状态，停用覆盖在重启前不影响运行中的连接。凭据安全：`Authorization` 等 header 值与 `env` 值只在宿主进程内读取，发给浏览器的一律打码，token 不出宿主。

### peak-hour-lock — 高峰拦截

`agent/pre-step` 事件（waterfall）拦截：北京时间 8:50–12:00、13:50–18:00（含前 10 分钟）拒绝含用户真实输入（`source.kind === 'user'`）的步，不误杀高峰前已在运行的任务。被拦截的消息按会话暂存到 profile 目录的 `.peak-hour-lock-queue.json`，高峰期结束后等 2 分钟缓冲，经 `agent.followup` 逐条自动补发（每条独立成轮）。会话不活跃时先经 `ctx.agents.resume({ resumeSessionId })` 从磁盘恢复再投递；恢复失败退避 10 分钟重试。状态行轮询 `/api/peak-hour-lock/status`，管理面板可查看 / 编辑 / 删除 / 立即发送单条暂存消息。

### usage-stats — 使用统计

设置页新增"使用统计"页：总量卡片（输入 / 输出 / 推理 / 缓存读取 / 请求数 / 生成速度）、近 30 天用量柱状图、按模型分解表、会话用量 Top 12、工具调用 Top 10。数据源是 `~/.dsh/sessions` 的会话日志（`session.jsonl.zstd`，**多 frame 拼接容器**），token 数取自 `assistant/message` 事件的 `usage` 字段——**模型侧精确值**，非估算。增量缓存：每个会话文件按 `(size, mtimeMs)` 记在 profile 目录 `.usage-stats-cache.json`（原子写），没变不重解——全量冷解约数秒，之后近零开销。宿主半段启动即预热一次。

### dsh-update-checker — 更新检查

设置页新增"更新"section（`order: 10` 优先级靠前）：显示当前版本 / npm 最新版本 / 是否有更新三段。**完整 semver 对比**：不仅比主.次.补丁，还比 prerelease 段（`-rc.N` / `-alpha.N` / `-beta.N` 等）——遵循 semver 规范：release > prerelease、数字段按大小（非字典序）、字符串段按字典序、数字段 < 字符串段。"一键更新"按钮先二次确认显示目标版本，确认后执行 `npm install -g @deepseek-ai/dsh@latest`。升级完成后不自动重启——磁盘包已更新但运行中进程仍是旧代码，UI 提示"请重启 DSH 生效"。

### dsh-task-pool — 任务池

右上角 FAB（`top: 56px`）+ 右侧 380px 抽屉，**不遮挡对话**。抽屉 header 常驻 inline input：回车即新建任务；卡片就地展开编辑（标题 / 描述 / 删除 / 收起），拖动 handle 上下重排，状态全部 localStorage（key `dsh.taskPool.v1`，v3 schema 含 `tasks / pinned / deleteAfterSend`，v1/v2 自动兼容）。"📨 发送到当前对话"走两次点击：第一次进入 armed 态（橙色脉冲 + 文字"再点一次确认发送（N）"含 4→3→2→1 倒计时），4 秒内再点才通过 `sessions.binding(...).session.driver.prompt([...])` 真发；超时 / 切换自动撤销——**唯一 token 路径，用户主动操作才触发**。发送成功后默认从池子删除任务（全局开关）。**跨面板 FAB 让位协议**：任意右侧抽屉打开时所有 FAB 让位到抽屉左边外侧（避免被别的面板遮挡），与 dsh-git-hub 共享统一 attr + `KNOWN_DRAWER_ATTRS` 列表。host half 零副作用（`apply` 为空函数），按用户意图"本地收集想法"严守隐式 token 成本。

### dsh-git-hub — Git/GitHub 管理面板

右上角 FAB（`top: 108px` 避让 task-pool）+ 右侧 420px 抽屉，**不遮挡对话**。抽屉打开自动扫配置的根目录下所有 git 仓库（默认扫描根可在 ⚙ 配置），每个仓库卡片显示：branch / clean-dirty 徽章 / 未推送数 / 今日 commit 数 / 最新 commit 摘要。操作按钮：单仓库 `⬆ 推送` 调 `daily-push.cjs --repo <path> --yes`；header `⬆ 全部推送` 调 `daily-push.cjs --all --yes`（spawn detached 子进程）；`💬 推到对话` 把仓库摘要作为 user message 发到当前会话，让 agent 调 `mcp__github__` 处理 GitHub 侧（open issues / PRs / releases 等）；`📌 钉` 持久化在 localStorage（`dsh.gitHub.v1`）。配置（扫描根路径列表）持久化在 web profile 根 `.git-hub-config.json`（原子写）。host half 暴露 7 个 `/api/git-hub/*` 路由（config / repos / refresh / push-all / repos/push / push-status）。**零造轮子**：不写 GitHub API 客户端（用 `mcp__github__`）、不写 git push 编排（用 `daily-push.cjs`）、不写 fetch wrapper（浏览器原生 `fetch`）；只做"面板 + 触发"。

### dsh-ui-tweaks — 外观微调合集

集中维护一组对 DSH shell 视觉的微调，每条 tweak 是 `lib/client.js` `TWEAKS` 数组里的一项（`id / name / description / configKeys / defaults / buildCSS(state)`），host half 退化为零副作用 placeholder。client half 用浏览器 `localStorage` 自管（key `dsh-ui-tweaks/state`），注册独立顶层 `settings.section` slot（id=`ui-tweaks`, order=5），用 React 函数组件直接渲染开关/数字输入，立即写 localStorage + 重注入 CSS + 通过 `CustomEvent("dsh-ui-tweaks-state-change")` 触发副作用。当前包含：

- `conversation-shift`：让 `[class*="centerCol"]` + `[data-pane="conversation"]` 双选择器命中（DSH 当前版本用 CSS module hash 类名；桥接包启用时种上 data-pane 兼容属性），`padding-right` 加 N 像素给右侧面板让位；与 task-pool 抽屉状态**解耦**，开关开即永久生效。
- `conversation-shift-debug`：开启后给命中的对话列加绿/橙 outline，并在 DevTools `console.info` 打出命中元素的 tagName/className/offsetWidth/paddingRight/boundingClientRect。
- `simple-mode`：开启时 think / tool-call / context 等整行 display:none，输入框上方常驻极简状态行（DOM 注入跟随 `[class*="turnStatus"]`，250ms 心跳 + MutationObserver，工具名从 `[data-chat-flow-kind="tool-call"]` 节点反推）。

加新调整只需 2 步：`TWEAKS` 数组 push 一条 + 不需要改其它代码（host half 是零副作用 placeholder，schema 演进走 localStorage 隐式迁移）。

## 技术要点

- 浏览器半段格式：`window.__ModuleLoader__.load({ id, factory })`，依赖经 `require()` 从 shell 模块表取得，可手写、无需构建工具；
- 覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- 宿主端注册 HTTP 路由用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- pnpm 11 的 `file:` 依赖是拷贝（非硬链接），改源码后需手动同步到 `node_modules\<包名>` 对应文件（pnpm install 不会感知内容变化）；
- 会话日志 `session.jsonl.zstd` 是**多 frame 拼接**的 zstd 容器（追加写、每批一帧），单 `decompress()` 只得到第一帧；须先按 zstd 帧头/块头结构性扫描边界再逐帧解（usage-stats 的 `scanZstdFrames`），Node 22 内置 `node:zlib` 即可，零依赖。

## 许可证

[MIT](LICENSE)。