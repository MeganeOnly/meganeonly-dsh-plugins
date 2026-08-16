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
| `simple-mode` | `dsh-simple-mode` | 简洁模式：隐藏思考过程与工具调用卡片，只在输入框上方显示一条极简状态行 |
| `usage-stats` | `dsh-usage-stats` | 使用统计：跨会话汇总 token 用量（模型侧精确值）、按日趋势、按模型分解、会话与工具排行 |

## 环境要求

- DeepSeek Harness **web profile**（本机目录形如 `F:\.dsh\profiles\web`）
- Node.js 22+、pnpm
- 浏览器端依赖（react、dsh-client-* 等）由 DSH shell 模块表提供，无需单独安装
- `simple-mode` 的宿主半端额外依赖 profile 自带的 `@deepseek-ai/dsh-settings` 与 `@deepseek-ai/schemastery`（DSH web profile 默认自带）

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
- 输入框上方显示状态行：高峰期提示、已暂存条数、预计补发时刻（轮询 `/api/peak-hour-lock/status`，失败时本地兜底）；预计时刻已过或恢复失败时不再显示过期时间，如实提示；
- 状态行右侧"管理"按钮展开面板：查看 / 编辑 / 删除 / 立即发送单条暂存消息（`GET|POST /api/peak-hour-lock/queue`，编辑只动文本 part，图片等非文本 part 原样保留）。

### simple-mode — 简洁模式

- 设置 → 通用 里新增开关"隐藏思考与工具调用过程"（默认开）；
- 开启时：think 推理行、工具调用卡片（`tool-call`）、上下文注入行（`context`）整体隐藏；除了覆盖渲染器返回 `null`，还注入全局 CSS 按 `data-chat-flow-kind` 隐藏整行，不留白色空白；
- 输入框上方常驻一条极简状态行（正在思考… / 正在阅读… / 正在执行命令…），运行结束自动消失；
- 隐藏只是展示层，对话数据与日志不受影响。

### usage-stats — 使用统计

- 设置页新增"使用统计"页：总量卡片（输入 / 输出 / 推理 / 缓存读取 / 请求数 / 生成速度）、近 30 天用量柱状图（悬停看缓存读与请求数）、按模型分解表、会话用量 Top 12、工具调用 Top 10（次数 / 总耗时 / 均耗）；
- 数据源是 `~/.dsh/sessions` 的会话日志（`session.jsonl.zstd`，多 frame 拼接容器），token 数取自 `assistant/message` 事件的 `usage` 字段——**模型侧返回的精确值**，非估算；工具耗时按 `callId` 配对 `tool/call` → `tool/result`；
- 主目录定位：`DSH_HOME`（官方 `dsh-home-paths` 解析顺序），兜底 profile 根上溯两级；按日分桶用北京时间；
- 增量缓存：每个会话文件按 `(size, mtimeMs)` 记在 profile 目录 `.usage-stats-cache.json`（原子写），没变不重解——全量冷解约数秒（47 会话实测 7.8s），之后近零开销；"强制重算"按钮可 `?force=1` 绕过；
- 宿主半端启动即预热一次，首次打开设置页即有数据；API：`GET /api/usage-stats/summary`。

## 技术要点（写给自己备忘，也欢迎指正）

- 浏览器半端格式：`window.__ModuleLoader__.load({ id, factory })`，依赖经 `require()` 从 shell 模块表取得，可手写、无需构建工具；
- 覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- 宿主端注册 HTTP 路由用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- pnpm 11 的 `file:` 依赖是拷贝（非硬链接），改源码后需手动同步到 `node_modules\<包名>` 对应文件（详见 DSH 插件手册，此处不展开）；
- skill 停用走 `ctx.skills.registerProvider` 高优先级遮蔽（rank 50 低于文件系统来源 100–600），影子条目 invocation 双 false 即彻底不可调用，`control.invalidate()` 让 skill 目录即时更新；
- MCP 服务器 = 名册里 `@deepseek-ai/dsh-mcp-client` 条目 + 各自 config；连接状态看 `entry.fiber.state`（数字枚举 0–5），工具清单按 `mcp__<serverName>__` 前缀过滤 `ctx.tools.schemas()`（详见 mcp-manager）；
- 会话日志 `session.jsonl.zstd` 是**多 frame 拼接**的 zstd 容器（追加写、每批一帧），`zstdDecompressSync` 只解第一帧；须先按 zstd 帧头/块头结构性扫描边界再逐帧解（usage-stats 的 `scanZstdFrames`），Node 22 内置 zlib 即可，零依赖。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
