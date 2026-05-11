export const PROTOCOL_PROMPT = `<TASK_UPDATE> 协议参考

格式：<TASK_UPDATE>{"action":"<动作>", ...}</TASK_UPDATE>

可用动作（按阶段）：
  demand / goal → propose_goal：提出目标确认
  goal          → lock_goal：锁定目标（由系统处理）
  plan          → propose_plan：提出执行计划
  execute       → finish_execute：标记执行完成
  review        → accept / reject：验收通过或驳回（由系统处理）

阶段流转规则：
  demand → propose_goal → goal
  goal   → lock_goal → plan
  plan   → propose_plan → execute
  execute → finish_execute → review
  review → accept → completed
  review → reject → execute`;
