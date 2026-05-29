import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
    private _modelName: string = '';
    private agentType: 'acp' | 'openai' | null = null;
    private workspaceRoot: string;
    private logCallback: ((direction: 'send' | 'recv', text: string) => void) | null = null;
    private connectPromise: Promise<boolean> | null = null;

    get isConnected(): boolean { return this._isConnected; }
    get lastError(): string { return this._lastError; }
    get agentName(): string { return this._agentName; }
    get modelName(): string { return this._modelName; }

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
        const execPath = this._cfg().get<string>('agentPath', '') || label;
        switch (label) {
            case 'kilo': return await this.connectKilo(execPath);
            case 'opencode': return await this.connectOpenCode(execPath);
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
            const execPath = this._cfg().get<string>('agentPath', '') || agentName;

            if (agentName === 'kilo') {
                return await this.connectKilo(execPath);
            }

            if (agentName === 'opencode') {
                return await this.connectOpenCode(execPath);
            }

            if (agentName === 'openai') {
                return this.connectOpenAI();
            }

            if (agentName && agentName !== 'npx') {
                return await this.connectGenericACP(execPath, agentArgs, agentName);
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

    private async connectOpenCode(execPath: string): Promise<boolean> {
        const agentPath = execPath;
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
            this._modelName = 'opencode';
            this.agentType = 'acp';
            this._lastError = '';
            acpClient.onExit((code) => {
                this._isConnected = false;
                this._agentName = '';
                this._lastError = `Agent 进程已退出 (退出码: ${code})`;
                console.log(`OpenCode process exited with code ${code}`);
            });
            return true;
        }

        this._lastError = acpClient.lastError || `无法启动 opencode: ${agentPath}`;
        return false;
    }

    private async connectKilo(execPath: string): Promise<boolean> {
        const kiloPath = execPath;
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
            this._modelName = this._readKiloModel();
            this.agentType = 'acp';
            this._lastError = '';
            acpClient.onExit((code) => {
                this._isConnected = false;
                this._agentName = '';
                this._lastError = `Agent 进程已退出 (退出码: ${code})`;
                console.log(`Kilo process exited with code ${code}`);
            });
            return true;
        }

        this._lastError = acpClient.lastError || `无法启动 kilo: ${kiloPath}`;
        return false;
    }

    private connectOpenAI(overrideApiKey?: string, overrideModel?: string, overrideBaseUrl?: string): boolean {
        const cfg = this._cfg();
        const model = overrideModel || cfg.get<string>('provider.openai.model');
        this.openaiAgent = new OpenAIAgent({
            apiKey: overrideApiKey || cfg.get<string>('provider.openai.apiKey'),
            model,
            baseURL: overrideBaseUrl || cfg.get<string>('provider.openai.baseUrl'),
        });
        this._isConnected = true;
        this._agentName = 'openai';
        this._modelName = model || 'unknown';
        this.agentType = 'openai';
        return true;
    }

    private _kiloConfigPath(): string {
        const xdgConfig = process.env.XDG_CONFIG_HOME;
        if (xdgConfig) return path.join(xdgConfig, 'kilo', 'kilo.jsonc');
        if (process.platform === 'win32') {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
            return path.join(appData, 'kilo', 'kilo.jsonc');
        }
        if (process.platform === 'darwin') {
            return path.join(os.homedir(), 'Library', 'Application Support', 'kilo', 'kilo.jsonc');
        }
        return path.join(os.homedir(), '.config', 'kilo', 'kilo.jsonc');
    }

    private _readKiloConfig(): any {
        const configPath = this._kiloConfigPath();
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch { return null; }
    }

    private _readKiloModel(): string {
        const config = this._readKiloConfig();
        if (!config) return 'kilo';
        return config.model || config.agent?.code?.model || 'kilo';
    }

    getAvailableModels(): string[] {
        const config = this._readKiloConfig();
        if (!config || !config.model) return [];
        return [config.model];
    }

    private async connectGenericACP(execPath: string, agentArgs: string[] = [], displayName?: string): Promise<boolean> {
        const acpClient = new AcpClient(this.workspaceRoot);
        if (this.logCallback) {
            acpClient.setLogCallback(this.logCallback);
        }

        const connectPromise = acpClient.connect(execPath, agentArgs);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = displayName || execPath;
            this._modelName = displayName || execPath;
            this.agentType = 'acp';
            this._lastError = '';
            acpClient.onExit((code) => {
                this._isConnected = false;
                this._agentName = '';
                this._lastError = `Agent 进程已退出 (退出码: ${code})`;
                console.log(`Agent process exited with code ${code}`);
            });
            return true;
        }

        this._lastError = acpClient.lastError || `Agent 连接失败: ${execPath}`;
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
        this._modelName = '';
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
                if (this.openaiAgent && this.agentType === 'openai') {
                    sessionId = `openai-session-${taskId}`;
                } else {
                    const errMsg = this.acpClient ? this.acpClient.lastError : '';
                    handler.onError(errMsg || 'ACP 会话未就绪');
                    return;
                }
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
            this.openaiAgent.cancel(`openai-session-${taskId}`);
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
