// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { _isTodoArray, _parseTodoStr, _todoHeaderHtml, buildTodoBodyHtml } from '../todoRenderer';

describe('_isTodoArray', () => {
    it('detects valid todo array', () => {
        const arr = JSON.stringify([
            { content: '任务1', status: 'pending' },
            { content: '任务2', status: 'completed' },
        ]);
        expect(_isTodoArray(arr)).toBe(true);
    });

    it('rejects empty array', () => {
        expect(_isTodoArray('[]')).toBe(false);
    });

    it('rejects non-array JSON', () => {
        expect(_isTodoArray('{"a":1}')).toBe(false);
    });

    it('rejects invalid JSON', () => {
        expect(_isTodoArray('not json')).toBe(false);
    });
});

describe('_parseTodoStr', () => {
    it('parses plain JSON array', () => {
        const result = _parseTodoStr('[{"content":"任务1","status":"pending"},{"content":"任务2","status":"completed"}]');
        expect(result.total).toBe(2);
        expect(result.done).toBe(1);
        expect(result.items[0].content).toBe('任务1');
        expect(result.items[0].status).toBe('pending');
        expect(result.items[1].status).toBe('completed');
    });

    it('parses XML-wrapped format', () => {
        const result = _parseTodoStr('<title>2 todos</title>[{"content":"A","status":"pending"},{"content":"B","status":"completed"}]');
        expect(result.total).toBe(2);
    });

    it('handles empty string', () => {
        const result = _parseTodoStr('');
        expect(result.total).toBe(0);
        expect(result.done).toBe(0);
    });
});

describe('_todoHeaderHtml', () => {
    it('renders progress fraction', () => {
        const html = _todoHeaderHtml(3, 5);
        expect(html).toContain('3/5');
    });
});

describe('buildTodoBodyHtml', () => {
    it('builds checkbox list from XML-wrapped todo', () => {
        const output = '<title>2 todos</title>[{"content":"任务1","status":"pending"},{"content":"任务2","status":"completed"}]';
        const html = buildTodoBodyHtml(output, 'tool_1', 'task_1');
        expect(html).toContain('todo-list');
        expect(html).toContain('todo-checkbox');
        expect(html).toContain('任务1');
        expect(html).toContain('任务2');
        expect(html).toContain('todo-done');
    });

    it('returns empty message for no items', () => {
        const html = buildTodoBodyHtml('[]', 'tool_1', 'task_1');
        expect(html).toContain('无待办项');
    });
});
