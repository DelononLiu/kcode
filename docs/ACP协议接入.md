# ACP 协议接入

## 背景

ACP (Agent Client Protocol) 是标准化代码编辑器与 AI 编码 Agent 之间通信的协议。KCode 作为 VS Code 扩展（Client 端），需要通过 ACP 与 Agent（OpenCode / Claude Code）通信。

## 支持的 Agent

| Agent | 启动命令 | 配置路径 |
|-------|----------|----------|
| OpenCode | `opencode acp --port 0 --cwd <工作目录>` | `~/.config/opencode/config.json` |
| Claude Code | `claude-agent-acp acp --port 0 --cwd <工作目录>` | `~/.claude/settings.json` |

Claude Code 也提供 ACP 入口 `claude-agent-acp`（随 `@anthropic-ai/claude-code` 安装），入门命令同样为：

```bash
claude-agent-acp acp --port 0 --cwd <工作目录>
```

## 传输方式

Agent 通过 stdio 运行 ACP 服务器（非 HTTP）：

- JSON-RPC 2.0 协议，消息通过 stdin/stdout 传递
- 消息为换行符分隔的 JSON (NDJSON)
- 每行一条完整的 JSON-RPC 消息
- Agent 的 stderr 可用于日志输出

## ACP 协议流程

```
启动子进程
    │
    ▼
initialize ───→ 协商协议版本 & 能力
    │
    ▼
session/new ───→ 创建会话，返回 sessionId
    │
    ▼
session/prompt ─→ 发送用户消息
    │                │
    │                ├─ session/update (plan) ← Agent 执行计划
    │                ├─ session/update (agent_message_chunk) ← 流式文本
    │                ├─ session/update (tool_call) ← Agent 工具调用
    │                ├─ session/update (tool_call_update) ← 工具进度
    │                ├─ session/request_permission ← 权限请求
    │                └─ session/prompt response (stopReason) ← 轮次结束
    │
    ▼
session/cancel ──→ (可选) 取消当前 prompt
    │
    ▼
SIGTERM ─────────→ 关闭子进程
```

### 关键接口

#### Client 侧（Agent 调用 Client）

| 方法 | 说明 | MVP 策略 |
|------|------|----------|
| `session/update` | 流式更新 (text/tool_call/plan) | 转发到 UI 渲染 |
| `session/request_permission` | 工具权限请求 | 自动允许 |
| `fs/read_text_file` | 读文件 | 直接读取 |
| `fs/write_text_file` | 写文件 | 直接写入 + 记录变更 |

#### Agent 侧（Client 调用 Agent）

| 方法 | 说明 |
|------|------|
| `initialize` | 初始化连接，协商能力和版本 |
| `session/new` | 创建新会话 |
| `session/prompt` | 发送用户提示，接收流式响应 |
| `session/cancel` | 取消正在处理的 prompt |
| `session/close` | 关闭会话（需 Agent 支持） |

## SDK 接入

使用官方 TypeScript SDK: `@agentclientprotocol/sdk`

```typescript
import * as acpSdk from '@agentclientprotocol/sdk';
import { Writable, Readable } from 'stream';
import { spawn } from 'child_process';

// 1. 启动 OpenCode 子进程
const proc = spawn('opencode', ['acp', '--port', '0', '--cwd', cwd], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

// 2. 转换 Node.js 流为 Web Stream
const input = Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>;
const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;

// 3. 创建 NDJSON 流 (参数1=写入端, 参数2=读取端)
const stream = acpSdk.ndJsonStream(input, output);

// 4. 创建 ClientSideConnection
const connection = new acpSdk.ClientSideConnection(
  () => clientHandler,  // Client 接口实现
  stream
);

// 5. 初始化
const initResult = await connection.initialize({
  protocolVersion: acpSdk.PROTOCOL_VERSION,
  clientCapabilities: {
    fs: { readTextFile: true, writeTextFile: true },
  },
  clientInfo: {
    name: 'kcode',
    title: 'KCode',
    version: '0.1.0',
  },
});

// 6. 创建会话
const { sessionId } = await connection.newSession({
  cwd,
  mcpServers: [],
});

// 7. 发送提示
const result = await connection.prompt({
  sessionId,
  prompt: [{ type: 'text', text: '用户消息' }],
});
console.log('stopReason:', result.stopReason);
```

### Client 接口实现

```typescript
class MyClientHandler implements acpSdk.Client {
  async requestPermission(params) {
    // MVP: 自动允许
    return { outcome: { outcome: 'selected', optionId: 'allow-once' } };
  }

  async sessionUpdate(params) {
    const update = params.update;
    switch (update.sessionUpdate) {
      case 'agent_message_chunk':
        // 流式文本块
        console.log(update.content.text);
        break;
      case 'tool_call':
        // 工具调用通知
        break;
      case 'tool_call_update':
        // 工具状态更新
        break;
      case 'plan':
        // Agent 执行计划
        break;
    }
  }

  async writeTextFile(params) {
    // Agent 请求写文件
    fs.writeFileSync(params.path, params.content);
    return {};
  }

  async readTextFile(params) {
    // Agent 请求读文件
    const content = fs.readFileSync(params.path, 'utf-8');
    return { content };
  }
}
```

## ndJsonStream 参数说明

`ndJsonStream(output, input)` 的参数命名容易混淆：

| 参数 | 类型 | Client 传入 | Agent 传入 |
|------|------|-------------|------------|
| `output` (第1参) | `WritableStream` | `child.stdin` (写入请求) | `process.stdout` (写入响应) |
| `input` (第2参) | `ReadableStream` | `child.stdout` (读取响应) | `process.stdin` (读取请求) |

Client 端使用:
```typescript
// 1st = writable = child.stdin (发送给 Agent)
// 2nd = readable = child.stdout (接收 Agent 响应)
ndJsonStream(
  Writable.toWeb(child.stdin),
  Readable.toWeb(child.stdout)
)
```

## SDK API 概览

### ClientSideConnection 方法

| 方法 | 用途 |
|------|------|
| `initialize(params)` | 初始化连接，协商版本和能力 |
| `newSession(params)` | 创建新会话，返回 `sessionId` |
| `prompt(params)` | 发送用户消息，返回 `{ stopReason }` |
| `cancel(params)` | 取消当前 prompt（notification，无响应） |
| `closeSession(params)` | 关闭会话（需 Agent 支持 `session.close` 能力） |
| `loadSession(params)` | 加载已有会话（需 Agent 支持 `loadSession`） |
| `listSessions(params)` | 列出会话（需 Agent 支持 `session.list`） |
| `resumeSession(params)` | 恢复已有会话（需 Agent 支持 `session.resume`） |
| `setSessionMode(params)` | 切换模式（ask/code/architect） |
| `authenticate(params)` | 认证（需 Agent 支持） |

## Session 持久化与恢复

Agent（Kilo/OpenCode）使用 SQLite 持久化 session（位于 `~/.local/share/kilo/kilo.db`），session 在进程重启后不丢失。

KCode 利用此机制实现会话恢复：

### 数据流

```
首次对话:
  KCode → session/new → Agent 生成 sessionId (ses_xxx)
  KCode 将 sessionId 持久化到 Task.meta.yml

重启后恢复:
  KCode loadTask → 从 Task.meta.yml 读出 sessionId
  KCode → resumeSession({ sessionId, cwd })
  Agent 从 SQLite 恢复完整对话上下文
  KCode 直接继续对话，Agent 记得所有历史

resume 失败时自动 fallback:
  session 已失效/被删除 → newSession 创建新会话 → 更新 sessionId
```

### Task 存储

`Task` 接口新增 `sessionId?: string` 字段，通过 `ProjectFs._writeTaskMeta()` 持久化到 `meta.yml`。

### Agent 能力要求

| 能力 | 标志 | Kilo 实现 |
|------|------|-----------|
| Session 持久化 | 无（基础能力） | SQLite `kilo.db` |
| Session 恢复 | `sessionCapabilities.resume` | ✅ `agent.ts:803` |
| Session 加载 | `agentCapabilities.loadSession` | ✅ `agent.ts:623` |
| Session 列表 | `sessionCapabilities.list` | ✅ `agent.ts:693` |

### 代码示例

```typescript
// 首次创建 session
const { sessionId } = await connection.newSession({ cwd, mcpServers: [] });
// 持久化 sessionId 到 Task
taskStore.updateTaskSessionId(taskId, sessionId);

// 恢复已有 session
try {
  await connection.resumeSession({ sessionId: storedSessionId, cwd });
} catch {
  // session 失效，创建新 session
  const { sessionId } = await connection.newSession({ cwd, mcpServers: [] });
  taskStore.updateTaskSessionId(taskId, sessionId);
}
```

## 验证连接

以下独立脚本可验证 ACP 连接是否正常。保存为文件后运行：

```bash
npx tsx test_acp.ts /path/to/claude-agent-acp
```

脚本执行流程：`initialize` → `newSession` → `prompt`，实时打印 Agent 流式回复。连接失败或 API 错误时会提示检查 `~/.claude/settings.json`。

### test_acp.ts

```typescript
import { spawn } from 'child_process';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';

class StubClient {
    async requestPermission() { return { outcome: { outcome: 'selected' as const, optionId: 'allow' } }; }
    async sessionUpdate(params: any) {
        const update = params.update;
        if (update?.sessionUpdate === 'agent_message_chunk') {
            process.stdout.write(update.content?.text || '');
        }
    }
    async writeTextFile() { return {}; }
    async readTextFile() { return { content: '' }; }
}

async function main() {
    const claudePath = process.argv[2] || 'claude';
    const cwd = process.cwd();
    console.log(`Spawning: ${claudePath} acp --port 0 --cwd ${cwd}`);

    const proc = spawn(claudePath, ['acp', '--port', '0', '--cwd', cwd], {
        stdio: ['pipe', 'pipe', 'inherit'],
    });

    const input = Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>;
    const output = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(input, output);

    const connection = new acp.ClientSideConnection(() => new StubClient(), stream);

    try {
        const init = await connection.initialize({
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: { fs: { readTextFile: true, writeTextFile: true } },
            clientInfo: { name: 'kcode-test', version: '1.0' },
        });
        console.log(`OK protocol v${init.protocolVersion}`);

        const s = await connection.newSession({ cwd, mcpServers: [] });
        console.log(`OK session ${s.sessionId}`);

        console.log('Sending prompt: "Say hello in one sentence"');
        const result = await connection.prompt({
            sessionId: s.sessionId,
            prompt: [{ type: 'text', text: 'Say hello in one sentence' }] as any,
        });
        console.log(`OK prompt stopReason: ${result.stopReason}`);
        console.log('TEST PASSED');
    } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.log(`\nFAILED: ${errMsg}`);
        console.log(`\n请检查配置文件: ~/.claude/settings.json`);
    }
    proc.kill('SIGTERM');
}

main().catch(console.error);
```

输出示例：

```
Spawning: /path/to/claude-agent-acp acp --port 0 --cwd /home/user/kcode
OK protocol v1
OK session 34ba6354-8711-4628-86c8-0b679e6316ca
Sending prompt: "Say hello in one sentence"
Hello! I'm your coding assistant, ready to help.
OK prompt stopReason: end_turn
TEST PASSED
```

