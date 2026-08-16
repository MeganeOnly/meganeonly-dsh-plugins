# dsh-plugins — 我的 DSH 常驻插件集

作者：MeganeOnly

一组面向 DeepSeek Harness（DSH）web profile 的**常驻插件**。
三个插件都遵循同一套结构：宿主半端（Cordis 插件）+ 浏览器半端（`__ModuleLoader__` bundle）。
作者本人并没有编成能力，除了README的少数部分之外的所有内容都是用ai写的。


## 仓库结构

| 目录 | npm 包名 | 功能 |
| --- | --- | --- |
| `plugin-manager` | `dsh-plugin-manager` | 设置页"插件管理"：列出所有非系统常驻插件（含作者署名），一键启用 / 暂停 |
| `peak-hour-lock` | `dsh-peak-hour-lock` | 北京时间高峰时段拦截发送，消息暂存，结束后自动补发，避免高峰产生双倍模型费用 |
| `simple-mode` | `dsh-simple-mode` | 简洁模式：隐藏思考过程与工具调用卡片，只在输入框上方显示一条极简状态行 |

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

安装后可到 **设置 → 插件管理** 统一查看 / 启停这些插件（由 plugin-manager 提供）。

## 插件说明

### plugin-manager — 插件管理

- 设置页新增"插件管理"页：搜索（按 id / 名称 / 作者）、分组（启用中 / 暂停中 / 系统插件）、一键启用 / 暂停；
- 启停实现：读写 web profile 的 `cordis.patch.yml` 中的 id 定向覆盖（用 `yaml` 的 `parseDocument` 保留注释，临时文件 + rename 原子写）；
- 系统插件（`@deepseek-ai/*`）在列表中置底且不可在此启停，避免误关基础能力；
- 作者署名从 profile `node_modules` 下各包 `package.json` 的 `author` 字段读取；
- 作者为 `MeganeOnly` 的插件（本人所写）行首标绿并带"我的"标记——改 `lib/client.js` 里的 `MINE_AUTHOR` 即可调整。

### peak-hour-lock — 高峰拦截

- 拦截点：`agent/pre-step` 事件（waterfall），只拒绝含用户真实输入（`source.kind === 'user'`）的步，不误杀高峰开始前已在运行的任务；
- 高峰时段（北京时间，UTC+8 无夏令时）：8:50–12:00、13:50–18:00，含高峰前 10 分钟；
- 被拦截的消息按会话暂存到 profile 目录的 `.peak-hour-lock-queue.json`，高峰期结束后再等 2 分钟缓冲，经 `agent.followup` 逐条自动补发（每条独立成轮）；
- 输入框上方显示状态行：高峰期提示、已暂存条数、预计补发时刻（轮询 `/api/peak-hour-lock/status`，失败时本地兜底）。

### simple-mode — 简洁模式

- 设置 → 通用 里新增开关"隐藏思考与工具调用过程"（默认开）；
- 开启时：think 推理行、工具调用卡片（`tool-call`）、上下文注入行（`context`）整体隐藏；除了覆盖渲染器返回 `null`，还注入全局 CSS 按 `data-chat-flow-kind` 隐藏整行，不留白色空白；
- 输入框上方常驻一条极简状态行（正在思考… / 正在阅读… / 正在执行命令…），运行结束自动消失；
- 隐藏只是展示层，对话数据与日志不受影响。

## 技术要点（写给自己备忘，也欢迎指正）

- 浏览器半端格式：`window.__ModuleLoader__.load({ id, factory })`，依赖经 `require()` 从 shell 模块表取得，可手写、无需构建工具；
- 覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- 宿主端注册 HTTP 路由用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- pnpm 11 的 `file:` 依赖是拷贝（非硬链接），改源码后需手动同步到 `node_modules\<包名>` 对应文件（详见 DSH 插件手册，此处不展开）。

## 许可证

MIT License，见 [LICENSE](LICENSE)。
