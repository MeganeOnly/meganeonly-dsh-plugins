    // ===== constants =====
    // ===== 常量 =====
    var STORAGE_KEY = "dsh.taskPool.v1";
    var DRAWER_ATTR = "data-dsh-taskpool-drawer-open";
    // 任何右侧抽屉打开时设的统一 attr；所有 FAB CSS 监听它→让位到屏幕左侧
    // （侧边栏区域），而不是被自己的抽屉遮挡。互斥协议保证任何时刻只有一个抽屉打开。
    var ANY_DRAWER_ATTR = "data-dsh-any-side-drawer-open";
    var DRAWER_WIDTH = 380;
    var PANEL_NAME = "taskpool";
    var ACTIVATE_EVENT = "dsh-panel-activate";

