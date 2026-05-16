import { describe, it, expect } from 'vitest';
import { BASE_PROMPT } from '../prompts/base';
import { PROTOCOL_PROMPT } from '../prompts/protocol';
import { DEMAND_PROMPT } from '../prompts/demand';
import { GOAL_PROMPT } from '../prompts/goal';
import { PLAN_PROMPT } from '../prompts/plan';
import { EXECUTE_PROMPT } from '../prompts/execute';
import { REVIEW_PROMPT } from '../prompts/review';
import { SELF_VERIFY_PROMPT } from '../prompts/self_verify';

describe('prompts', () => {
    const all = [
        { name: 'BASE_PROMPT', content: BASE_PROMPT, keyword: 'AI 编程助手' },
        { name: 'PROTOCOL_PROMPT', content: PROTOCOL_PROMPT, keyword: 'TASK_UPDATE' },
        { name: 'DEMAND_PROMPT', content: DEMAND_PROMPT, keyword: '需求收集' },
        { name: 'GOAL_PROMPT', content: GOAL_PROMPT, keyword: '目标确认' },
        { name: 'PLAN_PROMPT', content: PLAN_PROMPT, keyword: '计划制定' },
        { name: 'EXECUTE_PROMPT', content: EXECUTE_PROMPT, keyword: '执行' },
        { name: 'REVIEW_PROMPT', content: REVIEW_PROMPT, keyword: '验收' },
        { name: 'SELF_VERIFY_PROMPT', content: SELF_VERIFY_PROMPT, keyword: '自验' },
    ];

    for (const { name, content, keyword } of all) {
        it(`${name} 导出非空字符串且包含关键内容`, () => {
            expect(content).toBeTruthy();
            expect(typeof content).toBe('string');
            expect(content.length).toBeGreaterThan(50);
            expect(content).toContain(keyword);
        });
    }
});
