import type * as acp from '@agentclientprotocol/sdk';
import { AgentManager } from './AgentManager';
import { KCodeClient } from './callbacks';
import { createHttpStream } from './HttpStream';
import type { AcpMessageHandler, FileChange } from '../types';

export class AcpClient {
    private connection: acp.ClientSideConnection | null = null;
    private agentManager: AgentManager;
    private sessions: Map<string, string> = new Map(); // taskId → sessionId
    private kcodeClient: KCodeClient | null = null;
    private workspaceRoot: string;
    private httpMode: boolean = false;
    private _lastError: string = '';

    get lastError(): string { return this._lastError; }

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.agentManager = new AgentManager();
    }

    /**
     * Start the agent and initialize ACP connection (stdio subprocess).
     */
    async connect(agentName: string, args: string[] = []): Promise<boolean> {
        try {
            const { input, output } = await this.agentManager.startAgent(agentName, args);

            const sdk = await this.loadSDK();
            const stream = sdk.ndJsonStream(input, output);

            return this.initConnection(sdk, stream);
        } catch (err) {
            this._lastError = (err as Error)?.message || String(err);
            console.error('ACP connection failed:', this._lastError);
            return false;
        }
    }

    /**
     * Connect to a remote ACP agent via HTTP.
     */
    async connectHttp(agentUrl: string): Promise<boolean> {
        try {
            const sdk = await this.loadSDK();
            const stream = createHttpStream(agentUrl);
            this.httpMode = true;
            return this.initConnection(sdk, stream);
        } catch (err) {
            this._lastError = (err as Error)?.message || String(err);
            console.error('ACP HTTP connection failed:', this._lastError);
            return false;
        }
    }

    private async initConnection(sdk: typeof acp, stream: acp.Stream): Promise<boolean> {
        this.kcodeClient = new KCodeClient(this.workspaceRoot);
        this.connection = new sdk.ClientSideConnection(
            () => this.kcodeClient!,
            stream
        );

        const initResult = await this.connection.initialize({
            protocolVersion: sdk.PROTOCOL_VERSION,
            clientCapabilities: {
                fs: {
                    readTextFile: true,
                    writeTextFile: true,
                },
            },
            clientInfo: {
                name: 'kcode',
                title: 'KCode',
                version: '0.1.0',
            },
        });

        console.log(`ACP connected (protocol v${initResult.protocolVersion})`);
        return true;
    }

    /**
     * Create a new ACP session for a specific task.
     */
    async createSession(taskId: string, cwd: string): Promise<string | null> {
        if (!this.connection) {
            throw new Error('Not connected to agent');
        }

        try {
            const result = await this.connection.newSession({
                cwd,
                mcpServers: [],
            });

            this.sessions.set(taskId, result.sessionId);
            return result.sessionId;
        } catch (err) {
            console.error('Failed to create ACP session:', err);
            return null;
        }
    }

    /**
     * Get sessionId for a task.
     */
    getSessionId(taskId: string): string | undefined {
        return this.sessions.get(taskId);
    }

    /**
     * Check if a task has a session.
     */
    hasSession(taskId: string): boolean {
        return this.sessions.has(taskId);
    }

    /**
     * Send a user prompt for a specific task and receive streaming response via handler.
     */
    async prompt(taskId: string, text: string, handler: AcpMessageHandler): Promise<void> {
        const sessionId = this.sessions.get(taskId);
        if (!this.connection || !sessionId) {
            handler.onError('ACP 会话未就绪');
            return;
        }

        try {
            this.kcodeClient?.setSessionHandler(sessionId, handler);
            this.kcodeClient?.setCurrentSession(sessionId);

            const result = await this.connection.prompt({
                sessionId,
                prompt: [
                    {
                        type: 'text',
                        text,
                    },
                ],
            });

            // Grace period: 等待 straggler sessionUpdate 通知到达后再回调
            // opencode ACP agent 的事件循环可能在 prompt() resolve 后才
            // 处理完最后几条 message.part.delta，导致最后几个 agent_message_chunk
            // 通知在 prompt 响应之后到达。200ms 缓冲确保它们不被丢弃。
            await new Promise(resolve => setTimeout(resolve, 200));

            this.kcodeClient?.removeSessionHandler(sessionId);

            handler.onDone(result.stopReason || 'end_turn');
        } catch (err: any) {
            handler.onError(err?.message || 'ACP 请求失败');
        }
    }

    /**
     * Cancel the current prompt turn for a task.
     */
    async cancel(taskId: string): Promise<void> {
        const sessionId = this.sessions.get(taskId);
        if (!this.connection || !sessionId) return;

        try {
            await this.connection.cancel({ sessionId });
        } catch {
            // Ignore errors on cancel
        }
    }

    /**
     * Close the session for a specific task.
     */
    getReviewChanges(taskId: string): FileChange[] {
        const sessionId = this.sessions.get(taskId);
        if (!sessionId || !this.kcodeClient) return [];
        return this.kcodeClient.getSessionChanges(sessionId);
    }

    async closeTaskSession(taskId: string): Promise<void> {
        const sessionId = this.sessions.get(taskId);
        if (this.connection && sessionId) {
            try {
                await this.connection.closeSession({ sessionId });
            } catch {
                // closeSession may not be supported by agent
            }
        }
        this.sessions.delete(taskId);
    }

    /**
     * Disconnect and clean up.
     */
    async dispose(): Promise<void> {
        for (const [taskId] of this.sessions) {
            await this.closeTaskSession(taskId);
        }
        this.sessions.clear();
        this.kcodeClient = null;
        if (!this.httpMode) {
            this.agentManager.stopAgent();
        }
        this.connection = null;
    }

    /**
     * Dynamically load the ACP SDK (ESM-compatible).
     */
    private async loadSDK(): Promise<typeof acp> {
        return require('@agentclientprotocol/sdk');
    }
}
