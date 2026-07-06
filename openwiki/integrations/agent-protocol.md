# Agent Protocol & Integration

KCode communicates with AI agent backends via the **ACP (Agent Client Protocol)** — JSON-RPC 2.0 over child process stdio. A LangGraph-based agent is under development.

## Supported Agents

| Agent | Connect Command | Status |
|-------|----------------|--------|
| **OpenCode** | `opencode acp --port 0 --cwd <dir>` | Supported |
| **Claude Code** | `claude-agent-acp acp --port 0 --cwd <dir>` | Supported |
| **Kilo** | Kilo's ACP binary via configurable path | Supported |
| **Custom ACP** | Any ACP-compatible binary | Supported |
| **LangGraph** (I5) | In-process `@langchain/langgraph` StateGraph | In development |

*Source: `/src/core/AgentService.ts` (connectKilo, connectOpenCode, connectClaude methods)*

## ACP Protocol

**Transport**: JSON-RPC 2.0 over stdio (NDJSON — one JSON-RPC message per newline-delimited line). Agent stderr is used for logging.

### Protocol Lifecycle

```
Launch child process
  → initialize (negotiate version & capabilities)
  → session/new (get sessionId)
  → session/prompt (send user message)
      ├─ session/update (plan)
      ├─ session/update (agent_message_chunk)   ← streaming text
      ├─ session/update (tool_call)
      ├─ session/update (tool_call_update)      ← tool progress
      ├─ session/request_permission             ← permission requests
      └─ session/prompt response (stopReason)
  → session/cancel (optional)
  → SIGTERM
```

### Client → Agent Messages

| Method | Purpose |
|--------|---------|
| `initialize` | Negotiate version & capabilities |
| `session/new` | Create conversation session |
| `session/prompt` | Send user message, receive stream |
| `session/cancel` | Cancel current prompt |
| `session/close` | Close session |

### Agent → Client Messages

| Method | Purpose |
|--------|---------|
| `session/update` | Stream updates (text, tool calls, plan events) |
| `session/request_permission` | Permission requests (auto-allowed in MVP) |
| `fs/read_text_file` | Read file from workspace |
| `fs/write_text_file` | Write file to workspace |

*Source: `/docs/ACP协议接入.md`*

## Implementation

### AcpClient (`/src/acp/AcpClient.ts`)

Wraps `@agentclientprotocol/sdk` `ClientSideConnection`:

```typescript
class AcpClient {
    async connect(agentPath, args): Promise<boolean>
    async newSession(): Promise<string>
    async prompt(sessionId, text, attachments?): Promise<void>
    async cancel(sessionId): Promise<void>
    async close(sessionId): Promise<void>
    async dispose(): Promise<void>

    setLogCallback(cb)
    setActivityCallback(cb)
    onSessionUpdate(cb)
    onSessionRequestPermission(cb)
    onSessionToolCall(cb)
}
```

### callbacks (`/src/acp/callbacks.ts`)

Implements ACP client callbacks for file read/write operations and session updates. Hooks into VS Code's file system for permission-aware file modifications.

### AgentManager (`/src/acp/AgentManager.ts`)

Manages agent child process lifecycle:

```typescript
class AgentManager {
    async startAgent(command, args): Promise<boolean>
    async stopAgent(): Promise<void>
    async restartAgent(): Promise<boolean>
    getStatus(): 'running' | 'stopped' | 'error'
}
```

## AgentService (`/src/core/AgentService.ts`)

Abstraction layer between the application and agent backends:

```typescript
class AgentService {
    async connect(agentName: string, agentArgs?: string[]): Promise<boolean>
    async connectByLabel(label: 'kilo' | 'opencode' | 'claude'): Promise<boolean>
    async disconnect(): Promise<void>
    async newSession(): Promise<string>
    async prompt(sessionId: string, text: string): Promise<void>
    async cancelSession(sessionId: string): Promise<void>

    get isConnected(): boolean
    get lastError(): string
    get agentName(): string
    get modelName(): string
}
```

Connection flow:
1. `connectByLabel(label)` dispatches to `connectKilo`, `connectOpenCode`, or `connectClaude`
2. Each creates an `AcpClient`, finds the agent binary (via config or PATH), connects
3. `AgentConfigManager` (`/src/core/AgentConfigManager.ts`) manages OpenCode/Claude config files
4. `NodeManager` (`/src/env/NodeManager.ts`) locates Node.js for agents

### ConfigAgentManager (`/src/core/AgentConfigManager.ts`)

Handles config file merge for OpenCode and Claude Code agents. Reads agent config files and merges KCode provider settings (API key, model, base URL) so agents can use the configured provider without manual setup.

*Source: `/src/core/AgentConfigManager.ts`*

## OpenAIAgent (`/src/acp/OpenAIAgent.ts`)

Direct HTTP-based agent that calls OpenAI-compatible APIs. Simpler alternative that doesn't require a child process — useful when no local ACP agent is available.

## LangGraph Migration (Iteration 5)

### Motivation
- State persistence via SQLite checkpointing (survives VS Code restart)
- `interrupt` for natural human-in-loop pauses
- Conditional branching (self-verify fail → retry execution)
- No custom protocol markers — all handled by StateGraph state

### Planned Architecture
```typescript
const taskGraph = new StateGraph(TaskState)
  .addNode('goal', goalNode)
  .addNode('plan', planNode)
  .addNode('execute', executeNode)
  .addNode('verify', verifyNode)
  .addNode('review', reviewNode)
  .addConditionalEdges('verify', (s) => s.passed ? 'review' : 'execute')
  .compile({ checkpointer: sqliteSaver })
```

### Implementation History
| Commit | Event |
|--------|-------|
| `b9a30ff` | Added `@langchain/langgraph` dependency |
| `65b5ec1` | Created `StreamAdapter.ts` + `LocalAgentProvider.ts` |
| `840c4ba` | Extended `AgentService` with LangGraph type |
| `268f5b7` | Made LangGraph import dynamic to avoid startup errors |
| `a7585f6` | **Removed** LangGraph provider code (current state) |

### Key Design Principle
> LangGraph mode builds from scratch — inherits NO protocol baggage from ACP. ACP and LangGraph share only the Domain Model (types); execution paths are completely independent.

*Sources: `/docs/Agent框架选型.md`, `/docs/superpowers/plans/2026-07-06-iteration5-langgraph.md`, git log*

## Change Guidance

1. **New agent type**: Add to `AgentService._doConnect()` switch, create connect method
2. **ACP protocol changes**: Update `AcpClient.ts`, `callbacks.ts`, `StreamHandlerBase.ts`
3. **LangGraph re-activation**: `LocalAgentProvider.ts` and `StreamAdapter.ts` were removed — would need recreation per I5 plan
4. **Config**: Agent selection in `kcode.jsonc` under `agentName`, `agentPath`, `agentArgs`
5. **Tests**: `/src/core/__tests__/`
