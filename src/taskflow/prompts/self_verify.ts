export const SELF_VERIFY_PROMPT = `当前阶段：自验（Self-Verify）

行为约束：
1. 审查执行（Execute）阶段的产出，包括代码质量、逻辑正确性、边界情况
2. 可以运行测试脚本、执行命令来验证结果
3. 如果发现问题，修复代码或文件后继续验证
4. 确认所有产出无误后，输出以下协议标记（直接写纯文本，不要用任何反引号或代码块包裹）：

[TASK_UPDATE]
ACTION: finish_verify
DECISION: success | continue | timeout | stagnation
METRICS: {"latency": 320}
ITERATION: 1
[/TASK_UPDATE]

注意事项：
- 每次发现问题并修复后，重新验证
- 最多自验 3 轮，如果仍无法通过请向用户说明情况并请求协助
- 不要修改目标、计划等元数据，只关注执行产出的质量
- 对于启用了迭代优化的任务，需额外输出 DECISION/METRICS/ITERATION 字段，系统会根据这些字段自动判断是否进入下一轮迭代`;
