import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSdk = vi.hoisted(() => ({
    mockInitialize: vi.fn().mockResolvedValue({ protocolVersion: '0.1.0' }),
    mockNewSession: vi.fn().mockResolvedValue({ sessionId: 'session-1' }),
    mockPrompt: vi.fn().mockResolvedValue({ stopReason: 'end_turn' }),
    mockCancel: vi.fn().mockResolvedValue(undefined),
    mockCloseSession: vi.fn().mockResolvedValue(undefined),
    mockNdJsonStream: vi.fn(),
}));

vi.mock('@agentclientprotocol/sdk', () => {
    const ClientSideConnection = function(this: any, _clientFactory: any, _stream: any) {
        this.initialize = mockSdk.mockInitialize;
        this.newSession = mockSdk.mockNewSession;
        this.prompt = mockSdk.mockPrompt;
        this.cancel = mockSdk.mockCancel;
        this.closeSession = mockSdk.mockCloseSession;
    };
    return {
        ClientSideConnection,
        ndJsonStream: mockSdk.mockNdJsonStream,
        PROTOCOL_VERSION: '0.1.0',
    };
});

vi.mock('../AgentManager', () => {
    const ps = new (require('stream').PassThrough)();
    return {
        AgentManager: function MockAgentManager(this: any) {
            this.startAgent = function() { return Promise.resolve({ input: ps, output: ps, process: { on: function() {}, kill: function() {} } }); };
            this.stopAgent = function() {};
        },
    };
});

import { AcpClient } from '../AcpClient';

describe('AcpClient', () => {
    let client: AcpClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new AcpClient('/workspace');
    });

    it('connect succeeds', async () => {
        const result = await client.connect('test-agent', ['--port', '0']);
        expect(result).toBe(true);
        expect(mockSdk.mockInitialize).toHaveBeenCalled();
    });

    it('connect failure returns false and sets lastError', async () => {
        const badClient = new AcpClient('/workspace');
        (badClient as any).agentManager.startAgent = function() { return Promise.reject(new Error('agent not found')); };
        const result = await badClient.connect('nonexistent');
        expect(result).toBe(false);
        expect(badClient.lastError).toContain('agent not found');
    });

    it('createSession creates new session', async () => {
        await client.connect('test-agent');
        const sessionId = await client.createSession('task-1', '/cwd');
        expect(sessionId).toBe('session-1');
        expect(client.getSessionId('task-1')).toBe('session-1');
        expect(client.hasSession('task-1')).toBe(true);
    });

    it('createSession without connection throws', async () => {
        await expect(client.createSession('task-1', '/cwd')).rejects.toThrow('ACP 连接尚未建立');
    });

    it('createSession failure sets lastError and returns null', async () => {
        await client.connect('test-agent');
        mockSdk.mockNewSession.mockRejectedValueOnce(new Error('agent process exited'));
        const result = await client.createSession('task-1', '/cwd');
        expect(result).toBeNull();
        expect(client.lastError).toContain('agent process exited');
    });

    it('createSession success clears lastError', async () => {
        client['_lastError'] = 'previous error';
        await client.connect('test-agent');
        const result = await client.createSession('task-1', '/cwd');
        expect(result).toBe('session-1');
        expect(client.lastError).toBe('');
    });

    it('prompt sends text to connection', async () => {
        await client.connect('test-agent');
        await client.createSession('task-1', '/cwd');
        const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        await client.prompt('task-1', 'hello', handler);
        expect(mockSdk.mockPrompt).toHaveBeenCalled();
    });

    it('prompt without session calls onError', async () => {
        const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        await client.prompt('task-1', 'hello', handler);
        expect(handler.onError).toHaveBeenCalledWith('ACP 会话未就绪');
    });

    it('cancel calls connection.cancel', async () => {
        await client.connect('test-agent');
        await client.createSession('task-1', '/cwd');
        await client.cancel('task-1');
        expect(mockSdk.mockCancel).toHaveBeenCalledWith({ sessionId: 'session-1' });
    });

    it('getReviewChanges returns empty when no session', () => {
        expect(client.getReviewChanges('task-1')).toEqual([]);
    });

    it('closeTaskSession closes session and removes from map', async () => {
        await client.connect('test-agent');
        await client.createSession('task-1', '/cwd');
        await client.closeTaskSession('task-1');
        expect(mockSdk.mockCloseSession).toHaveBeenCalledWith({ sessionId: 'session-1' });
        expect(client.hasSession('task-1')).toBe(false);
    });

    it('closeTaskSession without connection does not throw', async () => {
        await expect(client.closeTaskSession('task-1')).resolves.not.toThrow();
    });

    it('dispose closes all sessions and stops agent', async () => {
        await client.connect('test-agent');
        await client.createSession('task-1', '/cwd');
        await client.dispose();
        expect(mockSdk.mockCloseSession).toHaveBeenCalled();
        expect(client.hasSession('task-1')).toBe(false);
    });

    it('setLogCallback does not throw', () => {
        expect(() => client.setLogCallback(vi.fn())).not.toThrow();
    });
});
