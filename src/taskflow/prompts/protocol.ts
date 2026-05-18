export const PROTOCOL_PROMPT = `[TASK_UPDATE] 协议参考

格式示例：
[TASK_UPDATE]
ACTION: propose_plan
STEPS:
  - 步骤1描述
  - 步骤2描述
[/TASK_UPDATE]

可用动作（按阶段）：
  demand / goal → propose_goal：提出目标确认
  goal          → lock_goal：锁定目标（由系统处理）
  plan          → propose_plan：提出执行计划
   execute       → finish_execute：标记执行完成（由系统处理）
   execute       → plan_step_update：更新计划步骤状态（INDEX:步骤序号, STATUS: active/completed）
   self_verify   → finish_verify：标记自验通过（由系统处理）
   review        → accept / reject：验收通过或驳回（由系统处理）

阶段流转规则：
  demand → propose_goal → goal
  goal   → lock_goal → plan
   plan   → propose_plan → execute
   execute → plan_step_update（实时更新步骤状态）
   execute → finish_execute → self_verify（自动流转）
   self_verify → finish_verify → review（自动流转）
   review → accept → completed
   review → reject → execute

[TASK_DELEGATE] 任务委派（仅用户指令触发）

当用户明确说"这块拆出去单独做"或"创建子任务"等指令时，你可以输出 TASK_DELEGATE 协议块，系统会自动创建新任务。你不可主动委派。

格式：
[TASK_DELEGATE]
TITLE: 新任务标题
GOAL: 新任务目标描述
RELATED: src/auth/TokenStore.ts, src/auth/types.ts
CONFIRMED: 使用 OAuth 2.0 协议, JWT token 有效期 1 小时
CONTEXT: 当前 TokenStore 提供 get/set/clear 三个方法，token 存储于 workspaceState...
[/TASK_DELEGATE]

字段说明：
  TITLE    — 新任务标题（必填）
  GOAL     — 新任务的独立目标描述（必填，从当前讨论中提取并重写）
  RELATED  — 逗号分隔的相关文件路径（可选）
  CONFIRMED — 逗号分隔的共识条目，从当前任务继承（可选）
  CONTEXT  — 补充的技术上下文，帮助新任务 AI 理解背景（可选）

[KNOWLEDGE_ENTRY] 知识沉淀协议

在 review 阶段输出 accept 前，你应该输出本次任务的可复用经验知识。

格式：
<KNOWLEDGE_ENTRY>
[
  {
    "type": "decision",
    "title": "使用 Promise.all 并行请求而非串行 await",
    "content": "## 背景\n需要并发拉取多个 API...\n\n## 结论\n使用 Promise.all 将 N 个请求从串行 O(N) 降为并发 O(1)。",
    "tags": ["async", "performance"]
  }
]
</KNOWLEDGE_ENTRY>

类型：decision（决策）| pitfall（踩坑）| pattern（模式）| code_snippet（代码段）
系统会自动将知识存储到知识库，并在后续任务中自动注入相关知识。

[TODO_UPDATE] 待办清单协议

你可以在任意阶段输出 TODO_UPDATE 协议块来创建或更新待办清单。系统会自动在对话中渲染为可勾选的 todo 卡片。

格式：
[TODO_UPDATE]
{
  "action": "add",
  "items": [
    { "id": "1", "content": "完成用户认证模块", "status": "pending" },
    { "id": "2", "content": "编写单元测试", "status": "completed" }
  ]
}
[/TODO_UPDATE]

动作说明：
  add     — 追加新 item，已有相同 id 则更新
  update  — 按 id 更新 items 中匹配项的 status
  replace — 全量替换 todo 列表（清空旧的，使用新列表）

约定：
  - id 取 "1", "2", "3"... 简单递增即可
  - status 为 "pending" 或 "completed"
  - 同一任务可多次输出 TODO_UPDATE，会基于已有 todo 消息追加/更新`;
