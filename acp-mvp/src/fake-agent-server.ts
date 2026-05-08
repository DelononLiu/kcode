import * as acpSdk from '@agentclientprotocol/sdk';
import { Writable, Readable } from 'stream';

class FakeAgentLogic implements acpSdk.Agent {
  private sessionCount = 0;

  async initialize(_params: acpSdk.InitializeRequest): Promise<acpSdk.InitializeResponse> {
    console.error('[FakeAgent] initialize called');
    return {
      protocolVersion: acpSdk.PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
        promptCapabilities: {
          image: false,
          audio: false,
          embeddedContext: false,
        },
        mcpCapabilities: {
          http: false,
          sse: false,
        },
      },
      agentInfo: {
        name: 'fake-agent',
        title: 'Fake ACP Agent (MVP Test)',
        version: '0.1.0',
      },
      authMethods: [],
    };
  }

  async newSession(params: acpSdk.NewSessionRequest): Promise<acpSdk.NewSessionResponse> {
    this.sessionCount++;
    const sessionId = `fake-session-${this.sessionCount}-${Date.now()}`;
    console.error(`[FakeAgent] session/new: ${sessionId} (cwd=${params.cwd})`);
    return { sessionId };
  }

  async prompt(params: acpSdk.PromptRequest): Promise<acpSdk.PromptResponse> {
    const sessionId = params.sessionId;
    const promptText = params.prompt.map((b: any) => b.text || '').join('');
    console.error(`[FakeAgent] session/prompt: ${sessionId}`);
    console.error(`[FakeAgent] Prompt: "${promptText.substring(0, 100)}"`);

    await this.sendUpdate(sessionId, {
      sessionUpdate: 'plan',
      entries: [
        { content: 'Analyze the request', priority: 'high', status: 'pending' },
        { content: 'Process the response', priority: 'medium', status: 'pending' },
      ],
    });

    await this.sleep(300);

    const responseText = `Received: "${promptText}"

I am a Fake ACP Agent for testing the protocol flow.

Here is what I would do:
1. First step
2. Second step
3. Third step

This is a simulated response to test the ACP client implementation.`;
    const chunkSize = 20;
    for (let i = 0; i < responseText.length; i += chunkSize) {
      const chunk = responseText.slice(i, i + chunkSize);
      await this.sendUpdate(sessionId, {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text' as const, text: chunk },
      });
      await this.sleep(50);
    }

    await this.sleep(200);

    return { stopReason: 'end_turn' };
  }

  async authenticate(_params: acpSdk.AuthenticateRequest): Promise<acpSdk.AuthenticateResponse | void> {
    console.error('[FakeAgent] authenticate called (no-op)');
  }

  async cancel(_params: acpSdk.CancelNotification): Promise<void> {
    console.error('[FakeAgent] cancel called (no-op)');
  }

  private async sendUpdate(sessionId: string, update: any) {
    const msg = {
      jsonrpc: '2.0',
      method: 'session/update',
      params: { sessionId, update },
    };
    process.stdout.write(JSON.stringify(msg) + '\n');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function main() {
  const output = Writable.toWeb(process.stdout) as WritableStream<Uint8Array>;
  const input = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;
  const stream = acpSdk.ndJsonStream(output, input);

  console.error('[FakeAgent] Starting Fake ACP Agent (stdio mode)...');

  const agent = new FakeAgentLogic();
  const _connection = new acpSdk.AgentSideConnection(() => agent, stream);

  console.error('[FakeAgent] Ready. Waiting for client requests...');

  await new Promise<void>((resolve) => {
    process.stdin.on('close', () => {
      console.error('[FakeAgent] stdin closed, shutting down');
      resolve();
    });
    process.on('SIGINT', () => {
      console.error('[FakeAgent] SIGINT received, shutting down');
      resolve();
    });
  });

  console.error('[FakeAgent] Shutdown');
}

main().catch((err) => {
  console.error('[FakeAgent] Fatal error:', err);
  process.exit(1);
});
