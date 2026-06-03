import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecuteCommand = vi.hoisted(() => vi.fn());

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test' } }],
    },
    commands: {
        executeCommand: mockExecuteCommand,
    },
}));

import plugin from '../DelegationPlugin';

function createMockAPI() {
    const store = {
        getTask: vi.fn(),
        getMessages: vi.fn(),
        nextMessageId: vi.fn(() => `msg_${Date.now()}`),
        addMessage: vi.fn(),
        addTask: vi.fn(),
    };
    const router = {
        PostMessage: vi.fn(),
    };
    const api = {
        onMessage: vi.fn(),
        getStore: () => store,
        getRouter: () => router,
        getAgentService: () => ({}),
        onPhaseChanged: vi.fn(),
        onToolCall: vi.fn(),
        addStreamProcessor: vi.fn(),
        addOutputPanelTab: vi.fn(),
        registerPhaseHook: vi.fn(),
        getPlugin: vi.fn(),
        setPluginExport: vi.fn(),
    };
    return { api, store, router };
}

describe('DelegationPlugin', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('registers convertToTask message handler on activate', () => {
        const { api } = createMockAPI();
        plugin.activate(api);
        expect(api.onMessage).toHaveBeenCalledWith('convertToTask', expect.any(Function));
    });

    it('creates a new task and copies messages on convertToTask', () => {
        const { api, store } = createMockAPI();
        const task = { id: 'chat_task_1', type: 'chat' };
        const messages = [
            { id: 'm1', role: 'user', content: 'hello', type: 'text', timestamp: 1000 },
            { id: 'm2', role: 'agent', content: 'world', type: 'text', timestamp: 1001 },
        ];
        store.getTask.mockReturnValue(task);
        store.getMessages.mockReturnValue(messages);
        store.nextMessageId.mockImplementation(() => `msg_${Date.now()}`);

        plugin.activate(api);

        const handler = api.onMessage.mock.calls[0][1];
        handler({ taskId: 'chat_task_1' });

        expect(store.addTask).toHaveBeenCalledTimes(1);
        const newTask = store.addTask.mock.calls[0][0];
        expect(newTask.id).toMatch(/^task_/);
        expect(newTask.type).toBe('task');
        expect(newTask.status).toBe('pending');
        expect(store.addMessage).toHaveBeenCalledTimes(2);
    });

    it('does NOT send selectTask via router.PostMessage', () => {
        const { api, store, router } = createMockAPI();
        store.getTask.mockReturnValue({ id: 'chat_task_1', type: 'chat' });
        store.getMessages.mockReturnValue([]);
        store.nextMessageId.mockImplementation(() => `msg_${Date.now()}`);

        plugin.activate(api);
        const handler = api.onMessage.mock.calls[0][1];
        handler({ taskId: 'chat_task_1' });

        const selectTaskMessages = router.PostMessage.mock.calls.filter(
            (call: any) => call[0]?.type === 'selectTask'
        );
        expect(selectTaskMessages).toHaveLength(0);
    });

    it('executes kcode.selectTask vscode command after creating task', () => {
        const { api, store } = createMockAPI();
        store.getTask.mockReturnValue({ id: 'chat_task_1', type: 'chat' });
        store.getMessages.mockReturnValue([]);
        store.nextMessageId.mockImplementation(() => `msg_${Date.now()}`);

        plugin.activate(api);
        const handler = api.onMessage.mock.calls[0][1];
        handler({ taskId: 'chat_task_1' });

        expect(mockExecuteCommand).toHaveBeenCalledWith('kcode.selectTask', expect.stringMatching(/^task_/));
    });
});
