/**
 * dsh-manager-hub — Host 半端（作者：MeganeOnly）
 *
 * 本插件是纯 UI 聚合层：在设置页注册唯一入口"管理"，顶部 tab 切换
 * 插件 / Skill / MCP，三个 tab 分别调用 plugin-manager / skill-manager /
 * mcp-manager 三个独立插件的 HTTP 路由（/api/plugin-manager、/api/skill-manager、
 * /api/mcp-manager）。宿主侧不需要任何路由与状态，这里是零副作用占位：
 * 所有数据源与启停逻辑仍在三个老插件各自的宿主半端里。
 *
 * 依赖关系：本插件依赖三个老插件保持启用（它们提供 API）。停用任一老插件时，
 * 对应 tab 会显示服务不可用，其余 tab 不受影响。
 */
export const name = 'manager-hub'

export const inject = []

export function apply() {
  // 零副作用：所有逻辑都在 client bundle（settings.section 注册）里。
}
