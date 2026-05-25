export type ExtensionPointType =
    | 'message'
    | 'phaseChanged'
    | 'toolCall'
    | 'stream'
    | 'uiOutputPanel'
    | 'phaseHook';

export interface PluginAPI {
    onMessage(type: string, handler: (message: any) => void): void;
    onPhaseChanged(handler: (taskId: string, fromPhase: string, toPhase: string) => void): void;
    onToolCall(kind: string, handler: (taskId: string, info: any) => void): void;
    addStreamProcessor(processor: (text: string) => string): void;
    addOutputPanelTab(id: string, label: string, renderer: (taskInfo: any) => string): void;
    registerPhaseHook(phase: string, hook: { onEnter?: (taskId: string) => Promise<void>; onLeave?: (taskId: string) => Promise<void> }): void;
    getPlugin<T = any>(id: string): T | undefined;
    getStore(): any;
    getRouter(): any;
    getAgentService(): any;
}

export interface KCodePlugin {
    id: string;
    name: string;
    version: string;
    mode?: 'task' | 'assistant';
    dependencies?: string[];
    activate(api: PluginAPI): void | Promise<void>;
    deactivate(): void | Promise<void>;
}
