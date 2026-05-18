import { AcpClient } from '../acp/AcpClient';
import { OpenAIAgent } from '../acp/OpenAIAgent';
import { ConfigService } from './ConfigService';
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
    private connectPromise: Promise<boolean> | null = null;

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

    private _cfg(): ConfigService {
        return ConfigService.getInstance();
    }

    async connectByLabel(label: string): Promise<boolean> {
        if (this._isConnected) await this.disconnect();
        switch (label) {
            case 'kilo': return await this.connectKilo();
            case 'opencode': return await this.connectOpenCode();
            case 'openai': return this.connectOpenAI();
            default: return false;
        }
    }

    async connect(agentName: string, agentArgs: string[] = []): Promise<boolean> {
        if (this._isConnected) return true;
        if (this.connectPromise) return this.connectPromise;

        this.connectPromise = this._doConnect(agentName, agentArgs);
        return await this.connectPromise;
    }

    private async _doConnect(agentName: string, agentArgs: string[]): Promise<boolean> {
        try {
            if (agentName === 'kilo') {
                return await this.connectKilo();
            }

            if (agentName === 'opencode') {
                return await this.connectOpenCode();
            }

            if (agentName === 'openai') {
                return this.connectOpenAI();
            }

            if (agentName && agentName !== 'npx') {
                return await this.connectGenericACP(agentName, agentArgs);
            }

            this._isConnected = false;
            return false;
        } catch (err: any) {
            this._lastError = err?.message || 'Agent 连接失败';
            this._isConnected = false;
            return false;
        } finally {
            this.connectPromise = null;
        }
    }

    private async connectOpenCode(overridePath?: string): Promise<boolean> {
        const agentPath = overridePath || this._cfg().get<string>('agentPath', 'opencode');
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

    private connectOpenAI(overrideApiKey?: string, overrideModel?: string, overrideBaseUrl?: string): boolean {
        const cfg = this._cfg();
        this.openaiAgent = new OpenAIAgent({
            apiKey: overrideApiKey || cfg.get<string>('provider.openai.apiKey'),
            model: overrideModel || cfg.get<string>('provider.openai.model'),
            baseURL: overrideBaseUrl || cfg.get<string>('provider.openai.baseUrl'),
        });
        this._isConnected = true;
        this._agentName = 'openai';
        this.agentType = 'openai';
        return true;
    }

    private async connectKilo(overridePath?: string): Promise<boolean> {
        const kiloPath = overridePath || this._cfg().get<string>('agentPath', 'kilo');
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

    private async connectGenericACP(agentName: string, agentArgs: string[] = []): Promise<boolean> {
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

    async createSession(taskId: string, cwd: string, existingSessionId?: string): Promise<string | null> {
        if (this.acpClient) {
            return await this.acpClient.createSession(taskId, cwd, existingSessionId);
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
        let sessionId = this.getSessionId(taskId);
        if (!sessionId) {
            if (this.isConnected && this.acpClient) {
                const cwd = this.workspaceRoot;
                const newSession = await this.acpClient.createSession(taskId, cwd);
                sessionId = newSession ?? undefined;
            }
            if (!sessionId) {
                const errMsg = this.acpClient ? this.acpClient.lastError : '';
                handler.onError(errMsg || 'ACP 会话未就绪');
                return;
            }
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
