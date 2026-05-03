import type * as acp from '@agentclientprotocol/sdk';
import { AgentManager } from './AgentManager';
import { KCodeClient } from './callbacks';
import { createHttpStream } from './HttpStream';
import type { AcpMessageHandler } from '../types';

export class AcpClient {
    private connection: acp.ClientSideConnection | null = null;
    private agentManager: AgentManager;
    private sessions: Map<string, string> = new Map(); // taskId → sessionId
    private kcodeClient: KCodeClient | null = null;
    private workspaceRoot: string;
    private httpMode: boolean = false;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.agentManager = new AgentManager();
    }

    /**
     * Start the agent and initialize ACP connection (stdio subprocess).
     */
    async connect(agentPath: string, args: string[] = []): Promise<boolean> {
        try {
            const { input, output } = await this.agentManager.startAgent(agentPath, args);

            const sdk = await this.loadSDK();
            const stream = sdk.ndJsonStream(input, output);

            return this.initConnection(sdk, stream);
        } catch (err) {
            console.error('ACP connection failed:', err);
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
            console.error('ACP HTTP connection failed:', err);
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

            const result = await this.connection.prompt({
                sessionId,
                prompt: [
                    {
                        type: 'text',
                        text,
                    },
                ],
            });

            this.kcodeClient?.removeSessionHandler(sessionId);

            if (result.stopReason === 'cancelled') {
                handler.onError('已取消');
            } else {
                handler.onDone();
            }
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
    closeTaskSession(taskId: string): void {
        this.sessions.delete(taskId);
    }

    /**
     * Disconnect and clean up.
     */
    async dispose(): Promise<void> {
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
