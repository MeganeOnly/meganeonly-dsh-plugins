# dsh-plugins — DeepSeek Harness 常驻插件集

[![license](https://img.shields.io/badge/license-MIT-brightgreen)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22-blue)](https://nodejs.org)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-web%20profile-blueviolet)](https://github.com/deepseek-ai/dsh)

> 一组面向 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) web profile 的**常驻插件**——从界面工具、用量统计到高峰省费，装完即用。

每个插件遵循同一套结构：**宿主半段**（Cordis 插件）+ **浏览器半段**（`__ModuleLoader__` bundle），可手写、无需构建工具。已发布到 npm 的插件用 DSH 自带命令一行安装；尚未发布的插件可直接从本仓库子目录安装。

## 插件一览

| 插件 | npm 包 | 一句话说明 |
| --- | --- | --- |
| [dsh-plugins-all](dsh-plugins-all/README.md) | `dsh-plugins-all`（未发布） | **名册聚合包**：一份 patch 把下表其余插件的名册行一次插入，profile 只登记一个 bundle |
| [dsh-manager-hub](dsh-manager-hub/README.md) | `dsh-manager-hub`（未发布） | 设置页统一「管理」入口：聚合插件 / Skill / MCP 三个管理页，tab 切换 |
| [plugin-manager](plugin-manager/README.md) | `dsh-plugin-manager`（已发布） | 插件管理：列出所有非系统常驻插件，一键启用 / 暂停 |
| [skill-manager](skill-manager/README.md) | `dsh-skill-manager`（已发布） | Skill 管理：用户级 skill 一键启用 / 停用，即时生效 |
| [mcp-manager](mcp-manager/README.md) | `dsh-mcp-manager`（已发布） | MCP 管理：服务器连接状态 + 工具清单，一键启用 / 停用 |
| [peak-hour-lock](peak-hour-lock/README.md) | `dsh-peak-hour-lock`（未发布） | 北京时间高峰时段拦截发送，消息暂存、结束后自动补发，省模型费用 |
| [usage-stats](usage-stats/README.md) | `dsh-usage-stats`（已发布） | 跨会话 token 用量统计：按日趋势 / 按模型分解 / 会话与工具排行 |
| [dsh-update-checker](dsh-update-checker/README.md) | `dsh-update-checker`（已发布） | 更新检查：当前版本 vs npm latest，完整 semver 对比，一键升级 |
| [dsh-task-pool](dsh-task-pool/README.md) | `dsh-task-pool`（未发布） | 任务池：右侧抽屉本地收集想法（零 token），卡片可发到当前对话 |
| [dsh-git-hub](dsh-git-hub/README.md) | `dsh-git-hub`（未发布） | Git/GitHub 管理面板：扫描本地仓库，一键推送 / 推到对话 |
| [dsh-ui-tweaks](dsh-ui-tweaks/README.md) | `dsh-ui-tweaks`（已发布） | 外观微调合集：对话列右缩让位、简洁模式等 |

另有面向插件开发者的最小管道健康检查器 [dsh-test](dsh-test/README.md)，以及配套的 skill 集 [meganeonly-dsh-skills](meganeonly-dsh-skills/README.md)（Anki 卡片生产流水线，姊妹仓库）。

表首的 `dsh-plugins-all` 不是功能插件——它把其余插件的名册行收口到一份 patch 里。全量使用本仓库插件时走它最省事，单个插件按需装也仍然可以。

## 快速开始

### 从 npm 安装（推荐，限已发布插件）

上表标「已发布」的插件均可用 DSH 自带命令一行安装，例如：

```sh
dsh plugin --profile web add dsh-ui-tweaks
dsh web
```

标「未发布」的插件见下一节。

### 从本仓库安装（本地开发 / 未发布插件）

1. 把插件目录放到本机任意位置，例如 `<your-dsh-plugins-dir>/<plugin-name>`；
2. 编辑你的 web profile 的 `package.json`：
   - `dependencies` 加一行：`"dsh-<包名>": "file:<相对路径到上面目录>"`
   - `dsh.profile.bundles` 数组加入：`"dsh-<包名>"`
3. 安装依赖（Windows 下若 pnpm 脚本被策略拦截，走 cmd shim）：

   ```bat
   cmd /c "cd /d <your-profile-dir> && pnpm install --no-frozen-lockfile"
   ```

4. **重启 DSH** 使宿主半段与插件名册生效；浏览器 bundle 的改动刷新页面即可生效。

### 一次装上全部（聚合包）

若要用齐本仓库插件，不必逐个往 `dsh.profile.bundles` 里加名字——只登记 `dsh-plugins-all` 一个 bundle，由它把其余插件的名册行一次插入：

1. 把 `dsh-plugins-all` 与要用的插件目录都放到本机任意位置；
2. 编辑 web profile 的 `package.json`：
   - `dependencies` 里放 `dsh-plugins-all` 与**各成员包**（成员包仍必须是 profile 的依赖，聚合包只负责报名，不负责安装）；
   - `dsh.profile.bundles` 只加 `"dsh-plugins-all"`，**成员包不要再列进去**——同一个包在名册里出现两次会让它的 client bundle 重复注册，浏览器端直接报 `duplicate factory registration`；
3. `pnpm install --no-frozen-lockfile` + 重启 DSH。

成员的单插件启停照旧在 profile 的 `cordis.patch.yml` 里按行 id 写 `disabled: true`。增删收录成员改 `dsh-plugins-all/aggregate.json` 后跑 `npm run build:patch` 重新生成。详见 [dsh-plugins-all/README.md](dsh-plugins-all/README.md)。

## 配置与管理

安装后可到 **设置 → 管理**（dsh-manager-hub）统一查看与启停插件 / Skill / MCP。三个独立管理页（插件管理 / Skill 管理 / MCP 管理）在 hub 在场时自动隐藏；**停用 hub 后它们自动恢复**，管理能力不丢失。

## 开发

- **结构**：宿主半段（Cordis 插件）+ 浏览器半段（`window.__ModuleLoader__.load({ id, factory })` bundle，可手写无需构建）；
- **渲染器覆盖**：覆盖官方同 key 渲染器须显式 `priority: -1`（最小 priority 成为 shadow winner），否则与官方 priority 0 冲突抛错；
- **HTTP 路由**：宿主端用 `ctx.webServer.register({ kind: 'exact', path, handler })`；
- **名册聚合**：`dsh-plugins-all/cordis.patch.yml` 是**生成文件**——`aggregate.json` 加各成员自己的 `cordis.patch.yml` 经 `scripts/aggregate.cjs` 投影而来；增删成员后跑 `npm run build:patch`（`npm run verify:patch` 只校验不写盘），生成结果与源一起提交；
- 各插件的实现细节见 [docs/implementation.md](docs/implementation.md)；
- 维护规范见 [docs/maintainability.md](docs/maintainability.md)，协作流程见 [CONTRIBUTING.md](CONTRIBUTING.md)；
- 升级 DSH 本体前的预检清单、升级后逐条核验结论与手动 smoke test 见 [docs/dsh-upgrade-precheck.md](docs/dsh-upgrade-precheck.md)；
- **离线契约自检**：`node tools/check-dsh-contract.cjs` —— 把各插件声明的 slot key / `inject` 服务名 / 包清单字段 / 路由守卫与**本机已安装的 DSH 源码**比对，不需要启动 DSH、不需要浏览器；换 DSH 版本后先跑它（详见预检清单 § 八）。

## 发布

每个子目录都是**可独立安装 / 发布**的 npm 包，与本仓库其余插件相互独立：

- **版本号**：以各插件目录下的 `package.json` 为准（npm 仅看 `package.json#version`）；
- **变更记录**：每个插件目录维护各自的 `CHANGELOG.md`，互不耦合；
- **发布材料**：`files` 数组已包含 `lib/`、`cordis.patch.yml`、`README.md`、`CHANGELOG.md`、`LICENSE`、`package.json`，`npm pack` 打出的 tarball 自带完整材料。

`dsh-plugins-all` 的 tarball 里只有生成好的 `cordis.patch.yml`（生成器与清单不入包），因此它可以独立发布；但它的名册行指向的是**成员包的包名**，成员包没发到 npm 时，装它的人解析不到那些包。发布顺序：先发成员包，再发聚合包。

仓库保持 **monorepo** 结构（一个 git 仓库存放所有插件源代码、统一 review），每个子包走独立版本号、独立 `CHANGELOG.md`、独立发布节奏，可单独 `npm install`、单独 `npm publish`，互不影响。

### 本地试打包

```bash
cd <插件目录>
npm pack --dry-run
```

### 发布到 npm

```bash
cd <插件目录>
npm publish
```

unscoped 包（如 `dsh-plugin-manager`）默认就是公开的，无需 `--access public`；仅当发布 **scoped 包**（包名以 `@scope/` 开头）时才需显式 `--access public`（scoped 包默认私有）。

## 许可证

[MIT](LICENSE)
