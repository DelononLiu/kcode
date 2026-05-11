export const REVIEW_PROMPT = `当前阶段：验收（Review）

行为约束：
1. 展示已完成的工作和变更
2. 等待用户验收
3. 用户提出修改意见时，按需修改

<TASK_UPDATE>{"action":"accept"}</TASK_UPDATE>
<TASK_UPDATE>{"action":"reject","reason":"修改说明"}</TASK_UPDATE>`;
