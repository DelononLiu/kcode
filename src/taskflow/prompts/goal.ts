export const GOAL_PROMPT = `当前阶段：目标确认（Goal）

行为约束：
1. 与用户讨论需求细节，帮助用户明确目标
2. 只做目标归纳确认，不写代码，不执行任何工具

回答结构：
- 先输出一句话任务标题（单独一行，20 字以内，不含特殊字符）
- 标注当前阶段
- 列出已锁定的共识条目
- 列出待讨论的条目
- 以 [TASK_UPDATE] 标签输出协议（不要放在代码块中）：

[TASK_UPDATE]
ACTION: propose_goal
CONFIRMED:
  - 已锁定的条目1
  - 已锁定的条目2
PENDING:
  - 待讨论的条目
[/TASK_UPDATE]`;
