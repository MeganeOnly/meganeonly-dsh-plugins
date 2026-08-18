# dsh-plugins — 我的 DSH 常驻插件集

作者：MeganeOnly

一组面向 DeepSeek Harness（DSH）web profile 的**常驻插件**。
各插件都遵循同一套结构：宿主半端（Cordis 插件）+ 浏览器半端（`__ModuleLoader__` bundle）。
作者本人并没有编成能力，除了README的少数部分之外的所有内容都是用ai写的。

## 仓库结构

| 目录 | npm 包名 | 功能 |
| --- | --- | --- |
| `plugin-manager` | `dsh-plugin-manager` | 设置页"插件管理"：列出所有非系统常驻插件（含作者署名），一键启用 / 暂停 |
| `skill-manager` | `dsh-skill-manager` | 设置页"Skill 管理"：列出用户级 skill（含描述与作者署名），一键启用 / 停用（遮蔽覆盖，即时生效） |
| `mcp-manager` | `dsh-mcp-manager` | 设置页"MCP 管理"：列出所有 MCP 服务器（连接状态 + 工具清单 + 端点摘要），一键启用 / 停用（重启生效） |
| `peak-hour-lock` | `dsh-peak-hour-lock` | 北京时间高峰时段拦截发送，消息暂存，结束后自动补发，避免高峰产生双倍模型费用 |
| `usage-stats` | `dsh-usage-stats` | 使用统计：跨会话汇总 token 用量（模型侧精确值）、按日趋势、按模型分解、会话与工具排行 |
| `dsh-update-checker` | `dsh-update-checker` | 更新检查：设置页"更新"section 显示当前版本与 npm latest，含完整 semver（含 prerelease）对比；一键 `npm install -g @deepseek-ai/dsh@latest` 升级，提示重启生效 |
| `dsh-task-pool` | `dsh-task-pool` | 任务池：右上角 FAB（top: 56px）+ 右侧 380px 抽屉，本地收集想法的池子（localStorage 持久化，零 token 消耗）；卡片就地展开可"发送到当前对话"（二次确认 + 4 秒倒计时，发完默认删除可关）；**v0.5.6 跨面板 FAB 让位**：任意右侧抽屉打开时所有 FAB 让位到 `calc(var(--active-drawer-width) + 24px)`（让位数值随实际抽屉宽度变化，`isOtherDrawerOpen` 检查修互斥协议 race condition） |
| `dsh-git-hub` | `dsh-git-hub` | Git/GitHub 管理面板：右侧 FAB（top: 108px 避让 task-pool）+ 420px 抽屉，扫描本地 git 仓库列表（branch / dirty / 未推送 / 今日 commit / 最新 commit），一键调 daily-push.cjs 推送（全部或单个），把仓库摘要发到当前对话让 agent 调 mcp__github__ 处理；host half 暴露 7 个 /api/git-hub/* 路由，零造轮子（推送走 daily-push.cjs，GitHub 视角走 mcp__github__）；**v0.1.4 跨面板 FAB 让位**：与 task-pool 共享 `data-dsh-any-side-drawer-open` 统一 attr + `KNOWN_DRAWER_ATTRS` 列表，让位公式用 CSS 变量；**v0.1.5 ESM fix**：host half 在 ESM 模块里错用 `require('node:fs')` 调同步 API（被 try/catch 静默吞错导致 scanRoot 永远返回空），修复为 `import { readdirSync, statSync } from 'node:fs'`；**v0.1.6 per-repo 隐藏**：localStorage schema v2 `{ pinnedPaths, hiddenPaths }`，卡片加 🚫 隐 按钮，配置面板可批量编辑 hiddenPaths（适用归档/隐私/损坏备份）；**v0.1.7 隐藏选择模式**：header 加 🎯/✓ toggle 按钮，模式激活后整张卡片可点 toggleHide，body 底部「已隐藏 N 个仓库」小条 + 展开/完成按钮，Esc 退出；**v0.1.7 hidden 阻止 push**：单仓库 push 按钮 hidden 时置灰 + 入口拒绝；全部推送 client 端循环 pushRepo 单仓库串行 800ms 间隔（替代 host half 的 daily-push.cjs --all，避免扫到 hidden） |
| `dsh-ui-tweaks` | `dsh-ui-tweaks` | 外观微调合集：当前含对话列永久右缩让位（`conversationShift` / `conversationShiftPx`，含调试高亮 `conversationShiftDebug`）+ 简洁模式（`simpleModeEnabled`：隐藏思考/工具调用 + 输入框上方极简状态行，从原 dsh-simple-mode 合并）；走 DSH 设置页渲染控件，client 动态生成 CSS + DOM 副作用 |

## 环境要求

- DeepSeek Harness **web profile**（本机目录形如 `F:\.dsh\profiles\web`）
- Node.js 22+、pnpm
- 浏览器端依赖（react、dsh-client-* 等）由 DSH shell 模块表提供，无需单独安装

## 安装（每个插件相同步骤）

1. 把插件目录放到本机任意位置，例如 `F:\.dsh\plugins\<目录名>`；
2. 编辑 web profile 的 `package.json`：
   - `dependencies` 中加一行：`"dsh-<包名>": "file:../../plugins/<目录名>"`
   - `dsh.profile.bundles` 数组中加入 `"dsh-<包名>"`
3. 安装依赖（Windows 下 pnpm 脚本可能被策略拦截，走 cmd shim）：

   ```bat
   cmd /c "cd /d F:\.dsh\profiles\web && pnpm install --no-frozen-lockfile"
   ```

4. **重启 DSH** 使宿主半端与插件名册生效；浏览器 bundle 的改动刷新页面即可生效。

安装后可到 **设置 → 插件管理** 统一查看 / 启停这些插件（由 plugin-manager 提供）；skill 的启停见 **设置 → Skill 管理**（由 skill-manager 提供）；MCP 服务器的启停见 **设置 → MCP 管理**（由 mcp-manager 提供）。

## 插件说明

### plugin-manager — 插件管理

- 设置页新增"插件管理"页：搜索（按 id / 名称 / 作者）、分组（启用中 / 暂停中 / 系统插件）、一键启用 / 暂停；
- 启停实现：读写 web profile 的 `cordis.patch.yml` 中的 id 定向覆盖（用 `yaml` 的 `parseDocument` 保留注释，临时文件 + rename 原子写）；
- 系统插件（`@deepseek-ai/*`）在列表中置底且不可在此启停，避免误关基础能力；
- 作者署名从 profile `node_modules` 下各包 `package.json` 的 `author` 字段读取；
- 作者为 `MeganeOnly` 的插件（本人所写）行首标绿并带"我的"标记——改 `lib/client.js` 里的 `MINE_AUTHOR` 即可调整。

### skill-manager — Skill 管理

- 设置页新增"Skill 管理"页（紧跟"插件管理"）：搜索（按名称 / 描述 / 作者）、分组（启用中 / 已停用 / 项目级 / 诊断）、一键启用 / 停用；行内容呈现参考 ZCode 的 skill 列表（名称 + 描述 + 来源 / 作者）；
- 停用实现：向 `ctx.skills` 注册 rank 50 的高优先级 provider，为停用名单里的 skill 提供同名"影子"条目遮蔽原条目，并把 invocation 双关（模型目录不出现、`/name` 手动调用也不注入）——**不改动任何 SKILL.md 文件**；停用按 skill 名全局生效（含项目级）；
- **即时生效，无需重启**：变更后调用 provider 的 `control.invalidate()`，DSH 的 skill 目录在下一轮对话自动发布更新（与插件启停需重启不同）；
- 项目级视角：按最近一个会话的 cwd 解析项目根（`ctx.sessions.list` + `ctx.agents.get(id).session.header.cwd`），"项目级"分组展示并可启停；
- 诊断：同名 skill 出现在多个根目录时显示遮蔽关系（谁生效、谁被遮蔽）；`DSH_HOME` 指向别处时默认主目录（`~/.dsh/skills`）下的 skill 永不被扫描——以"未被扫描的目录（死副本）"警示；行内"遮蔽 N"徽章提示同名多来源；
- 停用名单持久化在 web profile 根的 `.skill-manager.json`（临时文件 + rename 原子写）；名单里文件已不存在的 skill 显示"文件缺失"幽灵行，可重新启用移出名单；
- skill 名字以 SKILL.md frontmatter 的 `name` 为准（与 DSH 一致），作者署名读 `metadata.author`（官方约定；兼容顶层 `author`，string 或 `{name}` 均可，自动 trim）；管理范围 = 用户级目录（`DSH_HOME/skills`、`~/.agents/skills`）+ 最近会话的项目根；目录内的 junction / 符号链接会跟随（与 DSH 官方 provider 一致）；
- 作者为 `MeganeOnly` 的 skill（本人所写）行首标绿并带"我的"标记——改 `lib/client.js` 里的 `MINE_AUTHOR` 即可调整。

### mcp-manager — MCP 管理

- 设置页新增"MCP 管理"页（紧跟"Skill 管理"）：搜索（按服务器名 / 条目 id / 端点 / 工具名）、分组（启用中 / 已停用）、一键启用 / 停用；行内容呈现参考 ZCode 的 `/mcp` 列表（服务器名 + 连接状态徽章 + 工具清单可展开）；
- MCP 在 DSH 里的形态：每个 MCP 服务器是 loader 名册里 `name: '@deepseek-ai/dsh-mcp-client'` 的条目（`id: mcp-<x>`，`config.serverName` 是工具命名空间），工具注册公开名固定 `mcp__<serverName>__<rawName>`；
- 展示数据全部实时读：条目 / 启停状态来自 `ctx.loader.entries()`，连接状态来自 fiber 生命周期，工具清单来自 `ctx.tools.schemas()` 按前缀过滤——有工具即"已连接"，fiber 失败即"连接失败"；
- 启停实现：与 plugin-manager 同款 `cordis.patch.yml` id 定向覆盖（`parseDocument` 保留注释 + 原子写）；实测同文件内后出现的 `- id:` 覆盖可命中先由 `- insert:` 插入的 MCP 条目；**重启 DSH 后生效**，行内显示"待重启"徽章；
- 启停真源是 patch 文件而非 loader 实时状态——停用覆盖在重启前不影响运行中的连接，"停用后未重启又反悔"也能正确撤回；
- 凭据安全：`Authorization` 等 header 值与 `env` 值只在宿主进程内读取，发给浏览器的一律打码（只留键名 + Bearer/长度形态），token 不出宿主。

### peak-hour-lock — 高峰拦截

- 拦截点：`agent/pre-step` 事件（waterfall），只拒绝含用户真实输入（`source.kind === 'user'`）的步，不误杀高峰开始前已在运行的任务；
- 高峰时段（北京时间，UTC+8 无夏令时）：8:50–12:00、13:50–18:00，含高峰前 10 分钟；
- 被拦截的消息按会话暂存到 profile 目录的 `.peak-hour-lock-queue.json`，高峰期结束后再等 2 分钟缓冲，经 `agent.followup` 逐条自动补发（每条独立成轮）；
- 补发目标永远是消息被拦截时所在的会话：会话不活跃时先经 `ctx.agents.resume({ resumeSessionId })` 从磁盘恢复再投递；恢复失败的会话退避 10 分钟重试，并在状态行提示手动处理；
- 启动遗留（重启前就滞留在队列里的条目）先给 2 分钟管理缓冲再自动补发，期间可在面板查看/编辑/删除；
- 输入框上方显示状态行：高峰期提示、已暂存条数、预计补发时刻（轮询 `/api/peak-hour-lock/status`，失败时本地兜底）；预计时刻已过或恢复失败时不再显示过期时间，如实提示；
- 状态行右侧"管理"按钮展开面板：查看 / 编辑 / 删除 / 立即发送单条暂存消息（`GET|POST /api/peak-hour-lock/queue`，编辑只动文本 part，图片等非文本 part 原样保留）。

### usage-stats — 使用统计

- 设置页新增"使用统计"页：总量卡片（输入 / 输出 / 推理 / 缓存读取 / 请求数 / 生成速度）、近 30 天用量柱状图（悬停看缓存读与请求数）、按模型分解表、会话用量 Top 12、工具调用 Top 10（次数 / 总耗时 / 均耗）；
- 数据源是 `~/.dsh/sessions` 的会话日志（`session.jsonl.zstd`，多 frame 拼接容器），token 数取自 `assistant/message` 事件的 `usage` 字段——**模型侧返回的精确值**，非估算；工具耗时按 `callId` 配对 `tool/call` → `tool/result`；
- 主目录定位：`DSH_HOME`（官方 `dsh-home-paths` 解析顺序），兜底 profile 根上溯两级；按日分桶用北京时间；
- 增量缓存：每个会话文件按 `(size, mtimeMs)` 记在 profile 目录 `.usage-stats-cache.json`（原子写），没变不重解——全量冷解约数秒（47 会话实测 7.8s），之后近零开销；"强制重算"按钮可 `?force=1` 绕过；
- 宿主半端启动即预热一次，首次打开设置页即有数据；API：`GET /api/usage-stats/summary`。

### dsh-update-checker — 更新检查

- 设置页新增"更新"section（`order: 10` 优先级靠前）：显示当前版本 / npm 最新版本 / 是否有更新三段；
- **完整 semver 对比**（v0.1.1+）：不仅比主.次.补丁，还比 prerelease 段（`-rc.N` / `-alpha.N` / `-beta.N` 等）——遵循 semver 规范：release > prerelease、数字段按大小（非字典序）、字符串段按字典序、数字段 < 字符串段。修过 v0.1.0 的 bug：之前正则只吃 `^v?(\d+)\.(\d+)\.(\d+)` 把 `-rc.N` 直接丢掉，导致 `0.1.0-rc.6` vs `0.1.0-rc.7` 被判成"已是最新"；
- 当前版本来源：`dsh --version`（走 hermes 全局 dsh 命令，Windows 上 .cmd shim 需经 cmd.exe 解析）；npm 最新版本：`fetch https://registry.npmjs.org/@deepseek-ai/dsh/latest`；
- "检查更新"按钮手动重查；"一键更新"按钮先二次确认显示目标版本，确认后执行 `npm install -g @deepseek-ai/dsh@latest`；
- 升级完成后不自动重启——磁盘包已更新但运行中进程仍是旧代码，UI 提示"请重启 DSH 生效"；
- 升级期间 polling `/api/dsh-update/status` 直到 updating 结束；整个过程状态机单飞（同时只允许一个 check 或一个 update 进行）；
- API：`GET /api/dsh-update/status` / `POST /api/dsh-update/check` / `POST /api/dsh-update/update`；
- host half 启动时静默查一次版本（失败可忽略，UI 可手动重试）。

### dsh-task-pool — 任务池

- 右上角 FAB（`top: 56px`，44×44 圆形，DSH 风格浅色卡片按钮）唤起右侧 380px 抽屉，**不遮挡对话**（与 v0.1.0 中心覆盖模式的根本区别）；
- 抽屉 header 常驻 inline input：回车即新建任务、失焦不做任何事；📌 钉住 → 下次启动自动展开；× 关闭 → 仅会话级隐藏；
- 卡片就地展开编辑（标题 / 描述 / 删除 / 收起），拖动 handle 上下重排，状态全部 localStorage（key `dsh.taskPool.v1`，v3 schema 含 `tasks / pinned / deleteAfterSend`，v1/v2 自动兼容）；
- "📨 发送到当前对话"走两次点击：第一次进入 armed 态（橙色脉冲 + 文字"再点一次确认发送（N）"含 4→3→2→1 倒计时），4 秒内再点才通过 `sessions.binding(...).session.driver.prompt([...])` 真发；超时/切换自动撤销——**唯一 token 路径，用户主动操作才触发**；
- v0.5.3 起**发送成功后默认从池子删除任务**（全局开关，非 per-task），关掉可保留供"再发一次"场景；
- **v0.5.6 跨面板 FAB 让位协议**：任意右侧抽屉打开时所有 FAB 让位到 `calc(var(--active-drawer-width) + 24px)`，通过 `data-dsh-any-side-drawer-open` 统一 attr；与 dsh-git-hub 共享——避免被别的面板抽屉遮挡；`--active-drawer-width` 由打开抽屉的 panel setProperty（task-pool = 380px, git-hub = 420px），让位数值随实际抽屉宽度变化；`applyOpen` 引入 `isOtherDrawerOpen` 检查修互斥协议 race condition（开抽屉 A 去点 B 时不再误移除统一 attr / CSS 变量）；与 dsh-git-hub 共享 `KNOWN_DRAWER_ATTRS` 列表；**迭代记录**：v0.5.4 协议升级 + v0.5.5 hotfix（让位数值从 `left: 24px` 误写改成 `right: 444px`，符合用户"到那个抽屉的左边"原意）+ v0.5.6 hotfix（让位公式改 CSS 变量 + 修 race condition）；
- host half 零副作用（`apply` 为空函数），不注册 system prompt 段、不注册 HTTP、不注入服务——按用户意图"本地收集想法"严守隐式 token 成本；
- 用纯 DOM 实现（不引 React）——React 受控组件在 drag-and-drop 中经常干扰 dragover 事件，纯 DOM + 局部 patch 更可控。

### dsh-git-hub — Git/GitHub 管理面板

- 右上角 FAB（`top: 108px` 避让 task-pool，44×44 圆形，DSH 风格浅色卡片按钮）唤起右侧 420px 抽屉，**不遮挡对话**；与 task-pool 抽屉**互斥**（`dsh-panel-activate` CustomEvent + `<html data-dsh-github-drawer-open>` 属性）；**v0.1.4 跨面板 FAB 让位**：任意抽屉打开时所有 FAB 让位到 `calc(var(--active-drawer-width) + 24px)`（与 task-pool 共享 `data-dsh-any-side-drawer-open` attr + `KNOWN_DRAWER_ATTRS` 列表），让位公式用 CSS 变量（避免不同宽度抽屉位置错乱），`isOtherDrawerOpen` 检查修互斥协议 race condition；**v0.1.5 ESM fix**：host half 关键 bug 修复——原 v0.1.4 在 ESM 模块里错用 `require('node:fs').readdirSync / statSync`（ESM 没有 require → ReferenceError → 被 try/catch 静默吞错 → scanRoot 永远返回空 → API 永远返回 0 仓库）；改为 `import { readdirSync, statSync } from 'node:fs'` 顶层导入；**修复后需重启 DSH 生效**（host half bundle 启动时加载，运行时不会自动 HMR）；**v0.1.6 per-repo 隐藏**：localStorage schema v2 `{ pinnedPaths, hiddenPaths }`，每张卡片加 🚫 隐 按钮（隐藏后不显示），body 顶部「已隐藏 N 个」小条可一键展开/收起，⚙ 配置面板加 hiddenPaths textarea 支持批量编辑——适用场景：归档目录（.archive）/ 隐私项目（不打算 push 到 GitHub）/ 损坏备份（.broken）等；**迭代记录**：v0.1.2 协议升级 + v0.1.3 hotfix（让位数值）+ v0.1.4 hotfix（CSS 变量 + race 修复）+ v0.1.5 hotfix（ESM require 修复）+ v0.1.6 per-repo 隐藏 + v0.1.7 隐藏选择模式 + hidden 阻止 push；
- 抽屉打开自动扫配置的根目录下所有 git 仓库（默认 `F:\AllWorkSpace` + `E:\`，⚙ 可改），每个仓库卡片显示：branch / clean-dirty 徽章 / 未推送数 / 今日 commit 数 / 最新 commit 摘要；
- 操作按钮：单仓库 `⬆ 推送` 调 `daily-push.cjs --repo <path> --yes`；header `⬆ 全部推送` 调 `daily-push.cjs --all --yes`（spawn detached 子进程，立即返回 PID + "去终端看完整输出"提示）；`💬 推到对话` 把仓库摘要作为 user message 发到当前会话，触发 agent 调 `mcp__github__` 处理 GitHub 侧（open issues / PRs / releases 等）；`📌 钉` 持久化在 localStorage（`dsh.gitHub.v1`）；
- 配置（扫描根路径列表）持久化在 web profile 根 `.git-hub-config.json`（原子写），保存后自动重扫；
- host half 暴露 7 个 `/api/git-hub/*` 路由（config / repos / refresh / push-all / repos/push / push-status），host half **必须有真实职责**（与 task-pool 的零副作用 placeholder 不同）——本插件依赖 host half 跑 git 命令集 + spawn daily-push.cjs；
- 5 秒扫描缓存 + 单仓库状态串行读 + 每个命令 5s timeout + 失败 fallback 不阻塞；扫描跳过 `node_modules / .git / .git*` 等典型大目录；
- 抽屉打开时 4 秒轮询 push-status 显示推送进度（PID + 退出码）；
- 零造轮子：不写 GitHub API 客户端（用 `mcp__github__`）、不写 git push 编排（用 `daily-push.cjs`）、不写 fetch wrapper（浏览器原生 `fetch`）；只做"面板 + 触发"；
- 用纯 DOM 实现（不引 React）——复用 task-pool 已建立的 FAB + 抽屉 + 互斥协议 + CSS 注入 + 持久化降级模板。

### dsh-ui-tweaks — 外观微调合集

- 集中维护一组对 DSH shell 视觉的微调：每条 tweak 是 `lib/client.js` `TWEAKS` 数组里的一项（`id / name / description / configKeys / defaults / buildCSS(state)`），v0.4.0 起**不依赖 host half schema**——v0.3.0 起 host half 退化为零副作用 placeholder（按 DECISIONS C003，第三方 namespace 在 `exposedNamespaces()` 白名单外 silent filter）；
- client half 用浏览器 `localStorage` 自管（key `dsh-ui-tweaks/state`），注册独立顶层 `settings.section` slot（id=`ui-tweaks`, order=5），用 React 函数组件直接渲染开关/数字输入，立即写 localStorage + 重注入 CSS + 通过 `CustomEvent("dsh-ui-tweaks-state-change")` 触发副作用（调试高亮、简洁模式状态行 DOM controller）；
- 当前包含：
  - `conversation-shift`：让 `[class*="centerCol"]` + `[data-pane="conversation"]` 双选择器命中（DSH 当前版本用 CSS module hash 类名；`@linxin666/dsh-web-ui-all` 桥接包启用时种上 data-pane 兼容属性），`padding-right` 加 N 像素给右侧面板让位；并加 `box-sizing: border-box !important` + `min-width: 0 !important` 让 padding 在 flex/grid item 上也起作用；与 task-pool 抽屉状态**解耦**，开关开即永久生效；
  - `conversation-shift-debug`：开启后给命中的对话列加绿/橙 outline，并在 DevTools `console.info` 打出命中元素的 tagName/className/offsetWidth/paddingRight/boundingClientRect；
  - `simple-mode`：**从原 `dsh-simple-mode` 合并入**（v0.4.0），设置 → 界面微调里的开关；开启时 think/tool-call/context 等整行 display:none，输入框上方常驻极简状态行（DOM 注入跟随 `[class*="turnStatus"]`，250ms 心跳 + MutationObserver，工具名从 `[data-chat-flow-kind="tool-call"]` 节点反推——不依赖 settingsScope）；
- 加新调整只需 2 步：TWEAKS 数组 push 一条 + 不需要改其它代码（host half 是零副作用 placeholder，schema 演进走 localStorage 隐式迁移）；
- DSH selector 历史踩坑：v0.4.0 之前只用 `[class*="centerCol"]` substring 匹配（DSH 当前版本 CSS module hash 跨重启变但 substring 保留）；v0.4.0 起加 `[data-pane="conversation"]` 兜底，桥接包启用时也能命中。

## 技术要点（写给自己备忘，也欢迎指正）

- 浏览器半端格式：`window.__ModuleLoader__.load({ id, factory })`，依赖经 `require()` 从 shell 模块表取得，可手写、无需构建工具；
- 覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- 宿主端注册 HTTP 路由用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- pnpm 11 的 `file:` 依赖是拷贝（非硬链接），改源码后需手动同步到 `node_modules\<包名>` 对应文件（详见 DSH 插件手册，此处不展开）；
- skill 停用走 `ctx.skills.registerProvider` 高优先级遮蔽（rank 50 低于文件系统来源 100–600），影子条目 invocation 双 false 即彻底不可调用，`control.invalidate()` 让 skill 目录即时更新；
- MCP 服务器 = 名册里 `@deepseek-ai/dsh-mcp-client` 条目 + 各自 config；连接状态看 `entry.fiber.state`（数字枚举 0–5），工具清单按 `mcp__<serverName>__` 前缀过滤 `ctx.tools.schemas()`（详见 mcp-manager）；
- 会话日志 `session.jsonl.zstd` 是**多 frame 拼接**的 zstd 容器（追加写、每批一帧），`zstdDecompressSync` 只解第一帧；须先按 zstd 帧头/块头结构性扫描边界再逐帧解（usage-stats 的 `scanZstdFrames`），Node 22 内置 zlib 即可，零依赖。

## 诊断流程

踩坑时按这张流程图定位（写给自己，下次踩坑不用重想一遍）：

### 启停不生效

- 改 `cordis.patch.yml` 后**必须重启 DSH**，插件状态完全靠启动期 YAML 加载，没有运行时 disable 通道
- 若 YAML 已 `disabled: true` 但 plugin 还在响应：YAML 改了但 DSH 没重启，旧的 fiber 还在内存里
- 检查 web profile 的 `cordis.patch.yml`（`F:\.dsh\profiles\web\cordis.patch.yml`）与 bundle 内 `cordis.patch.yml`（`packages/<name>/cordis.patch.yml`）别写错 YAML 语法（YAML 重复 key 会让 patch 解析抛错）

### peak-hour-lock 队列堆积

- 队列文件在 `F:\.dsh\profiles\web\.peak-hour-lock-queue.json`，删之前**先备份**（工作区约定 D006）
- 自动补发时机会：
  - 高峰结束（12:00 或 18:00 北京时间）+ `OFFSET_MINUTES`（默认 2 分钟）
  - DSH 启动后 + `STARTUP_GRACE_MS`（默认 2 分钟）
- 队列条目带 `ts` 字段（拦截时刻），从 v0.3.3 起 plugin 启动时自动清理超过 `staleAfterMs`（默认 7 天）的条目——按状态 API `staleCount` 字段看清理数量
- 补发失败时（会话被删等）条目会留在队列里重试，**无最大重试次数**，需手动从管理面板删除

### session.jsonl.zstd 解压只得到 header

- 实际是**多 frame zstd 拼接容器**（追加写、每批一帧），单 `decompress()` 只得到 header 那一帧
- 用流式解压 ` `zstdDecompressor`\`.stream_reader(BytesIO(raw))` 或结构性 `scanZstdFrames`（usage-stats 的实现）逐帧解
- Node 22 内置 `node:zlib` 即可，零第三方依赖

### usage zip 找不到具体会话

- DeepSeek / 平台侧用量 csv 只到**小时桶 × provider/model × API key** 维度，**无 sessionId**
- 反查要靠本地 DSH 会话存档的 `request/header` 事件里的 `data.header.config.provider` + `config.model`
- 本机查不到时：用量可能来自其他客户端 / 命令行 / 另一台机器，建议**先 rotate key 排除泄露**

### 完整 API key 出现在会话存档里

- DSH 在持久化层不会写 `Authorization` 头，但**用户消息里明文粘贴 key 会作为对话内容落盘**
- `has_full_key` 子串扫描所有 `session.jsonl.zstd` 文件；命中后建议 rotate + 清理相关会话内容

## 许可证

MIT License，见 [LICENSE](LICENSE)。
