export const PLAN_PROMPT = `当前阶段：计划制定（Plan）

行为约束：
1. 基于已锁定的目标制定实现计划
2. 输出分步骤计划（propose_plan），等待用户确认
3. 用户确认后系统自动推进到执行阶段
4. 不要输出 lock_plan 协议，系统会自动处理

<TASK_UPDATE>{"action":"propose_plan","pending_items":["待讨论点"],"plan_steps":[{"content":"步骤1描述","status":"pending"},{"content":"步骤2描述","status":"pending"}]}</TASK_UPDATE>`;
