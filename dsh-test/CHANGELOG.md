# Changelog

dsh-test 的变更记录。

## [Unreleased]

### 新增
- 初次入库：最小 DSH 插件管道健康检查器（host + client + cordis 三层验证）。
  - host 注册 `GET /api/test/hello`
  - client 在右下角注入状态徽标（绿=通 / 红=断 / 黑底 loading=超时）
  - 用于排查「插件失踪」时先确认管道本身是否健康