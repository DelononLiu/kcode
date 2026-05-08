/**
 * ACP MVP — REPL 交互模式
 *
 * 启动后进入交互式命令行，支持连续对话测试。
 *
 * 命令:
 *   /new          — 创建新会话
 *   /cancel       — 取消当前 prompt
 *   /info         — 查看连接和会话信息
 *   /exit         — 退出
 *   /help         — 帮助
 *
 * 使用:
 *   npx tsx src/repl.ts                     # 默认连接 OpenCode
 *   npx tsx src/repl.ts --fake              # 连接 Fake Agent
 *   npx tsx src/repl.ts --cwd /some/path    # 指定工作目录
 */

import * as readline from 'readline';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acpSdk from '@agentclientprotocol/sdk';
import { AcpClient } from './acp-client';
import { AcpClientHandler } from './client-handler';
import type { AcpMessageHandler } from './types';

// ─── 参数解析 ───────────────────────────────────────────────

const args = process.argv.slice(2);
const useFake = args.includes('--fake');
const cwdIndex = args.indexOf('--cwd');
const cwd = cwdIndex >= 0 ? args[cwdIndex + 1] : process.cwd();

// ─── REPL 状态 ─────────────────────────────────────────────

interface ReplState {
  client: AcpClient | null;
  fakeProcess: ChildProcess | null;
  sessionId: string | null;
  busy: boolean;
}

const state: ReplState = {
  client: null,
  fakeProcess: null,
  sessionId: null,
  busy: false,
};

// ─── 连接管理 ───────────────────────────────────────────────

async function connectToOpenCode(): Promise<boolean> {
  const client = new AcpClient({ cwd });
  state.client = client;
  return client.connect();
}

async function connectToFakeAgent(): Promise<boolean> {
  const fakePath = path.resolve(__dirname, 'fake-agent-server.ts');
  console.log(`[REPL] Spawning fake agent: npx tsx ${fakePath}`);
  const proc = spawn('npx', ['tsx', fakePath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  state.fakeProcess = proc;

  proc.stderr!.on('data', (chunk: Buffer) => {
    // quiet fake agent logs in REPL
  });
  proc.on('exit', (code) => {
    console.log(`\n[REPL] Fake agent exited (code ${code})`);
    state.fakeProcess = null;
  });

  await new Promise((r) => setTimeout(r, 1000));

  const input = Writable.toWeb(proc.stdin!) as WritableStream<Uint8Array>;
  const output = Readable.toWeb(proc.stdout!) as ReadableStream<Uint8Array>;
  const stream = acpSdk.ndJsonStream(input, output);

  const handler = new AcpClientHandler();
  const connection = new acpSdk.ClientSideConnection(() => handler, stream);

  try {
    await connection.initialize({
      protocolVersion: acpSdk.PROTOCOL_VERSION,
      clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
      clientInfo: { name: 'acp-mvp-repl', title: 'ACP MVP REPL', version: '0.1.0' },
    });

    state.client = new AcpClient({ cwd });
    (state.client as any).connection = connection;
    (state.client as any).handler = handler;
    return true;
  } catch (err) {
    console.error('[REPL] Failed to connect to fake agent:', err);
    return false;
  }
}

// ─── 会话管理 ───────────────────────────────────────────────

async function createNewSession(): Promise<boolean> {
  if (!state.client) {
    console.log('[REPL] Not connected. Use /connect first.');
    return false;
  }
  const sessionId = await state.client.createSession();
  state.sessionId = sessionId;
  return sessionId !== null;
}

// ─── 对话 ────────────────────────────────────────────────────

function createPromptHandler(resolve: (stopReason: string) => void): AcpMessageHandler {
  return {
    onText(text: string) {
      process.stdout.write(text);
    },
    onToolCall(toolCallId: string, title: string, kind: string, status: string) {
      console.log(`\n[Tool] ${title} (${kind}, ${status})`);
    },
    onToolCallUpdate(toolCallId: string, status: string, content?: string) {
      if (content) process.stdout.write(content);
    },
    onPlan(entries) {
      console.log(`\n[Plan] ${entries.length} steps`);
    },
    onError(error: string) {
      console.error(`\n[Error] ${error}`);
      resolve('error');
    },
    onDone(stopReason?: string) {
      console.log(`\n[Done: ${stopReason || 'end_turn'}]`);
      resolve(stopReason || 'end_turn');
    },
  };
}

async function sendPrompt(text: string): Promise<void> {
  if (!state.client) {
    console.log('[REPL] Not connected.');
    return;
  }
  if (!state.sessionId) {
    console.log('[REPL] No session. Creating one...');
    const ok = await createNewSession();
    if (!ok) return;
  }

  state.busy = true;

  await new Promise<void>((resolve) => {
    const handler = createPromptHandler((_stopReason) => resolve());
    state.client!.prompt(text, handler).catch((err) => {
      console.error(`\n[REPL] Prompt error: ${err.message}`);
      resolve();
    });
  });

  state.busy = false;
}

// ─── 清理 ─────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n[REPL] Cleaning up...');
  if (state.client) await state.client.dispose();
  if (state.fakeProcess) {
    state.fakeProcess.kill('SIGTERM');
    setTimeout(() => {
      if (state.fakeProcess && !state.fakeProcess.killed) {
        state.fakeProcess.kill('SIGKILL');
      }
    }, 2000);
  }
}

// ─── REPL 主循环 ────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   ACP MVP  REPL                      ║');
  console.log(`║   Agent: ${useFake ? 'Fake Agent' : 'OpenCode'.padEnd(20)}║`);
  console.log(`║   CWD:   ${cwd.padEnd(25)}║`);
  console.log('╠══════════════════════════════════════╣');
  console.log('║  /new    新会话   /cancel 取消当前   ║');
  console.log('║  /info   信息     /exit   退出       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 自动连接
  console.log('[REPL] Connecting...');
  const connected = useFake ? await connectToFakeAgent() : await connectToOpenCode();
  if (!connected) {
    console.error('[REPL] Connection failed. Exiting.');
    process.exit(1);
  }
  console.log('[REPL] Connected! Type your message or /command.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });
  rl.prompt();

  const lineQueue: string[] = [];
  let processing = false;

  rl.on('line', (line) => {
    lineQueue.push(line);
    if (!processing) processQueue();
  });

  const processQueue = async () => {
    processing = true;

    while (lineQueue.length > 0) {
      const line = lineQueue.shift()!;
      const input = line.trim();
      if (!input) continue;

      if (input.startsWith('/')) {
        const cmd = input.toLowerCase().split(/\s+/)[0];
        switch (cmd) {
          case '/exit':
          case '/quit':
            rl.close();
            processing = false;
            return;
          case '/new':
            if (state.busy) {
              console.log('[REPL] Busy, wait or /cancel first.');
            } else {
              const ok = await createNewSession();
              console.log(`[REPL] Session: ${ok ? state.sessionId : 'failed'}`);
            }
            break;
          case '/cancel':
            if (state.client && state.sessionId) {
              await state.client.cancel();
              console.log('[REPL] Cancel sent.');
            } else {
              console.log('[REPL] No active session.');
            }
            break;
          case '/info':
            console.log(`  Agent:      ${useFake ? 'Fake' : 'OpenCode'}`);
            console.log(`  CWD:        ${cwd}`);
            console.log(`  Session:    ${state.sessionId || 'none'}`);
            console.log(`  Busy:       ${state.busy}`);
            break;
          case '/help':
            console.log('  /new      创建新会话');
            console.log('  /cancel   取消当前 prompt');
            console.log('  /info     查看连接和会话信息');
            console.log('  /exit     退出');
            break;
          default:
            console.log(`Unknown command: ${cmd}. Type /help`);
        }
      } else if (state.busy) {
        console.log('[REPL] Busy processing previous prompt. Wait or /cancel.');
      } else {
        await sendPrompt(input);
      }
    }

    processing = false;
    rl.prompt();
  };

  await new Promise<void>((resolve) => rl.on('close', () => resolve()));

  await cleanup();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Fatal:', err);
  await cleanup();
  process.exit(1);
});
