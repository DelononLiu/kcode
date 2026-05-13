import * as vscode from 'vscode';
import * as fs from 'fs';
import type * as acp from '@agentclientprotocol/sdk';
import type { AcpMessageHandler, FileChange } from '../types';

/**
 * Client implementation for ACP protocol.
 * KCode acts as the Client side - handles agent requests.
 */
export class KCodeClient implements acp.Client {
    private sessionHandlers: Map<string, AcpMessageHandler> = new Map();
    private sessionChanges: Map<string, FileChange[]> = new Map();
    private currentSessionId: string = '';
    private workspaceRoot: string;
    private lastUpdateTime: Map<string, number> = new Map();
    logCallback: ((direction: 'send' | 'recv', text: string) => void) | null = null;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    setSessionHandler(sessionId: string, handler: AcpMessageHandler) {
        this.sessionHandlers.set(sessionId, handler);
    }

    removeSessionHandler(sessionId: string) {
        this.sessionHandlers.delete(sessionId);
        this.lastUpdateTime.delete(sessionId);
    }

    setCurrentSession(sessionId: string) {
        this.currentSessionId = sessionId;
        if (!this.sessionChanges.has(sessionId)) {
            this.sessionChanges.set(sessionId, []);
        }
    }

    getSessionChanges(sessionId: string): FileChange[] {
        return this.sessionChanges.get(sessionId) || [];
    }

    /** 等待 session 的流式更新结束。每 100ms 检查一次，连续 idleMs 无更新则返回。 */
    async awaitSessionIdle(sessionId: string, idleMs: number = 300, maxMs: number = 5000): Promise<void> {
        const start = Date.now();
        while (Date.now() - start < maxMs) {
            const last = this.lastUpdateTime.get(sessionId) || 0;
            if (Date.now() - last >= idleMs) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
        // MVP: auto-accept all permissions
        return {
            outcome: {
                outcome: 'selected',
                optionId: params.options[0]?.optionId || 'allow'
            }
        };
    }

    async sessionUpdate(params: acp.SessionNotification): Promise<void> {
        this.lastUpdateTime.set(params.sessionId, Date.now());
        const update = params.update;
        const handler = this.sessionHandlers.get(params.sessionId);
        if (!handler) return;

        const log = (text: string) => this.logCallback?.('recv', text + '\n');

        switch (update.sessionUpdate) {
            case 'agent_message_chunk':
                if (update.content.type === 'text') {
                    handler.onText(update.content.text);
                }
                break;
            case 'tool_call': {
                const toolKind = update.kind ?? 'other';
                const displayTitle = extractToolDisplayTitle(update);
                handler.onToolCall?.(
                    update.toolCallId,
                    displayTitle,
                    toolKind,
                    update.status ?? 'pending'
                );
                break;
            }
            case 'tool_call_update': {
                const status = update.status ?? 'pending';
                const item = update.content?.[0];
                let textContent: string | undefined;
                if (item) {
                    if (item.type === 'content' && (item as any).content?.type === 'text') {
                        textContent = (item as any).content.text;
                    } else if (item.type === 'diff') {
                        textContent = (item as any).newText;
                    }
                }
                if (!textContent && update.rawOutput != null) {
                    textContent = String(update.rawOutput);
                }
                if (update.rawInput != null) {
                    const input = typeof update.rawInput === 'string' ? update.rawInput : JSON.stringify(update.rawInput);
                    if (input) log(input);
                }
                if (update.locations?.length) {
                    for (const loc of update.locations) {
                        const line = loc.line != null ? `:${loc.line}` : '';
                        log(`<path>${loc.path}${line}</path>`);
                    }
                }
                if (update.title && update.title !== update.kind) {
                    log(`<title>${update.title}</title>`);
                }
                if (textContent && (status === 'completed' || status === 'in_progress')) {
                    log(textContent);
                }

                const titleFromUpdate = update.title ?? undefined;
                const kindFromUpdate = update.kind ?? undefined;

                handler.onToolCallUpdate?.(
                    update.toolCallId,
                    status,
                    textContent,
                    titleFromUpdate,
                    kindFromUpdate
                );
                break;
            }
            case 'plan':
                handler.onPlan?.(update.entries);
                break;
            case 'agent_thought_chunk':
                if (update.content.type === 'text') {
                    handler.onReasoning?.(update.content.text);
                }
                break;
        }
    }

    async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
        const filePath = params.path;
        const content = params.content;

        const resolvedPath = this.resolvePath(filePath);

        let original = '';
        try {
            original = fs.readFileSync(resolvedPath, 'utf-8');
        } catch {
            // File doesn't exist yet
        }

        fs.writeFileSync(resolvedPath, content, 'utf-8');

        if (this.currentSessionId && original !== content) {
            const changes = this.sessionChanges.get(this.currentSessionId) || [];
            changes.push({ filePath, original, modified: content });
            this.sessionChanges.set(this.currentSessionId, changes);
        }

        return {};
    }

    async readTextFile(params: acp.ReadTextFileRequest): Promise<acp.ReadTextFileResponse> {
        const filePath = params.path;
        const resolvedPath = this.resolvePath(filePath);
        const content = fs.readFileSync(resolvedPath, 'utf-8');

        return { content };
    }

    private resolvePath(filePath: string): string {
        if (filePath.startsWith('/')) {
            return filePath;
        }
        return this.workspaceRoot ? `${this.workspaceRoot}/${filePath}` : filePath;
    }
}

function extractToolDisplayTitle(update: any): string {
    const kind = update.kind ?? 'other';
    const title = update.title ?? '';

    if (title && title !== kind) {
        return title;
    }

    if (update.locations?.length && update.locations[0].path) {
        return update.locations[0].path;
    }

    const rawInput = update.rawInput as any;
    if (rawInput != null) {
        if (typeof rawInput === 'string') {
            return rawInput;
        }
        if (typeof rawInput === 'object') {
            const pathKeys = ['path', 'filePath', 'file', 'file_path', 'filepath', 'target', 'target_file', 'filename', 'file_name'];
            for (const key of pathKeys) {
                if (rawInput[key]) return String(rawInput[key]);
            }
            if (rawInput.command) return String(rawInput.command);
            if (rawInput.args) return String(rawInput.args);
            if (rawInput.pattern) return String(rawInput.pattern);
        }
    }

    return title;
}
