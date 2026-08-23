# dsh-manager-hub

DeepSeek Harness (DSH) web profile 的常驻插件：把设置页里的 **插件管理 / Skill 管理 / MCP 管理** 三个独立管理页聚合成**一个**入口，顶部 tab 切换（插件默认）。

本插件**只做 UI 聚合**：数据源与启停逻辑仍由三个老插件各自的宿主半端提供，本插件不重复任何宿主逻辑。

## 功能

- **唯一入口**：设置页只显示一个"管理"入口，替代原来的三个独立管理页，减少设置页选项。
- **顶部 tab**：插件（默认）/ Skill / MCP，点击切换对应管理视图。
- **独立数据源**：三个 tab 分别调用 `/api/plugin-manager`、`/api/skill-manager`、`/api/mcp-manager`，即三个老插件的宿主 API。
- **条件显示**：tab 按服务可用性显示——某管理插件被停用时（其 API 返回 404），对应 tab 自动隐藏，其余 tab 不受影响；重新启用后刷新页面即恢复显示。
- **兜底恢复**：本插件被停用时，三个老插件的设置页条目自动恢复为兜底入口，管理能力不丢失。

## 与三个老插件的关系

- 三个老插件（`plugin-manager` / `skill-manager` / `mcp-manager`）**必须保持启用**——它们提供本插件三个 tab 的数据源。
- 三个老插件的设置页条目在本插件（settings.section id=`manager-hub`）存在时自动隐藏、缺席时自动恢复（由那三个插件的客户端监听 settings.section 注册变更实现）。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-manager-hub": "file:<到仓库的相对路径>/dsh-manager-hub"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-manager-hub": "^0.1.0"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-manager-hub"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 首次安装需**重启 DSH**（新 bundle 注册进名册）。
- 之后浏览器半段的改动**刷新页面**即可生效。
- 三个老插件的设置页条目在本插件启用后自动隐藏；停用本插件并重启后自动恢复。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: manager-hub
  disabled: true
```

## 许可证

[MIT](./LICENSE)
