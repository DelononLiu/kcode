import type * as acp from '@agentclientprotocol/sdk';
import { AgentManager } from './AgentManager';
import { KCodeClient } from './callbacks';
import type { AcpMessageHandler, FileChange } from '../types';

export class AcpClient {
    private connection: acp.ClientSideConnection | null = null;
    private agentManager: AgentManager;
    private sessions: Map<string, string> = new Map(); // taskId → sessionId
    private kcodeClient: KCodeClient | null = null;
    private workspaceRoot: string;
    private _lastError: string = '';
    private pendingLogCallback: ((direction: 'send' | 'recv', text: string) => void) | null = null;

    get lastError(): string { return this._lastError; }

    setLogCallback(cb: (direction: 'send' | 'recv', text: string) => void): void {
        this.pendingLogCallback = cb;
        if (this.kcodeClient) {
            this.kcodeClient.logCallback = cb;
        }
    }

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

    private async initConnection(sdk: typeof acp, stream: acp.Stream): Promise<boolean> {
        this.kcodeClient = new KCodeClient(this.workspaceRoot);
        if (this.pendingLogCallback) {
            this.kcodeClient.logCallback = this.pendingLogCallback;
        }
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
     * If existingSessionId is provided, try resumeSession first.
     */
    async createSession(taskId: string, cwd: string, existingSessionId?: string): Promise<string | null> {
        if (!this.connection) {
            this._lastError = 'ACP 连接尚未建立';
            throw new Error(this._lastError);
        }

        if (existingSessionId) {
            try {
                await this.connection.resumeSession({
                    sessionId: existingSessionId,
                    cwd,
                });
                this.sessions.set(taskId, existingSessionId);
                this._lastError = '';
                return existingSessionId;
            } catch (err) {
                console.warn(`[AcpClient] resumeSession failed for ${taskId}, creating new session:`, err);
            }
        }

        try {
            const result = await this.connection.newSession({
                cwd,
                mcpServers: [],
            });

            this.sessions.set(taskId, result.sessionId);
            this._lastError = '';
            return result.sessionId;
        } catch (err) {
            this._lastError = `创建 ACP 会话失败: ${(err as Error)?.message || String(err)}`;
            console.error(this._lastError);
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

            await this.kcodeClient?.awaitSessionIdle(sessionId, 300, 5000);
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
        this.agentManager.stopAgent();
        this.connection = null;
    }

    /**
     * Dynamically load the ACP SDK (ESM-compatible).
     */
    private async loadSDK(): Promise<typeof acp> {
        return (await import('@agentclientprotocol/sdk')) as typeof acp;
    }
}
