import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { AcpClient } from '../acp/AcpClient';
import { ConfigService } from './ConfigService';
import { AgentConfigManager } from './AgentConfigManager';
import { getNodeBinDir } from '../env/NodeManager';
import type { AcpMessageHandler, FileChange } from '../types';
import type { IAgentService } from './interfaces';
import { LocalAgentProvider } from './LocalAgentProvider';

export class AgentService implements IAgentService {
    private acpClient: AcpClient | null = null;
    private _isConnected: boolean = false;
    private _lastError: string = '';
    private _agentName: string = '';
    private _modelName: string = '';
    private agentType: 'acp' | 'langgraph' | null = null;
    private workspaceRoot: string;
    private logCallback: ((direction: 'send' | 'recv', text: string) => void) | null = null;
    private connectPromise: Promise<boolean> | null = null;
    private langGraphProvider: LocalAgentProvider | null = null;

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
            case 'claude': return await this.connectClaude(execPath === 'claude' ? 'claude-agent-acp' : execPath);
            case 'langgraph': return await this.connectLangGraph();
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

            if (agentName === 'claude') {
                return await this.connectClaude(execPath === 'claude' ? 'claude-agent-acp' : execPath);
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
        ], {
            OPENCODE_CONFIG: AgentConfigManager.getOpenCodeConfigPath(),
        });
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = 'opencode';
            this._modelName = this._readOpenCodeModel();
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
        ], {
            KILO_CONFIG: AgentConfigManager.getKiloConfigPath(),
        });
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

    private _resolveClaudeAcpBinary(): string | null {
        // 优先找全局安装的版本（通过 managed npm install -g）
        try {
            const binDir = getNodeBinDir();
            if (binDir) {
                const globalPkgPath = path.resolve(binDir, '..', 'lib', 'node_modules', '@agentclientprotocol', 'claude-agent-acp', 'dist', 'index.js');
                if (fs.existsSync(globalPkgPath)) return globalPkgPath;
            }
        } catch { /* fall through */ }

        // 回退到 require.resolve（开发模式，node_modules 中还残留的情况）
        try {
            return require.resolve('@agentclientprotocol/claude-agent-acp/dist/index.js');
        } catch {
            return null;
        }
    }

    private _ensureClaudeAcpPackage(): boolean {
        const binDir = getNodeBinDir();
        if (!binDir) return false;

        const npmExe = path.join(binDir, process.platform === 'win32' ? 'npm.cmd' : 'npm');
        if (!fs.existsSync(npmExe)) return false;

        try {
            execSync(`"${npmExe}" install -g @agentclientprotocol/claude-agent-acp`, {
                cwd: binDir,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 120000,
                env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}` },
            });
            return true;
        } catch (err: any) {
            const stderr = err.stderr?.toString()?.trim() || err.message || '';
            console.error('安装 @agentclientprotocol/claude-agent-acp 失败:', stderr);
            return false;
        }
    }

    private async connectClaude(claudePath: string): Promise<boolean> {
        let bundledBin = this._resolveClaudeAcpBinary();
        if (!bundledBin) {
            console.log('[AgentService] @agentclientprotocol/claude-agent-acp 未安装，正在自动安装…');
            const installed = this._ensureClaudeAcpPackage();
            if (installed) {
                bundledBin = this._resolveClaudeAcpBinary();
            }
        }

        const acpClient = new AcpClient(this.workspaceRoot);
        if (this.logCallback) {
            acpClient.setLogCallback(this.logCallback);
        }

        const cmd = bundledBin ? 'node' : claudePath;
        // claude-agent-acp 是纯 ACP 二元协议，不需 CLI 参数（通过 resolveSettings 自动读取系统配置）
        const cmdArgs = bundledBin
            ? [bundledBin]
            : ['--settings', AgentConfigManager.getClaudeSettingsPath(), 'acp', '--port', '0', '--cwd', this.workspaceRoot];

        // 从配置读取 Anthropic 兼容 API 参数，注入环境变量
        const anthropicBaseUrl = this._cfg().get<string>('provider.anthropic.baseUrl', '');
        const anthropicApiKey = this._cfg().get<string>('provider.anthropic.apiKey', '');
        const envOverride: Record<string, string> = {};
        if (anthropicBaseUrl && !process.env.ANTHROPIC_BASE_URL) {
            envOverride.ANTHROPIC_BASE_URL = anthropicBaseUrl;
        }
        if (anthropicApiKey && !process.env.ANTHROPIC_API_KEY) {
            envOverride.ANTHROPIC_API_KEY = anthropicApiKey;
        }

        const connectPromise = acpClient.connect(cmd, cmdArgs, envOverride);
        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
        const connected = await Promise.race([connectPromise, timeoutPromise]);

        if (connected) {
            this.acpClient = acpClient;
            this._isConnected = true;
            this._agentName = 'claude';
            this._modelName = process.env.CLAUDE_MODEL || '';
            this.agentType = 'acp';
            this._lastError = '';
            acpClient.onExit((code) => {
                this._isConnected = false;
                this._agentName = '';
                this._lastError = `Agent 进程已退出 (退出码: ${code})`;
                console.log(`Claude process exited with code ${code}`);
            });
            return true;
        }

        this._lastError = acpClient.lastError || `无法启动 claude: ${claudePath}`;
        return false;
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
        // 优先读取 KCode 同步的配置文件
        try {
            return JSON.parse(fs.readFileSync(AgentConfigManager.getKiloConfigPath(), 'utf-8'));
        } catch { /* fall through */ }

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

    private _readOpenCodeModel(): string {
        try {
            const configPath = AgentConfigManager.getOpenCodeConfigPath();
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            return config.model || 'opencode';
        } catch {
            return 'opencode';
        }
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

    async connectLangGraph(): Promise<boolean> {
        try {
            const apiKey = this._cfg().get<string>('provider.anthropic.apiKey', '')
                || process.env.ANTHROPIC_API_KEY || '';
            const baseUrl = this._cfg().get<string>('provider.anthropic.baseUrl', '')
                || process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
            const model = this._cfg().get<string>('provider.anthropic.model', '')
                || process.env.CLAUDE_MODEL || 'deepseek-v4-flash';

            const provider = new LocalAgentProvider({ model, apiKey, baseUrl });
            await provider.compile();
            this.langGraphProvider = provider;
            this._isConnected = true;
            this._agentName = 'langgraph';
            this._modelName = model;
            this.agentType = 'langgraph';
            this._lastError = '';
            return true;
        } catch (err: any) {
            this._lastError = err?.message || 'LangGraph 连接失败';
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.langGraphProvider) {
            await this.langGraphProvider.disconnect();
            this.langGraphProvider = null;
        }
        if (this.acpClient) {
            await this.acpClient.dispose();
            this.acpClient = null;
        }
        this._isConnected = false;
        this._agentName = '';
        this._modelName = '';
        this.agentType = null;
    }

    async createSession(taskId: string, cwd: string, existingSessionId?: string): Promise<string | null> {
        if (this.acpClient) {
            return await this.acpClient.createSession(taskId, cwd, existingSessionId);
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
        if (this.agentType === 'langgraph' && this.langGraphProvider) {
            await this.langGraphProvider.invoke(taskId, [
                { role: 'user', content: text },
            ], handler);
            return;
        }
        if (!this.acpClient || !this.isConnected) {
            const errMsg = this.acpClient ? this.acpClient.lastError : '';
            handler.onError(errMsg || 'ACP 会话未就绪');
            return;
        }
        let sessionId = this.getSessionId(taskId);
        if (!sessionId) {
            const cwd = this.workspaceRoot;
            const newSession = await this.acpClient.createSession(taskId, cwd);
            sessionId = newSession ?? undefined;
        }
        if (!sessionId) {
            const errMsg = this.acpClient.lastError || '';
            handler.onError(errMsg || 'ACP 会话未就绪');
            return;
        }
        await this.acpClient.prompt(taskId, text, handler);
    }

    async cancel(taskId: string): Promise<void> {
        if (this.acpClient) {
            await this.acpClient.cancel(taskId);
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
        return [];
    }
}
