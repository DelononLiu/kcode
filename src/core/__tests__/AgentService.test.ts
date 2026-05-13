import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentService } from '../AgentService';

vi.mock('vscode', () => ({
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(() => ''),
        })),
        workspaceFolders: [{ uri: { fsPath: '/test' } }],
    },
}));

vi.mock('../../acp/AcpClient', () => ({
    AcpClient: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(true),
        setLogCallback: vi.fn(),
        hasSession: vi.fn().mockReturnValue(false),
        createSession: vi.fn().mockResolvedValue('session-1'),
        getSessionId: vi.fn().mockReturnValue('session-1'),
        prompt: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
        closeTaskSession: vi.fn().mockResolvedValue(undefined),
        getReviewChanges: vi.fn().mockReturnValue([]),
        dispose: vi.fn().mockResolvedValue(undefined),
        lastError: '',
    })),
}));

vi.mock('../../acp/OpenAIAgent', () => ({
    OpenAIAgent: vi.fn().mockImplementation(() => ({
        createSession: vi.fn().mockReturnValue('openai-session-1'),
        setHandler: vi.fn(),
        prompt: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn(),
        getReviewChanges: vi.fn().mockReturnValue([]),
    })),
}));

describe('AgentService', () => {
    let service: AgentService;

    beforeEach(() => {
        service = new AgentService('/test/workspace');
    });

    it('starts disconnected', () => {
        expect(service.isConnected).toBe(false);
        expect(service.lastError).toBe('');
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
});
