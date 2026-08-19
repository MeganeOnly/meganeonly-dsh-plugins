# dsh-ui-tweaks

作者：MeganeOnly

**DSH 外观设计微调合集（v0.7.0：新增 `hide-trajectory-tab`——对话顶部"轨迹"标签隐藏，非开发者用不上）**。集中维护一组个人对 DSH shell 视觉的微调，每条 tweak 通过 DSH 设置页的"界面微调"顶级 section 控制开关 + 参数，client bundle 根据状态动态生成 CSS 注入 `<head>`，并通过 `CustomEvent` 触发副作用（调试高亮、简洁模式状态行 DOM controller、轨迹标签 hider）。

- **host half**：v0.3.0 起退化为零副作用 placeholder（cordis bundle 注册用占位）。**不**注册 DSH settings namespace、不读 settings 文档。
- **client half**：状态用浏览器 `localStorage` 自管（key `dsh-ui-tweaks/state`），注册独立顶层 `settings.section` slot（id=`ui-tweaks`, order=5），用 React 函数组件直接渲染控件，立即写 localStorage + 重注入 CSS。无 settingsScope 依赖。

每条 tweak 是 `lib/client.js` 里 `TWEAKS` 数组的一项（`{ id, name, description, configKeys:{enabled,value}, defaults:{enabled,value}, buildCSS(state) }`）。**TWEAKS 数组是 UI 渲染 + CSS 生成 + 持久化的单一数据源**——加新 tweak 时 push 一条，React 自动多渲染一行，CSS 生成自动多走一个 buildCSS，loadState/saveState 自动覆盖。

## 动机

DSH 默认视觉未必完全符合每个人的审美，且一个一个写小插件维护成本高。把"对 DSH 外观的微调"集中到一个包里——加新调整只需 push 一条 + 不改其它代码，UI 控件（开关/数字输入）由 React section 组件按 TWEAKS 数组自动渲染。

## v0.5.0 重大变更：self-shim + 不再依赖 `@linxin666/dsh-web-ui-all`

v0.4.0 的 CSS 用了两个 selector：

```css
html [class*="centerCol"], html [data-pane="conversation"]{...}
```

其中 `[data-pane="conversation"]` 这个属性原本由 `@linxin666/dsh-web-ui-all` 桥接包种上。这个包里有个 MutationObserver 找 `pI_x6G_centerCol` 元素并给它打 `data-pane="conversation"`。

**问题**：本插件作者已禁用所有 `@linxin666/*` 插件（`F:\.dsh\profiles\web\cordis.patch.yml` 里 `- id: ui-web-ui-compat, disabled: true`）。所以 `data-pane="conversation"` 永远不会被种，CSS 的两条 selector 中只有 `[class*="centerCol"]` 在生效。更糟的是 `pI_x6G_` 这个 hash 是 CSS Module 内容派生的，下次 DSH 升级可能就变了。

**v0.5.0 解法**：插件自己带 self-shim，自己种属性。4 层 selector 策略，按可信度递减：

| 层 | selector | 适用场景 |
| --- | --- | --- |
| L1 | `[data-pane="conversation"]` | 自己（或外部）已种——最稳，本插件独占 |
| L2 | `[class*="centerCol"]` | 当前 DSH 版本（CSS Module 类名 `pI_x6G_centerCol`） |
| L3 | grid 中间列（解析 `grid-template-columns` + 子元素位置） | DSH 升级后 hash 变了——只要还是 grid 三列结构就仍能命中 |
| L4 | `[data-pane-shell="conversation"]` | 保底（未来 DSH 可能自加） |

外加 `MutationObserver(document.body, {childList,subtree})` 在 DSH React 重渲时自动重新种属性（DSH 会 unmount/remount grid 子树）。这样插件完全自给自足，**不依赖任何其他插件**。

## v0.5.0 视觉反馈

### "对话区右缩" 开启后（v0.5.2 → v0.5.5 修复链）

1. JS 探测 DOM 找出真正的 chatflow 容器（overflow:auto/scroll 容器 + 含 `data-chat-flow-kind` 节点）和 inputArea（contenteditable/textarea/role=textbox 祖先），给它们打 `data-dsh-ui-tweaks-shift-target="chatflow"|"input"` 标记
2. CSS 只命中被标记的元素，加 `padding-right: 380px`（或自定义值，无 transition）
3. **关键效果**：conv 列容器本身宽度不变（grid 列宽 + 滚动条 + 滚动指示器保持在原位），只 chatflow + input 内的内容左移；padding 区域显示 chatflow 容器自身的背景色，与对话内容背景连续
4. 探测失败时回退：在 conv 列容器自身打 `data-dsh-ui-tweaks-shift-target="column"` 标记（v0.5.1 行为兜底）

#### 关键 bug 修复链

| 版本 | 问题 | 修复 |
| --- | --- | --- |
| v0.5.0 | centerCol 列容器加 `padding-right`，给右侧面板让空间 | 初步方案，OK |
| v0.5.1 | 用户反馈"对话窗口左移 + 背景一致"才符合直觉（不应给列容器加 padding）| 维持 padding-right 方案（理解有偏差） |
| v0.5.2 | 改为给 `centerCol > *` 直接子元素加 padding → 用户实测**对话根本不移动，调试高亮无任何显示**——`> *` 选择器在 DSH 嵌套结构里命中 0 个元素 | 退回旧 selector |
| v0.5.3 | 引入 JS 探测：找真正的 chatflow + inputArea，打 `data-dsh-ui-tweaks-shift-target` 标记；CSS 只命中标记元素。探测失败回退标 conv 列 | 根治 v0.5.2 命中 0 的问题 |
| v0.5.4 | 用户反馈"来回拉过去又弹回去"——因为 MutationObserver 观察 body+subtree=true，DSH React 在 chatflow 内部每次重渲都触发重打标记，配合 `padding-right .22s ease` transition 产生视觉循环 | 移除 CSS transition；chatflow observer 收窄到只观察 centerCol 直接子元素 + 已标记的元素被 unmount 时才重打 |
| v0.5.5 | v0.5.4 修复后回归"对话根本不移动"——`startChatflowMarksObserver` 在 `apply()` 太早时找不到 `centerCol`，静默失败，DSH 后续渲染时没人探测 | 把 `applyChatflowShiftMarks` 集成到 `startShellShimObserver` 回调里作为 body-level 兜底；加幂等性（已是最优标记就跳过重打，保留 v0.5.4 修过的"不再来回弹"） |

### "对话右缩调试高亮" 开启后

1. JS 探测标记的元素（chatflow / input / 兜底 column）四周出现 **4px 黄色 outline** (`#facc15`, `outline-offset: -4px`)，加 `box-shadow: inset 0 0 0 1px rgba(0,0,0,.5)` 增强对比度
2. 左上角浮动黑底白字 label：内容是 `DSH UI TWEAKS · 对话内容 · 当前右缩 380px (debug)`
3. console 一次性输出命中元素的 `tagName`/`className`/`shiftType`/`offsetWidth`/`boundingClientRect` 诊断数据

### "简洁模式" 行为

v0.4.0 起的工作模式——隐藏思考 / 工具调用 / 上下文行 / 过程节点；在输入框上方跑 DOM controller 注入 "正在思考…" / "正在阅读…" / "正在执行命令…" 状态行。

### "隐藏侧栏悬浮提示" 行为

v0.6.0 新增 → **v0.6.1 修复 selector**。DSH 侧栏会话项 / 工作窗口在 hover 时默认会通过 DSH 自己的 Tooltip 组件（`@deepseek-ai/dsh-client-ui-primitives/lib/types/Tooltip.js`）弹出深色方框展示会话全名。

**v0.6.0 失效原因**：DSH Tooltip 组件渲染结构是 `<span role="tooltip" className={undefined} style={{left,top}}>`——作为锚点的兄弟节点 inline 渲染，**不 portal 到 body**；className 是 undefined（CSS module stub 是 `var Tooltip_module_css_default = {};`）。所以 v0.6.0 的三条 selector 一条都不命中：
- `body > [role="tooltip"]` ← 不是 body 直接子级
- `body > div:has(> [role="tooltip"])` ← 同上
- `[class*="TooltipContent"]` ← className 是 undefined 无子串匹配

**v0.6.1 修法**：直接 `[role="tooltip"]{display:none!important}`。DSH 全 app 里 `role="tooltip"` 只在 Tooltip 组件里出现——全局干掉无副作用（与 v0.6.0 文档描述"全局关闭"一致）。

### "隐藏对话中的'轨迹'标签" 行为

v0.7.0 新增。DSH 对话顶部（`@deepseek-ai/dsh-client-ui-conversation/lib/client.js:7034-7047`）渲染了一个 `[role="tablist"]`，含两个 tab 按钮："对话"（Chat）/ "轨迹"（Trajectory）。"轨迹"标签打开的是 `TrajectoryView`（`@deepseek-ai/dsh-client-ui-trajectory`），是开发者视角的模型/工具调用事件账本（turn / step / tool-call 时间线 + 详细记录 + 搜索 / 折叠 / 跳读等调试工具）。

非开发者根本用不上，看着也容易困惑。开启后用 `data-dsh-ui-tweaks-hidden-tab="trajectory"` 标记打掉——CSS 命中隐藏。

**实现关键**：
- **JS 端**：CSS 没有 `:text()` 选择器无法匹配按钮文本。`createTrajectoryTabHider()` controller 用 `MutationObserver(document.body, {childList, subtree})` 巡检 `[role="tablist"] [role="tab"]` 列表，找文本等于 `"轨迹"` 或 `"Trajectory"` 的按钮，打 `data-dsh-ui-tweaks-hidden-tab="trajectory"` 标记。
- **CSS 端**：`[data-dsh-ui-tweaks-hidden-tab="trajectory"]{display:none!important}` 命中标记元素隐藏。
- **副作用**：如果轨迹标签当前 `aria-selected="true"`（用户正在轨迹视图），点击"对话"/"Chat" 标签自动切回对话页——避免用户卡在轨迹视图出不来。
- **关掉时**：`stop()` 主动移除已打的标记 + disconnect observer；切回 chat view（如果当前停在轨迹）。

**DSH 升级应对**：按钮文本变（比如本地化新增语言）或结构变（tab 移出 `[role="tablist"]`），需要相应更新 `TRAJECTORY_TAB_LABELS` 数组或 `findTabButtonByLabels` 选择器。

## 诊断与验证

每条 tweak row 旁都有一个 **诊断** 按钮，点击在 console.groupCollapsed 里输出：

- tweak id + 当前 state
- 这一条 tweak 的 `buildCSS(state)` 完整输出
- `getMatchedElements()` 结果（命中元素的 tag/class/paddingRight/offsetWidth/boundingClientRect）

整 section 顶部还有 **复制状态到剪贴板** 按钮，方便发出来反馈。

**`window.__dshUiTweaks` 调试 API**：

```js
window.__dshUiTweaks.getState()              // 当前 localStorage state
window.__dshUiTweaks.getInjectedCSS()        // 注入的 CSS 全文
window.__dshUiTweaks.getMatchedElements()    // { '[data-pane="conversation"]': [...], '[class*="centerCol"]': [...] }
window.__dshUiTweaks.debug()                 // 上面三个一并 console.group 输出
window.__dshUiTweaks.setState({conversationShift: true})  // 调试用：立即改 state 并触发副作用
window.__dshUiTweaks.reshim()                // 立即重跑 self-shim（调试用）
```

发现不生效时：**打开 console 跑 `window.__dshUiTweaks.debug()`，把输出贴出来**——能立刻定位是 state 没存上、CSS 没注入、还是 selector 没命中。

## 当前调整清单

| id / key | name | 描述 | 设置项 |
| --- | --- | --- | --- |
| `conversation-shift` | 对话区右缩 | JS 探测 DOM 找真正 chatflow 容器 + inputArea → 打 `data-dsh-ui-tweaks-shift-target` 标记 → CSS 只命中被标记元素 + conv 列容器不变（grid 列宽 + 滚动条 + 滚动指示器保持在原位）。探测失败时回退标记 conv 列容器（v0.5.1 兜底行为）。**自给自足**——不依赖任何外部桥接包；self-shim 4 层 selector 找 conv 列。 | 开关（`conversationShift`）+ 像素值（`conversationShiftPx`，默认 380，0–800） |
| `conversation-shift-debug` | 对话右缩调试高亮 | 开启后给 conversation 列加 4px 黄色 outline + 黑底白字浮动 label 显示当前像素值，并在 DevTools console.info 打出命中元素诊断。调试用——对话右缩关闭时也能开。 | 开关（`conversationShiftDebug`，默认关） |
| `simple-mode` | 简洁模式 | 隐藏思考（think 推理）、工具调用（read/edit/pwsh/bash/grep/glob 等）、上下文注入行、其它纯过程节点（compaction / model-retry / turn-error / turn-max-tokens），整体 display:none 不留白。输入框上方常驻一条极简状态行（"正在思考…" / "正在阅读…" / "正在执行命令…"），运行结束自动消失。状态行用 DOM 注入 `[class*="turnStatus"]` 跟随 TurnStatus 重渲（MutationObserver + 250ms 心跳），工具名从 `[data-chat-flow-kind="tool-call"]` 节点反推（不依赖 settingsScope）。 | 开关（`simpleModeEnabled`，默认开） |
| `hide-sidebar-tooltip` | 隐藏侧栏悬浮提示 | 鼠标悬停在左侧栏会话项 / 工作窗口时 DSH 默认弹出一个深色方框展示会话全名。v0.6.1 修复 selector：DSH Tooltip 组件渲染 `<span role="tooltip">` 作为锚点兄弟节点 inline 渲染（不 portal 到 body，className=undefined），直接 `[role="tooltip"]{display:none!important}` 命中。**全局关闭**——DSH 全 app 只有 Tooltip 组件用 `role="tooltip"`，全局干掉无副作用；其它位置（goal / composer / message-feedback 等）出现频次极低且 aria-label 仍可用。 | 开关（`hideSidebarTooltip`，默认开） |
| `hide-trajectory-tab` | 隐藏对话中的"轨迹"标签 | 对话顶部多了一个"轨迹"标签——展示模型/工具调用的事件账本（开发者视角，含 turn/step/tool-call 时间线、详情、搜索等调试功能）。非开发者用不上，看着也容易困惑。v0.7.0 实现：JS MutationObserver 巡检 `[role="tablist"]` 找文本为"轨迹"/"Trajectory"的按钮，打 `data-dsh-ui-tweaks-hidden-tab="trajectory"` 标记，CSS 命中隐藏。如果当前 view 正是轨迹（aria-selected=true），自动点击"对话"/"Chat"标签切回对话页——避免卡在轨迹视图出不来。 | 开关（`hideTrajectoryTab`，默认开） |

## 如何加新调整

仅需 push 一条到 `lib/client.js` 的 `TWEAKS` 数组。React UI 按数组自动渲染新 row，CSS 生成自动包含新 `buildCSS`，localStorage 持久化自动覆盖新字段（按 dsh-persistent-plugin-authoring skill §三的隐式迁移路径）。

```js
var TWEAKS = [
  // ... existing tweaks
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

刷新浏览器即可生效（client bundle 改动无需重启 DSH；按 dsh-persistent-plugin-authoring §四.5"更正"段，`cache-control: no-cache`，但仍建议按 Ctrl+F5 强制刷新以避免浏览器缓存）。

## 安装

按 dsh-plugins 总 README「安装」节的统一流程：

1. 插件源放 `F:\.dsh\plugins\dsh-ui-tweaks\`
2. 编辑 `F:\.dsh\profiles\web\package.json`：
   - `dependencies` 加 `"dsh-ui-tweaks": "file:../../plugins/dsh-ui-tweaks"`
   - `dsh.profile.bundles` 加 `"dsh-ui-tweaks"`
3. 安装：`cmd /c "cd /d F:\.dsh\profiles\web && pnpm install --no-frozen-lockfile"`
4. 改源码后手动同步副本（D004 + 手册 §四.4）：
   ```powershell
   Copy-Item E:\dsh-plugins\dsh-ui-tweaks\lib\client.js F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\lib\client.js -Force
   Copy-Item E:\dsh-plugins\dsh-ui-tweaks\package.json F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\package.json -Force
   Copy-Item E:\dsh-plugins\dsh-ui-tweaks\cordis.patch.yml F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\cordis.patch.yml -Force
   ```
5. **client bundle 改动无需重启 DSH**——刷新浏览器（Ctrl+F5 强制刷新更稳）即可；host half 是 zero-side-effect placeholder 也无需重启

## 风险与回退

- **彻底停用**：profile `cordis.patch.yml` 加：
  ```yaml
  - id: ui-tweaks
    disabled: true
  ```
  重启 DSH 即恢复
- **彻底卸载**：profile `package.json` 移除 `dsh-ui-tweaks` 依赖与 bundle 条目 → `pnpm install` → 删除 `F:\.dsh\plugins\dsh-ui-tweaks\`
- **清空 tweak 状态**：浏览器 DevTools → `localStorage.removeItem('dsh-ui-tweaks/state')`
- **运行时验证**：DevTools → `window.__dshUiTweaks.debug()` 看 state / CSS / 命中元素

## 实现要点

- **不依赖 settingsScope / DSH settings namespace**：v0.3.0 起 tweak 状态完全在浏览器侧管理（localStorage）。原因见 DECISIONS.md C003——DSH API gateway 的 `exposedNamespaces()` 硬编码白名单对第三方插件 silent filter。
- **self-shim 4 层 selector（v0.5.0）**：本插件独占 self-shim，不依赖 `@linxin666/dsh-web-ui-all`。L1 数据属性 → L2 CSS Module 子串 → L3 grid 解析 → L4 兜底。配合 `MutationObserver(document.body, {childList,subtree})` 在 DSH React 重渲时自动重新种属性。
- **副作用总线**：UiTweaksSection 在 useEffect 里 dispatch `CustomEvent("dsh-ui-tweaks-state-change", { detail: state })`；apply() 订阅事件分发到 `applyDebugMode()`、简洁模式状态行 controller 的 `start()/stop()`、**v0.7.0 起** trajectory tab hider 的 `start()/stop()`（自动切回 chat view）。
- **视觉锚点（v0.5.0）**：右缩开启时 conversation 列右边界画 1px 红线 (`#dc2626`)；调试开启时 4px 黄 outline + 浮动 label。两层视觉反馈让用户**哪怕没有右面板也能立刻看到效果**。
- **诊断 API（v0.5.0）**：`window.__dshUiTweaks` 暴露 `VERSION / getState / getInjectedCSS / getMatchedElements / debug / setState / reshim`。每条 tweak row 加 "诊断" 按钮直接输出这一条的 buildCSS + 命中元素。
- **Controller-less 设计**：v0.2.1 用的 `UiTweaksController` + `useSyncExternalStore` 改为 React 原生 `useState` + `useEffect`——简单一个 section 不需要外部 store 抽象，状态完全在 React 树内。
- **localStorage 持久化降级**：探针可用性，QuotaExceededError/SecurityError 时 storage=undefined，load 返回默认、save 静默跳过。
- **schema 演进不升 localStorage key**：TWEAKS 加新字段时 loadState 用 defaultState 补缺字段，save 写完整 state——隐式迁移路径。
- **CSS 注入去重**：每次状态变化时先 `querySelector("style[data-plugin-css=...]")` remove 旧标签再 createElement 新标签。
- **零 Tailwind / 零自定义设计系统**：UI 用 DSH 原生 CSS 变量（`--dsw-alias-*` / `--dsw-specific-input-major`），视觉与设置页完全对齐。
- **视图函数传入 slot 用 jsxRuntime.jsx(...) 包裹**：直接传组件类型会被 React 错误边界吞掉。
- **token 消耗**：client half 注册 React section 是纯 UI 渲染 + localStorage 写入（无 settings RPC、无 agent followup、无 system prompt 段）。**唯一 IO 是 localStorage**，**零 token 消耗**。