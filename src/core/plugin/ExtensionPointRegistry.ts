import type { ExtensionPointType } from './PluginInterface';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (...args: any[]) => void;

interface ExtensionEntry {
    handler: Handler;
    meta?: Record<string, any>;
    pluginId: string;
    mode?: 'task' | 'assistant';
}

export class ExtensionPointRegistry {
    private registries = new Map<ExtensionPointType, Map<string, Set<ExtensionEntry>>>();

    register(type: ExtensionPointType, key: string, handler: Handler, pluginId: string, mode?: 'task' | 'assistant', meta?: Record<string, any>): void {
        if (!this.registries.has(type)) {
            this.registries.set(type, new Map());
        }
        const keyed = this.registries.get(type)!;
        if (!keyed.has(key)) {
            keyed.set(key, new Set());
        }
        keyed.get(key)!.add({ handler, pluginId, mode, meta });
    }

    dispatch(type: ExtensionPointType, key: string, payload: any, currentMode?: 'task' | 'assistant'): void {
        const keyed = this.registries.get(type);
        if (!keyed) return;
        const entries = keyed.get(key);
        if (!entries) return;
        for (const entry of entries) {
            if (entry.mode && currentMode && entry.mode !== currentMode) continue;
            entry.handler(payload);
        }
    }

    dispatchAll(type: ExtensionPointType, payload: any, currentMode?: 'task' | 'assistant'): void {
        const keyed = this.registries.get(type);
        if (!keyed) return;
        for (const [, entries] of keyed) {
            for (const entry of entries) {
                if (entry.mode && currentMode && entry.mode !== currentMode) continue;
                entry.handler(payload);
            }
        }
    }

    getEntries(type: ExtensionPointType, key: string): ExtensionEntry[] {
        const keyed = this.registries.get(type);
        if (!keyed) return [];
        const entries = keyed.get(key);
        if (!entries) return [];
        return Array.from(entries);
    }

    removeByPlugin(pluginId: string): void {
        for (const [, keyed] of this.registries) {
            for (const [, entries] of keyed) {
                for (const entry of entries) {
                    if (entry.pluginId === pluginId) {
                        entries.delete(entry);
                    }
                }
            }
        }
    }

    reset(): void {
        this.registries.clear();
    }
}
