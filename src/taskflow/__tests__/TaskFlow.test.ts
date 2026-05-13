import { describe, it, expect } from 'vitest';
import { TaskFlow, ITaskStore, TaskFlowDelegate } from '../TaskFlow';
import type { Task, PlanStep, ChatMessage } from '../../types';
import { DEMAND_PROMPT } from '../prompts/demand';
import { GOAL_PROMPT } from '../prompts/goal';
import { PLAN_PROMPT } from '../prompts/plan';
import { EXECUTE_PROMPT } from '../prompts/execute';
import { REVIEW_PROMPT } from '../prompts/review';

// ==============================
// Mock Store
// ==============================

class MockTaskStore implements ITaskStore {
    private tasks: Map<string, Task> = new Map();
    private messages: Map<string, ChatMessage[]> = new Map();
    private msgIdCounter = 0;

    getTask(taskId: string): Task | undefined {
        return this.tasks.get(taskId);
    }

    updateTaskPhase(taskId: string, phase: Task['phase']): void {
        const t = this.tasks.get(taskId);
        if (t) t.phase = phase;
    }

    updateTaskStatus(taskId: string, status: Task['status']): void {
        const t = this.tasks.get(taskId);
        if (t) t.status = status;
    }

    updateConfirmedItems(taskId: string, items: string[]): void {
        const t = this.tasks.get(taskId);
        if (t) t.confirmedItems = items;
    }

    updatePendingItems(taskId: string, items: string[]): void {
        const t = this.tasks.get(taskId);
        if (t) t.pendingItems = items;
    }

    updatePlanSteps(taskId: string, steps: PlanStep[]): void {
        const t = this.tasks.get(taskId);
        if (t) t.planSteps = steps;
    }

    updatePlanStepStatus(taskId: string, index: number, status: PlanStep['status']): void {
        const t = this.tasks.get(taskId);
        if (t && t.planSteps[index]) {
            t.planSteps[index].status = status;
        }
    }

    updateTaskGoal(taskId: string, goal: string): void {
        const t = this.tasks.get(taskId);
        if (t) t.goal = goal;
    }

    updateTaskNodeMessageId(_taskId: string, _nodeType: string, _messageId: string): void {}

    getMessages(taskId: string): ChatMessage[] {
        return this.messages.get(taskId) || [];
    }

    addMessage(msg: ChatMessage): void {
        const msgs = this.messages.get(msg.taskId) || [];
        msgs.push(msg);
        this.messages.set(msg.taskId, msgs);
    }

    nextMessageId(_taskId: string): string {
        this.msgIdCounter++;
        return `msg_${this.msgIdCounter}`;
    }

    updateMessageType(_taskId: string, _messageId: string, _type?: ChatMessage['type']): void {}

    updateTaskTitle(_taskId: string, _title: string): void {}

    updateTaskType(taskId: string, type: 'task' | 'chat'): void {
        const t = this.tasks.get(taskId);
        if (t) t.type = type;
    }

    updateTaskHooks(_taskId: string, _phase: string, _commands: string[]): void {}

    addTask(task: Task): void {
        this.tasks.set(task.id, task);
    }
}

// ==============================
// Mock Delegate
// ==============================

class MockDelegate implements TaskFlowDelegate {
    phaseChanged: string[] = [];
    executeFinished: string[] = [];
    selfVerifyFinished: string[] = [];
    planStepUpdated: string[] = [];
    goalFormatted: boolean = false;

    onPhaseChanged(taskId: string): void { this.phaseChanged.push(taskId); }
    onExecuteFinished(taskId: string): void { this.executeFinished.push(taskId); }
    onGoalFormatted(): void { this.goalFormatted = true; }
    onError(_taskId: string, _error: string): void {}
    onSelfVerifyNeeded(_taskId: string): void {}
    onSelfVerifyFinished(taskId: string): void { this.selfVerifyFinished.push(taskId); }
    onPlanStepUpdate(taskId: string): void { this.planStepUpdated.push(taskId); }
    onTaskDelegated(_taskId: string, _payload: any): void {}
}

// ==============================
// Helpers
// ==============================

function makeFlow(overrides: Partial<Task> = {}) {
    const task: Task = {
        id: 'task_1', title: 'Test', goal: '', type: 'task', status: 'pending',
        phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [], createdAt: Date.now(),
        ...overrides,
    };
    const store = new MockTaskStore();
    store.addTask(task);
    const delegate = new MockDelegate();
    const flow = new TaskFlow(store, delegate);
    flow.loadTask(task.id);
    return { flow, store, delegate, pid: task.id };
}

// ==============================
// Test 1: buildPrompt — phase-specific prompt injection
// ==============================

describe('buildPrompt', () => {
    it('输出各阶段对应的 System Prompt', () => {
        const cases: Array<{ phase: Task['phase']; expectText: string; prompt: string }> = [
            { phase: 'demand',  expectText: '需求收集（Demand）',  prompt: DEMAND_PROMPT },
            { phase: 'goal',    expectText: '目标确认（Goal）',    prompt: GOAL_PROMPT },
            { phase: 'plan',    expectText: '计划制定（Plan）',    prompt: PLAN_PROMPT },
            { phase: 'execute', expectText: '执行（Execute）',     prompt: EXECUTE_PROMPT },
            { phase: 'review',  expectText: '验收（Review）',      prompt: REVIEW_PROMPT },
        ];

        for (const { phase, expectText, prompt } of cases) {
            const { flow, store, pid } = makeFlow({ phase });
            const result = flow.buildPrompt(pid, 'hello');
            expect(result).toContain(expectText);
            expect(result).toContain(prompt);
            expect(result).toContain('专注于任务驱动的 AI 编程助手');  // BASE_PROMPT
            expect(result).toContain('[TASK_UPDATE] 协议参考');      // PROTOCOL_PROMPT
            expect(result).toContain('hello');
        }
    });

    it('chat 类型带有系统提示词', () => {
        const { flow, pid } = makeFlow({ type: 'chat' });
        const result = flow.buildPrompt(pid, 'hello');
        expect(result).toContain('AI 编程助手');
        expect(result).toContain('hello');
    });
});

// ==============================
// Test 2: processChunk — TASK_UPDATE 协议解析
// ==============================

describe('processChunk', () => {
    it('解析 propose_goal 并更新 store', () => {
        const { flow, store, delegate, pid } = makeFlow({ phase: 'goal' });
        flow.processChunk(pid,
            '[TASK_UPDATE]\nACTION: propose_goal\nCONFIRMED:\n  - 登录\n  - 注册\nPENDING:\n  - 邮箱验证\n[/TASK_UPDATE]'
        );
        const t = store.getTask(pid)!;
        expect(t.confirmedItems).toEqual(['登录', '注册']);
        expect(t.pendingItems).toEqual(['邮箱验证']);
        expect(delegate.phaseChanged).toContain(pid);
    });

    it('解析 propose_plan 并更新 store', () => {
        const { flow, store, delegate, pid } = makeFlow({ phase: 'plan' });
        flow.processChunk(pid,
            '[TASK_UPDATE]\nACTION: propose_plan\nSTEPS:\n  - 步骤1\n[/TASK_UPDATE]'
        );
        expect(store.getTask(pid)!.planSteps).toEqual([{ content: '步骤1', status: 'pending' }]);
        expect(delegate.phaseChanged).toContain(pid);
        expect(flow.isPlanProposed(pid)).toBe(true);
    });

    it('解析 finish_execute 并触发回调', () => {
        const { flow, delegate, pid } = makeFlow({ phase: 'execute' });
        flow.processChunk(pid, '[TASK_UPDATE]\nACTION: finish_execute\n[/TASK_UPDATE]');
        expect(delegate.executeFinished).toContain(pid);
        expect(flow.isExecuteFinished(pid)).toBe(true);
    });

    it('嵌入文本的 TASK_UPDATE 块不被剥离（独立块约束）', () => {
        const { flow, pid } = makeFlow({ phase: 'goal' });
        const result = flow.processChunk(pid,
            '文本[TASK_UPDATE]\nACTION: propose_goal\nCONFIRMED:\n  - A\n[/TASK_UPDATE]继续'
        );
        // 块嵌入句中，不符合独立段落约束，保持原样
        expect(result).toContain('[TASK_UPDATE]');
        expect(result).toContain('ACTION: propose_goal');
    });
});

// ==============================
// Test 3: 完整流程 demand → goal → plan → execute → review → completed
// ==============================

describe('完整流程', () => {
    it('走通 demand → goal → plan → execute → review → completed', () => {
        const { flow, store, delegate, pid } = makeFlow();

        // demand: AI 输出 propose_goal（带尾部换行模拟末尾流式）
        flow.processChunk(pid,
            '[TASK_UPDATE]\nACTION: propose_goal\nCONFIRMED:\n  - 用户登录\n[/TASK_UPDATE]\n'
        );
        expect(store.getTask(pid)!.confirmedItems).toEqual(['用户登录']);

        // processGoalProposal → phase = goal
        flow.processGoalProposal(pid, '实现用户登录功能', '写登录', '写登录');
        expect(store.getTask(pid)!.phase).toBe('goal');

        // confirmGoal → phase = plan
        flow.confirmGoal(pid);
        expect(store.getTask(pid)!.phase).toBe('plan');

        // plan: AI 输出 propose_plan
        flow.processChunk(pid,
            '[TASK_UPDATE]\nACTION: propose_plan\nSTEPS:\n  - 设计 API\n[/TASK_UPDATE]'
        );
        expect(flow.isPlanProposed(pid)).toBe(true);

        // confirmPlan → phase = execute
        flow.confirmPlan(pid);
        expect(store.getTask(pid)!.phase).toBe('execute');

        // execute: AI 输出 finish_execute
        flow.processChunk(pid, '[TASK_UPDATE]\nACTION: finish_execute\n[/TASK_UPDATE]');
        expect(delegate.executeFinished).toContain(pid);

        // confirmExecuteDone → phase = self_verify
        flow.confirmExecuteDone(pid);
        expect(store.getTask(pid)!.phase).toBe('self_verify');
        expect(store.getTask(pid)!.status).toBe('active');

        // self_verify: AI 输出 finish_verify
        flow.processChunk(pid, '[TASK_UPDATE]\nACTION: finish_verify\n[/TASK_UPDATE]');
        expect(delegate.selfVerifyFinished).toContain(pid);

        // confirmSelfVerifyDone → phase = review
        flow.confirmSelfVerifyDone(pid);
        expect(store.getTask(pid)!.phase).toBe('review');
        expect(store.getTask(pid)!.status).toBe('in_review');

        // finishReview → completed
        flow.finishReview(pid);
        expect(store.getTask(pid)!.status).toBe('completed');
    });
});
