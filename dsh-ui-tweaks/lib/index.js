/**
 * dsh-ui-tweaks — Host 半端（Cordis 插件，作者：MeganeOnly）
 *
 * 注册 DSH settings namespace "ui-tweaks" + schemastery schema，让每条 tweak
 * 在 DSH 设置页里都有对应的开关 / 输入控件。schema 字段与 client 端
 * TWEAKS 数组的 configKeys 严格对齐。
 *
 * 副作用全在 client 端（CSS 注入），host 端只做 schema 注册，不做副作用。
 */

import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "schemastery";

const NAMESPACE = settingsNamespace("ui-tweaks");

/**
 * 每加一条 tweak（client 端 TWEAKS 数组），在这里同步加一个字段。
 * - type: boolean → 渲染为开关
 * - type: number  → 渲染为数字输入
 *
 * ui-tweaks 只管 UI 类微调；其它插件的自身行为设置（如 dsh-task-pool 的
 * "发送后删除"开关）在各自插件内管理，不归到这个 namespace。
 */
const Config = z.object({
  conversationShift: z.boolean().default(false),
  conversationShiftPx: z.number().default(380),
});

export const name = "dsh-ui-tweaks";
export const inject = ["settings"];

export function apply(ctx) {
  installSettingsSection(ctx, NAMESPACE, Config, {}, {
    setSource: () => {},
    onChange: () => {},
  });
}