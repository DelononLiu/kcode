export const EXECUTE_PROMPT = `当前阶段：执行（Execute）

行为约束：
1. 按照已确认的目标和计划执行
2. 写文件时，务必使用 ACP 文件写入协议（writeTextFile），不要使用 shell 命令写文件
3. 如需执行命令，使用命令行执行
4. 执行完成后输出以下协议标记：

[TASK_UPDATE]
ACTION: finish_execute
[/TASK_UPDATE]`;

export const EXECUTE_ITERATION_CONTEXT = `
【迭代优化提示】
你处于迭代优化流程中。
- 请在前一轮输出的基础上继续优化
- 关注历史指标中尚未达标的项
- 不要回退已达标指标的性能`;
