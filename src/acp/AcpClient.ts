import type * as acp from '@agentclientprotocol/sdk';
import { AgentManager } from './AgentManager';
import { KCodeClient } from './callbacks';

export type AcpMessageHandler = {
    onText: (text: string) => void;
    onError: (error: string) => void;
    onDone: () => void;
};

export class AcpClient {
    private connection: acp.ClientSideConnection | null = null;
    private agentManager: AgentManager;
    private sessionId: string | null = null;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.agentManager = new AgentManager();
    }

    /**
     * Start the agent and initialize ACP connection.
     */
    async connect(agentPath: string, args: string[] = []): Promise<boolean> {
        try {
            const { input, output } = await this.agentManager.startAgent(agentPath, args);

            const sdk = await this.loadSDK();
            const stream = sdk.ndJsonStream(input, output);

            this.connection = new sdk.ClientSideConnection(
                (agent) => new KCodeClient(this.workspaceRoot),
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
        } catch (err) {
            console.error('ACP connection failed:', err);
            return false;
        }
    }

    /**
     * Create a new ACP session.
     */
    async createSession(cwd: string): Promise<string | null> {
        if (!this.connection) {
            throw new Error('Not connected to agent');
        }

        try {
            const result = await this.connection.newSession({
                cwd,
                mcpServers: [],
            });

            this.sessionId = result.sessionId;
            return this.sessionId;
        } catch (err) {
            console.error('Failed to create ACP session:', err);
            return null;
        }
    }

    /**
     * Send a user prompt and receive streaming response via handler.
     */
    async prompt(text: string, handler: AcpMessageHandler): Promise<void> {
        if (!this.connection || !this.sessionId) {
            handler.onError('ACP 会话未就绪');
            return;
        }

        try {
            // Set up streaming update handler
            // The KCodeClient's sessionUpdate will be called by ClientSideConnection
            // We need to wire the handler into the client

            const result = await this.connection.prompt({
                sessionId: this.sessionId,
                prompt: [
                    {
                        type: 'text',
                        text,
                    },
                ],
            });

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
     * Cancel the current prompt turn.
     */
    async cancel(): Promise<void> {
        if (!this.connection || !this.sessionId) return;

        try {
            await this.connection.cancel({
                sessionId: this.sessionId,
            });
        } catch {
            // Ignore errors on cancel
        }
    }

    /**
     * Close the current session.
     */
    async closeSession(): Promise<void> {
        if (this.sessionId) {
            this.sessionId = null;
        }
    }

    /**
     * Disconnect and clean up.
     */
    async dispose(): Promise<void> {
        await this.closeSession();
        this.agentManager.stopAgent();
        this.connection = null;
    }

    /**
     * Dynamically load the ACP SDK (ESM-compatible).
     */
    private async loadSDK(): Promise<typeof acp> {
        return require('@agentclientprotocol/sdk');
    }
}
