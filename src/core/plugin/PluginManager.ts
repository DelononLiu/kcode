import * as path from 'path';
import * as fs from 'fs';
import type { KCodePlugin, PluginAPI, ExtensionPointType } from './PluginInterface';
import { ExtensionPointRegistry } from './ExtensionPointRegistry';

export interface PluginConfig {
    [pluginId: string]: {
        enabled: boolean;
        config?: Record<string, any>;
    };
}

export class PluginManager {
    private plugins = new Map<string, KCodePlugin>();
    private activePlugins = new Set<string>();
    private extensionPoints: ExtensionPointRegistry;
    private pluginConfig: PluginConfig = {};
    private apiImpl: PluginAPI;
    private pluginExports = new Map<string, Record<string, any>>();

    constructor(
        private store: any,
        private router: any,
        private agentService: any,
        private getCurrentMode: () => 'task' | 'assistant',
    ) {
        this.extensionPoints = new ExtensionPointRegistry();
        this.apiImpl = this.createAPI();
    }

    private createAPI(): PluginAPI {
        const mgr = this;
        return {
            onMessage(type: string, handler: (message: any) => void) {
                mgr.extensionPoints.register('message', type, handler, '__api__');
            },
            onPhaseChanged(handler: (taskId: string, fromPhase: string, toPhase: string) => void) {
                mgr.extensionPoints.register('phaseChanged', '*', handler, '__api__');
            },
            onToolCall(kind: string, handler: (taskId: string, info: any) => void) {
                mgr.extensionPoints.register('toolCall', kind, handler, '__api__');
            },
            addStreamProcessor(processor: (text: string) => string) {
                mgr.extensionPoints.register('stream', '*', processor, '__api__');
            },
            addOutputPanelTab(id: string, label: string, renderer: (taskInfo: any) => string) {
                mgr.extensionPoints.register('uiOutputPanel', id, () => {}, '__api__', undefined, { id, label, renderer });
            },
            registerPhaseHook(phase: string, hook: { onEnter?: (taskId: string) => Promise<void>; onLeave?: (taskId: string) => Promise<void> }) {
                mgr.extensionPoints.register('phaseHook', phase, () => {}, '__api__', undefined, hook as Record<string, any>);
            },
            getPlugin<T = any>(id: string): T | undefined {
                return mgr.getPluginAPI(id) as T | undefined;
            },
            setPluginExport(id: string, exports: Record<string, any>): void {
                mgr.setPluginExport(id, exports);
            },
            getStore: () => mgr.store,
            getRouter: () => mgr.router,
            getAgentService: () => mgr.agentService,
        };
    }

    setPluginExport(id: string, exports: Record<string, any>): void {
        this.pluginExports.set(id, exports);
    }

    getPluginAPI(id: string): Record<string, any> | undefined {
        if (this.activePlugins.has(id)) {
            return this.pluginExports.get(id);
        }
        return undefined;
    }

    getExtensionPoints(): ExtensionPointRegistry {
        return this.extensionPoints;
    }

    setConfig(config: PluginConfig): void {
        this.pluginConfig = config;
    }

    register(plugin: KCodePlugin): void {
        this.plugins.set(plugin.id, plugin);
    }

    async loadFromDir(dirPath: string): Promise<void> {
        if (!fs.existsSync(dirPath)) return;
        const entries = fs.readdirSync(dirPath);
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            if (fs.statSync(fullPath).isDirectory()) {
                const pluginFile = path.join(fullPath, `${entry}Plugin.ts`);
                if (fs.existsSync(pluginFile)) {
                    try {
                        const mod = await import(pluginFile);
                        if (mod.default && mod.default.id) {
                            this.register(mod.default);
                        }
                    } catch (e) {
                        console.warn(`[PluginManager] Failed to load plugin from ${pluginFile}:`, e);
                    }
                }
            }
        }
    }

    async activateAll(): Promise<void> {
        for (const [id, plugin] of this.plugins) {
            const cfg = this.pluginConfig[id];
            if (cfg && cfg.enabled === false) continue;
            await this.activate(id);
        }
    }

    async activate(id: string): Promise<boolean> {
        if (this.activePlugins.has(id)) return true;
        const plugin = this.plugins.get(id);
        if (!plugin) return false;

        if (plugin.dependencies) {
            for (const depId of plugin.dependencies) {
                if (!this.activePlugins.has(depId)) {
                    await this.activate(depId);
                }
            }
        }

        try {
            await plugin.activate(this.apiImpl);
            this.activePlugins.add(id);
            return true;
        } catch (e) {
            console.warn(`[PluginManager] Failed to activate plugin ${id}:`, e);
            return false;
        }
    }

    async deactivate(id: string): Promise<void> {
        const plugin = this.plugins.get(id);
        if (!plugin || !this.activePlugins.has(id)) return;
        try {
            await plugin.deactivate();
        } catch (e) {
            console.warn(`[PluginManager] Error deactivating plugin ${id}:`, e);
        }
        this.activePlugins.delete(id);
        this.extensionPoints.removeByPlugin(id);
    }

    async deactivateAll(): Promise<void> {
        const ids = Array.from(this.activePlugins);
        for (const id of ids) {
            await this.deactivate(id);
        }
    }

    isActive(id: string): boolean {
        return this.activePlugins.has(id);
    }

    getActivePlugins(): string[] {
        return Array.from(this.activePlugins);
    }

    getRegisteredPlugins(): KCodePlugin[] {
        return Array.from(this.plugins.values());
    }

    dispatchMessage(type: string, message: any): void {
        const mode = this.getCurrentMode();
        this.extensionPoints.dispatch('message', type, message, mode);
    }

    dispatchPhaseChanged(taskId: string, fromPhase: string, toPhase: string): void {
        const mode = this.getCurrentMode();
        this.extensionPoints.dispatch('phaseChanged', '*', { taskId, fromPhase, toPhase }, mode);
    }

    dispatchToolCall(kind: string, taskId: string, info: any): void {
        const mode = this.getCurrentMode();
        this.extensionPoints.dispatch('toolCall', kind, { taskId, info }, mode);
    }

    processStream(text: string): string {
        const mode = this.getCurrentMode();
        return this.extensionPoints.dispatchStream('stream', text, mode);
    }

    getOutputPanelTabs(): { id: string; label: string; renderer: (taskInfo: any) => string }[] {
        const tabs: { id: string; label: string; renderer: (taskInfo: any) => string }[] = [];
        this.extensionPoints.forEachEntry('uiOutputPanel', (entry) => {
            const meta = entry.meta as { id?: string; label?: string; renderer?: (taskInfo: any) => string } | undefined;
            if (meta?.id && meta?.label && meta?.renderer) {
                tabs.push({ id: meta.id, label: meta.label, renderer: meta.renderer });
            }
        });
        return tabs;
    }

    getPluginContributions(): { type: string; id?: string; label?: string; messageType?: string; icon?: string; action?: string }[] {
        const contribs: { type: string; id?: string; label?: string; messageType?: string; icon?: string; action?: string }[] = [];
        this.extensionPoints.forEachEntry('uiOutputPanel', (entry) => {
            const meta = entry.meta as { id?: string; label?: string } | undefined;
            if (meta?.id && meta?.label) {
                contribs.push({ type: 'outputPanelTab', id: meta.id, label: meta.label });
            }
        });
        return contribs;
    }
}
