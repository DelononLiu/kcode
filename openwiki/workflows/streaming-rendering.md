# Streaming & Rendering Pipeline

KCode streams AI responses from child processes to the WebView in real-time, processing chunks through multiple layers before rendering as structured UI components.

## End-to-End Flow

```
Agent Process (ACP child process over stdio)
    │  NDJSON stream events
    ▼
StreamHandlerBase.ts             ← parsed by callback:
    │  onText, onThinking,        onToolCall, onToolResult, onDone
    ▼
TaskViewBridgeV2.ts              ← translated to postMessage format:
    │  stream-chunk, stream-done, state-delta
    ▼
WebView (app.ts)
    ▼
renderManager.ts (task)          ← state machine + rendering dispatch
  or assistantPipeline.ts (chat)
    ▼
msgRenderer.ts                   ← dispatches by message role+type
    │
    ▼
Renderer Registry                ← 7 individual renderer modules
 ├── text.ts             — Markdown text rendering
 ├── thinking.ts         — AI reasoning blocks (collapsible)
 ├── tool_call.ts        — Tool call cards (bash, read, write, etc.)
 ├── phase_action.ts     — Phase transition cards
 ├── round_summary.ts    — Conversation round summary (collapsible)
 ├── user.ts             — User message rendering
 └── registry.ts         — Renderer registration & dispatch
```

## Stream Processing (`/src/view/stream/`)

### StreamHandlerBase (`/src/view/stream/StreamHandlerBase.ts`)

Shared stream parser for both task and assistant modes. Processes ACP event callbacks:

| Callback | Trigger | Description |
|----------|---------|-------------|
| `onText(chunk)` | Text delta | Appends to buffer |
| `onThinking(chunk)` | Thinking block | Captures `think`/`think` content |
| `onToolCall(toolCallId, title, kind)` | Tool invocation | Creates tracked tool call state |
| `onToolOutput(toolCallId, output)` | Tool result | Attaches output to tool call |
| `onDone(stopReason)` | Stream end | Finalizes message, persists to store |

### AssistantStreamHandler (`/src/view/stream/AssistantStreamHandler.ts`)

Subclass for chat mode. On `onDone`:
1. Persists completed tool calls as `tool_call` messages via `store.addAssistantMessage()`
2. Persists final text buffer as `agent` message
3. Calls `loadMessagesFn()` to refresh WebView

## WebView Side Stream Handler (`/src/view/webview/streamHandler.ts`)

Shared WebView functions for both task and assistant pipelines:

```typescript
handleStreamChunk(text, sm)     // Append text to streaming agent message
handleStreamDone(sm)            // Remove streaming flag
handleThinkingChunk(msg, sm)    // Create/update thinking block
handleToolChunk(msg, sm)        // Create/update tool call message with structured toolCall field
```

The `StreamStateAccess` interface abstracts state manager access.

## Rendering Pipeline: taskv3 (`/src/view/webview/taskv3/`)

| File | Role |
|------|------|
| `state.ts` | `StateManager` — holds `AppState`, supports `subscribe()` and `patch()` |
| `renderManager.ts` | Main render orchestrator — handles state-delta, stream-chunk, stream-done |
| `msgRenderer.ts` | Message dispatch — routes by role+type to appropriate renderer |
| `basePipeline.ts` | `BasePipeline` — shared logic for task and chat modes (message ordering, dedup) |
| `cardRenderer.ts` | Card-style renderer for Goal/Plan/Review cards |
| `types.ts` | WebView-specific type extensions (Message extends DomainMessage + UIState) |
| `taskStrategy.ts` | Task mode strategy (phase-aware) |
| `viewStrategy.ts` | View strategy interface |
| `rendererShared.ts` | Shared collapse/expand utilities |

## Renderer Registry (`/src/view/webview/renderers/`)

After Iteration 3, renderers are fully componentized:

| Renderer | File | Handles |
|----------|------|---------|
| text | `text.ts` | `role=agent, type=text` — full markdown |
| thinking | `thinking.ts` | `role=agent, type=thinking` — collapsible reasoning block |
| tool_call | `tool_call.ts` | `role=tool, type=tool_call` — tool call cards with status |
| phase_action | `phase_action.ts` | `role=agent, type=phase_action` — phase transition cards |
| round_summary | `round_summary.ts` | `role=agent, type=round_summary` — collapsible round wrapper |
| user | `user.ts` | `role=user` — user messages |
| registry | `registry.ts` | Maps `(role, type) → renderer function`, supports plugin wrapping |

## Collapse System (Iteration 4)

- **State**: `AppUIState.expandedRounds: Record<string, boolean>`
- **UI**: `RoundSummary` renderer click-toggle
- **Auto-collapse**: Latest round collapses on `stream-done`
- **Shared**: Works for both task and assistant modes via `rendererShared.ts`

## Card Pipeline (Legacy)

`/src/view/webview/cardApp.ts` + `cardBuilder.ts` implement an older rendering system for the "three-card" UI (Goal/Plan/Review). Partially deprecated by the taskv3 pipeline, but still contains card-specific rendering logic for version iteration.

## Stream Parser (`/src/view/webview/streamParser.ts`)

Parses incoming stream text for server-sent events. Handles protocol markers and text chunking on the WebView side.

## Change Guidance

1. **New renderer**: Add to `/src/view/webview/renderers/`, register in `registry.ts` and `msgRenderer.ts`
2. **Stream format**: The WebView receives `stream-chunk`, `stream-done`, `state-delta` — change format in `TaskViewBridgeV2.ts`
3. **New stream event type**: Add handling in both `StreamHandlerBase` (extension) and WebView stream handler
4. **I3 refactoring is done**: Don't add direct render logic in `msgRenderer.ts` — create new renderer files
5. **Tests**: `/src/view/webview/__tests__/`
