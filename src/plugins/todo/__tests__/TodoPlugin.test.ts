import { describe, it, expect, vi, beforeEach } from 'vitest';
import plugin from '../TodoPlugin';

function parseTodosFromOutput(output: string): any[] {
    const titleMatch = output.match(/<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/);
    if (titleMatch) {
        try { return JSON.parse(titleMatch[1]); } catch {}
    }
    try {
        const arr = JSON.parse(output);
        if (Array.isArray(arr)) return arr;
    } catch {}
    if (output.trim().startsWith('[')) {
        try { return JSON.parse(output.trim()); } catch {}
    }
    return [];
}

function replaceTodosInOutput(output: string, todos: any[]): string {
    const titleMatch = output.match(/^(<title>\s*\d+\s*todos?\s*<\/title>\s*)/i);
    if (titleMatch) {
        return titleMatch[1] + JSON.stringify(todos, null, 2);
    }
    return JSON.stringify(todos, null, 2);
}

describe('TodoPlugin — parseTodosFromOutput', () => {
    it('parses raw JSON array', () => {
        const result = parseTodosFromOutput('[{"id":"1","content":"a","status":"pending"}]');
        expect(result).toEqual([{ id: '1', content: 'a', status: 'pending' }]);
    });

    it('parses JSON with title prefix', () => {
        const result = parseTodosFromOutput('<title>2 todos</title>\n[{"id":"1","content":"a","status":"pending"}]');
        expect(result).toEqual([{ id: '1', content: 'a', status: 'pending' }]);
    });

    it('returns empty for invalid content', () => {
        expect(parseTodosFromOutput('')).toEqual([]);
        expect(parseTodosFromOutput('not json')).toEqual([]);
    });

    it('trims whitespace before checking [', () => {
        const result = parseTodosFromOutput('  \n  [{"id":"1","content":"a","status":"pending"}]');
        expect(result).toEqual([{ id: '1', content: 'a', status: 'pending' }]);
    });

    it('parses JSON with nested structure', () => {
        const result = parseTodosFromOutput('[{"id":"1","content":"task1","status":"completed","extra":true}]');
        expect(result[0].content).toBe('task1');
        expect(result[0].status).toBe('completed');
    });

    it('handles multiple items', () => {
        const result = parseTodosFromOutput('[{"id":"1","content":"a"},{"id":"2","content":"b"}]');
        expect(result).toHaveLength(2);
    });
});

describe('TodoPlugin — replaceTodosInOutput', () => {
    it('preserves title tag when present', () => {
        const result = replaceTodosInOutput('<title>2 todos</title>\n[{"id":"1","content":"a"}]', []);
        expect(result).toMatch(/^<title>\s*2\s*todos?\s*<\/title>/);
    });

    it('returns plain JSON array when no title tag', () => {
        const result = replaceTodosInOutput('[{"id":"1"}]', [{ id: '2' }]);
        expect(result).toBe(JSON.stringify([{ id: '2' }], null, 2));
    });

    it('replaces todos in output preserving original title', () => {
        const output = '<title>1 todos</title>\n[{"id":"1","content":"old"}]';
        const result = replaceTodosInOutput(output, [{ id: '1', content: 'new' }]);
        expect(result).toContain('"content": "new"');
    });
});

describe('TodoPlugin — plugin activate', () => {
    let api: any;
    let store: any;
    let router: any;

    beforeEach(() => {
        vi.clearAllMocks();
        store = {
            getMessages: vi.fn().mockReturnValue([]),
            nextMessageId: vi.fn().mockReturnValue('msg-1'),
            addMessage: vi.fn(),
            updateMessageContent: vi.fn(),
            getTask: vi.fn().mockReturnValue({ status: 'active', planSteps: [] }),
            updatePlanSteps: vi.fn(),
        };
        router = { PostMessage: vi.fn() };
        api = {
            onToolCall: vi.fn(),
            onMessage: vi.fn(),
            getStore: () => store,
            getRouter: () => router,
        };
    });

    it('registers todowrite and updateTodoItem handlers on activate', () => {
        plugin.activate(api);
        expect(api.onToolCall).toHaveBeenCalledWith('todowrite', expect.any(Function));
        expect(api.onMessage).toHaveBeenCalledWith('updateTodoItem', expect.any(Function));
    });

    it('todowrite handler with output creates todo message', () => {
        plugin.activate(api);
        const todowriteHandler = api.onToolCall.mock.calls.find(
            (c: any[]) => c[0] === 'todowrite'
        )?.[1];
        expect(todowriteHandler).toBeDefined();

        todowriteHandler('task_1', {
            output: '[{"id":"1","content":"do something","status":"pending"}]',
            title: '',
            kind: 'todowrite',
        });

        expect(store.addMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'todo', role: 'agent' })
        );
        expect(router.PostMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'loadMessages' })
        );
    });

    it('todowrite handler with no output does nothing', () => {
        plugin.activate(api);
        const todowriteHandler = api.onToolCall.mock.calls.find(
            (c: any[]) => c[0] === 'todowrite'
        )?.[1];
        todowriteHandler('task_1', { output: '', kind: 'todowrite' });
        expect(store.addMessage).not.toHaveBeenCalled();
    });

    it('todowrite handler merges with existing todo messages', () => {
        store.getMessages.mockReturnValue([
            { type: 'todo', content: JSON.stringify([{ id: '1', content: 'old', status: 'pending' }]) },
        ] as any);

        plugin.activate(api);
        const todowriteHandler = api.onToolCall.mock.calls.find(
            (c: any[]) => c[0] === 'todowrite'
        )?.[1];
        todowriteHandler('task_1', {
            output: '[{"id":"2","content":"new","status":"pending"}]',
            kind: 'todowrite',
        });

        expect(store.updateMessageContent).toHaveBeenCalled();
    });

    it('updateTodoItem handler updates item status in todo message', () => {
        store.getMessages.mockReturnValue([
            { id: 'todo-1', type: 'todo', content: JSON.stringify([{ id: '1', content: 'item', status: 'pending' }]) },
        ] as any);

        plugin.activate(api);
        const updateHandler = api.onMessage.mock.calls.find(
            (c: any[]) => c[0] === 'updateTodoItem'
        )?.[1];
        expect(updateHandler).toBeDefined();

        updateHandler({ taskId: 'task_1', msgId: 'todo-1', itemId: '1', checked: true });
        expect(store.updateMessageContent).toHaveBeenCalledWith(
            'task_1', 'todo-1',
            JSON.stringify([{ id: '1', content: 'item', status: 'completed' }])
        );
    });

    it('updateTodoItem handles tool_call message with toolCallId', () => {
        store.getMessages.mockReturnValue([
            { id: 'tool_abc', type: 'tool_call', content: JSON.stringify({ toolCallId: 'abc', kind: 'todowrite', output: '[{"id":"1","content":"x","status":"pending"}]' }) },
        ] as any);

        plugin.activate(api);
        const updateHandler = api.onMessage.mock.calls.find(
            (c: any[]) => c[0] === 'updateTodoItem'
        )?.[1];
        updateHandler({ taskId: 'task_1', msgId: 'tool_abc', itemId: '1', checked: true });
        expect(store.updateMessageContent).toHaveBeenCalled();
    });
});
