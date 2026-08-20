window.__ModuleLoader__.load({
  id: "dsh-task-pool",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = ["sessions"]; // sessions 发送任务到当前会话

