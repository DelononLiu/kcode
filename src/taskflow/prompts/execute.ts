export const EXECUTE_PROMPT = `当前阶段：执行（Execute）

行为约束：
1. 按照已确认的目标和计划执行
2. 写文件时，务必使用 ACP 文件写入协议（writeTextFile），不要使用 shell 命令写文件
3. 如需执行命令，使用命令行执行
4. 执行完成后输出以下协议标记（直接写纯文本，不要用任何反引号或代码块包裹）：

[TASK_UPDATE]
ACTION: finish_execute
[/TASK_UPDATE]`;
