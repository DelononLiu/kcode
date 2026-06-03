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

function createMockReader(chunks: string[]) {
    let idx = 0;
    const encoder = new TextEncoder();
    return {
        read: vi.fn().mockImplementation(() => {
            if (idx >= chunks.length) return Promise.resolve({ done: true, value: undefined });
            return Promise.resolve({ done: false, value: encoder.encode(chunks[idx++]) });
        }),
    };
}

function createMockResponse(reader: any) {
    return {
        ok: true,
        status: 200,
        body: { getReader: () => reader },
    };
}

describe('OpenAIAgent streaming thinking fields', () => {
    let agent: OpenAIAgent;

    beforeEach(() => {
        agent = new OpenAIAgent({ apiKey: 'test-key', model: 'test-model', baseURL: 'https://test.com' });
    });

    it('解析 reasoning_content 字段调用 onReasoning', async () => {
        const handler = { onText: vi.fn(), onReasoning: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('s1', handler);
        const reader = createMockReader([
            'data: {"choices":[{"delta":{"reasoning_content":"step 1思考"}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_content":"step 2思考"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(reader)));

        await agent.prompt('s1', 'hello');

        expect(handler.onReasoning).toHaveBeenCalledTimes(2);
        expect(handler.onReasoning).toHaveBeenNthCalledWith(1, 'step 1思考');
        expect(handler.onReasoning).toHaveBeenNthCalledWith(2, 'step 2思考');
        expect(handler.onText).toHaveBeenCalledWith('Hello');
        expect(handler.onDone).toHaveBeenCalled();
    });

    it('解析 reasoning 字段调用 onReasoning', async () => {
        const handler = { onText: vi.fn(), onReasoning: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('s2', handler);
        const reader = createMockReader([
            'data: {"choices":[{"delta":{"reasoning":"thinking step 1"}}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning":"thinking step 2"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"reply"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(reader)));

        await agent.prompt('s2', 'hello');

        expect(handler.onReasoning).toHaveBeenCalledTimes(2);
        expect(handler.onReasoning).toHaveBeenNthCalledWith(1, 'thinking step 1');
        expect(handler.onReasoning).toHaveBeenNthCalledWith(2, 'thinking step 2');
        expect(handler.onText).toHaveBeenCalledWith('reply');
    });

    it('解析 thinking 字段调用 onReasoning', async () => {
        const handler = { onText: vi.fn(), onReasoning: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('s3', handler);
        const reader = createMockReader([
            'data: {"choices":[{"delta":{"thinking":"inner thought"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(reader)));

        await agent.prompt('s3', 'hello');

        expect(handler.onReasoning).toHaveBeenCalledWith('inner thought');
        expect(handler.onText).toHaveBeenCalledWith('answer');
    });

    it('优先使用 reasoning_content 再 reasoning 再 thinking', async () => {
        const handler = { onText: vi.fn(), onReasoning: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('s4', handler);
        const reader = createMockReader([
            'data: {"choices":[{"delta":{"reasoning_content":"primary","reasoning":"fallback","thinking":"third"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(reader)));

        await agent.prompt('s4', 'hello');

        expect(handler.onReasoning).toHaveBeenCalledWith('primary');
        expect(handler.onReasoning).toHaveBeenCalledTimes(1);
        expect(handler.onText).toHaveBeenCalledWith('done');
    });

    it('无 thinking 字段时只调 onText', async () => {
        const handler = { onText: vi.fn(), onReasoning: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
        agent.setHandler('s5', handler);
        const reader = createMockReader([
            'data: {"choices":[{"delta":{"content":"plain text"}}]}\n\n',
            'data: [DONE]\n\n',
        ]);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createMockResponse(reader)));

        await agent.prompt('s5', 'hello');

        expect(handler.onReasoning).not.toHaveBeenCalled();
        expect(handler.onText).toHaveBeenCalledWith('plain text');
    });
});
