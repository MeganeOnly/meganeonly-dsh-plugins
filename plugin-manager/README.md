# dsh-plugin-manager

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页集中查看与启停其他常驻插件。

## 功能

- **插件清单**：列出 profile 中所有非系统常驻插件，显示名称、版本、描述与作者署名，支持搜索与按状态分组（启用中 / 暂停中 / 预设组件（.mjs）/ 系统插件）。
- **预设组件分组**：agent 预设组合（如梁神模式）里的相对路径 `.mjs` 行（`./tool-bootstrap.mjs`、`./custom-bash.mjs` 等）归入独立的"预设组件（.mjs）"分组，带"预设"徽标，随会话所选预设自动加载/卸载，不可在此启停。
- **一键启停**：写入 web profile 的 `cordis.patch.yml`，通过按 id 定向覆盖实现；解析时保留原有注释，采用临时文件 + 重命名的原子写。
- **系统插件保护**：`@deepseek-ai/*` 前缀的系统插件在列表中置底且不可在此启停，避免误关基础能力。

> 与 [dsh-manager-hub](../dsh-manager-hub) 的关系：本插件的设置页条目在 hub（id=`manager-hub`）在场时自动隐藏，由 hub 的"插件"tab 聚合展示；停用 hub 后本页自动恢复为兜底入口。宿主 API（`/api/plugin-manager/*`）始终独立运行。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-plugin-manager": "file:<到仓库的相对路径>/plugin-manager"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-plugin-manager": "^0.2.0"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-plugin-manager"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段读取插件名册并读写 `cordis.patch.yml`，**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染设置页的"插件管理"页面，**刷新页面**即可加载最新版本。
- 通过本插件启停其他插件后通常会触发热重载；个别插件（例如注册 HTTP 路由或挂载事件钩子的宿主半段）仍需重启 DSH 才能完全生效。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: plugin-manager
  disabled: true
```

## 许可证

[MIT](./LICENSE)
