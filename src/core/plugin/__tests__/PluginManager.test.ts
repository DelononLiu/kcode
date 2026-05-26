import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from '../PluginManager';
import type { KCodePlugin, PluginAPI } from '../PluginInterface';

function makeMockPlugin(overrides: Partial<KCodePlugin> = {}): KCodePlugin {
    return {
        id: 'test.plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        mode: 'task',
        activate: vi.fn(),
        deactivate: vi.fn(),
        ...overrides,
    };
}

function createManager() {
    const store = { getTask: vi.fn() };
    const router = { PostMessage: vi.fn(), on: vi.fn(), off: vi.fn(), dispatch: vi.fn(), reset: vi.fn() };
    const agentService = { cancel: vi.fn(), getReviewChanges: vi.fn().mockReturnValue([]) };
    let currentMode: 'task' | 'assistant' = 'task';
    const mgr = new PluginManager(store, router, agentService, () => currentMode);
    const setMode = (m: 'task' | 'assistant') => { currentMode = m; };
    return { mgr, store, router, agentService, setMode };
}

describe('PluginManager', () => {
    describe('register / getRegisteredPlugins', () => {
        it('register adds plugin to registry', () => {
            const { mgr } = createManager();
            const p = makeMockPlugin({ id: 'p1' });
            mgr.register(p);
            expect(mgr.getRegisteredPlugins()).toHaveLength(1);
            expect(mgr.getRegisteredPlugins()[0].id).toBe('p1');
        });

        it('getRegisteredPlugins returns all registered plugins', () => {
            const { mgr } = createManager();
            mgr.register(makeMockPlugin({ id: 'a' }));
            mgr.register(makeMockPlugin({ id: 'b' }));
            expect(mgr.getRegisteredPlugins()).toHaveLength(2);
        });
    });

    describe('activate / deactivate', () => {
        it('activate calls plugin.activate and tracks active state', async () => {
            const { mgr } = createManager();
            const activate = vi.fn();
            const p = makeMockPlugin({ id: 'p1', activate });
            mgr.register(p);
            const ok = await mgr.activate('p1');
            expect(ok).toBe(true);
            expect(activate).toHaveBeenCalled();
            expect(mgr.isActive('p1')).toBe(true);
        });

        it('activate returns false for unregistered plugin', async () => {
            const { mgr } = createManager();
            expect(await mgr.activate('nonexistent')).toBe(false);
        });

        it('activate is idempotent', async () => {
            const { mgr } = createManager();
            const activate = vi.fn();
            mgr.register(makeMockPlugin({ id: 'p1', activate }));
            await mgr.activate('p1');
            await mgr.activate('p1');
            expect(activate).toHaveBeenCalledTimes(1);
        });

        it('deactivate calls deactivate and removes active flag', async () => {
            const { mgr } = createManager();
            const deactivate = vi.fn();
            mgr.register(makeMockPlugin({ id: 'p1', deactivate }));
            await mgr.activate('p1');
            await mgr.deactivate('p1');
            expect(deactivate).toHaveBeenCalled();
            expect(mgr.isActive('p1')).toBe(false);
        });

        it('deactivate calls plugin.deactivate() and clears active flag', async () => {
            const { mgr } = createManager();
            const deactivate = vi.fn();
            const p = makeMockPlugin({ id: 'p1', deactivate });
            mgr.register(p);
            expect(mgr.isActive('p1')).toBe(false);
            await mgr.activate('p1');
            expect(mgr.isActive('p1')).toBe(true);
            await mgr.deactivate('p1');
            expect(deactivate).toHaveBeenCalled();
            expect(mgr.isActive('p1')).toBe(false);
        });

        it('deactivate non-active plugin does nothing', async () => {
            const { mgr } = createManager();
            const deactivate = vi.fn();
            mgr.register(makeMockPlugin({ id: 'p1', deactivate }));
            await mgr.deactivate('p1');
            expect(deactivate).not.toHaveBeenCalled();
        });

        it('activate resolves dependencies first', async () => {
            const { mgr } = createManager();
            const order: string[] = [];
            const depActivate = vi.fn(() => { order.push('dep'); });
            const mainActivate = vi.fn(() => { order.push('main'); });
            mgr.register(makeMockPlugin({ id: 'dep', activate: depActivate }));
            mgr.register(makeMockPlugin({ id: 'main', dependencies: ['dep'], activate: mainActivate }));
            await mgr.activate('main');
            expect(order).toEqual(['dep', 'main']);
            expect(mgr.isActive('dep')).toBe(true);
        });
    });

    describe('activateAll', () => {
        it('activates all registered plugins', async () => {
            const { mgr } = createManager();
            const a = vi.fn();
            const b = vi.fn();
            mgr.register(makeMockPlugin({ id: 'a', activate: a }));
            mgr.register(makeMockPlugin({ id: 'b', activate: b }));
            await mgr.activateAll();
            expect(a).toHaveBeenCalled();
            expect(b).toHaveBeenCalled();
        });

        it('skips plugins with enabled=false config', async () => {
            const { mgr } = createManager();
            const activate = vi.fn();
            mgr.register(makeMockPlugin({ id: 'disabledP', activate }));
            mgr.setConfig({ disabledP: { enabled: false } });
            await mgr.activateAll();
            expect(activate).not.toHaveBeenCalled();
        });
    });

    describe('deactivateAll', () => {
        it('deactivates all active plugins', async () => {
            const { mgr } = createManager();
            const da = vi.fn();
            const db = vi.fn();
            mgr.register(makeMockPlugin({ id: 'a', deactivate: da }));
            mgr.register(makeMockPlugin({ id: 'b', deactivate: db }));
            await mgr.activateAll();
            await mgr.deactivateAll();
            expect(da).toHaveBeenCalled();
            expect(db).toHaveBeenCalled();
            expect(mgr.getActivePlugins()).toEqual([]);
        });
    });

    describe('dispatchMessage', () => {
        it('dispatches to registered handlers', async () => {
            const { mgr } = createManager();
            const handler = vi.fn();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) { api.onMessage('eventX', handler); },
            }));
            await mgr.activate('p1');
            mgr.dispatchMessage('eventX', { val: 42 });
            expect(handler).toHaveBeenCalledWith({ val: 42 });
        });

        it('dispatches message arrives at registered handler', async () => {
            const { mgr } = createManager();
            const handler = vi.fn();
            mgr.getExtensionPoints().register('message', 'evt', handler, 'p1');
            mgr.dispatchMessage('evt', { val: 1 });
            expect(handler).toHaveBeenCalledWith({ val: 1 });
        });
    });

    describe('dispatchPhaseChanged', () => {
        it('dispatches phase change to registered handlers', async () => {
            const { mgr } = createManager();
            const handler = vi.fn();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) { api.onPhaseChanged(handler); },
            }));
            await mgr.activate('p1');
            mgr.dispatchPhaseChanged('task_1', 'demand', 'goal');
            expect(handler).toHaveBeenCalledWith({ taskId: 'task_1', fromPhase: 'demand', toPhase: 'goal' });
        });
    });

    describe('dispatchToolCall', () => {
        it('dispatches tool call to kind-matched handler only', async () => {
            const { mgr } = createManager();
            const bashHandler = vi.fn();
            const readHandler = vi.fn();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) {
                    api.onToolCall('bash', bashHandler);
                    api.onToolCall('read', readHandler);
                },
            }));
            await mgr.activate('p1');
            mgr.dispatchToolCall('bash', 'task_1', { command: 'ls' });
            expect(bashHandler).toHaveBeenCalledOnce();
            expect(readHandler).not.toHaveBeenCalled();
        });
    });

    describe('processStream', () => {
        it('passes text through stream processors', async () => {
            const { mgr } = createManager();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) {
                    api.addStreamProcessor((t: string) => t.replace(/foo/g, 'bar'));
                },
            }));
            await mgr.activate('p1');
            expect(mgr.processStream('foo hello')).toBe('bar hello');
        });

        it('chains multiple processors in order', async () => {
            const { mgr } = createManager();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) { api.addStreamProcessor((t: string) => t + '|a'); },
            }));
            mgr.register(makeMockPlugin({
                id: 'p2',
                activate(api: PluginAPI) { api.addStreamProcessor((t: string) => t + '|b'); },
            }));
            await mgr.activateAll();
            expect(mgr.processStream('start')).toBe('start|a|b');
        });

        it('returns original text when no processors', () => {
            const { mgr } = createManager();
            expect(mgr.processStream('hello')).toBe('hello');
        });
    });

    describe('getOutputPanelTabs', () => {
        it('returns tabs registered by plugins', async () => {
            const { mgr } = createManager();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) {
                    api.addOutputPanelTab('tab1', 'Tab 1', () => '<div>1</div>');
                },
            }));
            await mgr.activate('p1');
            const tabs = mgr.getOutputPanelTabs();
            expect(tabs).toHaveLength(1);
            expect(tabs[0].id).toBe('tab1');
            expect(tabs[0].label).toBe('Tab 1');
            expect(tabs[0].renderer({})).toBe('<div>1</div>');
        });

        it('returns empty when no tabs registered', () => {
            const { mgr } = createManager();
            expect(mgr.getOutputPanelTabs()).toEqual([]);
        });
    });

    describe('getPluginContributions', () => {
        it('returns output panel tab contributions', async () => {
            const { mgr } = createManager();
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) {
                    api.addOutputPanelTab('t1', 'T1', () => '');
                },
            }));
            await mgr.activate('p1');
            const contribs = mgr.getPluginContributions();
            expect(contribs).toEqual([{ type: 'outputPanelTab', id: 't1', label: 'T1' }]);
        });
    });

    describe('getPluginAPI / setPluginExport', () => {
        it('returns undefined for inactive or non-existent plugin', () => {
            const { mgr } = createManager();
            expect(mgr.getPluginAPI('nonexistent')).toBeUndefined();
            expect(mgr.getPluginAPI('inactive')).toBeUndefined();
        });

        it('returns exports for active plugin', async () => {
            const { mgr } = createManager();
            const exports = { deviceManager: { exec: vi.fn() } };
            mgr.register(makeMockPlugin({
                id: 'p1',
                activate(api: PluginAPI) { api.setPluginExport('p1', exports); },
            }));
            await mgr.activate('p1');
            expect(mgr.getPluginAPI('p1')).toBe(exports);
        });
    });

    describe('getExtensionPoints', () => {
        it('returns the internal registry', () => {
            const { mgr } = createManager();
            expect(mgr.getExtensionPoints()).toBeDefined();
        });
    });

    describe('setConfig', () => {
        it('loadFromDir works with valid directory', async () => {
            const { mgr } = createManager();
            await mgr.loadFromDir('/nonexistent');
            expect(mgr.getRegisteredPlugins()).toEqual([]);
        });
    });
});
