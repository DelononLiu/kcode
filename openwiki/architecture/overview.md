# Architecture Overview

## System Architecture

KCode is a VS Code extension using a **hybrid view architecture**: a sidebar `WebviewView` (task list) + an editor `WebviewPanel` (main chat + output panels). The extension host runs TypeScript compiled to CommonJS; the WebView runs JavaScript in a sandboxed browser context.

```
┌──────────────────────────────────────────────────────────────────┐
│                        VS Code Host                              │
│                                                                  │
│  ┌──────────────────────┐       ┌──────────────────────────┐    │
│  │  extension.ts        │       │  ConfigService            │    │
│  │  (activate/deactivate│       │  (kcode.jsonc loader)     │    │
│  │   + command registry)│       └──────────────────────────┘    │
│  └──────────┬───────────┘                                        │
│             │                                                    │
│  ┌──────────▼─────────────────────────────────────────────┐     │
│  │                    Panel.ts                              │     │
│  │  WebviewPanel lifecycle + dependency injection           │     │
│  │  Holds: TaskStore, TaskFlow, AgentService,               │     │
│  │         SessionHandler, FlowHandler, AssistantHandler,   │     │
│  │         PluginManager, TaskViewBridgeV2, CommandRegistry │     │
│  └──────┬──────────────┬──────────────┬────────────────────┘     │
│         │              │              │                          │
│  ┌──────▼────┐  ┌──────▼──────┐  ┌───▼───────────┐              │
│  │ TaskFlow  │  │ AgentService│  │ PluginManager  │              │
│  │ (state    │  │ (ACP + LG)  │  │ (6 extension   │              │
│  │  machine) │  │             │  │  point types)  │              │
│  └───────────┘  └──────┬──────┘  └───────────────┘              │
│                        │                                         │
│  ┌─────────────────────▼──────────────────────────────┐         │
│  │              TaskViewBridgeV2                       │         │
│  │  (state-delta, stream-chunk, stream-done,          │         │
│  │   messages-sync → WebView postMessage)             │         │
│  └────────────────────────┬───────────────────────────┘         │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────┐         │
│  │              WebView (sandboxed)                     │         │
│  │  ┌──────────────────────────────────────────────┐  │         │
│  │  │  app.ts (main dispatch)                       │  │         │
│  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐   │  │         │
│  │  │  │ sidebar │ │  chat    │ │ outputPanel  │   │  │         │
│  │  │  │ (task   │ │ (taskv3  │ │ (preview,    │   │  │         │
│  │  │  │  list)  │ │  /assist)│ │  device, ...)│   │  │         │
│  │  │  └─────────┘ └──────────┘ └──────────────┘   │  │         │
│  │  └──────────────────────────────────────────────┘  │         │
│  └────────────────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

*Sources: `/src/extension.ts`, `/src/view/Panel.ts` (43078 bytes), `/src/view/TaskViewBridgeV2.ts`*

## Extension Lifecycle

### Activation (`/src/extension.ts`)

1. Initialize `ProjectFs` (file-based JSON persistence) and `TaskStore`
2. Load `ConfigService` (global + project `kcode.jsonc`)
3. Register `SidebarProvider` as `WebviewViewProvider`
4. Create main `Panel` (WebviewPanel) — auto-opens on activation
5. Register VS Code commands: `kcode.open`, `kcode.newTask`, `kcode.importGitHubIssue`

### Panel Construction (`/src/view/Panel.ts`)

The `Panel` class is the **central orchestrator** (43078 bytes — the largest file). It wires together:

| Component | File | Role |
|-----------|------|------|
| `MessageRouter` | `/src/view/MessageRouter.ts` | Bi-directional host ↔ WebView messaging |
| `TaskFlow` | `/src/taskflow/TaskFlow.ts` | 5-phase state machine |
| `AgentService` | `/src/core/AgentService.ts` | Agent connection management |
| `TaskFlowHandler` | `/src/view/TaskFlowHandler.ts` | Phase orchestration (confirm/reject/approve) |
| `TaskSessionHandler` | `/src/view/TaskSessionHandler.ts` | ACP session lifecycle |
| `AssistantHandler` | `/src/view/AssistantHandler.ts` | Chat mode session management |
| `PluginManager` | `/src/core/plugin/PluginManager.ts` | Plugin lifecycle + dispatch |
| `CommandRegistry` | `/src/commands/CommandRegistry.ts` | Slash commands (`/confirm`, `/debug`, etc.) |
| `AcpLogManager` | `/src/view/AcpLogManager.ts` | ACP communication logging |
| `TaskViewBridgeV2` | `/src/view/TaskViewBridgeV2.ts` | State sync → WebView |

### Panel Dependency Injection

The `KCodePanelContext` interface (`/src/view/PanelContext.ts`) defines all dependencies provided to sub-handlers, enabling loose coupling and testability.

## Dual-Mode Architecture

KCode has "一套内核、两套 UI 范式" (one kernel, two UI paradigms):

### Task Mode (Task.type === 'task')
- Activated by selecting a task from the sidebar
- Shows 5-phase node panel (goal/plan/execute/self_verify/review)
- Uses `taskv3/` rendering pipeline in WebView
- Plugins active
- Uses `TaskFlowHandler` for phase orchestration

### Chat/Assistant Mode
- Activated via `/ai` command or opening the panel directly
- No phase management, no node panel
- Uses `assistantView.ts` + `assistantPipeline.ts` rendering
- Plugins silent
- Can convert chat to task via `/totask` command

Both modes share: AgentService, ACP session, stream handling, file diffs, device connections.

*Sources: `/src/view/AssistantHandler.ts`, `/src/view/webview/taskv3/taskStrategy.ts`, `/src/view/webview/taskv3/viewStrategy.ts`*

## Data Flow for AI Request

1. User types message in WebView → `app.ts` sends `userMessage` via `postMessage`
2. `Panel.ts` dispatches via `taskFlowHandler` or `sessionHandler` depending on mode
3. `TaskFlow.ts` builds phase-specific prompt (base + protocol + phase prompt)
4. `AgentService` sends prompt to agent (ACP child process)
5. Agent streams response → `StreamHandlerBase` processes chunks
6. Each chunk sent to WebView via `TaskViewBridgeV2.sendStreamChunk()`
7. WebView `taskv3/renderManager.ts` processes streaming → renders via `msgRenderer.ts` + renderer registry
8. On stream end → `stream-done` → `TaskFlow` parses structured data (`TASK_UPDATE`)

## Key Architectural Decisions

### Hand-written State Machine → LangGraph Migration
The original `TaskFlow.ts` uses `Map<string, boolean>` clusters for phase tracking. Iteration 5 plans to replace this with `@langchain/langgraph` StateGraph providing SQLite checkpointing, interrupt/human-in-loop, and conditional branching. The LangGraph provider code was initially added (commit `65b5ec1`) but later removed (commit `a7585f6`).

### Three-Layer Type Separation
Iterations 1-2 established clean separation: Domain Model (persisted), UI State (ephemeral), Agent Runtime (not stored with Task). This eliminated the prior problem of 3 out-of-sync data models.

### Two Rendering Pipelines → Unified Renderer Registry
Iteration 3 split `msgRenderer.ts` into an independent renderer registry with 7 renderers (text, thinking, tool_call, phase_action, round_summary, user). The `streamHandler.ts` was extracted as a shared utility used by both task and assistant pipelines.

*Sources: `/docs/superpowers/specs/2026-07-05-architecture-review.md`, `/docs/架构重构方案.md`, git log*
