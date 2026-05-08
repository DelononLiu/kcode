/**
 * ACP MVP — Test against real OpenCode via stdio.
 *
 * This script:
 *   1. Spawns `opencode acp --port 0 --cwd <path>` as subprocess
 *   2. Connects via ACP protocol over stdio
 *   3. Creates a session
 *   4. Sends a prompt and streams the response
 *   5. Cleans up
 *
 * Usage:
 *   npx tsx src/test-opencode.ts [prompt] [cwd]
 *
 * Examples:
 *   npx tsx src/test-opencode.ts "Hello"
 *   npx tsx src/test-opencode.ts "分析当前目录" /some/path
 */

import * as path from 'path';
import { AcpClient } from './acp-client';
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
  const args = process.argv.slice(2);
  const promptText = args[0] || 'Hello, please introduce yourself in one sentence.';
  const cwd = args[1] || process.cwd();

  console.log('=== ACP MVP: OpenCode Integration Test ===');
  console.log(`Prompt: "${promptText}"`);
  console.log(`CWD:    ${cwd}`);
  console.log('');

  const client = new AcpClient({ cwd });

  // Step 1: Connect (spawn opencode + initialize)
  console.log('[Step 1] Connecting to OpenCode via ACP...');
  const connected = await client.connect();
  if (!connected) {
    console.error('Failed to connect. Is opencode installed and in PATH?');
    console.error('Install: npm install -g @opencode/cli');
    process.exit(1);
  }

  // Step 2: Create session
  console.log('\n[Step 2] Creating session...');
  const sessionId = await client.createSession();
  if (!sessionId) {
    console.error('Failed to create session');
    await client.dispose();
    process.exit(1);
  }

  // Step 3: Send prompt with streaming handler
  console.log('\n[Step 3] Sending prompt...');
  console.log('--- Response ---');
  const handler = createHandler(promptText);
  await client.prompt(promptText, handler);
  console.log('--- End ---');

  // Step 4: Cleanup
  console.log('\n[Step 4] Cleaning up...');
  await client.dispose();

  console.log('\n=== Test Complete ===');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
