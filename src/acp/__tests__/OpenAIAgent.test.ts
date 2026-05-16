import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAgent } from '../OpenAIAgent';

function mockFetch(response?: Partial<Response>) {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
        body: null,
        ...response,
    });
}

describe('OpenAIAgent', () => {
    let agent: OpenAIAgent;

    beforeEach(() => {
        vi.stubGlobal('fetch', mockFetch());
        agent = new OpenAIAgent({ apiKey: 'test-key', model: 'test-model', baseURL: 'https://test.com' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('createSession 返回 session id', () => {
        const sessionId = agent.createSession('task-1');
        expect(sessionId).toBe('openai-session-task-1');
    });

    it('hasSession 返回 true/false', () => {
        expect(agent.hasSession('task-1')).toBe(false);
        agent.createSession('task-1');
        agent.setHandler('task-1', {
            onText: vi.fn(), onError: vi.fn(), onDone: vi.fn(),
        });
        expect(agent.hasSession('task-1')).toBe(true);
    });

    it('cancel 清除 abort controller', () => {
        agent.createSession('task-1');
        agent.setHandler('task-1', { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() });
        agent['abortControllers'].set('task-1', new AbortController());
        const spy = vi.spyOn(agent['abortControllers'].get('task-1')!, 'abort');
        agent.cancel('task-1');
        expect(spy).toHaveBeenCalled();
    });

    it('getReviewChanges 返回空数组', () => {
        expect(agent.getReviewChanges('task-1')).toEqual([]);
        agent.createSession('task-1');
        expect(agent.getReviewChanges('task-1')).toEqual([]);
    });

    it('prompt 无 apiKey 时报错', async () => {
        const agent2 = new OpenAIAgent({ apiKey: '', model: 'm', baseURL: 'https://test.com' });
        const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent2.setHandler('s1', handler);
        await agent2.prompt('s1', 'hello');
        expect(handler.onError).toHaveBeenCalledWith(expect.stringContaining('未设置'));
    });

    it('prompt 无 handler 时静默返回', async () => {
        await expect(agent.prompt('s1', 'hello')).resolves.not.toThrow();
    });

    it('removeHandler 移除 handler', () => {
        agent.createSession('task-1');
        const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('task-1', handler);
        agent.removeHandler('task-1');
        expect(agent.hasSession('task-1')).toBe(false);
    });
});
