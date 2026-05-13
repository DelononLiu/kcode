# ACP 协议接入 — OpenCode 集成验证

## 背景

ACP (Agent Client Protocol) 是标准化代码编辑器与 AI 编码 Agent 之间通信的协议。KCode 作为 VS Code 扩展（Client 端），需要通过 ACP 与 Agent（如 OpenCode）通信。

## 传输方式

OpenCode 通过 stdio 运行 ACP 服务器（非 HTTP）：

```bash
opencode acp --port 0 --cwd <工作目录>
```

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

