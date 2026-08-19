    // ===== 常量 =====
    var STORAGE_KEY = "dsh.gitHub.v1";
    var DRAWER_ATTR = "data-dsh-github-drawer-open";
    // 任何右侧抽屉打开时设的统一 attr；所有 FAB CSS 监听它→让位到屏幕左侧
    // （侧边栏区域），而不是被自己的抽屉遮挡。互斥协议保证任意时刻只有一个抽屉打开。
    // 与 dsh-task-pool / 其他面板共享此协议（v0.1.1+ 协议升级）。
    var ANY_DRAWER_ATTR = "data-dsh-any-side-drawer-open";
    var DRAWER_WIDTH = 420;
    var PANEL_NAME = "github";
    var ACTIVATE_EVENT = "dsh-panel-activate";
    var POLL_INTERVAL_MS = 4000; // v0.2.1 智能轮询：仅在有推送运行时才以这个间隔轮询 push-status

