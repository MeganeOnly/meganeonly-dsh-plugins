# dsh-git-hub

DeepSeek Harness (DSH) web profile 的常驻插件：在界面右侧提供一个本地 git 仓库管理面板。

## 功能

- **仓库总览**：扫描配置的根目录，列出其中所有 git 仓库；每个仓库卡片显示分支、工作区是否干净、未推送 commit 数、当日 commit 数与最新 commit 摘要。
- **一键推送**：单个仓库或批量推送，通过外部推送脚本以独立子进程执行，面板按需轮询推送状态（空闲时不发起网络请求）。
- **推到对话**：把仓库摘要作为一条用户消息注入当前会话，便于在对话中借助 GitHub 相关工具继续处理远端事务。
- **钉住与隐藏**：常用仓库置顶，无需关注的仓库从列表中隐藏；隐藏的仓库不允许推送。
- **配置面板**：在抽屉内编辑扫描根路径列表，保存后自动重扫。

界面入口为右侧悬浮按钮（FAB）+ 右侧抽屉，不遮挡对话区；与同类抽屉面板互斥显示。

## 配置

插件不在源码里写死任何机器相关路径。扫描根与推送脚本路径都按 **配置文件 > 环境变量 > 未配置** 的顺序解析，两级都没有时退化为空（面板显示"没有仓库"、推送按钮禁用并在 tooltip 说明原因），不会替你猜一个盘符。

| 配置项 | 配置文件字段 | 环境变量 | 未配置时 |
| --- | --- | --- | --- |
| 扫描根目录列表 | `scanRoots`（字符串数组，面板「配置扫描根路径」保存） | `DSH_GIT_HUB_SCAN_ROOTS`（逗号或分号分隔） | 面板显示"没有仓库" |
| 推送脚本路径 | `pushTool`（绝对路径，手写该文件） | `DSH_GIT_HUB_PUSH_TOOL` | 推送按钮禁用 |

配置文件是 web profile 根目录下的 `.git-hub-config.json`（原子写：临时文件 + rename）：

```json
{
  "scanRoots": ["D:\\work", "E:\\"],
  "pushTool": "<到推送脚本的绝对路径>"
}
```

- 面板保存只提交 `scanRoots`，手写的 `pushTool` 会被原样保留；把 `pushTool` 设为空串即清除该字段、回落到环境变量。
- 推送脚本按 `node <pushTool> --all --yes`（全部）与 `node <pushTool> --repo <路径> --yes`（单仓库）调用——任何接受这两个参数的脚本都能接上，不必是某个特定实现。
- 路径写法与扫描根同样做规范化（`/` → `\`、盘符根补尾 `\`），`D:` 与 `D:\` 等价。
- 配置文件在每次请求时读取，改完**无需重启 DSH**；环境变量在进程启动时读取，改动需重启。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-git-hub": "file:<到仓库的相对路径>/dsh-git-hub"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-git-hub": "^0.2.1"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-git-hub"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段注册 `/api/git-hub/*` HTTP 路由（仓库扫描、状态读取、推送触发、配置读写），**修改后需重启 DSH** 才会生效。
- 浏览器半段负责 FAB、抽屉与仓库列表渲染，**刷新页面**即可加载最新版本。
- 面板状态（钉住 / 隐藏列表）保存在浏览器 `localStorage`；扫描根路径配置以原子写方式保存在 web profile 根目录下的 `.git-hub-config.json`。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: git-hub
  disabled: true
```

## 许可证

[MIT](./LICENSE)

## 开发

- 浏览器 half 的源码按职责拆分为 `lib/client-src/*.js`（见 `docs/maintainability.md`），构建脚本 `lib/build-client.cjs` 将其按序拼接回 `lib/client.js`。编辑源后跑 `npm run build:client` 同时提交 `client.js`，DSH 加载契约不变。
- 宿主 half 改动后**需重启 DSH**；浏览器 half 改动**只需刷新页面**（`dsh-client-modules` 路由读文件时 `cache-control: no-cache`，无需复制到 `node_modules` 副本）。
