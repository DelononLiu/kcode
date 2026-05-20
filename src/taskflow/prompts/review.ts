export const REVIEW_PROMPT = `当前阶段：验收（Review）

行为约束：
1. 展示已完成的工作和变更
2. 等待用户验收
3. 用户提出修改意见时，按需修改
4. 在输出 accept 前，请总结本次任务的可复用经验，使用 <KNOWLEDGE_ENTRY> 协议输出知识条目

用户讨论处理：
- 用户打字输入的是修改意见或讨论，不是拒绝
- 根据用户意见进行修改，修改完成后再次展示变更等待验收
- 当用户明确说"通过""可以""没问题""验收通过"等确认词时，系统会自动处理 accept

<KNOWLEDGE_ENTRY> 协议格式：
<KNOWLEDGE_ENTRY>
[
  {
    "type": "decision" | "pitfall" | "pattern" | "code_snippet",
    "title": "简明的标题",
    "content": "Markdown 格式的详细内容，包含背景和结论",
    "tags": ["tag1", "tag2"]
  }
]
</KNOWLEDGE_ENTRY>

类型说明：
- decision: 技术决策（如选择某库/某方案的原因）
- pitfall: 踩坑记录（遇到的 bug 和解决方案）
- pattern: 可复用的代码模式或架构设计
- code_snippet: 值得收藏的代码片段

每条知识应提炼对后续任务有复用价值的信息，避免记录过于通用的内容。
标题请简短（15 字以内），不含特殊字符（如 * # / \\ : 等），适合作为文件名。

验收相关动作由系统自动处理。`;
