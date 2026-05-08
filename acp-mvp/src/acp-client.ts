import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acpSdk from '@agentclientprotocol/sdk';
import { AcpClientHandler } from './client-handler';
import type { AcpMessageHandler } from './types';

export interface AcpClientOptions {
  /** Working directory for the session */
  cwd: string;
  /** Path to opencode executable. Defaults to 'opencode' from PATH. */
  opencodePath?: string;
}

/**
 * ACP Client that connects to OpenCode via stdio.
 *
 * Flow:
 *   1. Spawn `opencode acp --port 0 --cwd <path>` as subprocess
 *   2. Initialize ACP connection (negotiate versions + capabilities)
 *   3. Create a new session (session/new)
 *   4. Send prompts (session/prompt) with streaming updates via handler
 *   5. Clean up on dispose
 */
export class AcpClient {
  private process: ChildProcess | null = null;
  private connection: acpSdk.ClientSideConnection | null = null;
  private handler: AcpClientHandler;
  private currentSessionId: string | null = null;
  private options: AcpClientOptions;

  constructor(options: AcpClientOptions) {
    this.options = options;
    this.handler = new AcpClientHandler();
  }

  /**
   * Connect to OpenCode by spawning it as a subprocess with stdio ACP mode.
   */
  async connect(): Promise<boolean> {
    const opencodePath = this.options.opencodePath || 'opencode';
    const cwd = this.options.cwd;

    console.log(`[AcpClient] Spawning: ${opencodePath} acp --port 0 --cwd ${cwd}`);

    this.process = spawn(opencodePath, ['acp', '--port', '0', '--cwd', cwd], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env },
    });

    // Log stderr from the agent for debugging
    if (this.process.stderr) {
      const stderrChunks: string[] = [];
      this.process.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrChunks.push(text);
        process.stderr.write(text); // forward to our stderr
      });
      this.process.stderr.on('end', () => {
        const full = stderrChunks.join('');
        if (full.trim()) {
          console.log(`\n[AcpClient] Agent stderr:\n${full}`);
        }
      });
    }

    this.process.on('exit', (code) => {
      console.log(`[AcpClient] OpenCode process exited with code ${code}`);
      this.process = null;
    });

    this.process.on('error', (err) => {
      console.error(`[AcpClient] OpenCode process error:`, err.message);
      this.process = null;
    });

    const input = Writable.toWeb(this.process.stdin!) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(this.process.stdout!) as ReadableStream<Uint8Array>;
    const stream = acpSdk.ndJsonStream(input, output);

    this.connection = new acpSdk.ClientSideConnection(() => this.handler, stream);

    try {
      const initResult = await this.connection.initialize({
        protocolVersion: acpSdk.PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
        },
        clientInfo: {
          name: 'acp-mvp',
          title: 'ACP MVP Test Client',
          version: '0.1.0',
        },
      });

      console.log(`[AcpClient] Connected! Protocol v${initResult.protocolVersion}`);
      if (initResult.agentInfo) {
        console.log(`[AcpClient] Agent: ${initResult.agentInfo.title || initResult.agentInfo.name} v${initResult.agentInfo.version}`);
      }
      console.log(`[AcpClient] Agent capabilities:`, JSON.stringify(initResult.agentCapabilities, null, 2));

      return true;
    } catch (err) {
      console.error(`[AcpClient] Initialization failed:`, err);
      return false;
    }
  }

  /**
   * Create a new ACP session.
   */
  async createSession(): Promise<string | null> {
    if (!this.connection) {
      console.error('[AcpClient] Not connected');
      return null;
    }

    try {
      const result = await this.connection.newSession({
        cwd: this.options.cwd,
        mcpServers: [],
      });

      this.currentSessionId = result.sessionId;
      console.log(`[AcpClient] Session created: ${result.sessionId}`);
      return result.sessionId;
    } catch (err) {
      console.error(`[AcpClient] Failed to create session:`, err);
      return null;
    }
  }

  /**
   * Send a prompt to the agent with streaming response handling.
   */
  async prompt(text: string, handler: AcpMessageHandler): Promise<void> {
    if (!this.connection || !this.currentSessionId) {
      handler.onError('Not connected');
      return;
    }

    this.handler.setHandler(this.currentSessionId, handler);

    try {
      console.log(`[AcpClient] Sending prompt (session: ${this.currentSessionId})`);
      const result = await this.connection.prompt({
        sessionId: this.currentSessionId,
        prompt: [{ type: 'text', text }],
      });

      if (result.stopReason === 'cancelled') {
        handler.onDone('cancelled');
      } else if (result.stopReason === 'end_turn') {
        handler.onDone('end_turn');
      } else {
        handler.onDone(result.stopReason);
      }
    } catch (err: any) {
      handler.onError(err?.message || 'Prompt failed');
    } finally {
      this.handler.removeHandler(this.currentSessionId);
    }
  }

  /**
   * Cancel the current prompt turn.
   */
  async cancel(): Promise<void> {
    if (!this.connection || !this.currentSessionId) return;
    try {
      await this.connection.cancel({ sessionId: this.currentSessionId });
      console.log('[AcpClient] Cancel sent');
    } catch {
      // Ignore errors on cancel
    }
  }

  /**
   * Close the current session.
   */
  async closeSession(): Promise<void> {
    if (!this.connection || !this.currentSessionId) return;
    try {
      await this.connection.closeSession({ sessionId: this.currentSessionId });
      console.log(`[AcpClient] Session closed: ${this.currentSessionId}`);
    } catch {
      // closeSession may not be supported
      console.log(`[AcpClient] session/close not supported, skipping`);
    }
    this.currentSessionId = null;
  }

  /**
   * Disconnect from the agent and clean up.
   */
  async dispose(): Promise<void> {
    console.log('[AcpClient] Disconnecting...');
    if (this.currentSessionId) {
      await this.closeSession();
    }

    this.connection = null;

    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 3000);
      this.process = null;
    }

    console.log('[AcpClient] Disconnected');
  }
}
