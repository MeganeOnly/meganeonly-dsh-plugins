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
| 重复 HTTP 路由 | `ctx.webServer.register` 对重复 `(kind, path)` 直接 `throw` | 同左，且启动期冲突会连带打崩本次启动 | 任何注册路由的 host 半端都必须"注册前查重"，见 § 四 |
| 输入区统计扩展 | `conversation.composer.dock` 单条目 `id: "stats"`（`StatsPills`） | 0.2.1-alpha.1 起拆成 `id: "activity"`（order 0）+ `id: "usage"`（order 1）两条目 | 锚在该 slot 上做 DOM 变换的客户端 tweak 需同时兼容"单条目 / 双条目"两种结构 |
| invariant 运行时插件 | 各包提供 `./invariant` 导出 | 0.2.1-alpha.1 起移除该插件与全部 `./invariant` 导出 | 直接 import 它的插件会被 skip，需改用普通 `apply` 内的断言 |
| 子路径插件元数据 | 子路径下可放独立 `package.json` 提供显示文本 / 图标 | 0.2.1-alpha.1 起不再读取，必须走对应子路径导出 | 一个包注册多个插件（子路径 bundle）的包需要补 `exports` |
| 插件兼容闸门 | 无 | peerDependencies 与当前 dsh 版本不匹配时，整个 bundle 被 skip 或该行被 disable，日志给出原因与 `dsh plugin allow-version` 豁免入口 | 升级后先读日志，再决定"换版本 / 禁用 / 显式豁免" |

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

## 七、相关

- 维护规范：[`maintainability.md`](./maintainability.md)
- 实现细节：[`implementation.md`](./implementation.md)
