export const PROTOCOL_PROMPT = `[TASK_UPDATE] 协议参考

格式示例：
[TASK_UPDATE]
action: propose_plan
steps:
  - 步骤1描述
  - 步骤2描述
[/TASK_UPDATE]

可用动作（按阶段）：
  demand / goal → propose_goal：提出目标确认
  goal          → lock_goal：锁定目标（由系统处理）
  plan          → propose_plan：提出执行计划
  execute       → finish_execute：标记执行完成（由系统处理）
  self_verify   → finish_verify：标记自验通过（由系统处理）
  review        → accept / reject：验收通过或驳回（由系统处理）

阶段流转规则：
  demand → propose_goal → goal
  goal   → lock_goal → plan
  plan   → propose_plan → execute
  execute → finish_execute → self_verify（自动流转）
  self_verify → finish_verify → review（自动流转）
  review → accept → completed
  review → reject → execute`;
