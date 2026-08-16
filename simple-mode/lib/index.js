/**
 * dsh-simple-mode — Host 半端
 *
 * 只做一件事：注册设置命名空间 dsh-simple-mode（字段 hideToolCalls，默认 true），
 * 让浏览器半端的开关能持久化到宿主 settings.yaml。
 * 与 dsh-client-ui-conversation 的宿主半端同款写法（settingsNamespace + schemastery schema）。
 */
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

export const name = 'simple-mode'

export const inject = []

const NAMESPACE = 'dsh-simple-mode'
const HIDE_FIELD = 'hideToolCalls'
const SimpleModeSchema = z.object({ [HIDE_FIELD]: z.boolean().default(true) })

export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(NAMESPACE), SimpleModeSchema)
  })
}
