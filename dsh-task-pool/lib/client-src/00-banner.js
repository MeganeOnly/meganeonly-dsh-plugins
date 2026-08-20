/**
 * dsh-task-pool — 浏览器半端（web client bundle，作者：MeganeOnly）
 *
 * v0.6.0：任务结构从 { title, description } 简化为单字段 { content }。
 *   - 不再有"标题+描述"两栏：inline 新建、卡片预览、就地展开面板
 *     都只编辑/显示一段纯文本（多行 textarea，Enter 换行，Ctrl/⌘+Enter 保存）；
 *   - 发送时直接把 content 作为 user message，不再拼接 title + description；
 *   - 数据迁移：旧 schema {title, description} 自动合并成
 *     content = title + (description ? "\n\n" + description : "")，
 *     旧字段在保存时被剥离（仅保留新 schema 字段），无破坏性丢失；
 *   - 视觉 token / FAB 让位 / 抽屉交互 / 发送二次确认 / 发送后删除全局开关
 *     等其余行为沿用 v0.5.6。
 *
 * 持久化：localStorage（key dsh.taskPool.v1，schema v3 兼容 v2/v1）。
 * 唯一 token 消耗路径：用户主动发送任务到对话时（与 ui-task-board 的执行模式同款）。
 */
