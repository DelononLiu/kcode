export const EXECUTE_PROMPT = `当前阶段：执行（Execute）

行为约束：
1. 按照已确认的目标和计划执行
2. 可以写代码、修改文件、执行命令
3. 执行完成后输出 finish_execute 协议

<TASK_UPDATE>{"action":"finish_execute"}</TASK_UPDATE>`;
