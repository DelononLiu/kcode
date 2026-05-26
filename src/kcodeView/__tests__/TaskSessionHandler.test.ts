import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({ get: vi.fn().mockReturnValue('') })),
        workspaceFolders: [{ uri: { fsPath: '/test' } }],
    },
    window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
}));

import { MessageRouter } from '../MessageRouter';
import { TaskSessionHandler } from '../TaskSessionHandler';

function makeMockCtx() {
    const store = {
        getTask: vi.fn(),
        getMessages: vi.fn().mockReturnValue([]),
        nextMessageId: vi.fn().mockReturnValue('msg-1'),
        addMessage: vi.fn(),
        updateTaskCategory: vi.fn(),
        updateTaskSubType: vi.fn(),
        updateTaskType: vi.fn(),
        updateTaskTitle: vi.fn(),
        updateTaskNodeMessageId: vi.fn(),
    };
    const router = new MessageRouter();
    const postSpy = vi.fn();
    router.PostMessage = postSpy;
    const taskFlow = {
        buildInitialPrompt: vi.fn().mockReturnValue('initial prompt'),
        buildPhaseTransitionPrompt: vi.fn().mockReturnValue('transition prompt'),
        resetGeneration: vi.fn(),
        getCleanText: vi.fn().mockReturnValue(''),
    };
    const agentService = {
        isConnected: false,
        hasSession: vi.fn().mockReturnValue(false),
        connect: vi.fn().mockResolvedValue(true),
        connectByLabel: vi.fn().mockResolvedValue(true),
        disconnect: vi.fn().mockResolvedValue(undefined),
        createSession: vi.fn().mockResolvedValue('session-1'),
        sendPrompt: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
        getAvailableModels: vi.fn().mockReturnValue([]),
        lastError: '',
        agentName: 'kilo',
    };
    const refreshSidebarCallback = vi.fn();
    const setGenerationState = vi.fn();
    const sendTaskInfo = vi.fn();
    const sendNodePanelUpdate = vi.fn();
    const sendHooksAsMessage = vi.fn().mockResolvedValue(undefined);
    const sendAgentPrompt = vi.fn().mockResolvedValue(undefined);
    const storeMessage = vi.fn().mockReturnValue('msg-store');
    const sendAcpLog = vi.fn();
    const flushAcpRecvBuffer = vi.fn();
    const activeToolCalls = new Map();
    const triggerReviewRequest = vi.fn();
    const showPlanConfirmation = vi.fn().mockReturnValue(true);
    const showAgentError = vi.fn();
    const sendPendingQueueUpdate = vi.fn();

    const ctx = {
        store, router, taskFlow, agentService,
        refreshSidebarCallback, setGenerationState,
        sendTaskInfo, sendNodePanelUpdate, sendHooksAsMessage,
        sendAgentPrompt, storeMessage, sendAcpLog, flushAcpRecvBuffer,
        triggerReviewRequest, showPlanConfirmation, showAgentError,
        sendPendingQueueUpdate,
        currentTaskId: 'task-1',
        activeToolCalls,
        isGenerating: false,
        pendingMessages: [],
        hasSetPlanMessage: false,
        hasSetExecuteMessage: false,
        stopGeneration: vi.fn(),
        loadTask: vi.fn(),
        loadAssistant: vi.fn(),
    };

    const handler = new TaskSessionHandler(ctx as any);

    return { handler, ctx, store, router, postSpy, taskFlow, agentService };
}

describe('TaskSessionHandler', () => {
    let mocks: ReturnType<typeof makeMockCtx>;

    beforeEach(() => {
        mocks = makeMockCtx();
        vi.clearAllMocks();
    });

    describe('sendAgentList', () => {
        it('发送可用 Agent 列表', () => {
            mocks.handler.sendAgentList();
            expect(mocks.postSpy).toHaveBeenCalledWith({
                type: 'agentList',
                agents: expect.arrayContaining([
                    expect.objectContaining({ label: 'Kilo' }),
                    expect.objectContaining({ label: 'OpenCode' }),
                ]),
            });
        });
    });

    describe('createAgentResponseHandler', () => {
        it('返回 handler 对象含所有回调方法', () => {
            const handler = mocks.handler.createAgentResponseHandler('task-1', false, '');
            expect(handler).toHaveProperty('onText');
            expect(handler).toHaveProperty('onError');
            expect(handler).toHaveProperty('onDone');
            expect(handler).toHaveProperty('onReasoning');
            expect(handler).toHaveProperty('onToolCall');
            expect(handler).toHaveProperty('onToolCallUpdate');
            expect(handler).toHaveProperty('onPlan');
        });

        it('onError 设置生成状态并发送错误', () => {
            const handler = mocks.handler.createAgentResponseHandler('task-1', false, '');
            handler.onError('test error');
            expect(mocks.ctx.setGenerationState).toHaveBeenCalledWith(false);
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'agentStreamUpdate' })
            );
        });

        it('onDone cancelled 通知重置', () => {
            mocks.store.getTask.mockReturnValue({ id: 'task-1', type: 'task' });
            mocks.store.getMessages.mockReturnValue([]);
            const handler = mocks.handler.createAgentResponseHandler('task-1', false, '');
            mocks.taskFlow.getCleanText.mockReturnValue('');
            handler.onDone('cancelled');
            expect(mocks.ctx.setGenerationState).toHaveBeenCalledWith(false);
        });
    });

    describe('ensureSession', () => {
        it('throws when createSession returns null', async () => {
            mocks.agentService.isConnected = true;
            mocks.agentService.hasSession = vi.fn().mockReturnValue(false);
            mocks.agentService.createSession = vi.fn().mockResolvedValue(null);
            mocks.agentService.lastError = 'agent crashed';
            await expect(mocks.handler.ensureSession('task-1')).rejects.toThrow('agent crashed');
        });

        it('skips when already has session', async () => {
            mocks.agentService.isConnected = true;
            mocks.agentService.hasSession = vi.fn().mockReturnValue(true);
            const createSpy = vi.fn();
            mocks.agentService.createSession = createSpy;
            await mocks.handler.ensureSession('task-1');
            expect(createSpy).not.toHaveBeenCalled();
        });
    });

    describe('doPrompt', () => {
        it('calls onError when createSession returns null', async () => {
            mocks.agentService.isConnected = true;
            mocks.agentService.hasSession = vi.fn().mockReturnValue(false);
            mocks.agentService.createSession = vi.fn().mockResolvedValue(null);
            mocks.agentService.lastError = 'ACP 会话创建失败';
            const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
            await mocks.handler.doPrompt('task-1', 'hello', handler);
            expect(handler.onError).toHaveBeenCalledWith('ACP 会话创建失败');
        });
    });

    describe('switchAgent', () => {
        it('切换 Agent 后发送连接状态', async () => {
            await mocks.handler.handleSwitchAgent('OpenCode');
            expect(mocks.agentService.disconnect).toHaveBeenCalled();
            expect(mocks.agentService.connectByLabel).toHaveBeenCalledWith('OpenCode');
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'agentStatus', status: 'connected' })
            );
        });

        it('切换失败发送 disconnected 状态', async () => {
            mocks.agentService.connectByLabel = vi.fn().mockResolvedValue(false);
            mocks.agentService.lastError = '连接失败';
            await mocks.handler.handleSwitchAgent('nonexistent');
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'agentStatus', status: 'disconnected' })
            );
        });
    });
});
