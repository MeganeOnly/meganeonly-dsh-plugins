# Changelog

本文件记录 `dsh-update-checker` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.7] - 2026-10-03

### 兼容性

- 已对照 DSH 0.2.0-rc.2 实际安装源码（`@deepseek-ai/dsh` 及同目录下的 `@deepseek-ai/*` 依赖包）核验，本插件无功能代码变更：
  - **版本探测仍可解析**：`dsh --version` 仍输出单行裸版本号（实测 `0.2.0-rc.2`，退出码 0），`readLocalVersion()` 的"取首行并去空白"解析路径不变；`execFile('dsh', ['--version'])`（Windows 上以 `shell: true` 经 `cmd.exe` 解析 `dsh.cmd` shim）的调用方式不变。
  - **路由契约未变**：`ctx.webServer.register({ kind, path, handler })` 签名与 `exact` Map 形态未变，三条 `/api/dsh-update/*` 路由的注册前查重守卫继续成立；`GET /api/dsh-update/status` 实测 200（`current` 与 `latest` 均为 `0.2.0-rc.2`，`hasUpdate: false`），`GET /api/dsh-update/check` 实测 405 `method-not-allowed`——`check` / `update` 仅接受 POST，405 是方法守卫的预期行为而非路由缺失。
  - **npm 路径未变**：`POST /api/dsh-update/check` 实测 200，registry 查询（`https://registry.npmjs.org/@deepseek-ai/dsh/latest`）与升级命令 `npm install -g @deepseek-ai/dsh@latest` 都与 DSH 内核 API 解耦；0.2.x 新增的 `dsh plugin allow-version` / `revoke-version` / `version-exemptions` 子命令只作用于 profile 内插件的兼容闸门，与本插件的 npm 全局升级路径无关。
  - **客户端契约未变**：`ctx.slots.inject("settings.section", …)` 的 slot key 仍在 0.2.0-rc.2 的 slot catalog 中（90 个 key），catalog 里唯一被删除的 `settings.plugin.item` 本插件未使用；`__ModuleLoader__.load({ id, factory })` 信封、`react` 平台模块表、React 18 均未变。
- **README 口径复核**：README 未描述 `dsh` CLI 的子命令结构，与 0.2.x 的实际情况无冲突（`dsh web` 的应用参数 `--host` / `--port` / `--no-open` / `--trusted-host` 完全未变，仅由位置参数改写实现），逐条复核后无需改动措辞。

### 改动文件

- `CHANGELOG.md`（本段）
- `package.json`（version 0.1.6 → 0.1.7）

### 验证

- `node tools/check-dsh-contract.cjs`：`PASS  dsh-update-checker`

## [Unreleased]

### 兼容性

- 已对照 DSH v0.1.5-rc.1 源码（`deepseek-ai/deepseek-harness@dsh-v0.1.5-rc.1`，SHA `183f08e9c6dde7e36cd2318eaee70b0da08fb35e`）的破坏性变更清单做兼容性核对，本插件无代码变更：
  - 仅使用 `ctx.slots.inject("settings.section", ...)` 注册设置页入口，该 slot key 在 v0.1.5-rc.1 源码中**未重命名**（§ 三-5 重命名清单仅涉及 `conversation.*` 系列）。
  - npm registry 接口 + `npm install -g @deepseek-ai/dsh@latest` 升级流程与 DSH 内核 API 解耦——`§ 三` 全部 14 项清单均不命中。
- 行为零变化——升级 DSH 内核至 v0.1.5-rc.1 不需改本插件任何代码。
- 注：v0.1.5-rc.1 是 release candidate，发布到正式版前本插件可能再发一版跟踪版本切换。

### 加固

- **HTTP 路由注册前查重（防启动崩溃）**：`/api/dsh-update/status`、`/api/dsh-update/check`、`/api/dsh-update/update` 三条路由改为统一经本地 `registerRoute()` 注册——先查 `ctx.webServer.exact`，路径已被其他插件占用时告警并跳过该条，不再让 `ctx.webServer.register()` 抛 `duplicate exact route`。DSH 的 webServer 对重复 `(kind, path)` 直接 throw，一次冲突会连带把本次启动打崩。守卫所需的表结构不存在时退回直接注册，不静默失效。
- 行为变化只发生在"路径被占用"这条异常路径上：无冲突时注册的路由数量与之前完全一致。

### 改动文件

- `CHANGELOG.md`（本段）
- `lib/index.js`（新增 `registerRoute()` 守卫 + 3 处调用点）
- `package.json`（version 0.1.5 → 0.1.6）

## [0.1.4] - 2026-09-05

### 变更

- 注释精简：删除 1-3 行冗余 inline 注释（`// 更新进行中：轮询直到结束` 等）；保留 section mini-marker / banner / 关键 WHY。

## [0.1.3] - 2026-09-04

### 新增

- **dsh 命令 shim 自动保护**：升级前快照 `dsh.cmd` 路径与内容 sha256；升级后若发现 shim 丢失（Windows 上 npm 全局安装"删旧包 → 解包新包 → 生成新 shim"三步之间的窗口期被打断的典型表现），自动重跑 `npm install -g @deepseek-ai/dsh@latest` 最多 2 次（连同主调用合计 1 + 2 次尝试）。
- **分级提示**：升级完成后根据 shim 校验结果显示三类提示——`完整 / 已自动恢复 / 丢失需手动修复`，对应不同的样式（绿 / 黄警告 / 红警告）。

### 修复

- **UI 偶尔"只留下字"的裸态**：DSH 默认启用 client bundle HMR 轮询（500ms stat-poll，`dsh-client-hmr`）；当 `dsh-update-checker` 自身或相邻文件的 mtime 因编辑 / AV 扫描等抖动时，HMR 链路会按 `data-plugin` 属性移除本插件注入的 `<style>`。移除瞬间到下次 React 渲染之间出现一个窗口——表现为更新栏目只剩纯文本、卡片 / 按钮 / 边框全没。修法：把 `injectCss()` 放进 `UpdatePage` 的 `useLayoutEffect`，在浏览器绘制前同步重新注入；`apply()` 中的首调保留作为兜底，双重保证。

### 变更

- 设置页升级过程中显示全屏遮罩 + "请勿关闭 DSH 或浏览器"提示，避免用户在 npm 解包窗口期关闭页面导致 shim 半完成状态。
- 升级完成提示更明确：自动恢复时附加 "dsh shim 曾被中断，已自动重试 N 次恢复"；失败时附加 "dsh shim 升级后丢失，请手动执行 `npm install -g @deepseek-ai/dsh` 修复"。

### 兼容性

- DSH 0.1.2-rc.1 实测：`/api/dsh-update/*` 路由在浏览器 cookie 鉴权下正常返回；DSH 0.1.2 的"一次性 token 鉴权"是连接层特性，对 host 端 `ctx.webServer.register` 路径注册无影响。

## [0.1.1] - 2026-08-19

作为独立 npm 包发布的初始版本，包含以下已有功能。

### 新增

- 设置页新增"更新"栏目，排序靠前，显示当前安装版本、npm 上的最新版本与是否有可用更新。
- 完整的 semver 比较：除主版本 / 次版本 / 修订号外，同时比较预发布段（如 `-rc.N`、`-alpha.N`、`-beta.N`）——正式版高于预发布版，数字标识符按数值比较，字符串标识符按字典序比较，数字标识符低于字符串标识符。
- 一键升级：二次确认并展示目标版本后，执行 `npm install -g @deepseek-ai/dsh@latest`。
- 升级完成后不自动重启，界面提示需重启 DSH 才会实际生效。
- 宿主半段通过 HTTP 路由向前端暴露版本查询与升级执行能力。
