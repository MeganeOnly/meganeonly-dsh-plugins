/**
 * dsh-manager-hub — 浏览器半端（web client bundle）
 *
 * 打包格式与官方社区插件一致：window.__ModuleLoader__.load({ id, factory })。
 * 依赖经 require() 取得（react 由 shell 模块表提供），其余全部走浏览器 fetch
 * 调用三个独立管理插件的宿主 webServer 路由。
 *
 * 界面：设置 → “管理”页（唯一入口，聚合原 插件管理 / Skill 管理 / MCP 管理 三页）。
 *   - 顶部 tab：插件（默认）/ Skill / MCP，切换显示的三个管理视图；
 *   - 三个视图分别调用 /api/plugin-manager、/api/skill-manager、/api/mcp-manager；
 *   - 视图逻辑来自三个独立插件（plugin-manager / skill-manager / mcp-manager），
 *     本插件只做 UI 聚合，不重复任何宿主逻辑；
 *   - tab 按服务可用性条件显示：某管理插件被停用（其 API 返回 404）时，对应 tab
 *     自动隐藏；重新启用后刷新页面即恢复显示。其余 tab 不受影响。
 *
 * 与其他三个管理插件的关系：
 *   - 三个插件各自的设置页条目（插件管理 / Skill 管理 / MCP 管理）在本插件
 *     （settings.section id=manager-hub）存在时自动隐藏——由那三个插件的客户端
 *     监听 settings.section 注册变更实现；
 *   - 本插件被停用时，三个独立管理页自动恢复为兜底入口，管理能力不丢失。
 */
