import * as vscode from 'vscode';
import * as fs from 'fs';
import type * as acp from '@agentclientprotocol/sdk';
import type { AcpMessageHandler } from '../types';

/**
 * Client implementation for ACP protocol.
 * KCode acts as the Client side - handles agent requests.
 */
export class KCodeClient implements acp.Client {
    private sessionHandlers: Map<string, AcpMessageHandler> = new Map();
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
                console.log(`[ACP Tool Call] ${update.title} (${update.status})`);
                break;
            case 'tool_call_update':
                console.log(`[ACP Tool Update] ${update.toolCallId}: ${update.status}`);
                break;
            case 'plan':
            case 'agent_thought_chunk':
                // Can be displayed in UI as thinking indicator
                break;
        }
    }

    async writeTextFile(params: acp.WriteTextFileRequest): Promise<acp.WriteTextFileResponse> {
        const filePath = params.path;
        const content = params.content;

        // Resolve relative paths against workspace root
        const resolvedPath = this.resolvePath(filePath);
        fs.writeFileSync(resolvedPath, content, 'utf-8');

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
