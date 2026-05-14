import * as vscode from 'vscode';
import { AcpClient } from '../acp/AcpClient';
import { OpenAIAgent } from '../acp/OpenAIAgent';
import type { AcpMessageHandler, FileChange } from '../types';
import type { IAgentService } from './interfaces';

export class AgentService implements IAgentService {
    private acpClient: AcpClient | null = null;
    private openaiAgent: OpenAIAgent | null = null;
    private _isConnected: boolean = false;
    private _lastError: string = '';
    private _agentName: string = '';
    private agentType: 'acp' | 'openai' | null = null;
    private workspaceRoot: string;
    private logCallback: ((direction: 'send' | 'recv', text: string) => void) | null = null;

    get isConnected(): boolean { return this._isConnected; }
    get lastError(): string { return this._lastError; }
    get agentName(): string { return this._agentName; }

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    setLogCallback(cb: (direction: 'send' | 'recv', text: string) => void): void {
        this.logCallback = cb;
        if (this.acpClient) {
            this.acpClient.setLogCallback(cb);
        }
    }

    async connect(agentName: string, agentArgs: string[] = []): Promise<boolean> {
        if (this._isConnected) return true;

        try {
            const config = vscode.workspace.getConfiguration('kcode');

            // Kilo agent via stdio ACP (kilo acp)
            if (agentName === 'kilo') {
                return await this.connectKilo(config);
            }

            // OpenCode agent via stdio ACP
            if (agentName === 'opencode') {
                return await this.connectOpenCode(config);
            }

            // OpenAI Agent
            if (agentName === 'openai') {
                return this.connectOpenAI(config);
            }

            // Generic ACP stdio subprocess
            if (agentName && agentName !== 'npx') {
                return await this.connectGenericACP(agentName, agentArgs);
            }

            this._isConnected = false;
            return false;
        } catch (err: any) {
            this._lastError = err?.message || 'Agent 连接失败';
            this._isConnected = false;
            return false;
        }
    }

    private async connectOpenCode(config: vscode.WorkspaceConfiguration): Promise<boolean> {
        const agentPath = config.get<string>('agentPath') || 'opencode';
        const acpClient = new AcpClient(this.workspaceRoot);
        if (this.logCallback) {
            acpClient.setLogCallback(this.logCallback);
        }

        const connectPromise = acpClient.connect(agentPath, [
            'acp', '--port', '0', '--cwd', this.workspaceRoot
        ]);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = 'opencode';
            this.agentType = 'acp';
            return true;
        }

        this._lastError = acpClient.lastError || `无法启动 opencode: ${agentPath}`;
        return false;
    }

    private connectOpenAI(config: vscode.WorkspaceConfiguration): boolean {
        this.openaiAgent = new OpenAIAgent({
            apiKey: config.get<string>('openaiApiKey'),
            model: config.get<string>('openaiModel'),
            baseURL: config.get<string>('openaiBaseUrl'),
        });
        this._isConnected = true;
        this._agentName = 'openai';
        this.agentType = 'openai';
        return true;
    }

    private async connectKilo(config: vscode.WorkspaceConfiguration): Promise<boolean> {
        const kiloPath = config.get<string>('agentPath') || 'kilo';
        const acpClient = new AcpClient(this.workspaceRoot);
        if (this.logCallback) {
            acpClient.setLogCallback(this.logCallback);
        }

        const connectPromise = acpClient.connect(kiloPath, [
            'acp', '--port', '0', '--cwd', this.workspaceRoot
        ]);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = 'kilo';
            this.agentType = 'acp';
            return true;
        }

        this._lastError = acpClient.lastError || `无法启动 kilo: ${kiloPath}`;
        return false;
    }

    private async connectGenericACP(agentName: string, agentArgs: string[]): Promise<boolean> {
        const acpClient = new AcpClient(this.workspaceRoot);
        if (this.logCallback) {
            acpClient.setLogCallback(this.logCallback);
        }

        const connectPromise = acpClient.connect(agentName, agentArgs);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = agentName;
            this.agentType = 'acp';
            return true;
        }

        this._lastError = acpClient.lastError || `Agent 连接失败: ${agentName}`;
        return false;
    }

    async disconnect(): Promise<void> {
        if (this.acpClient) {
            await this.acpClient.dispose();
            this.acpClient = null;
        }
        this.openaiAgent = null;
        this._isConnected = false;
        this._agentName = '';
        this.agentType = null;
    }

    async createSession(taskId: string, cwd: string): Promise<string | null> {
        if (this.acpClient) {
            return await this.acpClient.createSession(taskId, cwd);
        }
        if (this.openaiAgent) {
            return this.openaiAgent.createSession(taskId);
        }
        throw new Error('未连接到 Agent');
    }

    hasSession(taskId: string): boolean {
        if (this.acpClient) return this.acpClient.hasSession(taskId);
        return false;
    }

    getSessionId(taskId: string): string | undefined {
        if (this.acpClient) return this.acpClient.getSessionId(taskId);
        return undefined;
    }

    async sendPrompt(taskId: string, text: string, handler: AcpMessageHandler): Promise<void> {
        const sessionId = this.getSessionId(taskId);
        if (!sessionId) {
            handler.onError('ACP 会话未就绪');
            return;
        }

        if (this.acpClient && this.agentType === 'acp') {
            await this.acpClient.prompt(taskId, text, handler);
        } else if (this.openaiAgent && this.agentType === 'openai') {
            this.openaiAgent.setHandler(sessionId, handler);
            await this.openaiAgent.prompt(sessionId, text);
        } else {
            handler.onError('Agent 未就绪');
        }
    }

    async cancel(taskId: string): Promise<void> {
        if (this.acpClient) {
            await this.acpClient.cancel(taskId);
        } else if (this.openaiAgent) {
            this.openaiAgent.cancel(taskId);
        }
    }

    async closeTaskSession(taskId: string): Promise<void> {
        if (this.acpClient) {
            await this.acpClient.closeTaskSession(taskId);
        }
    }

    getReviewChanges(taskId: string): FileChange[] {
        if (this.acpClient) {
            return this.acpClient.getReviewChanges(taskId);
        }
        if (this.openaiAgent) {
            return this.openaiAgent.getReviewChanges?.(taskId) || [];
        }
        return [];
    }
}
