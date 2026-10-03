# dsh-usage-stats

DeepSeek Harness (DSH) web profile 的常驻插件：在设置页汇总展示跨会话的 token 用量统计。

## 功能

- **总量卡片**：输入、输出、推理、缓存读取 token 数，以及请求数与生成速度。
- **多粒度趋势**（v0.3.0 新增）：用量柱状图支持按**分钟（最近 24h）/ 小时（最近 7d）/ 日（最近 30d）/ 周（全部，按 ISO 周一折叠）**切换粒度；柱宽自适应 + 分钟模式横向滚动。
- **子代理归并**（v0.3.0 新增）：subagent 的 token 沿 DSH SessionHeader 的 `parentSession` 链 rollup 到 root main session，counts 只算 main session，token 全部归属 owner。
- **趋势与分解**：按模型分解表、会话用量排行、工具调用排行。
- **贡献热力图**（v0.2.2 新增）：GitHub 风格 53 周 × 7 日方格日历，多级颜色按 token 量分级，可选模型筛选，悬停查看当日明细。
- **精确数据源**：token 数取自会话日志中助手消息的 `usage` 字段，为模型侧返回的精确值而非估算。
- **显示设置**：页面右上角「显示」按钮可独立隐藏/展示 7 个数据块（元信息、指标卡、柱状图、热力图、按模型表、会话 Top、工具 Top），支持「全选 / 全不选」快捷按钮，偏好持久化到 `localStorage`。
- **扫描状态行**（v0.5.0 新增）：页面标题下方显示后台重算进度（含进度条）、旧缓存占位提示、数据截至时间与失败会话数；扫描进行中客户端自动每 2 秒追平一次。

## 增量账本（v0.5.0）

- **每会话一条记录**：`<web profile 根>/.usage-stats/sessions/<id>.json`，记录水位（已消费字节 + 已折叠 seq）与前缀锚。会话日志追加内容后**只读新增字节、只解新增 zstd 帧**，不再整文件重解码。
- **失效键是文件修订令牌**（`dev:ino:size:mtimeNs:ctimeNs`）+ 日志世代号。v0.4.x 用 `header.createdAt` 判命中，而该字段永不变化，导致活跃会话被永久冻结（这正是"今天用了很多但面板显示 0"的根因）。
- **请求永不阻塞**：`/api/usage-stats/summary` 立即返回"已发布快照"，扫描在后台单飞推进；首次安装或全量重算时界面先出旧数据/空图并显示进度，而不是卡住几十秒。
- **保留量有界**：分钟级桶保留 48 小时、小时级桶保留 15 天、日级永久 —— 桶表不再无界增长（v0.4.x 的缓存文件 4.14 MB 且持续变大）。
- **旧缓存只读迁移**：v0.4.x 的 `.usage-stats-cache.json` 仅用于首屏占位显示，**不写入新库**；全量重算成功后才改名为 `.usage-stats-cache.json.legacy-<时间戳>`（原件保留，可回滚到 v0.4.x）。

架构细节（数据通路、记录 schema、水位与锚契约、保留量、诊断字段）见 [`docs/architecture.md`](./docs/architecture.md)。

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
    "dsh-usage-stats": "^0.4.0"
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

- 宿主半段在 web profile 根下维护 `.usage-stats/`（每会话一条记录）；会话日志的发现与读取由插件自己完成（框架 `sessionPersistence.listGenerations()` 优先，自走查兜底，最后才回退 `sessionQuery.listSessions()`）。注册 `/api/usage-stats/summary` 聚合路由，**修改后需重启 DSH** 才会生效。
- 浏览器半段渲染设置页的"使用统计"页面，**刷新页面**即可加载最新版本。
- 启动后**不做预热**（v0.4.5 起）：首次打开设置页触发第一轮扫描，界面立即出图并显示进度；之后走增量，常驻开销接近于零。
- 页面按钮：「刷新」= 立即比对会话日志修订（只重折有变化的会话，通常几百毫秒）；「全量重算」= 丢弃现有统计存储并从头重算（耗时较长，界面显示进度）。
- 删除 `.usage-stats/` 目录等价于「全量重算」；`.usage-stats-cache.json.legacy-<ts>` 是 v0.4.x 旧缓存，可改名回滚。
- 排查用：`GET /api/usage-stats/summary?diag=1` 返回存储目录、记录数、扫描状态、折叠表规模、失败记忆与 zstd 能力探测。

临时停用可在 profile 的 `cordis.patch.yml` 中追加：

```yaml
- id: usage-stats
  disabled: true
```

## 许可证

[MIT](./LICENSE)
