# dsh-ui-tweaks

作者：MeganeOnly

**DSH 外观设计微调合集（v0.2.1：补独立顶层 "界面微调" section）**。集中维护一组个人对 DSH shell 视觉的微调，每条 tweak 通过 DSH 设置页的 "界面微调" 顶级 section 控制开关 + 参数，client bundle 根据设置动态生成 CSS 注入到 `<head>`。

- **host half**：注册 settings namespace `ui-tweaks` + schemastery schema
- **client half**：用 settingsScope 订阅设置变化 → (1) 动态 CSS 生成 → 注入 `<head>` (2) 注册独立顶层 `settings.section` slot，React 组件渲染开关/数字输入并立即写入

每条 tweak 是 `lib/client.js` 里 `TWEAKS` 数组的一项（`{ id, name, description, configKeys, defaults, buildCSS(state) }`），与 `lib/index.js` schemastery Config 字段严格对齐。**TWEAKS 数组是 React UI 渲染 + CSS 生成的双重数据源**——加新 tweak 时 push 一条，React 自动多渲染一行，CSS 生成自动多走一个 buildCSS。

## 动机

DSH 默认视觉未必完全符合每个人的审美，且一个一个写小插件维护成本高。把"对 DSH 外观的微调"集中到一个包里——加新调整只需 push 一条 + 在 schema 加对应字段，UI 控件（开关/数字输入）由 React section 组件按 TWEAKS 数组自动渲染。

## 重要：v0.2.1 bug fix

v0.2.0 的"接入 DSH 设置页"是个设计 bug——`installSettingsSection` 只把 schema 注册到 `ctx.settings` service，但 **DSH 设置页不会自动遍历 namespace 渲染 UI**，每个可见 section 必须显式注册 React 组件到 `settings.section` slot。结果：v0.2.0 在 DSH 设置页里**完全找不到 ui-tweaks 入口**。

v0.2.1 修复：
- client half 新增独立顶层 "界面微调" section（`id: "ui-tweaks"`, `order: 5`，介于"通用" 0 与"插件" 15 之间）
- React 函数组件 `UiTweaksSection` 渲染 TWEAKS 列表，每条 tweak 一个 row（标题 + 描述 + 开关 + 可选数字输入）
- 开关/数字输入变化立即 `controller.set(field, value)` 写入 settings（不走 staging）
- 与 task-pool 抽屉状态完全解耦（CSS 选择器 `[class*="centerCol"]` substring 匹配，跨重启稳定）

## 当前调整清单

| id / key | name | 描述 | 设置项 |
| --- | --- | --- | --- |
| `conversation-shift` | 对话左移让位 | 让 DSH 主框架的 `centerCol`（对话列容器）永久右缩 N 像素，给右侧面板（如任务池抽屉）让出空间。**与 task-pool 抽屉状态解耦——开关开启后始终生效，不依赖抽屉是否打开**。DSH 当前版本用 CSS module 类名 hash（如 `pI_x6G_centerCol`），用 `[class*="centerCol"]` substring 匹配跨重启稳定。 | 开关（`conversationShift`）+ 像素值（`conversationShiftPx`，默认 380） |

## 如何加新调整

三步（host + client + schema 三方同步）：

**Step 1：`lib/client.js` 的 `TWEAKS` 数组 push 一条**

```js
var TWEAKS = [
  {
    id: "new-tweak-id",
    name: "新调整的名字",
    description: "这条调整做什么",
    configKeys: { enabled: "newTweakEnabled", value: "newTweakValue" },  // 或别的字段名
    defaults: { enabled: false, value: 100 },
    buildCSS: function (state) {
      if (!state.newTweakEnabled) return null;
      return "/* your CSS */";
    }
  }
];
```

**Step 2：`lib/index.js` 的 schemastery Config 加对应字段**

```js
const Config = z.object({
  conversationShift: z.boolean().default(false),
  conversationShiftPx: z.number().default(380),
  newTweakEnabled: z.boolean().default(false),  // 新增
  newTweakValue: z.number().default(100),       // 新增
});
```

**Step 3**：DSH 重启后 → 设置页 → "界面微调" section 自动多一行（React 组件按 TWEAKS 数组渲染，CSS 生成也按 TWEAKS 数组构建）。无需改其它代码。

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
4. 手动同步源码副本：
   ```powershell
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\lib\* F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\lib\ -Recurse -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\package.json F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\package.json -Force
   Copy-Item F:\AllWorkSpace\dsh-plugins\dsh-ui-tweaks\cordis.patch.yml F:\.dsh\profiles\web\node_modules\dsh-ui-tweaks\cordis.patch.yml -Force
   ```
5. **必须重启 DSH**（host half 注册 settings schema 需要重启，client bundle 刷新即可生效）

## 风险与回退

- **彻底停用**：profile `cordis.patch.yml` 加：
  ```yaml
  - id: ui-tweaks
    disabled: true
  ```
  重启 DSH 即恢复
- **彻底卸载**：profile `package.json` 移除 `dsh-ui-tweaks` 依赖与 bundle 条目 → `pnpm install` → 删除 `F:\.dsh\plugins\dsh-ui-tweaks\`
- **调试某条 tweak**：DevTools → 找到 `<style data-plugin-css="dsh-ui-tweaks/main.css">`，里面有 `/* === id : name === */` 注释

## 实现要点

- **DSH 设置页不自动渲染 namespace**：每个 section 必须显式注册 React 组件到 `settings.section` slot（v0.2.0 没做这一步 = 设置页里看不到）。DSH 内部 `dsh-client-ui-settings-general` / `-plugins` 等都是 React 函数组件 + `slots.register({name, id, order, label, inject}, Component)`。
- **controller 模式**：`UiTweaksController` 持 scope + 内部维护 snapshot 缓存 + 监听器集合，对外暴露 `getSnapshot / subscribe / set / dispose`。React 组件用 `useSyncExternalStore(subscribe, getSnapshot)` 订阅。
- **立即写入（不走 staging）**：与 dsh-plugins 官方 bash / agent-loop 卡的"暂存编辑 → save → discard"模式不同，tweak 改动小（bool + 单 number），用户拨动开关或 blur 数字框就立即 `scope.set(field, value)` 落盘，无误触成本。
- **CSS 选择器跨重启稳定**：用 `[class*="centerCol"]` substring 匹配，DSH 重启时 CSS module hash 变但 substring 保留
- **schemastery schema 是 Host 数据契约**：client TWEAKS 数组的 `configKeys` 与 host schema 字段名严格对齐，schema 提供类型校验 + 默认值 + 反序列化，client 用 schema defaults 做 fallback（schema `default(false)` 与 TWEAKS `defaults.enabled: false` 必须同步）
- **零 Tailwind / 零自定义设计系统**：UI 用 DSH 原生 CSS 变量（`--dsw-alias-*` / `--dsw-specific-input-major`），视觉与设置页完全对齐
- **token 消耗**：client half 注册 React section 是纯 UI 渲染，无 `agent/pre-step` 或 followup；唯一 IO 是 settings 写入（settings service RPC），CSS 注入是纯 DOM。**零 token 消耗**