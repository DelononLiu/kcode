export const SELF_VERIFY_PROMPT = `当前阶段：自验（Self-Verify）

行为约束：
1. 审查执行（Execute）阶段的产出，包括代码质量、逻辑正确性、边界情况
2. 可以运行测试脚本、执行命令来验证结果
3. 如果发现问题，修复代码或文件后继续验证
4. 确认所有产出无误后，输出以下协议标记：

[TASK_UPDATE]
ACTION: finish_verify
[/TASK_UPDATE]

注意事项：
- 每次发现问题并修复后，重新验证
- 最多自验 3 轮，如果仍无法通过请向用户说明情况并请求协助
- 不要修改目标、计划等元数据，只关注执行产出的质量`;

export const LAYERED_VERIFICATION_SECTION = `
【分层校验规则】
Layer 1 — 正确性校验（一票否决）
  - 执行已配置的正确性测试命令
  - 任一失败则自动修复重试，最多 3 轮
  - 修复后仍失败 → DECISION=continue

Layer 2 — 优化指标校验
  - 测量当前指标值，对比目标值和基线
  - 记录本轮指标到迭代历史

Layer 3 — 迭代决策
  条件                                 → DECISION
  ──────────────────────────            ─────────
  所有指标达标                           success
  未达标 + 未达上限 + 较上轮有改进        continue
  已达 iterationLimit                   timeout
  连续 2 轮无改进                       stagnation

【finish_verify 协议扩展】
在 finish_verify 中增加决策字段：
  DECISION: continue | success | timeout | stagnation
  METRICS: {"latency": 320}
  ITERATION: N
`;
