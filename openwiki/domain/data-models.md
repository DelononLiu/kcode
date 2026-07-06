# Domain Data Models

KCode uses a cleanly separated type system (established in Iterations 1-2) to avoid the historical problem of three out-of-sync data models.

## Type Layer Architecture

```
types/index.ts    → Domain Model (persisted, single source of truth)
types/ui.ts       → UI State (ephemeral, WebView-only, never persisted)
types/agent.ts    → Agent Runtime (LangGraph-specific, not stored with Task)
types/config.ts   → Configuration (kcode.jsonc schema)
```

## Core Domain Model (`/src/types/index.ts`)

### Task Entity

```typescript
interface Task {
    id: string;
    title: string;
    type: 'task' | 'chat';

    originalRequest?: string;
    goal: string;

    phase: Phase;           // 'goal' | 'plan' | 'execute' | 'self_verify' | 'review'
    status: TaskStatus;     // 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled'

    confirmedItems: string[];
    pendingItems: string[];
    planSteps: PlanStep[];
    riskItems?: string[];
    boundaryItems?: string[];

    category?: TaskCategory;          // 'requirement_dev' | 'code_review' | ...
    subType?: string;
    createdAt: number;
    workspace?: string;
    pinned?: boolean;
    group?: string;
    archived?: boolean;
    containerId?: string;
    hooks?: Partial<Record<Phase, string[]>>;
    planVersion?: number;

    // Transitional fields (from pre-I1 model)
    source?: TaskSource;
    sessionId?: string;
    nodeMessageIds?: Partial<Record<Phase, string>>;
    flowIteration?: { ... };
}
```

Key design choices:
- `phase` is the workflow step; `status` is the lifecycle state
- `confirmedItems`/`pendingItems`/`planSteps` store structured phase data
- Category drives prompt template selection

### Message Entity

```typescript
interface Message {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool' | 'system';
    type: string;       // 'text' | 'thinking' | 'tool_call' | 'phase_action' | ...
    content: string;    // Plain text (not JSON-encoded since I2 cleanup)

    toolCall?: ToolCallInfo;        // Structured tool call data
    toolResult?: ToolResultInfo;    // Tool execution results
    phaseAction?: PhaseActionInfo;  // TASK_UPDATE structured data

    timestamp: number;
}
```

After Iteration 2, `JSON.parse(msg.content)` patterns were replaced with structured fields. The `type` field was simplified from a complex enum to a string.

### Supporting Types

```typescript
interface PlanStep {
    content: string;
    status: 'pending' | 'active' | 'completed';
}

interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'completed';
    priority?: 'low' | 'medium' | 'high';
}

interface KnowledgeEntry {
    title: string;
    content: string;
    category?: string;
    tags?: string[];
}

interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

interface TimelineEntry {
    timestamp: number;
    type: string;
    summary: string;
    detail?: string;
}
```

*Source: `/src/types/index.ts`*

## UI State (`/src/types/ui.ts`)

Never persisted, applies only to the current WebView session:

```typescript
interface MessageUIState {
    streaming: boolean;
    collapsed: boolean;
    roundGroup: string | null;
}

interface AppUIState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    expandedRounds: Record<string, boolean>;
    isGenerating: boolean;
    scrollLocked: boolean;
}
```

## Agent Types (`/src/types/agent.ts`)

Runtime types for LangGraph agent (not persisted with tasks):

```typescript
type AgentType = 'acp' | 'langgraph';

interface GraphState {
    messages: GraphMessage[];
    phase: Phase;
    status: TaskStatus;
    goal: string;
    confirmedItems: string[];
    planSteps: PlanStep[];
    taskId: string;
}

interface AgentConfig {
    type: AgentType;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    graphThreadId?: string;  // LangGraph checkpoint thread ID
    sessionId?: string;      // ACP session ID
}
```

## Configuration Types (`/src/types/config.ts`)

```typescript
interface KCodeConfig {
    agentName?: string;
    agentArgs?: string[];
    agentPath?: string;
    provider?: Record<string, ProviderConfig>;  // openai, anthropic
    log?: LogConfig;
    github?: GitHubConfig;
    ui?: UIConfig;
    devices?: SavedDevice[];
    plugins?: Record<string, PluginEntry>;
}
```

Default provider targets **DeepSeek** API endpoint (`https://api.deepseek.com`) with model `deepseek-v4-flash`.

## Storage Layer

### ProjectFs

The persistence layer stores data as JSON files under `~/.kcode/`:

| Data | Path |
|------|------|
| Tasks | `~/.kcode/tasks.json` |
| Messages per task | `~/.kcode/messages/{taskId}.json` |
| Assistant messages | `~/.kcode/assistant_messages.json` |
| Knowledge entries | `~/.kcode/knowledge.json` |
| Timeline entries | `~/.kcode/timelines/{taskId}.json` |
| ACP logs | `~/.kcode/logs/{taskId}/{sessionId}.ndjson` |

### TaskStore (`/src/store/TaskStore.ts`)

Wraps `ProjectFs` with a type-safe CRUD API:

```typescript
class TaskStore {
    getTasks(): Task[]
    addTask(task: Task): void
    getTask(taskId: string): Task | undefined
    updateTaskPhase(taskId, phase): void
    updatePlanSteps(taskId, steps): void
    updateConfirmedItems(taskId, items): void
    addMessage(msg: ChatMessage): void
    getMessages(taskId: string): ChatMessage[]
    nextMessageId(taskId: string): string
    // ... more update methods for each Task field
}
```

## WebView Type Extensions (`/src/view/webview/taskv3/types.ts`)

The WebView layer extends Domain Model types with UI state:

```typescript
interface Message extends Omit<DomainMessage, 'type'>, MessageUIState {
    type: string;  // Override: compatible with WebView dynamic type assignment
}

interface AppState extends AppUIState {
    activeTaskPhase: string;
    activeTaskStatus: string;
    taskInfo: TaskInfo;
    messages: Message[];
    msgVersion: number;
    reviewState: ReviewState;
    pendingMessages: PendingMessage[];
    agentName: string;
    modelName: string;
}
```

## Historical Issues Resolved

The architecture review found 3 parallel, out-of-sync data models:

| Location | Usage | Problem |
|----------|-------|---------|
| `types/index.ts` | Task, ChatMessage | Base definitions, but incomplete |
| `taskv3/types.ts` | AppState, Message | Extra fields, missing fields |
| `TaskFlow.ts` | Map clusters | No structured state |

**Fix**: Iteration 1 unified Domain Model. Iteration 2 removed `JSON.parse(msg.content)` patterns, removed `cardMeta` refs, cleaned type enums.

## Change Guidance

1. **Never add UI state to Domain Model types** — use `types/ui.ts` for streaming, collapse, scroll
2. **Never persist agent runtime state** — use `types/agent.ts` for LangGraph fields
3. **New Task field**: Update `Task` interface + `TaskStore` methods + `ProjectFs` read/write
4. **WebView rendering**: `taskv3/types.ts` extends Domain Model with UI state — keep Omit+intersect pattern clean
