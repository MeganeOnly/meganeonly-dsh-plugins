    // ===== 常量 =====
    var API_PLUGIN = "/api/plugin-manager";
    var API_SKILL = "/api/skill-manager";
    var API_MCP = "/api/mcp-manager";
    var MINE_AUTHOR = "MeganeOnly";

    // 每个 tab 对应一个独立管理插件；tab 是否显示由该插件 API 是否可用决定
    // （插件停用 → API 404 → tab 隐藏；启用 → API 正常 → tab 显示）。
    var TABS = [
      { id: "plugin", label: "插件", api: API_PLUGIN },
      { id: "skill", label: "Skill", api: API_SKILL },
      { id: "mcp", label: "MCP", api: API_MCP }
    ];

