# dsh-usage-stats

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页汇总展示跨会话的 token 用量统计。

## 功能

- **总量卡片**：输入、输出、推理、缓存读取 token 数，以及请求数与生成速度。
- **趋势与分解**：近 30 天用量柱状图、按模型分解表、会话用量排行、工具调用排行。
- **精确数据源**：token 数取自会话日志中助手消息的 `usage` 字段，为模型侧返回的精确值而非估算。
- **显示设置**：页面右上角「显示」按钮可独立隐藏/展示 6 个数据块（元信息、指标卡、图表、按模型表、会话 Top、工具 Top），支持「全选 / 全不选」快捷按钮，偏好持久化到 `localStorage`。
- **增量缓存**：按 `(size, mtimeMs)` 记录每个会话文件的解析结果并以原子写方式落盘，未变更的文件不重复解析；全量首次解析约数秒，之后开销接近于零。宿主半段启动时预热一次。

## 安装

插件既可以从本仓库子目录安装，也可以作为独立 npm 包安装。

**从 monorepo 子目录安装**

克隆仓库后，在 DSH web profile 的 `package.json` 中以 `file:` 协议引用该子目录：

```json
{
  "dependencies": {
    "dsh-usage-stats": "file:<到仓库的相对路径>/usage-stats"
  }
}
```

**从 npm 包安装**

```json
{
  "dependencies": {
    "dsh-usage-stats": "^0.1.1"
  }
}
```

## 启用

在同一份 profile `package.json` 的 `dsh.profile.bundles` 数组中加入包名：

```json
{
  "dsh": {
    "profile": {
      "bundles": ["dsh-usage-stats"]
    }
  }
}
```

随后在 profile 目录安装依赖：

```bash
pnpm install --no-frozen-lockfile
```

## 运行与生效

- 宿主半段解析 `~/.dsh/sessions` 下的会话日志（zstd 压缩、多帧拼接的 `session.jsonl.zstd`）并注册 `/api/usage-stats/summary` 聚合路由，**修改后需重启 DSH** 才会生效。解压使用 Node 内置模块，无额外运行时依赖。
- 浏览器半段渲染设置页的"使用统计"页面，**刷新页面**即可加载最新版本。
- 解析缓存保存在 web profile 目录下的 `.usage-stats-cache.json`；删除该文件会触发下一次全量重新解析。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: usage-stats
  disabled: true
```

## 许可证

[MIT](./LICENSE)
