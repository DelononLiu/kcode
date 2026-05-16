import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../AgentService';

vi.mock('vscode', () => {
    const configGet = vi.fn().mockReturnValue('');
    const getConfig = vi.fn().mockReturnValue({ get: configGet });
    return {
        workspace: {
            getConfiguration: getConfig,
            workspaceFolders: [{ uri: { fsPath: '/test' } }],
        },
    };
});

vi.mock('../../acp/AcpClient', () => ({
    AcpClient: vi.fn(function(this: any) {
        this.connect = vi.fn().mockResolvedValue(true);
        this.setLogCallback = vi.fn();
        this.hasSession = vi.fn().mockReturnValue(false);
        this.createSession = vi.fn().mockResolvedValue('session-1');
        this.getSessionId = vi.fn().mockReturnValue('session-1');
        this.prompt = vi.fn().mockResolvedValue(undefined);
        this.cancel = vi.fn().mockResolvedValue(undefined);
        this.closeTaskSession = vi.fn().mockResolvedValue(undefined);
        this.getReviewChanges = vi.fn().mockReturnValue([]);
        this.dispose = vi.fn().mockResolvedValue(undefined);
        this.lastError = '';
    }),
}));

vi.mock('../../acp/OpenAIAgent', () => ({
    OpenAIAgent: vi.fn(function(this: any) {
        this.createSession = vi.fn().mockReturnValue('openai-session-1');
        this.setHandler = vi.fn();
        this.prompt = vi.fn().mockResolvedValue(undefined);
        this.cancel = vi.fn();
        this.getReviewChanges = vi.fn().mockReturnValue([]);
    }),
}));

describe('AgentService', () => {
    let service: AgentService;

    beforeEach(() => {
        service = new AgentService('/test/workspace');
    });

    it('starts disconnected', () => {
        expect(service.isConnected).toBe(false);
        expect(service.lastError).toBe('');
        expect(service.agentName).toBe('');
    });

    it('connect returns false with empty agentName', async () => {
        const result = await service.connect('');
        expect(result).toBe(false);
        expect(service.isConnected).toBe(false);
    });

    it('connect returns false with npx agentName', async () => {
        const result = await service.connect('npx');
        expect(result).toBe(false);
        expect(service.isConnected).toBe(false);
    });

    it('setLogCallback does not throw', () => {
        const cb = vi.fn();
        expect(() => service.setLogCallback(cb)).not.toThrow();
    });

    it('disconnect when not connected does not throw', async () => {
        await expect(service.disconnect()).resolves.not.toThrow();
    });

    it('hasSession returns false when not connected', () => {
        expect(service.hasSession('task-1')).toBe(false);
    });

    it('getSessionId returns undefined when not connected', () => {
        expect(service.getSessionId('task-1')).toBeUndefined();
    });

    it('getReviewChanges returns empty array when not connected', () => {
        expect(service.getReviewChanges('task-1')).toEqual([]);
    });

    it('closeTaskSession does not throw when not connected', async () => {
        await expect(service.closeTaskSession('task-1')).resolves.not.toThrow();
    });

    it('cancel does not throw when not connected', async () => {
        await expect(service.cancel('task-1')).resolves.not.toThrow();
    });

    it('sendPrompt calls onError when no session', async () => {
        const handler = {
            onText: vi.fn(),
            onError: vi.fn(),
            onDone: vi.fn(),
        };
        await service.sendPrompt('task-1', 'hello', handler);
        expect(handler.onError).toHaveBeenCalled();
    });

    it('createSession throws when not connected', async () => {
        await expect(service.createSession('task-1', '/cwd')).rejects.toThrow('未连接到 Agent');
    });

    it('connect with kilo agentName via ACP', async () => {
        const result = await service.connect('kilo');
        expect(service.lastError).toBe('');
        expect(result).toBe(true);
        expect(service.isConnected).toBe(true);
        expect(service.agentName).toBe('kilo');
    });

    it('agentName resets after disconnect', async () => {
        const result = await service.connect('kilo');
        expect(result).toBe(true);
        expect(service.agentName).toBe('kilo');
        await service.disconnect();
        expect(service.isConnected).toBe(false);
        expect(service.agentName).toBe('');
    });

    it('double connect succeeds (disconnects first)', async () => {
        const r1 = await service.connect('kilo');
        expect(r1).toBe(true);
        const r2 = await service.connect('kilo');
        expect(r2).toBe(true);
        expect(service.isConnected).toBe(true);
    });

    it('connect with openai agentName sets agentName', async () => {
        const result = await service.connect('openai');
        expect(result).toBe(true);
        expect(service.agentName).toBe('openai');
    });

    it('sendPrompt with connected session forwards to agent', async () => {
        await service.connect('kilo');
        await service.createSession('task-1', '/cwd');
        const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        await service.sendPrompt('task-1', 'hello', handler);
        expect(handler.onText).not.toHaveBeenCalled();
        expect(handler.onError).not.toHaveBeenCalled();
    });

    it('getReviewChanges returns changes after execute', async () => {
        await service.connect('kilo');
        const changes = service.getReviewChanges('task-1');
        expect(Array.isArray(changes)).toBe(true);
    });
});
