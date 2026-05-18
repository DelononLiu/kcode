import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../MessageRouter';
import { AssistantHandler } from '../AssistantHandler';

function makeMocks() {
    const store = {
        getAssistantMessages: vi.fn().mockReturnValue([]),
        addAssistantMessage: vi.fn(),
        nextAssistantMessageId: vi.fn().mockReturnValue('msg-1'),
        addTask: vi.fn(),
    };
    const agentService = {
        isConnected: false,
        connect: vi.fn().mockResolvedValue(true),
        sendPrompt: vi.fn().mockResolvedValue(undefined),
    };
    const router = new MessageRouter();
    const postSpy = vi.fn();
    router.PostMessage = postSpy;
    const sessionHandler = {
        ensureConnection: vi.fn().mockResolvedValue(undefined),
    };
    const setGenerationState = vi.fn();
    const isGenerating = vi.fn().mockReturnValue(false);
    const pushPending = vi.fn();
    const sendPendingQueueUpdate = vi.fn();
    const refreshSidebar = vi.fn();
    const loadTask = vi.fn();

    return { store, agentService, router, postSpy, sessionHandler, setGenerationState, isGenerating, pushPending, sendPendingQueueUpdate, refreshSidebar, loadTask };
}

describe('AssistantHandler', () => {
    let mocks: ReturnType<typeof makeMocks>;
    let handler: AssistantHandler;

    beforeEach(() => {
        mocks = makeMocks();
        handler = new AssistantHandler(
            mocks.store as any,
            mocks.agentService as any,
            mocks.router,
            mocks.sessionHandler as any,
            mocks.setGenerationState,
            mocks.isGenerating,
            mocks.pushPending,
            mocks.sendPendingQueueUpdate,
            mocks.refreshSidebar,
            mocks.loadTask,
        );
    });

    it('showLanding 发送空节点和任务信息', () => {
        handler.showLanding();
        expect(mocks.postSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'updateNodePanel', taskType: 'assistant' })
        );
        expect(mocks.postSpy).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'updateTaskInfo', title: '💬 小助手' })
        );
    });

    it('loadMessages 发送 assistant 消息', () => {
        const msgs = [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }];
        mocks.store.getAssistantMessages.mockReturnValue(msgs);
        handler.loadMessages();
        expect(mocks.postSpy).toHaveBeenCalledWith({
            type: 'loadMessages', messages: msgs, taskId: '', taskType: 'assistant',
        });
    });

    it('handleMessage 创建 /go 任务', async () => {
        mocks.store.getAssistantMessages.mockReturnValue([
            { id: 'm1', role: 'user', content: '帮我写登录', timestamp: 1 },
        ]);
        await handler.handleMessage('/go');
        expect(mocks.store.addTask).toHaveBeenCalled();
        expect(mocks.loadTask).toHaveBeenCalled();
        expect(mocks.refreshSidebar).toHaveBeenCalled();
    });

    it('handleMessage 生成中时入队', async () => {
        mocks.isGenerating.mockReturnValue(true);
        await handler.handleMessage('hello');
        expect(mocks.pushPending).toHaveBeenCalledWith('hello', '__assistant__');
    });

    it('handleMessage 未连接时先 ensureConnection', async () => {
        mocks.agentService.isConnected = false;
        mocks.sessionHandler.ensureConnection.mockResolvedValue(undefined);
        mocks.agentService.sendPrompt.mockResolvedValue(undefined);
        await handler.handleMessage('hello');
        expect(mocks.sessionHandler.ensureConnection).toHaveBeenCalled();
    });

    it('handleMessage 发送文本到 agent', async () => {
        mocks.agentService.isConnected = true;
        mocks.store.nextAssistantMessageId.mockReturnValue('msg-u1');
        await handler.handleMessage('hello');
        expect(mocks.store.addAssistantMessage).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'user', content: 'hello' })
        );
        expect(mocks.agentService.sendPrompt).toHaveBeenCalled();
    });

    describe('createResponseHandler', () => {
        function getHandler(): Exclude<Parameters<typeof mocks.agentService.sendPrompt>[2], undefined> {
            const call = mocks.agentService.sendPrompt.mock.calls.find(
                (c: any[]) => c[0] === '__assistant__'
            );
            return call ? call[2] : null;
        }

        beforeEach(async () => {
            mocks.agentService.isConnected = true;
            mocks.store.nextAssistantMessageId
                .mockReturnValueOnce('msg-u1')
                .mockReturnValue('msg-a1');
            await handler.handleMessage('hello');
        });

        it('onReasoning 发送 thinking toolCallUpdate', () => {
            const h = getHandler();
            h.onReasoning?.('思考中');
            const calls = mocks.postSpy.mock.calls.filter((c: any[]) => c[0]?.type === 'toolCallUpdate');
            expect(calls.length).toBeGreaterThanOrEqual(1);
            const first = calls[0][0];
            expect(first.toolCallId).toMatch(/^reasoning_/);
            expect(first.kind).toBe('thinking');
            expect(first.title).toBe('推理');
            expect(first.status).toBe('running');
        });

        it('onReasoning 流式追加推理文本', () => {
            const h = getHandler();
            const before = mocks.postSpy.mock.calls.filter((c: any[]) =>
                c[0]?.type === 'toolCallUpdate' && String(c[0]?.toolCallId).startsWith('reasoning_')
            ).length;
            h.onReasoning?.('第一步');
            h.onReasoning?.('第二步');
            const calls = mocks.postSpy.mock.calls.filter((c: any[]) =>
                c[0]?.type === 'toolCallUpdate' && String(c[0]?.toolCallId).startsWith('reasoning_')
            );
            // 首次激活发送 2 条 (empty init + content)，第二次追加 1 条，共 3 条
            expect(calls.length - before).toBe(3);
            const newCalls = calls.slice(before);
            // 第 1 条是空内容 initialize
            expect(newCalls[0][0].content).toBe('');
            expect(newCalls[1][0].content).toBe('第一步');
            expect(newCalls[2][0].content).toBe('第一步第二步');
        });

        it('onToolCall 发送 toolCallUpdate', () => {
            const h = getHandler();
            h.onToolCall?.('tc-1', '读取文件', 'read', 'running');
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'toolCallUpdate', toolCallId: 'tc-1', title: '读取文件', kind: 'read', status: 'running' })
            );
        });

        it('onToolCallUpdate 发送 toolCallUpdate', () => {
            const h = getHandler();
            h.onToolCallUpdate?.('tc-1', 'completed', '输出内容', '读取文件', 'read');
            expect(mocks.postSpy).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'toolCallUpdate', toolCallId: 'tc-1', title: '读取文件', kind: 'read', status: 'completed', content: '输出内容' })
            );
        });

        it('onText 关闭推理后发送文本', () => {
            const h = getHandler();
            h.onReasoning?.('推理内容');
            h.onText('Hello');
            const updates = mocks.postSpy.mock.calls.filter((c: any[]) => c[0]?.type === 'agentStreamUpdate');
            expect(updates.length).toBeGreaterThanOrEqual(1);
            const completed = mocks.postSpy.mock.calls.filter((c: any[]) =>
                c[0]?.type === 'toolCallUpdate' && c[0]?.status === 'completed' && c[0]?.kind === 'thinking'
            );
            expect(completed.length).toBeGreaterThanOrEqual(1);
        });

        it('onDone 标记推理完成并存储消息', () => {
            const h = getHandler();
            h.onReasoning?.('推理内容');
            h.onDone?.('completed');
            const completed = mocks.postSpy.mock.calls.filter((c: any[]) =>
                c[0]?.type === 'toolCallUpdate' && c[0]?.status === 'completed' && c[0]?.kind === 'thinking'
            );
            expect(completed.length).toBeGreaterThanOrEqual(1);
            expect(mocks.store.addAssistantMessage).toHaveBeenCalled();
        });
    });
});
