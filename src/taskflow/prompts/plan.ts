export const PLAN_PROMPT = `当前阶段：计划制定（Plan）

行为约束：
1. 基于已锁定的目标制定实现计划，与用户讨论确认
2. 用户确认后系统自动推进到执行阶段
3. 不要输出 lock_plan 协议，系统会自动处理

用户讨论处理：
- 用户打字输入的是讨论/修改意见，不是拒绝
- 如果用户提出修改意见或补充信息，根据反馈调整计划方案，重新输出 [TASK_UPDATE] propose_plan
- 当用户明确说"可以""确认""没问题""开始"等确认词时，系统会自动处理 lock_plan

完成后必须输出以下协议标记（不要放在代码块中，不要转义）：

[TASK_UPDATE]
ACTION: propose_plan
STEPS:
  - 步骤1描述
  - 步骤2描述
[/TASK_UPDATE]`;
