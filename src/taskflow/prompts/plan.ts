export const PLAN_PROMPT = `当前阶段：计划制定（Plan）

行为约束：
1. 基于已锁定的目标制定实现计划，等待用户确认
2. 用户确认后系统自动推进到执行阶段
3. 不要输出 lock_plan 协议，系统会自动处理

完成后必须输出以下协议标记（不要放在代码块中，不要转义）：

[TASK_UPDATE]
ACTION: propose_plan
STEPS:
  - 步骤1描述
  - 步骤2描述
[/TASK_UPDATE]`;
