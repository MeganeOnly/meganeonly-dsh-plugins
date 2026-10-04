/**
 * dsh-plugins-all — Host 半端（占位）
 *
 * 本包是**名册聚合包**：它做的工作全部在 cordis.patch.yml 里——把各插件
 * 自己的 insert 块搬进同一份 bundle patch，让 profile 只用登记一个 bundle。
 *
 * 因此本包：
 * - **不自插名册行**（没有 `- id: dsh-plugins-all`）——插了也只是一行空插件；
 * - **不提供浏览器半段**（package.json 无 dsh.client）——不贡献 client bundle；
 * - 本文件仅用于满足包清单完整性（`main` 指向的宿主入口存在），正常启动下
 *   不会被 import。将来若本包需要真正的宿主逻辑，再补一个名册行即可。
 */

export const name = 'dsh-plugins-all'

export const inject = []

export function apply(_ctx) {}
