# dsh-git-hub

DeepSeek Harness (DSH) web profile 的常驻插件：在界面右侧提供一个本地 git 仓库管理面板。

## 功能

- **仓库总览**：扫描配置的根目录，列出其中所有 git 仓库；每个仓库卡片显示分支、工作区是否干净、未推送 commit 数、当日 commit 数与最新 commit 摘要。
- **一键推送**：单个仓库或批量推送，通过外部推送脚本以独立子进程执行，面板按需轮询推送状态（空闲时不发起网络请求）。
- **推到对话**：把仓库摘要作为一条用户消息注入当前会话，便于在对话中借助 GitHub 相关工具继续处理远端事务。
- **钉住与隐藏**：常用仓库置顶，无需关注的仓库从列表中隐藏；隐藏的仓库不允许推送。
- **配置面板**：在抽屉内编辑扫描根路径列表，保存后自动重扫。

界面入口为右侧悬浮按钮（FAB）+ 右侧抽屉，不遮挡对话区；与同类抽屉面板互斥显示。

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
