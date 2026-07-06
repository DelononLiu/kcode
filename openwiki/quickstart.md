# KCode — OpenWiki Quickstart

> VS Code extension for **AI-assisted task-flow-driven development**. Dual-mode architecture: structured task mode (5-phase pipeline) + chat mode (assistant).

## What Is KCode?

KCode is an AI-powered coding workbench that integrates directly into VS Code as a sidebar + editor panel extension. Unlike chat-only AI tools, KCode provides a structured **task pipeline** (Goal → Plan → Execute → Self-Verify → Review) that gives engineers control, traceability, and approval checkpoints.

The project is inspired by [Kilo Code](https://github.com/Kilo-Org/kilocode) and draws product inspiration from ZCode ADE.

**Key differentiator**: "Task-flow-driven AI coding" vs. "chat-driven coding" found in most competitors.

## Quick Start

```bash
# Install dependencies
npm install

# Compile TypeScript → out/
npm run compile

# Watch mode for development
npm run watch

# Package into .vsix for installation
npm run package

# Run tests
npx vitest run
```

## Two UI Modes

| Mode | Entry | Phase Management | Use Case |
|------|-------|-----------------|----------|
| **Task Mode** (三张卡片) | Sidebar task list → editor panel | 5-phase pipeline (goal→plan→execute→self_verify→review) | Feature dev, code review, defect analysis |
| **Chat Mode** (小助手) | Editor panel directly | None — free-form AI conversation | Quick questions, debugging, one-off commands |

Both modes share the same **kernel** (agent session, streaming, terminal execution, file diffs, logging).

## Project Layout

```
kcode/
├── package.json               # VS Code extension manifest
├── tsconfig.json              # TypeScript config (CommonJS → out/)
├── vitest.config.ts           # Test runner config
├── AGENTS.md                  # AI agent guide (existing, 13261 bytes)
├── PROJECT.md                 # Full project reference (45553 bytes)
├── TASKS.md                   # Developer task registry (73499 bytes)
├── CASES.md                   # Case studies (35462 bytes)
├── docs/                      # Detailed docs (Chinese)
│   ├── ACP协议接入.md          # ACP protocol guide
│   ├── task-flow-design.md    # 5-phase task flow design
│   ├── 架构重构方案.md          # Architecture refactoring plan
│   ├── plugin-dev-guide.md    # Plugin development guide
│   └── superpowers/           # Iteration plans (I1-I5)
├── scripts/
│   ├── build-webview.js
│   └── install-gitnexus.sh
└── src/
    ├── extension.ts           # VS Code entrypoint
    ├── types/                 # Domain model (index.ts, ui.ts, agent.ts, config.ts)
    ├── core/
    │   ├── AgentService.ts    # Agent connection management
    │   ├── ConfigService.ts   # Configuration loader (kcode.jsonc)
    │   └── plugin/            # Plugin system
    ├── taskflow/              # 5-phase state machine + modular prompts
    ├── acp/                   # ACP client (JSON-RPC 2.0 over stdio)
    ├── store/                 # Persistence (TaskStore, ProjectFs)
    ├── view/                  # VS Code UI layer
    │   ├── Panel.ts           # Main webview panel (central orchestrator)
    │   ├── SidebarProvider.ts # Sidebar task list
    │   ├── TaskFlowHandler.ts # Phase orchestration
    │   ├── stream/            # Stream processing handlers
    │   └── webview/           # WebView app, rendering, taskv3 pipeline
    ├── plugins/               # 9 built-in plugins
    │   ├── device/, demo/, setup/, todo/, knowledge/
    │   ├── review/, diff/, delegate/, _template/
    ├── device/                # SSH/ADB/Telnet/Local device management
    ├── commands/              # VS Code commands
    └── env/                   # Node.js environment management
```

## Key Concepts

### Domain Model Clean Separation

| Directory | Purpose | Source |
|-----------|---------|--------|
| `types/index.ts` | **Domain Model**: Task, Message, FileChange — persisted, single source of truth | `/src/types/index.ts` |
| `types/ui.ts` | **UI State**: streaming, collapsed, expandedRounds — never persisted | `/src/types/ui.ts` |
| `types/agent.ts` | **Agent Runtime**: GraphState, AgentConfig — agent-specific only | `/src/types/agent.ts` |
| `types/config.ts` | **Configuration**: KCodeConfig schema | `/src/types/config.ts` |

### 5-Phase Task Pipeline

```
goal → plan → execute → self_verify → review
```

Each phase has strict behavioral constraints (AI may only act within current phase). Phase transitions are controlled by `TaskFlow.ts` and triggered via `TASK_UPDATE` protocol markers.

### Agent Integration

| Backend | Protocol | Status |
|---------|----------|--------|
| **ACP** (Agent Client Protocol) | JSON-RPC 2.0 over stdio | Current primary |
| **LangGraph** (LocalAgentProvider) | `@langchain/langgraph` StateGraph + SQLite | I5 (code removed pending rework) |

### Plugin System

Plugins implement `KCodePlugin` with 6 extension points: message routing, phase hooks, tool call interceptors, stream processors, output panel tabs, phase hooks. Activate only in task mode.

## Build & Configuration

```bash
npm run compile    # Build to out/
npm run watch      # Auto-rebuild
npm run package    # .vsix packaging
```

**Config file**: `kcode.jsonc` in `.kcode/` (project level) or `~/.kcode/` (global). Key settings: `agentName`, `agentPath`, `provider`, `devices`, `plugins`.

## Testing

```bash
npx vitest run     # Run all src/**/*.test.ts files
```

Key test files: `/src/taskflow/__tests__/TaskFlow.test.ts` (7 state machine tests), `/src/core/plugin/__tests__/`, `/src/view/__tests__/`, `/src/view/webview/__tests__/`.

## Documentation Map

| Page | Description |
|------|-------------|
| [Architecture Overview](architecture/overview.md) | Full system architecture, data flow, component interaction |
| [Plugin System](architecture/plugin-system.md) | Plugin interface, extension points, lifecycle |
| [Task Flow Workflow](workflows/task-flow.md) | 5-phase state machine, prompt system, phase transitions |
| [Streaming & Rendering](workflows/streaming-rendering.md) | Streaming pipeline, WebView rendering, renderer registry |
| [Domain Data Models](domain/data-models.md) | Type system, Task/Message entities, storage layer |
| [Agent Protocol & Integration](integrations/agent-protocol.md) | ACP protocol, supported agents, LangGraph migration |
| [Setup & Operations](operations/setup-build.md) | Build, configuration, CI, packaging |

### Existing Docs (Chinese)

For deep dives, the `/docs/` directory contains detailed Chinese documentation covering ACP protocol, architecture refactoring, plugin development, and product specifications.
