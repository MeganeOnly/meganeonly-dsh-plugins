# 各插件实现细节

> 本文档承接根 README「开发」一节，逐插件记录**实现层面的细节**（机制、数据格式、边界行为）。面向插件开发者与排障，不面向终端用户。维护规范见 [maintainability.md](maintainability.md)。

## dsh-plugins-all — 名册聚合（跨插件）

本仓库各插件的登记方式有两条路：各自在 `dsh.profile.bundles` 里占一行，或统一由 `dsh-plugins-all` 收口。

机制：DSH 启动时按 `dsh.profile.bundles` 的顺序，把每个 bundle 包 `dsh.bundle.patch` 指向的 patch 文件当作一层叠加。patch 文件是 YAML 数组，**可以含任意多个 `- insert:` 块**，每块向名册插入一行 `{ id, name }`——`name` 是包名，loader 以 profile 根为解析基准定位它的 `package.json`。因此一个包可以为 N 个包"报名"。

`dsh-plugins-all` 只做这件事：它的 `cordis.patch.yml` 由 `scripts/aggregate.cjs` 从 `aggregate.json` 与各成员自己的 `cordis.patch.yml` 生成（逐行投影 insert 块，只剥注释与空行，不解析 YAML 语义，因此 `config` 之类的字段原样保留）。本包不自插名册行，也不声明 `dsh.client`——没有浏览器半段。

两条硬约束：

- **同一个包不能注册两次**。client bundle 的注册 id 就是包名，名册里出现两次会让 bundle 执行两次，浏览器端抛 `client-modules: duplicate factory registration for "<包名>"`；同名行 id 则在构建客户端图时抛 `duplicate graph entry`。被聚合收录的插件必须从 `dsh.profile.bundles` 移除。
- **聚合包只负责"报名"，不负责把包装进 profile"**。行里的 `name` 仍由 loader 从 profile 根解析，成员包必须仍是 profile 的依赖。

行 id 与各插件独立安装时保持一致，profile `cordis.patch.yml` 里已有的按 id 停用条目（`peak-hour-lock` / `mcp-manager` 等）聚合后继续有效；成员的单插件启停仍归 profile 那一层，聚合包不管启停。

## dsh-manager-hub — 统一管理

设置页唯一「管理」入口（settings.section id=`manager-hub`，order=30），顶部 tab：插件（默认）/ Skill / MCP，点击切换三个管理视图。数据源分别是 `/api/plugin-manager`、`/api/skill-manager`、`/api/mcp-manager`——即三个老插件（plugin-manager / skill-manager / mcp-manager）的宿主 API。本插件**只做 UI 聚合，不重复任何宿主逻辑**；三个视图是三个老插件客户端视图的适配副本。

三个老插件的设置页条目在本插件在场时自动隐藏、缺席时自动恢复（由老插件客户端监听 `settings.section` 注册变更实现）——停用 hub 后三个独立管理页作为兜底重新出现，管理能力不丢失。tab 按服务可用性条件显示：某管理插件被停用（API 404）时对应 tab 自动隐藏，其余 tab 不受影响；重新启用后刷新即恢复。

## plugin-manager — 插件管理

设置页「插件管理」页：搜索、分组（启用中 / 暂停中 / 系统插件）、一键启用 / 暂停。启停通过读写 web profile `cordis.patch.yml` 中的 id 定向覆盖实现（用 `yaml` 的 `parseDocument` 保留注释，临时文件 + rename 原子写）。系统插件（`@deepseek-ai/*`）在列表中置底且不可在此启停，避免误关基础能力。作者为 `MeganeOnly` 的插件行首标绿并带「我的」标记。

## skill-manager — Skill 管理

设置页「Skill 管理」页：搜索、分组（启用中 / 已停用 / 项目级 / 诊断）、一键启用 / 停用。停用通过向 `ctx.skills` 注册高优先级 provider 注入同名「影子」条目遮蔽原条目实现，**不改动任何 SKILL.md 文件**；停用按 skill 名全局生效（含项目级）。变更后调用 `control.invalidate()` 即时生效，无需重启 DSH（与插件启停需重启不同）。管理范围：用户级目录（`DSH_HOME/skills`、`~/.agents/skills`）+ 最近会话的项目根。

## mcp-manager — MCP 管理

设置页「MCP 管理」页：搜索、分组（启用中 / 已停用）、一键启用 / 停用。连接状态实时读 fiber 生命周期，工具清单按 `mcp__<serverName>__` 前缀过滤 `ctx.tools.schemas()`——有工具即「已连接」，fiber 失败即「连接失败」。**重启 DSH 后生效**，行内显示「待重启」徽章。启停真源是 patch 文件而非 loader 实时状态，停用覆盖在重启前不影响运行中的连接。凭据安全：`Authorization` 等 header 值与 `env` 值只在宿主进程内读取，发给浏览器的一律打码，token 不出宿主。

## peak-hour-lock — 高峰拦截

`agent/pre-step` 事件（waterfall）拦截：北京时间 8:50–12:00、13:50–18:00（含前 10 分钟）拒绝含用户真实输入（`source.kind === 'user'`）的步，不误杀高峰前已在运行的任务。被拦截的消息按会话暂存到 profile 目录的 `.peak-hour-lock-queue.json`，高峰期结束后等 2 分钟缓冲，经 `agent.followup` 逐条自动补发（每条独立成轮）。会话不活跃时先经 `ctx.agents.resume({ resumeSessionId })` 从磁盘恢复再投递；恢复失败退避 10 分钟重试。状态行轮询 `/api/peak-hour-lock/status`，管理面板可查看 / 编辑 / 删除 / 立即发送单条暂存消息。

## usage-stats — 使用统计

设置页「使用统计」页：总量卡片（输入 / 输出 / 推理 / 缓存读取 / 请求数 / 生成速度）、近 30 天用量柱状图、按模型分解表、会话用量 Top 12、工具调用 Top 10。数据源是 `ctx.sessionQuery`（web profile 挂载 `dsh-session-query-sqlite`）——**日志格式、zstd 解压与 replay 校验全部由框架负责**，插件只在事件流上做业务聚合；token 数取自 `assistant/message` 事件的 `usage` 字段——**模型侧精确值**，非估算。增量缓存：按 session header 的 `id` + `createdAt` 记在 profile 目录 `.usage-stats-cache.json`（原子写），没变不重解。宿主半段启动即预热一次。磁盘上的会话日志自 DSH 0.2.0 起为 `session.v4.jsonl.zstd`（旧文件仍是 `session.v3.jsonl.zstd`，同目录并存、读时由框架透明迁移），插件不感知版本差异。

## dsh-update-checker — 更新检查

设置页「更新」section（`order: 10` 优先级靠前）：显示当前版本 / npm 最新版本 / 是否有更新三段。**完整 semver 对比**：不仅比主.次.补丁，还比 prerelease 段（`-rc.N` / `-alpha.N` / `-beta.N` 等）——遵循 semver 规范：release > prerelease、数字段按大小（非字典序）、字符串段按字典序、数字段 < 字符串段。「一键更新」按钮先二次确认显示目标版本，确认后执行 `npm install -g @deepseek-ai/dsh@latest`。升级完成后不自动重启——磁盘包已更新但运行中进程仍是旧代码，UI 提示「请重启 DSH 生效」。

## dsh-task-pool — 任务池

右上角 FAB（`top: 56px`）+ 右侧 380px 抽屉，**不遮挡对话**。抽屉 header 常驻 inline input：回车即新建任务；卡片就地展开编辑（标题 / 描述 / 删除 / 收起），拖动 handle 上下重排，状态全部 localStorage（key `dsh.taskPool.v1`，v3 schema 含 `tasks / pinned / deleteAfterSend`，v1/v2 自动兼容）。「📨 发送到当前对话」走两次点击：第一次进入 armed 态（橙色脉冲 + 文字「再点一次确认发送（N）」含 4→3→2→1 倒计时），4 秒内再点才通过 `sessions.binding(...).session.driver.prompt([...])` 真发；超时 / 切换自动撤销——**唯一 token 路径，用户主动操作才触发**。发送成功后默认从池子删除任务（全局开关）。**跨面板 FAB 让位协议**：任意右侧抽屉打开时所有 FAB 让位到抽屉左边外侧（避免被别的面板遮挡），与 dsh-git-hub 共享统一 attr + `KNOWN_DRAWER_ATTRS` 列表。host half 零副作用（`apply` 为空函数），按用户意图「本地收集想法」严守隐式 token 成本。

## dsh-git-hub — Git/GitHub 管理面板

右上角 FAB（`top: 108px` 避让 task-pool）+ 右侧 420px 抽屉，**不遮挡对话**。抽屉打开自动扫配置的根目录下所有 git 仓库（默认扫描根可在 ⚙ 配置），每个仓库卡片显示：branch / clean-dirty 徽章 / 未推送数 / 今日 commit 数 / 最新 commit 摘要。操作按钮：单仓库「⬆ 推送」调 `daily-push.cjs --repo <path> --yes`；header「⬆ 全部推送」调 `daily-push.cjs --all --yes`（spawn detached 子进程）；「💬 推到对话」把仓库摘要作为 user message 发到当前会话，让 agent 调 `mcp__github__` 处理 GitHub 侧（open issues / PRs / releases 等）；「📌 钉」持久化在 localStorage（`dsh.gitHub.v1`）。配置（扫描根路径列表）持久化在 web profile 根 `.git-hub-config.json`（原子写）。host half 暴露 7 个 `/api/git-hub/*` 路由（config / repos / refresh / push-all / repos/push / push-status）。**零造轮子**：不写 GitHub API 客户端（用 `mcp__github__`）、不写 git push 编排（用 `daily-push.cjs`）、不写 fetch wrapper（浏览器原生 `fetch`）；只做「面板 + 触发」。

## dsh-ui-tweaks — 外观微调合集

集中维护一组对 DSH shell 视觉的微调，每条 tweak 是 `lib/client.js` `TWEAKS` 数组里的一项（`id / name / description / configKeys / defaults / buildCSS(state)`），host half 退化为零副作用 placeholder。client half 用浏览器 `localStorage` 自管（key `dsh-ui-tweaks/state`），注册独立顶层 `settings.section` slot（id=`ui-tweaks`, order=5），用 React 函数组件直接渲染开关/数字输入，立即写 localStorage + 重注入 CSS + 通过 `CustomEvent("dsh-ui-tweaks-state-change")` 触发副作用。

当前 tweak 全表见 [dsh-ui-tweaks/README.md](../dsh-ui-tweaks/README.md)。两个代表性示例：

- `conversation-shift`：让 `[class*="centerCol"]` + `[data-pane="conversation"]` 双选择器命中（DSH 当前版本用 CSS module hash 类名；桥接包启用时种上 data-pane 兼容属性），`padding-right` 加 N 像素给右侧面板让位；与 task-pool 抽屉状态**解耦**，开关开即永久生效。
- `simple-mode`：开启时 think / tool-call / context 等整行 display:none，输入框上方常驻极简状态行（DOM 注入跟随 `[class*="turnStatus"]`，250ms 心跳 + MutationObserver，工具名从 `[data-chat-flow-kind="tool-call"]` 节点反推）。

加新调整只需 2 步：`TWEAKS` 数组 push 一条 + 不需要改其它代码（host half 是零副作用 placeholder，schema 演进走 localStorage 隐式迁移）。

## 技术要点

- 浏览器半段格式：`window.__ModuleLoader__.load({ id, factory })`，依赖经 `require()` 从 shell 模块表取得，可手写、无需构建工具；
- 覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- 宿主端注册 HTTP 路由用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- pnpm 11 的 `file:` 依赖按**硬链接**落盘（不是整目录拷贝）：原地修改已有文件会立刻反映到 `node_modules`；**新增 / 删除文件不会同步**，`pnpm install` 也不感知内容变化，需要重装（`link:` 则始终是活链接，但不会安装被链接包自己的依赖）；
- 会话日志 `session.jsonl.zstd` 是**多 frame 拼接**的 zstd 容器（追加写、每批一帧），单 `decompress()` 只得到第一帧；须先按 zstd 帧头/块头结构性扫描边界再逐帧解（usage-stats 的 `scanZstdFrames`），Node 22 内置 `node:zlib` 即可，零依赖。
