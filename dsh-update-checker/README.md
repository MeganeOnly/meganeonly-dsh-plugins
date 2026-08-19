# dsh-update-checker

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页显示 DSH 本体（`@deepseek-ai/dsh`）的版本状态并提供一键升级。

## 功能

- **版本对照**：显示当前安装版本、npm 上的最新版本，以及是否有可用更新。
- **完整 semver 比较**：不仅比较主版本 / 次版本 / 修订号，也比较预发布段（如 `-rc.N`、`-alpha.N`、`-beta.N`）；遵循 semver 规范——正式版高于预发布版，数字标识符按数值比较，字符串标识符按字典序比较，数字标识符低于字符串标识符。
- **一键升级**：二次确认后执行 `npm install -g @deepseek-ai/dsh@latest`。
- **升级后提示**：升级完成不会自动重启，界面提示重启 DSH 后新版本才会实际生效。

设置页中的"更新"栏目排序靠前，便于快速查看。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-update-checker": "file:<到仓库的相对路径>/dsh-update-checker"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-update-checker": "^0.1.1"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-update-checker"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段读取本地版本、查询 npm 最新版本并执行升级命令，通过 HTTP 路由暴露给前端；**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染设置页的"更新"栏目，**刷新页面**即可加载最新版本。
- 版本查询需要可访问的 npm registry；网络不可达时界面显示查询失败，不影响其他功能。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: update-checker
  disabled: true
```

## 许可证

[MIT](./LICENSE)
