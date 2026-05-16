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
});
