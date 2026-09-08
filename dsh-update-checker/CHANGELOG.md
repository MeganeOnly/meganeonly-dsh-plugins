# Changelog

本文件记录 `dsh-update-checker` 的重要变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

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
