import { describe, it, expect, vi } from 'vitest';
import { ExtensionPointRegistry } from '../ExtensionPointRegistry';

describe('ExtensionPointRegistry', () => {
    it('register and dispatch a handler', () => {
        const reg = new ExtensionPointRegistry();
        const handler = vi.fn();
        reg.register('message', 'testMsg', handler, 'p1');
        reg.dispatch('message', 'testMsg', { data: 1 });
        expect(handler).toHaveBeenCalledWith({ data: 1 });
    });

    it('dispatch does not call handler for unmatched key', () => {
        const reg = new ExtensionPointRegistry();
        const handler = vi.fn();
        reg.register('message', 'a', handler, 'p1');
        reg.dispatch('message', 'b', {});
        expect(handler).not.toHaveBeenCalled();
    });

    it('dispatch filters by mode', () => {
        const reg = new ExtensionPointRegistry();
        const taskHandler = vi.fn();
        const assistantHandler = vi.fn();
        reg.register('message', 'x', taskHandler, 'p1', 'task');
        reg.register('message', 'x', assistantHandler, 'p2', 'assistant');
        reg.dispatch('message', 'x', {}, 'task');
        expect(taskHandler).toHaveBeenCalled();
        expect(assistantHandler).not.toHaveBeenCalled();
    });

    it('dispatch without mode filter calls all handlers', () => {
        const reg = new ExtensionPointRegistry();
        const h1 = vi.fn();
        const h2 = vi.fn();
        reg.register('message', 'x', h1, 'p1', 'task');
        reg.register('message', 'x', h2, 'p2', 'assistant');
        reg.dispatch('message', 'x', {});
        expect(h1).toHaveBeenCalled();
        expect(h2).toHaveBeenCalled();
    });

    it('dispatchAll calls all entries for a type regardless of key', () => {
        const reg = new ExtensionPointRegistry();
        const h1 = vi.fn();
        const h2 = vi.fn();
        reg.register('message', 'a', h1, 'p1');
        reg.register('message', 'b', h2, 'p2');
        reg.dispatchAll('message', { n: 1 });
        expect(h1).toHaveBeenCalledWith({ n: 1 });
        expect(h2).toHaveBeenCalledWith({ n: 1 });
    });

    it('dispatchAll filters by mode', () => {
        const reg = new ExtensionPointRegistry();
        const taskH = vi.fn();
        const asstH = vi.fn();
        reg.register('message', 'a', taskH, 'p1', 'task');
        reg.register('message', 'b', asstH, 'p2', 'assistant');
        reg.dispatchAll('message', {}, 'assistant');
        expect(taskH).not.toHaveBeenCalled();
        expect(asstH).toHaveBeenCalled();
    });

    it('dispatchStream chains processors in order', () => {
        const reg = new ExtensionPointRegistry();
        reg.register('stream', '*', (t: string) => t + '|b', 'p1');
        reg.register('stream', '*', (t: string) => t + '|c', 'p2');
        const result = reg.dispatchStream('stream', 'a');
        expect(result).toBe('a|b|c');
    });

    it('dispatchStream does nothing when no handlers', () => {
        const reg = new ExtensionPointRegistry();
        expect(reg.dispatchStream('stream', 'hello')).toBe('hello');
    });

    it('dispatchStream filters by mode', () => {
        const reg = new ExtensionPointRegistry();
        reg.register('stream', '*', (t: string) => t + '_task', 'p1', 'task');
        reg.register('stream', '*', (t: string) => t + '_asst', 'p2', 'assistant');
        expect(reg.dispatchStream('stream', 'x', 'task')).toBe('x_task');
        expect(reg.dispatchStream('stream', 'x', 'assistant')).toBe('x_asst');
    });

    it('forEachEntry iterates all entries with key info', () => {
        const reg = new ExtensionPointRegistry();
        reg.register('toolCall', 'bash', vi.fn(), 'p1');
        reg.register('toolCall', 'read', vi.fn(), 'p2');
        const keys: string[] = [];
        reg.forEachEntry('toolCall', (entry) => keys.push(entry.key));
        expect(keys.sort()).toEqual(['bash', 'read']);
    });

    it('getEntries returns entries for a specific key', () => {
        const reg = new ExtensionPointRegistry();
        const fn = vi.fn();
        reg.register('message', 'evt', fn, 'p1');
        const entries = reg.getEntries('message', 'evt');
        expect(entries).toHaveLength(1);
        expect(entries[0].handler).toBe(fn);
        expect(entries[0].pluginId).toBe('p1');
    });

    it('getEntries returns empty for unknown type', () => {
        const reg = new ExtensionPointRegistry();
        expect(reg.getEntries('message', 'none')).toEqual([]);
    });

    it('removeByPlugin removes all entries for a plugin', () => {
        const reg = new ExtensionPointRegistry();
        const h1 = vi.fn();
        const h2 = vi.fn();
        reg.register('message', 'a', h1, 'p1');
        reg.register('message', 'b', h2, 'p1');
        reg.register('message', 'c', vi.fn(), 'p2');
        reg.removeByPlugin('p1');
        expect(reg.getEntries('message', 'a')).toEqual([]);
        expect(reg.getEntries('message', 'b')).toEqual([]);
        expect(reg.getEntries('message', 'c')).toHaveLength(1);
    });

    it('removeByPlugin on non-existent plugin does nothing', () => {
        const reg = new ExtensionPointRegistry();
        reg.register('message', 'a', vi.fn(), 'p1');
        expect(() => reg.removeByPlugin('nonexistent')).not.toThrow();
        expect(reg.getEntries('message', 'a')).toHaveLength(1);
    });

    it('reset clears all registries', () => {
        const reg = new ExtensionPointRegistry();
        reg.register('message', 'a', vi.fn(), 'p1');
        reg.register('phaseChanged', '*', vi.fn(), 'p1');
        reg.reset();
        expect(reg.getEntries('message', 'a')).toEqual([]);
        expect(reg.getEntries('phaseChanged', '*')).toEqual([]);
    });

    it('multiple handlers for same key and type all called', () => {
        const reg = new ExtensionPointRegistry();
        const h1 = vi.fn();
        const h2 = vi.fn();
        reg.register('message', 'evt', h1, 'p1');
        reg.register('message', 'evt', h2, 'p2');
        reg.dispatch('message', 'evt', { ok: true });
        expect(h1).toHaveBeenCalledWith({ ok: true });
        expect(h2).toHaveBeenCalledWith({ ok: true });
    });

    it('handlers carry meta through register and forEachEntry', () => {
        const reg = new ExtensionPointRegistry();
        const handler = vi.fn();
        reg.register('uiOutputPanel', 'tab1', handler, 'p1', 'task', { id: 'tab1', label: 'Tab 1' });
        const metas: any[] = [];
        reg.forEachEntry('uiOutputPanel', (entry) => metas.push(entry.meta));
        expect(metas).toHaveLength(1);
        expect(metas[0]).toEqual({ id: 'tab1', label: 'Tab 1' });
    });

    it('dispatch for unknown type does nothing', () => {
        const reg = new ExtensionPointRegistry();
        expect(() => reg.dispatch('unknownType' as any, 'k', {})).not.toThrow();
    });

    it('dispatchStream with no registered handlers returns payload unchanged', () => {
        const reg = new ExtensionPointRegistry();
        expect(reg.dispatchStream('stream', 'text')).toBe('text');
    });
});
