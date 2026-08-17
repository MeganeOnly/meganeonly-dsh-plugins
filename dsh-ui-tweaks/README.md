# dsh-ui-tweaks

作者：MeganeOnly

**DSH 外观设计微调合集（v0.3.0）**。集中维护一组个人对 DSH shell 视觉的微调，每条 tweak 通过 DSH 设置页的"界面微调"顶级 section 控制开关 + 参数，client bundle 根据状态动态生成 CSS 注入到 `<head>`。

- **host half**：v0.3.0 起退化为零副作用 placeholder（cordis bundle 注册用占位）。**不**注册 DSH settings namespace、不读 settings 文档。
- **client half**：状态用浏览器 `localStorage` 自管（key `dsh-ui-tweaks/state`），注册独立顶层 `settings.section` slot（id=`ui-tweaks`, order=5），用 React 函数组件直接渲染控件，立即写 localStorage + 重注入 CSS。无 settingsScope 依赖。

每条 tweak 是 `lib/client.js` 里 `TWEAKS` 数组的一项（`{ id, name, description, configKeys:{enabled,value}, defaults:{enabled,value}, buildCSS(state) }`）。**TWEAKS 数组是 UI 渲染 + CSS 生成 + 持久化的单一数据源**——加新 tweak 时 push 一条，React 自动多渲染一行，CSS 生成自动多走一个 buildCSS，loadState/saveState 自动覆盖。

## 动机

DSH 默认视觉未必完全符合每个人的审美，且一个一个写小插件维护成本高。把"对 DSH 外观的微调"集中到一个包里——加新调整只需 push 一条 + 不改其它代码，UI 控件（开关/数字输入）由 React section 组件按 TWEAKS 数组自动渲染。

## 重要：v0.3.0 架构变更（破坏性）

v0.2.0→v0.2.1→v0.2.1.1 三次迭代修复 host 注册层（C001/C002），但**修复方向全错**。真正根因是 DSH API server 的 `exposedNamespaces()` 硬编码白名单（详见 DECISIONS.md C003）——所有第三方 host-plane 插件 namespace 都被 silent filter，client 端 settingsScope 永远 `status="unavailable"`。

v0.3.0 切换数据通路：

- **不用** DSH settings namespace：DSH API 不暴露第三方 namespace
- **不用** settingsScope：拿不到 namespace 的 status 永远是 unavailable
- **改用** localStorage（浏览器侧 `dsh-ui-tweaks/state`）：无 DSH 介入，刷新即生效
- **保留** settings.section slot 注册：UI 入口还在设置页"界面微调"section
- **保留** CSS 注入：`<style data-plugin-css="dsh-ui-tweaks/main.css">` 行为不变
- **简化** host half：完全空 apply，无 `@deepseek-ai/dsh-settings` / `schemastery` 依赖

UI 与 v0.2.1 完全一致（开关 + 数字输入 + 立即写入），用户**不会**感知差异。区别仅在数据通路——这次 tweak 状态真的能持久化、能跨重启、能立即生效。

**调试某条 tweak**：DevTools → `localStorage.getItem('dsh-ui-tweaks/state')` 看持久化状态；`<style data-plugin-css="dsh-ui-tweaks/main.css">` 里看 `/* === id : name === */` 注释。

## 历史教训（v0.2.0→v0.2.1→v0.2.1.1 三次修复全错）

| 版本 | 改动 | 失败原因 |
| --- | --- | --- |
| v0.2.0 | host half 用 `installSettingsSection` 注册 namespace | 嵌套 inject 不触发 callback（Bug B） |
| v0.2.1 | client half 加 React section card | Bug B 还在，section 永远 unavailable |
| v0.2.1.1 | host half 改 `ctx.settings.register` 直接注册 | Bug B 修了，但 settings API gateway 还有 `exposedNamespaces()` 白名单过滤（真因），client 仍 unavailable |

详见 DECISIONS.md C001/C002/C003。三次修复的根因诊断全部停留在 host 注册层，没去 grep DSH API server 的实际 wire 协议。

## 当前调整清单

| id / key | name | 描述 | 设置项 |
| --- | --- | --- | --- |
| `conversation-shift` | 对话左移让位 | 让 DSH 主框架的 `centerCol`（对话列容器）永久右缩 N 像素，给右侧面板（如任务池抽屉）让出空间。**与 task-pool 抽屉状态解耦——开关开启后始终生效，不依赖抽屉是否打开**。DSH 当前版本用 CSS module 类名 hash（如 `pI_x6G_centerCol`），用 `[class*="centerCol"]` substring 匹配跨重启稳定。 | 开关（`conversationShift`）+ 像素值（`conversationShiftPx`，默认 380） |

## 如何加新调整

两步（TWEAKS 数组是单一数据源，不需要再改 host half 或 package.json）：

**Step 1：`lib/client.js` 的 `TWEAKS` 数组 push 一条**

```js
var TWEAKS = [
  {
    id: "new-tweak-id",
    name: "新调整的名字",
    description: "这条调整做什么",
    configKeys: { enabled: "newTweakEnabled", value: "newTweakValue" },  // 或 { enabled: "newTweak", value: "newTweak" } 表示只有开关
    defaults: { enabled: false, value: 100 },
    buildCSS: function (state) {
      if (!state.newTweakEnabled) return null;
      return "/* your CSS */";
    }
  }
];
```

**Step 2**：刷新浏览器（client bundle 改动**无需重启 DSH**——dsh-client-modules 按请求读文件，`cache-control: no-cache`）。设置页 → "界面微调" section 自动多一行（React 组件按 TWEAKS 数组渲染，CSS 生成也按 TWEAKS 数组构建）。无需改 host half / schema / package.json。

## 安装

按 dsh-plugins 总 README「安装」节的统一流程：

1. 插件源放 `F:\.dsh\plugins\dsh-ui-tweaks\`（仓库源码在 `F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\`，按 D005 部署为独立副本）
2. 编辑 `F:\.dsh\profiles\web\package.json`：
   - `dependencies` 加 `"dsh-ui-tweaks": "file:../../plugins/dsh-ui-tweaks"`
   - `dsh.profile.bundles` 加 `"dsh-ui-tweaks"`
3. 安装：
   ```bat
   cmd /c "cd /d F:\.dsh\profiles\web && pnpm install --no-frozen-lockfile"
   ```
4. 手动同步源码副本（D004 + 手册 §四.4）：
   ```powershell
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\lib\* F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\lib\ -Recurse -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\package.json F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\package.json -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\cordis.patch.yml F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\cordis.patch.yml -Force
   ```
5. **必须重启 DSH**（host half 是 zero-side-effect placeholder，但 bundle 组合是启动时读取的；client bundle 改动刷新浏览器即可）

## 风险与回退

- **彻底停用**：profile `cordis.patch.yml` 加：
  ```yaml
  - id: ui-tweaks
    disabled: true
  ```
  重启 DSH 即恢复
- **彻底卸载**：profile `package.json` 移除 `dsh-ui-tweaks` 依赖与 bundle 条目 → `pnpm install` → 删除 `F:\.dsh\plugins\dsh-ui-tweaks\`
- **清空 tweak 状态**：浏览器 DevTools → `localStorage.removeItem('dsh-ui-tweaks/state')`
- **调试某条 tweak**：DevTools → 找到 `<style data-plugin-css="dsh-ui-tweaks/main.css">`，里面有 `/* === id : name === */` 注释

## 实现要点

- **不依赖 settingsScope / DSH settings namespace**：v0.3.0 起 tweak 状态完全在浏览器侧管理（localStorage）。原因见 DECISIONS.md C003——DSH API gateway 的 `exposedNamespaces()` 硬编码白名单对第三方插件 silent filter。
- **Controller-less 设计**：v0.2.1 用的 `UiTweaksController` + `useSyncExternalStore` 改为 React 原生 `useState` + `useEffect`——简单一个 section 不需要外部 store 抽象，状态完全在 React 树内。
- **CSS 选择器跨重启稳定**：用 `[class*="centerCol"]` substring 匹配，DSH 重启时 CSS module hash 变但 substring 保留（详见 D023）。
- **localStorage 持久化降级**：探针可用性，QuotaExceededError/SecurityError 时 storage=undefined，load 返回默认、save 静默跳过（按 dsh-persistent-plugin-authoring §三）。
- **schema 演进不升 localStorage key**：TWEAKS 加新字段时 loadState 用 defaultState 补缺字段，save 写完整 state——隐式迁移路径（按 dsh-persistent-plugin-authoring §三）。
- **CSS 注入去重**：每次状态变化时先 `querySelector("style[data-plugin-css=...]")` remove 旧标签再 createElement 新标签（按 dsh-persistent-plugin-authoring §三 "注入全局 CSS"）。
- **零 Tailwind / 零自定义设计系统**：UI 用 DSH 原生 CSS 变量（`--dsw-alias-*` / `--dsw-specific-input-major`），视觉与设置页完全对齐。
- **视图函数传入 slot 用 jsxRuntime.jsx(...) 包裹**：直接传组件类型会被 React 错误边界吞掉（按 dsh-persistent-plugin-authoring §三 末尾"客户端渲染崩"）。
- **token 消耗**：client half 注册 React section 是纯 UI 渲染 + localStorage 写入（无 settings RPC、无 agent followup、无 system prompt 段）。**唯一 IO 是 localStorage**，**零 token 消耗**。