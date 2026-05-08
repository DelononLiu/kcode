/**
 * ACP MVP — Test against Fake Agent (no real OpenCode needed).
 *
 * This script spawns the fake agent as a subprocess, then connects
 * to it via ACP stdio protocol to verify the client flow works.
 *
 * Usage:
 *   npx tsx src/test-fake.ts [prompt]
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Writable, Readable } from 'stream';
import * as acpSdk from '@agentclientprotocol/sdk';
import { AcpClientHandler } from './client-handler';
import type { AcpMessageHandler } from './types';

function createHandler(promptText: string): AcpMessageHandler {
  return {
    onText(text: string) {
      process.stdout.write(text);
    },
    onToolCall(toolCallId: string, title: string, kind: string, status: string) {
      console.log(`\n[Tool Call] ${kind}: ${title} (${status}) [id=${toolCallId}]`);
    },
    onToolCallUpdate(toolCallId: string, status: string, content?: string) {
      if (content) {
        process.stdout.write(content);
      }
      console.log(`\n[Tool Update] ${toolCallId}: ${status}`);
    },
    onPlan(entries) {
      console.log(`\n[Plan] ${entries.length} steps:`);
      for (const e of entries) {
        const icon = e.status === 'completed' ? '✅' : e.status === 'in_progress' ? '🔄' : '⬜';
        console.log(`  ${icon} [${e.priority}] ${e.content}`);
      }
    },
    onError(error: string) {
      console.error(`\n[Error] ${error}`);
    },
    onDone(stopReason?: string) {
      console.log(`\n[Done] stopReason: ${stopReason || 'end_turn'}`);
    },
  };
}

async function main() {
  const promptText = process.argv[2] || 'Hello, what can you do?';
  const fakeAgentPath = path.resolve(__dirname, 'fake-agent-server.ts');

  console.log('=== ACP MVP: Fake Agent Test ===');
  console.log(`Prompt: "${promptText}"`);
  console.log('');

  // Step 1: Spawn fake agent as subprocess
  console.log('[Step 1] Spawning fake agent...');
  const agentProcess = spawn('npx', ['tsx', fakeAgentPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  agentProcess.stderr!.on('data', (chunk: Buffer) => {
    process.stderr.write(`[FakeAgent] ${chunk}`);
  });

  agentProcess.on('exit', (code) => {
    console.log(`\n[FakeAgent] exited with code ${code}`);
  });

  // Wait for agent to be ready
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const input = Writable.toWeb(agentProcess.stdin!) as WritableStream<Uint8Array>;
  const output = Readable.toWeb(agentProcess.stdout!) as ReadableStream<Uint8Array>;
  const stream = acpSdk.ndJsonStream(input, output);

  const handler = new AcpClientHandler();
  const connection = new acpSdk.ClientSideConnection(() => handler, stream);

  // Step 2: Initialize
  console.log('[Step 2] Initializing ACP connection...');
  const initResult = await connection.initialize({
    protocolVersion: acpSdk.PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
    },
    clientInfo: {
      name: 'acp-mvp',
      title: 'ACP MVP Test Client',
      version: '0.1.0',
    },
  });
  console.log(`  Protocol: v${initResult.protocolVersion}`);
  console.log(`  Agent: ${initResult.agentInfo?.title || 'unknown'}`);

  // Step 3: Create session
  console.log('[Step 3] Creating session...');
  const sessionResult = await connection.newSession({
    cwd: process.cwd(),
    mcpServers: [],
  });
  const sessionId = sessionResult.sessionId;
  console.log(`  Session ID: ${sessionId}`);

  // Step 4: Send prompt
  console.log('[Step 4] Sending prompt...\n');
  console.log('--- Response ---');
  const msgHandler = createHandler(promptText);
  handler.setHandler(sessionId, msgHandler);

  const promptResult = await connection.prompt({
    sessionId,
    prompt: [{ type: 'text', text: promptText }],
  });
  handler.removeHandler(sessionId);
  console.log('\n--- End ---');
  console.log(`\n  Stop reason: ${promptResult.stopReason}`);

  // Step 5: Cleanup
  console.log('\n[Step 5] Cleaning up...');
  agentProcess.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
