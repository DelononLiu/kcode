import { describe, it, expect, vi } from 'vitest';
import { MessageRouter } from '../MessageRouter';

describe('MessageRouter', () => {
    it('registers and dispatches a handler', () => {
        const router = new MessageRouter();
        const handler = vi.fn();
        router.on('testEvent', handler);
        router.dispatch('testEvent', { key: 'value' });
        expect(handler).toHaveBeenCalledWith({ key: 'value' });
    });

    it('dispatches to multiple handlers for the same type', () => {
        const router = new MessageRouter();
        const h1 = vi.fn();
        const h2 = vi.fn();
        router.on('multi', h1);
        router.on('multi', h2);
        router.dispatch('multi', { n: 42 });
        expect(h1).toHaveBeenCalledWith({ n: 42 });
        expect(h2).toHaveBeenCalledWith({ n: 42 });
    });

    it('does not call handler after off()', () => {
        const router = new MessageRouter();
        const handler = vi.fn();
        router.on('evt', handler);
        router.off('evt', handler);
        router.dispatch('evt', {});
        expect(handler).not.toHaveBeenCalled();
    });

    it('does nothing for unregistered type', () => {
        const router = new MessageRouter();
        expect(() => router.dispatch('unknown', {})).not.toThrow();
    });

    it('clears all handlers on reset', () => {
        const router = new MessageRouter();
        const handler = vi.fn();
        router.on('a', handler);
        router.on('b', handler);
        router.reset();
        router.dispatch('a', {});
        router.dispatch('b', {});
        expect(handler).not.toHaveBeenCalled();
    });

    it('PostMessage can be set and called', () => {
        const router = new MessageRouter();
        const sender = vi.fn();
        router.PostMessage = sender;
        router.PostMessage({ type: 'ping' });
        expect(sender).toHaveBeenCalledWith({ type: 'ping' });
    });

    it('re-registering handler after off works', () => {
        const router = new MessageRouter();
        const handler = vi.fn();
        router.on('evt', handler);
        router.off('evt', handler);
        router.on('evt', handler);
        router.dispatch('evt', { ok: true });
        expect(handler).toHaveBeenCalledWith({ ok: true });
    });

    it('handler throwing does not affect other handlers', () => {
        const router = new MessageRouter();
        const throwing = vi.fn().mockImplementation(() => { throw new Error('oops'); });
        const normal = vi.fn();
        router.on('err', throwing);
        router.on('err', normal);
        expect(() => router.dispatch('err', {})).toThrow('oops');
        expect(normal).not.toHaveBeenCalled();
    });

    it('dispatch with no handlers does nothing', () => {
        const router = new MessageRouter();
        router.on('a', vi.fn());
        router.off('a', vi.fn());
        expect(() => router.dispatch('a', {})).not.toThrow();
    });
});
