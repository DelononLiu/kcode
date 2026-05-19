import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
    workspace: {
        fs: { writeFile: vi.fn() },
        getConfiguration: vi.fn(() => ({ get: vi.fn() })),
    },
    commands: { executeCommand: vi.fn() },
    Uri: { file: vi.fn((p: string) => ({ $uri: p })) },
    window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
}));

import { MessageRouter } from '../MessageRouter';
import { TaskFlowHandler } from '../TaskFlowHandler';
import type { Task, FileChange, ProgressNode } from '../../types';

function makeMockTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-1', title: 'Test', goal: '', type: 'task', status: 'pending',
        phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [],
        createdAt: Date.now(), pinned: false, ...overrides,
    };
}

function makeMockCtx() {
    const store = {
        getTask: vi.fn(),
        getMessages: vi.fn().mockReturnValue([]),
        nextMessageId: vi.fn().mockReturnValue('msg-1'),
        addMessage: vi.fn(),
        updateMessageContent: vi.fn(),
        updateTaskPhase: vi.fn(),
        updateTaskStatus: vi.fn(),
        updateTaskGoal: vi.fn(),
        storeReviewChanges: vi.fn(),
        getReviewChanges: vi.fn().mockReturnValue([]),
        getTaskKnowledgeEntries: vi.fn().mockReturnValue([]),
        getAllKnowledgeEntries: vi.fn().mockReturnValue([]),
        updatePlanSteps: vi.fn(),
    };
    const router = new MessageRouter();
    const postSpy = vi.fn();
    router.PostMessage = postSpy;
    const taskFlow = {
        confirmGoal: vi.fn(),
        confirmGoalWithEdit: vi.fn(),
        confirmPlan: vi.fn(),
        confirmExecuteDone: vi.fn(),
        rejectPlan: vi.fn(),
        rejectReview: vi.fn(),
        finishReview: vi.fn(),
        getPlanEntries: vi.fn().mockReturnValue([]),
        isExecuteFinished: vi.fn().mockReturnValue(false),
        buildPhaseTransitionPrompt: vi.fn().mockReturnValue('transition prompt'),
        getCleanText: vi.fn().mockReturnValue(''),
        resetGeneration: vi.fn(),
    };
    const agentService = {
        cancel: vi.fn(),
        getReviewChanges: vi.fn().mockReturnValue([]),
    };
    const refreshSidebarCallback = vi.fn();
    const setGenerationState = vi.fn();
    const sendTaskInfo = vi.fn();
    const sendNodePanelUpdate = vi.fn();
    const sendHooksAsMessage = vi.fn().mockResolvedValue(undefined);
    const sendAgentPrompt = vi.fn().mockResolvedValue(undefined);
    const storeMessage = vi.fn().mockReturnValue('msg-store');
    const startAutoGeneration = vi.fn();

    const ctx = {
        store, router, taskFlow, agentService,
        refreshSidebarCallback, setGenerationState,
        sendTaskInfo, sendNodePanelUpdate, sendHooksAsMessage,
        sendAgentPrompt, storeMessage, startAutoGeneration,
        currentTaskId: 'task-1',
        activeToolCalls: new Map(),
        isGenerating: false,
        pendingMessages: [],
        hasSetPlanMessage: false,
        hasSetExecuteMessage: false,
        sendPendingQueueUpdate: vi.fn(),
        sendAcpLog: vi.fn(),
        flushAcpRecvBuffer: vi.fn(),
        triggerReviewRequest: vi.fn(),
        showPlanConfirmation: vi.fn().mockReturnValue(true),
        showAgentError: vi.fn(),
        stopGeneration: vi.fn(),
        loadTask: vi.fn(),
        loadAssistant: vi.fn(),
    };

    const handler = new TaskFlowHandler(ctx as any);

    return { handler, ctx, store, router, postSpy, taskFlow, agentService };
}

describe('TaskFlowHandler', () => {
    let mocks: ReturnType<typeof makeMockCtx>;

    beforeEach(() => {
        mocks = makeMockCtx();
        vi.clearAllMocks();
    });

    describe('deriveNodes', () => {
        it('任务不存在返回空数组', () => {
            mocks.store.getTask.mockReturnValue(undefined);
            expect(mocks.handler.deriveNodes('task-1')).toEqual([]);
        });

        it('pending 任务首节点 active 其余 pending', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({ status: 'pending', phase: 'demand' }));
            mocks.store.getMessages.mockReturnValue([]);
            const nodes = mocks.handler.deriveNodes('task-1');
            expect(nodes).toHaveLength(6);
            expect(nodes[0].status).toBe('active');
            expect(nodes.slice(1).every(n => n.status === 'pending')).toBe(true);
        });

        it('completed 任务前 6 节点全部 completed', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({ status: 'completed', phase: 'review' }));
            mocks.store.getMessages.mockReturnValue([{ type: 'review_request' } as any]);
            mocks.taskFlow.getPlanEntries.mockReturnValue([{ content: 'step', priority: 'high', status: 'completed' }]);
            const nodes = mocks.handler.deriveNodes('task-1');
            expect(nodes.filter(n => n.status === 'completed').length).toBeGreaterThanOrEqual(5);
        });

        it('interruptAt 中断点标记 cancelled', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({ status: 'cancelled', phase: 'demand', goal: '' }));
            mocks.store.getMessages.mockReturnValue([]);
            const nodes = mocks.handler.deriveNodes('task-1');
            const cancelled = nodes.find(n => n.status === 'cancelled');
            expect(cancelled).toBeDefined();
            expect(cancelled!.type).toBe('goal');
        });
    });

    describe('showPlanConfirmation', () => {
        it('无 plan steps 返回 false', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({ planSteps: [] }));
            expect(mocks.handler.showPlanConfirmation('task-1')).toBe(false);
        });

        it('有 plan steps 发送消息并返回 true', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({
                planSteps: [{ content: 'step1', status: 'pending' }],
            }));
            const result = mocks.handler.showPlanConfirmation('task-1');
            expect(result).toBe(true);
            expect(mocks.store.addMessage).toHaveBeenCalled();
            expect(mocks.postSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'showPlanProposal' }));
        });
    });

    describe('handleTodoUpdate', () => {
        it('replace 操作覆盖全部 todo', () => {
            mocks.store.getMessages.mockReturnValue([]);
            mocks.store.getTask.mockReturnValue(makeMockTask());
            mocks.handler.handleTodoUpdate('task-1', [{ id: '1', content: 'todo1', status: 'pending' }], 'replace');
            expect(mocks.store.addMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'todo' })
            );
        });

        it('add 操作追加到已有 todo', () => {
            mocks.store.getMessages.mockReturnValue([
                { type: 'todo', content: JSON.stringify([{ id: '1', content: 'a', status: 'pending' }]) },
            ] as any);
            mocks.store.getTask.mockReturnValue(makeMockTask());
            mocks.handler.handleTodoUpdate('task-1', [{ id: '2', content: 'b', status: 'pending' }], 'add');
            expect(mocks.store.updateMessageContent).toHaveBeenCalled();
        });

        it('update 操作更新已有 item 状态', () => {
            mocks.store.getMessages.mockReturnValue([
                { id: 'todo-1', type: 'todo', content: JSON.stringify([{ id: '1', content: 'a', status: 'pending' }]) },
            ] as any);
            mocks.store.getTask.mockReturnValue(makeMockTask());
            mocks.handler.handleTodoUpdate('task-1', [{ id: '1', content: 'a', status: 'completed' }], 'update');
            expect(mocks.store.updateMessageContent).toHaveBeenCalledWith(
                'task-1', 'todo-1',
                JSON.stringify([{ id: '1', content: 'a', status: 'completed' }])
            );
        });
    });

    describe('handleRejectPlan', () => {
        it('发送 reject 消息并调用 taskFlow.rejectPlan', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask());
            mocks.store.getMessages.mockReturnValue([]);
            mocks.handler.handleRejectPlan('task-1');
            expect(mocks.store.addMessage).toHaveBeenCalled();
            expect(mocks.taskFlow.rejectPlan).toHaveBeenCalledWith('task-1');
        });
    });

    describe('sendTaskInfo', () => {
        it('任务不存在时静默返回', () => {
            mocks.store.getTask.mockReturnValue(undefined);
            expect(() => mocks.handler.sendTaskInfo('task-1')).not.toThrow();
        });

        it('发送任务信息到 WebView', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask({ phase: 'execute', goal: 'do something' }));
            mocks.store.getMessages.mockReturnValue([]);
            mocks.handler.sendTaskInfo('task-1');
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'updateTaskInfo',
                    phase: 'execute',
                })
            );
        });
    });

    describe('handleStopGeneration', () => {
        it('无 taskId 且无 currentTaskId 时静默返回', () => {
            (mocks.ctx as any).currentTaskId = null;
            expect(() => mocks.handler.handleStopGeneration()).not.toThrow();
        });

        it('停止生成并保存当前文本', () => {
            mocks.store.getTask.mockReturnValue(makeMockTask());
            mocks.store.getMessages.mockReturnValue([]);
            mocks.taskFlow.getCleanText.mockReturnValue('some text');
            mocks.handler.handleStopGeneration('task-1');
            expect(mocks.agentService.cancel).toHaveBeenCalledWith('task-1');
        });
    });
});
