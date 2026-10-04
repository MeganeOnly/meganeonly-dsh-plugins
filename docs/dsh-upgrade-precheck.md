# DSH 升级前预检清单

目的：把"升级 DSH 之后起不来"的风险在升级前消掉，并给出升级后逐条比对的判据。

读者：在本机维护 DSH profile 与一组常驻插件的人。

## 一、升级前必做

1. **备份 profile**：把 profile 目录下的 `package.json`、`cordis.patch.yml`、`pnpm-lock.yaml` 各留一份带时间戳的副本；升级出问题时可以直接回滚这三份文件。
2. **记录当前版本**：`dsh --version`（升级后要能说出"从哪个版本到哪个版本"）。
3. **确认 profile 里没有"明知会被跳过"的条目**：peer 不匹配的第三方包会在新版启动时被 skip / disable（见 § 三），提前换成兼容版本或先禁用，升级日志才干净。

## 二、DSH 0.2.x 相对旧版的已知差异（实测 0.2.0-rc.2 与 0.2.1-alpha.1）

| 主题 | 旧版行为 | 0.2.x 行为 | 对本仓库插件的影响 |
| --- | --- | --- | --- |
| 重复 HTTP 路由 | `ctx.webServer.register` 对重复 `(kind, path)` 直接 `throw` | 同左（`dsh-host-webserver` 源码逐字节等价），且启动期冲突会连带打崩本次启动 | 任何注册路由的 host 半端都必须"注册前查重"，见 § 四 |
| 输入区统计扩展 | 统计行 `StatsPills` 是 `conversation.composer.dock` 的唯一占位者（`id: "stats"`, order 0）；上下文计量器 `ContextMeter` 在 `trailing` 工具行 | 0.2.0-rc.2 实测：占位者仍只有 `stats`，但 `ContextMeter` **搬进了 composer dock**，成为 slot 出口的**同级兄弟节点**；另新增 `conversation.input.activity`（single/session）与 `conversation.input.dock` 的第三个占位者 `GoalDock`（order 10） | **0.2.0-rc.2 唯一打破的契约**：`dsh-ui-tweaks` 的"隐藏 slot 出口 == 隐藏整行统计"不再成立（ContextMeter 仍会显示），且"dock 内最内层 `_root`"的镜像源启发式可能选到 ContextMeter。详见 § 七-2 |
| invariant 运行时插件 | 各包提供 `./invariant` 导出 | 0.2.0-rc.2 仍在树内（`dsh-agent/lib/types/invariant.d.ts`）；移除发生在 0.2.1-alpha.1 | 本仓库 11 个插件均未引用 `./invariant`，无需处理 |
| 子路径插件元数据 | 子路径下可放独立 `package.json` 提供显示文本 / 图标 | 客户端 bundle 解析走 `exports["./client"]`；子路径 specifier 走"最近的 `package.json`"归属判定 | 11 个包各只有 1 个 `package.json`、无子路径 bundle，零影响 |
| 插件兼容闸门 | 无 | peerDependencies 与当前 dsh 版本不匹配时整个 bundle 被 skip（启动期 `dsh: skipping profile bundle "…"`）；豁免写入 `$DSH_HOME/profiles/<name>/compatibility.json` | 见 § 七-5：**本仓库约定不声明 `peerDependencies`**（缺省即不过闸，最安全） |
| 会话日志格式 | `session.v3.jsonl.zstd`，`SESSION_FORMAT_VERSION = 3` | `session.v4.jsonl.zstd`，`SESSION_FORMAT_VERSION = 4`；事件表唯一新增 `developer/message`，SessionHeader 字段未变；旧日志**不就地迁移**（同目录并存 v3/v4） | 直接读磁盘日志的插件需要适配；本仓库 `usage-stats` 走 `ctx.sessionQuery`，由框架透明吸收，见 § 七-3 |

slot key 本身在 0.2.x 未改名：`settings.section`、`conversation.composer.dock`、`conversation.input.dock`、`conversation.session.header.actions` 均照旧可用。

## 三、启动日志里要看的四个关键字

| 关键字 | 含义 | 处理 |
| --- | --- | --- |
| `duplicate` | 路由冲突（`webserver: duplicate exact route`） | 必须处理：给冲突的一方加查重守卫，或禁用其中一方 |
| `skipping profile bundle` | 整个 bundle 被跳过（通常是 peer 不匹配或包解析不到） | 换兼容版本 / 装回依赖 / 禁用该 bundle |
| `disabling profile plugin row` | 单行被禁用（peer 不匹配等） | 同上，或对该精确版本显式豁免 |
| `did not activate` / `failed to import` | 条目导入或激活失败 | 看该条目的包是否与新版 API 匹配 |

## 四、路由守卫约定（本仓库硬规则）

`ctx.webServer.register` 在 DSH 0.1.5 与 0.2.x 上行为一致：**重复 `(kind, path)` 直接抛错**，而启动期的抛错会连带把本次启动打崩（历史案例：两个插件管理器抢同一条 `/api/plugin-manager/list`）。

因此本仓库所有注册 HTTP 路由的 host 半端**必须**先查表再注册：

```js
function routeTaken(ctx, route) {
  const table = route.kind === 'exact' ? ctx.webServer.exact : ctx.webServer.prefixes
  return table !== undefined && table !== null && typeof table.has === 'function' && table.has(route.path)
}

// 单条：命中就告警 + 跳过；批量：循环里 continue
if (routeTaken(ctx, route)) {
  ctx.logger.warn(`<plugin>: 路由 ${route.path} 已被其他插件注册，跳过注册以避免启动失败`)
  return () => {}
}
return ctx.webServer.register(route)
```

两条实现约定：

- 守卫所需的表结构不存在时（`ctx.webServer.exact` 缺失）**退回直接注册**——宁可重复报错，也不要静默不注册；
- 被跳过只影响那一条路由，其余路由照常注册；无冲突时注册结果与加守卫前逐字节等价。

## 五、第三方条目的常见处置

| 现象 | 处置 |
| --- | --- |
| peer 不匹配（`is incompatible with dsh <version>`） | 优先升级该包到兼容版本；不能升级就禁用该行；确实要用旧版再用 `dsh plugin allow-version` 显式豁免 |
| 包已弃用（npm `deprecated`） | 迁移到官方指定新包名后移除旧包 |
| 包解析不到（`cannot resolve profile bundle`） | 在 profile 目录重跑 `pnpm install --no-frozen-lockfile`，或检查该依赖是不是 `link:` 到了已移走的目录 |

## 六、升级验证（影子环境法）

不碰正在运行的生产实例，用一份独立 DSH_HOME + 独立端口验证：

```bat
:: 1) 影子 home：只复制 settings.yaml、profile 的 package.json / cordis.patch.yml / pnpm-workspace.yaml
:: 2) 影子 profile 里重装依赖（会按 package.json 的 link: 依赖重建链接）
cmd /c "cd /d <scratch-home>\profiles\web && pnpm install --no-frozen-lockfile"
:: 3) 用新版 CLI 起影子实例（另选端口，避免与生产实例抢端口）
node <new-dsh>\lib\bin.js web --port 3099 --no-open
:: 4) 打几条插件接口，确认 host 半端在新版下真的可用
curl "http://127.0.0.1:3099/api/<plugin>/..."
```

判据：进程起得来 + 日志无 § 三 的关键字 + 各插件接口返回 200。三项都过，再升级生产实例。

## 七、0.2.0-rc.2 实测结论（本轮升级逐条核验）

核验方式：把已安装的 `@deepseek-ai/dsh@0.2.0-rc.2` 源码（host 包在 `dsh/node_modules/@deepseek-ai/*`，客户端包同名 `dsh-client-ui-*`）与 `npm pack @deepseek-ai/<pkg>@0.1.5-rc.1` 解包出的旧版逐文件对照；不依赖 GitHub、不依赖 release notes。

1. **host / Cordis 契约：全部兼容。** `ctx.webServer`（`register({kind,path,handler})` + `exact`/`prefixes` Map + 重复注册抛错）与 0.1.5-rc.1 逐字节等价；`ctx.logger`、`ctx.agents`、`ctx.skills`、`ctx.sessions`、`ctx.tools`、`ctx.systemPrompt`、`ctx.timer`、`ctx.loader` 服务名与 `inject` 声明方式未变。已逐个确认：`ctx.tools.schemas(scope?)`、`ctx.systemPrompt.section(section)`、`agent/pre-step` payload `{agent, messages, turn, step, signal}`、`AgentHandle.agent`、`Agent.session/options` 均与旧版同名同形。
2. **客户端契约：唯一破坏点是 `dsh-ui-tweaks`。** `composer.dock` 的 dock 容器在 0.2.0-rc.2 变成"slot 出口 + `ContextMeter`"两个同级子节点（0.1.5-rc.1 里出口是唯一子节点，`ContextMeter` 位于 `trailing` 工具行）。因此：隐藏 `[data-slot="conversation.composer.dock"]` 不再等于隐藏整行；`dsh-ui-tweaks` 已改为同时隐藏该行的后继兄弟节点，并把镜像源查询收窄到出口子树内。其余全部未变：slot catalog 里 `settings.section` / `conversation.composer.dock` / `conversation.input.dock` / `conversation.session.header.actions` 四个 key 与 kind/scope 逐字不变（全 catalog 唯一删除项是没人用的 `settings.plugin.item`），`data-slot` 出口仍带 inline `display:contents`，`data-conversation-scroll` / `data-chat-flow-kind` / `data-composer-seat` / `_titleCluster` / `_composerSeat` 锚点仍在，`__ModuleLoader__.load({id, factory})` 信封、`require` 平台模块表（9 个种子词，含 `react` / `react/jsx-runtime`，React 18）、`priority: -1` 覆盖规则均未变。
3. **会话格式 v3 → v4：被框架透明吸收。** 新版写 `session.v4.jsonl.zstd`（`SESSION_FORMAT_VERSION = 4`）；事件表只新增 `developer/message`，`assistant/message.usage` / `request/header.config` / SessionHeader（`parentSession` / `delegationDepth` / `origin`）字段未变；旧 v3 文件**不就地迁移**（同目录并存）。`usage-stats` 通过 `ctx.sessionQuery.listSessions()/readSession()/traceSession()` 读取，不自己解 zstd，因此无需改代码。
4. **清单字段：`dsh.bundle.patch` 是硬必需**（缺失 → 整包 skip，日志 `declares no dsh.bundle in its package.json`）；`dsh.client.platform === "web"` 与 `exports["./client"]` 是浏览器半段的硬必需（缺失 → fiber FAILED）。`author` 与 `dsh.engines.dsh` 在 0.2.0-rc.2 **没有任何读取方**（后者是"声明式、尚无 reader"）。
5. **兼容闸门：只在声明了 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 `peerDependencies` 时才生效**，且 `includePrerelease: true`（`^0.2.0-rc.1` 能满足 `0.2.0-rc.2`）；缺省不声明 = 直接放行。**本仓库约定：11 个包都不声明 `peerDependencies`** —— 一旦声明，下一个 0.3.x 会立刻把插件 skip 掉，收益为零、风险为负。
6. **`cordis.patch.yml` 仍接受 `- id: X` + `disabled: true`**；`name:` 不是必需字段，而是"值不匹配就跳过该补丁"的一致性护栏（`patch: name mismatch`）。0.2.0-rc.2 里带 `name:` + `config:` 的行由内核 `@deepseek-ai/dsh-config-editor` 在设置页保存时热写；DSH 自身没有任何代码写这个文件（仅在文件不存在时写模板）。**本仓库写它的两个插件（`plugin-manager` / `mcp-manager`）给 `yaml.parseDocument` 补了 `customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (v) => v }]`**，与内核两处写入点（`@deepseek-ai/dsh-plugin-manager/lib/types/patch.js`、`@deepseek-ai/dsh-config-editor/lib/index.js`）一致。实测定性：**不传 customTags 不会失败**（`yaml` 2.9 对未知 `!!js` 标签只报 `TAG_RESOLVE_FAILED` 警告，`errors=0`；对真实 `dsh-base/cordis.patch.yml` 的解析、回写与改动后回写在两种模式下**逐字节相同**、`!!js` 完整保留）——补 `customTags` 是消除 16 条警告、与内核写入方语义对齐的**防御性一致性修复**，不是崩溃修复。
7. **CLI 增量**：顶层新增 `--dump-config-schema`；`dsh plugin` 新增 `allow-version` / `revoke-version` / `version-exemptions` 三个子命令（在转发给 pnpm 之前拦截），用法
   `dsh plugin --profile <p> allow-version <pkg>@<exact> --dsh-version <exact> --accept-risk`；`dsh web` 的应用参数（`--host` / `--port` / `--no-open` / `--trusted-host`）完全未变。
8. **本机 profile 的第三方条目**：`dsh-plugin-hub@0.1.8` 因 peer 声明 `^0.1.0-rc.6` 被新版闸门 **skip**（升级后要么升级该包、要么禁用该行、要么显式豁免）；`dshmarket@1.2.2` 与 `@linxin666/dsh-web-ui-all@0.2.7` 未声明 `@deepseek-ai/dsh*` peer，不受闸门影响。

## 八、离线契约自检

`tools/check-dsh-contract.cjs` 把"插件声明的 DSH 接口面"与**本机已安装的 DSH 源码**比对，不需要启动 DSH、不需要浏览器、不需要网络：

```bat
node tools/check-dsh-contract.cjs
node tools/check-dsh-contract.cjs --dsh "C:\path\to\node_modules\@deepseek-ai\dsh"
```

它检查四件事：① `lib/client-src`（或 `lib/client.js`）里 `slots.inject` / `slots.register` 的每个 slot key 与 `data-slot="…"` 选择器都存在于 DSH 的 slot catalog；② host 半段 `export const inject = [...]` 的每个服务名都能在已安装的 DSH 里找到服务定义；③ `package.json` 的 `dsh.bundle.patch` / `dsh.client.platform === "web"` / `exports["./client"]` / `lib/client.js` 齐备，且 bundle 以 `__ModuleLoader__.load` 信封收尾、`id` 与包名一致；④ 调 `ctx.webServer.register` 的插件必须带查重守卫（§ 四 硬规则）。

判据：退出码 0 且每个插件 `PASS`。它只覆盖**静态可判定**的部分——真实 DOM 行为、渲染结果、运行时数据仍需 § 九 的人工确认。

## 九、升级后手动 smoke test（浏览器）

登录运行中的实例后逐条确认（这些都是自动化覆盖不到的部分）：

1. **设置 → 管理**：三个 tab（插件 / Skill / MCP）都在；插件列表能列出全部条目（本机 200+ 条，首屏可能等十几秒）。
2. **`dsh-ui-tweaks` → 统计行位置**：切到"顶部"——顶部标题右侧出现统计 pill 镜像，且**底部 dock 行整行消失**（0.2.x 新增的上下文计量器也要一起消失）；切到"隐藏"同理；切回"底部"确认恢复、输入区高度无跳变。
3. **Skill 管理**：项目级分组能显示当前项目（修复后的 `latestSessionCwd` 依赖的会话 cwd 解析）；停用/启用任一 skill 后立即生效、无需重启。
4. **使用统计**：打开设置页"使用统计"，确认今日（升级当天）的 token 曲线非空；`汇总` 的会话数应包含升级后新建的会话（`/api/usage-stats/summary` 的 `errors` 应为空数组）。
5. **Git 面板**：打开 `dsh-git-hub` 抽屉，仓库列表能加载（本机扫描较慢，首次可能十几秒）；对任一仓库执行一次 commit 演练，确认无异常。
6. **更新检查**：设置页"更新检查"显示当前版本 `0.2.0-rc.2`，不再提示可升级（或提示正确的新版本）。
7. **浏览器控制台**：F12 打开 Console，刷新页面，确认没有本仓库插件的红色报错（静态常驻插件的客户端异常**不会**出现在 host 日志里，只有浏览器可见）。

## 十、相关

- 维护规范：[`maintainability.md`](./maintainability.md)
- 实现细节：[`implementation.md`](./implementation.md)
- 离线契约自检：[`../tools/check-dsh-contract.cjs`](../tools/check-dsh-contract.cjs)
