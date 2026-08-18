# 贡献指南

欢迎 fork / 提 PR。本仓库是一组面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 的常驻插件集合。

## 安装（在你自己的机器上）

每个插件是独立 npm 包，按 [`README.md`](./README.md) §安装 步骤：

1. 把插件目录放到本机任意位置，例如 `<your-dsh-plugins-dir>/<plugin-name>`
2. 编辑你的 web profile 的 `package.json`：
   - `dependencies` 加 `"dsh-<包名>": "file:<相对路径到上面目录>"`
   - `dsh.profile.bundles` 数组加 `"dsh-<包名>"`
3. 安装依赖（Windows 下 pnpm 脚本可能被策略拦截，走 cmd shim）：
   ```bat
   cmd /c "cd /d <your-profile-dir> && pnpm install --no-frozen-lockfile"
   ```
4. 重启 DSH

## 贡献一个插件

1. **先找现成轮子**：本仓库其他插件 / DSH 插件市场 / npm 上 `dsh-` 开头包是否已有？直接裁剪比从零写省力。
2. **插件骨架**：参考已有插件（如 `dsh-task-pool` 是最小 host/client 结构）。
3. **注册插件名册**：在自己插件 `cordis.patch.yml` 加 `id` 条目。
4. **测试**：host half 在 ESM 模块里**不要**用 `require('node:fs')`——DSH 启动时检测不到错，bug 会静默触发（参考 `DECISIONS.md` E007 决策）。
5. **推送**：fork 后提 PR，按你团队流程。

## 署名

仓库作者 MeganeOnly。贡献者在 PR 里加 `Co-authored-by:` 行即可共同署名。

## 技术栈

- 宿主半段：Cordis 插件（Node ESM）
- 浏览器半段：`window.__ModuleLoader__.load({ id, factory })` bundle，可手写无需构建工具
- HTTP 路由：`ctx.webServer.register({ kind: 'exact', path, handler })`
- 持久化：临时文件 + rename 原子写（避免锁文件）

## 许可证

贡献即同意以 [MIT](LICENSE) 许可证发布你的代码。