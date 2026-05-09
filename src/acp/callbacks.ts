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

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    setSessionHandler(sessionId: string, handler: AcpMessageHandler) {
        this.sessionHandlers.set(sessionId, handler);
    }

    removeSessionHandler(sessionId: string) {
        this.sessionHandlers.delete(sessionId);
    }

    setCurrentSession(sessionId: string) {
        this.currentSessionId = sessionId;
        this.sessionChanges.set(sessionId, []);
    }

    getSessionChanges(sessionId: string): FileChange[] {
        return this.sessionChanges.get(sessionId) || [];
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
        const update = params.update;
        const handler = this.sessionHandlers.get(params.sessionId);
        if (!handler) return;

        switch (update.sessionUpdate) {
            case 'agent_message_chunk':
                if (update.content.type === 'text') {
                    handler.onText(update.content.text);
                }
                break;
            case 'tool_call':
                handler.onToolCall?.(
                    update.toolCallId,
                    update.title ?? '',
                    update.kind ?? 'other',
                    update.status ?? 'pending'
                );
                break;
            case 'tool_call_update': {
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
                handler.onToolCallUpdate?.(
                    update.toolCallId,
                    update.status ?? 'pending',
                    textContent
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
