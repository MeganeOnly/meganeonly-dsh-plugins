# dsh-mcp-manager

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页集中查看与启停 MCP（Model Context Protocol）服务器。

## 功能

- **服务器清单**：列出 profile 中配置的所有 MCP 服务器，支持搜索与按启用状态分组。
- **连接状态**：读取运行时状态区分"已连接 / 连接失败 / 已停用"；工具清单按 `mcp__<serverName>__` 前缀从已注册工具中筛选。
- **摘要信息**：显示端点与凭据摘要。`Authorization` 等请求头值与环境变量值只在宿主进程内读取，发送到浏览器前一律打码，凭据明文不出宿主。
- **一键启停**：写入 web profile 的 `cordis.patch.yml`（保留原有注释，采用临时文件 + 重命名的原子写）。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-mcp-manager": "file:<到仓库的相对路径>/mcp-manager"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-mcp-manager": "^0.1.0"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-mcp-manager"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段读取 MCP 运行状态并读写 `cordis.patch.yml`，**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染设置页的"MCP 管理"页面，**刷新页面**即可加载最新版本。
- **启停操作需重启 DSH 后生效**，界面会为待生效条目显示"待重启"标记；启停的真实来源是 patch 文件而非运行时状态，因此在重启前不会中断已建立的连接。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: mcp-manager
  disabled: true
```

## 许可证

[MIT](./LICENSE)
