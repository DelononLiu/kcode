import { describe, it, expect } from 'vitest';
import { BASE_PROMPT } from '../prompts/base';
import { PROTOCOL_PROMPT, PROTOCOL_CORE, PROTOCOL_DELEGATE, PROTOCOL_KNOWLEDGE } from '../prompts/protocol';
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
        { name: 'PROTOCOL_CORE', content: PROTOCOL_CORE, keyword: 'TASK_UPDATE' },
        { name: 'PROTOCOL_DELEGATE', content: PROTOCOL_DELEGATE, keyword: 'TASK_DELEGATE' },
        { name: 'PROTOCOL_KNOWLEDGE', content: PROTOCOL_KNOWLEDGE, keyword: 'KNOWLEDGE_ENTRY' },
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

    describe('content structure', () => {
        it('BASE_PROMPT 包含阶段流程和 TASK_UPDATE 协议规则', () => {
            expect(BASE_PROMPT).toContain('[TASK_UPDATE]');
            expect(BASE_PROMPT).toContain('6 个阶段');
            expect(BASE_PROMPT).toContain('Demand');
            expect(BASE_PROMPT).toContain('Goal');
            expect(BASE_PROMPT).toContain('Plan');
            expect(BASE_PROMPT).toContain('Execute');
            expect(BASE_PROMPT).toContain('Self-Verify');
            expect(BASE_PROMPT).toContain('Review');
            expect(BASE_PROMPT).toContain('ACTION');
            expect(BASE_PROMPT).toContain('STEPS');
        });

        it('PROTOCOL_CORE 包含完整动作定义', () => {
            expect(PROTOCOL_CORE).toContain('propose_goal');
            expect(PROTOCOL_CORE).toContain('propose_plan');
            expect(PROTOCOL_CORE).toContain('finish_execute');
            expect(PROTOCOL_CORE).toContain('finish_verify');
            expect(PROTOCOL_CORE).toContain('accept');
            expect(PROTOCOL_CORE).toContain('reject');
            expect(PROTOCOL_CORE).toContain('plan_step_update');
            expect(PROTOCOL_CORE).toContain('ACTION');
            expect(PROTOCOL_CORE).toContain('STEPS');
        });

        it('PROTOCOL_DELEGATE 包含完整委派字段', () => {
            expect(PROTOCOL_DELEGATE).toContain('TITLE');
            expect(PROTOCOL_DELEGATE).toContain('GOAL');
            expect(PROTOCOL_DELEGATE).toContain('RELATED');
            expect(PROTOCOL_DELEGATE).toContain('CONFIRMED');
            expect(PROTOCOL_DELEGATE).toContain('CONTEXT');
        });

        it('PROTOCOL_KNOWLEDGE 包含完整知识类型', () => {
            expect(PROTOCOL_KNOWLEDGE).toContain('<KNOWLEDGE_ENTRY>');
            expect(PROTOCOL_KNOWLEDGE).toContain('decision');
            expect(PROTOCOL_KNOWLEDGE).toContain('pitfall');
            expect(PROTOCOL_KNOWLEDGE).toContain('pattern');
            expect(PROTOCOL_KNOWLEDGE).toContain('code_snippet');
            expect(PROTOCOL_KNOWLEDGE).toContain('title');
            expect(PROTOCOL_KNOWLEDGE).toContain('content');
            expect(PROTOCOL_KNOWLEDGE).toContain('tags');
        });

        it('DEMAND_PROMPT 包含 demand 阶段协议', () => {
            expect(DEMAND_PROMPT).toContain('Demand');
            expect(DEMAND_PROMPT).toContain('ACTION: propose_goal');
            expect(DEMAND_PROMPT).toContain('[TASK_UPDATE]');
            expect(DEMAND_PROMPT).toContain('[/TASK_UPDATE]');
            expect(DEMAND_PROMPT).not.toContain('finish_execute');
            expect(DEMAND_PROMPT).not.toContain('propose_plan');
        });

        it('GOAL_PROMPT 包含 goal 阶段协议', () => {
            expect(GOAL_PROMPT).toContain('Goal');
            expect(GOAL_PROMPT).toContain('ACTION: propose_goal');
            expect(GOAL_PROMPT).toContain('[TASK_UPDATE]');
            expect(GOAL_PROMPT).toContain('[/TASK_UPDATE]');
            expect(GOAL_PROMPT).not.toContain('finish_execute');
        });

        it('PLAN_PROMPT 包含 plan 阶段协议', () => {
            expect(PLAN_PROMPT).toContain('Plan');
            expect(PLAN_PROMPT).toContain('ACTION: propose_plan');
            expect(PLAN_PROMPT).toContain('STEPS:');
            expect(PLAN_PROMPT).toContain('[TASK_UPDATE]');
            expect(PLAN_PROMPT).toContain('[/TASK_UPDATE]');
        });

        it('EXECUTE_PROMPT 包含 execute 阶段协议', () => {
            expect(EXECUTE_PROMPT).toContain('Execute');
            expect(EXECUTE_PROMPT).toContain('ACTION: finish_execute');
            expect(EXECUTE_PROMPT).toContain('[TASK_UPDATE]');
            expect(EXECUTE_PROMPT).toContain('[/TASK_UPDATE]');
        });

        it('SELF_VERIFY_PROMPT 包含自验协议字段', () => {
            expect(SELF_VERIFY_PROMPT).toContain('Self-Verify');
            expect(SELF_VERIFY_PROMPT).toContain('ACTION: finish_verify');
            expect(SELF_VERIFY_PROMPT).toContain('DECISION');
            expect(SELF_VERIFY_PROMPT).toContain('METRICS');
            expect(SELF_VERIFY_PROMPT).toContain('ITERATION');
            expect(SELF_VERIFY_PROMPT).toContain('[TASK_UPDATE]');
            expect(SELF_VERIFY_PROMPT).toContain('[/TASK_UPDATE]');
        });

        it('REVIEW_PROMPT 包含 KNOWLEDGE_ENTRY 和验收描述', () => {
            expect(REVIEW_PROMPT).toContain('Review');
            expect(REVIEW_PROMPT).toContain('<KNOWLEDGE_ENTRY>');
            expect(REVIEW_PROMPT).toContain('accept');
            expect(REVIEW_PROMPT).toContain('decision');
            expect(REVIEW_PROMPT).toContain('pitfall');
            expect(REVIEW_PROMPT).toContain('pattern');
            expect(REVIEW_PROMPT).toContain('code_snippet');
        });
    });
});
