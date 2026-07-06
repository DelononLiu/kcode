# Task Flow: 5-Phase Pipeline

The task flow is KCode's core workflow — a structured 5-phase pipeline for AI-assisted feature development with human approval checkpoints at each transition.

## Phase Definitions

```
goal → plan → execute → self_verify → review
```

| Phase | AI Behavior | Human Action |
|-------|-------------|--------------|
| **goal** | Summarize/confirm request, identify scope/risks | Confirm or revise |
| **plan** | Define implementation steps only | Confirm/edit plan |
| **execute** | Write files, run commands, build/test | None — AI owns execution |
| **self_verify** | Show changes, verify correctness with tests | Confirm or reject |
| **review** | Present diffs + verification results | Approve/reject changes |

## State Machine: TaskFlow (`/src/taskflow/TaskFlow.ts`)

`TaskFlow` is the core state machine (36753 bytes). It uses `Map<string, boolean>` clusters per phase type:

```typescript
private planProposed: Map<string, boolean> = new Map();
private goalProposed: Map<string, boolean> = new Map();
private executeFinished: Map<string, boolean> = new Map();
private selfVerifyFinished: Map<string, boolean> = new Map();
```

### Key Methods

| Method | Effect |
|--------|--------|
| `buildGoalPrompt(taskId, originalRequest)` | Builds initial goal prompt with project context |
| `confirmGoal(taskId)` | Transitions to `plan` phase |
| `buildPhaseTransitionPrompt(taskId, userText)` | Builds prompt for next phase |
| `confirmPlan(taskId)` | Transitions to `execute` phase |
| `confirmExecuteDone(taskId)` | Transitions to `self_verify` phase |
| `confirmSelfVerifyDone(taskId)` | Transitions to `review` phase |
| `getGenResult(taskId)` | Returns `{planProposed, executeFinished, selfVerifyFinished}` |

*Source: `/src/taskflow/TaskFlow.ts`*

## TASK_UPDATE Protocol

The AI communicates structured phase data via `TASK_UPDATE` markers embedded in response text. `TaskFlow.ts` parses these with regex:

```text
[TASK_UPDATE]
{
  "phase": "goal",
  "action": "propose_goal | lock_goal | propose_plan | lock_plan | finish_execute | accept | reject",
  "confirmed_items": ["consensus 1", "consensus 2"],
  "pending_items": ["to discuss"],
  "plan_steps": [{"content": "step 1", "priority": "P0"}]
}
[/TASK_UPDATE]
```

Additional protocols handled:
- `[TASK_DELEGATE]` — task delegation (parse by `DelegationPlugin`)
- `<TODO_UPDATE>` — structured TODO list updates
- `<KNOWLEDGE_ENTRY>` / `<KNOWLEDGE_TABLE>` — knowledge management

**Note**: These custom protocol markers are being deprecated in LangGraph mode (Iteration 5), where state transitions will be handled by `StateGraph` edges instead of regex-parsed embedded JSON.

## Prompt System (`/src/taskflow/prompts/`)

| File | Purpose |
|------|---------|
| `base.ts` | System prompt — agent identity and capabilities |
| `protocol.ts` | Protocol format definitions (`TASK_UPDATE`, `TASK_DELEGATE`, knowledge) |
| `demand.ts` | Requirements gathering |
| `goal.ts` | Goal formulation |
| `plan.ts` | Plan generation |
| `execute.ts` | Execution instructions |
| `self_verify.ts` | Self-verification check |
| `review.ts` | Change review |
| `types.ts` | TypeScript types for prompt injection |

Additional prompt sources:
- **External prompts**: `/src/taskflow/externalPrompts.ts` — loads `.kcode/prompts/` custom overrides
- **Templates**: `/src/taskflow/templates.ts` — category definitions
- **Workspace hooks**: `/src/taskflow/workspaceHooks.ts` — project-specific hook commands

## Phase Orchestration (`/src/view/TaskFlowHandler.ts`)

`TaskFlowHandler` bridges the state machine with the UI. Key handlers:

```typescript
handleConfirmGoal(tid, originalRequest)     // ✅ → goal locked, AI plans
handleReviseGoal(tid)                       // Reset goal for revision
handleConfirmPlan(tid)                      // Plan approved → execute
handleConfirmPlanWithEdit(tid, goal, steps) // Plan edited then approved
handleConfirmExecuteDone(tid)               // Execution confirmed → self-verify
handleConfirmSelfVerifyDone(tid)            // Self-verify done → review
handleApproveReview(tid, comment)           // Review approved → completed
handleRejectReview(tid, reason)             // Review rejected → loop back
```

Each handler: (1) logs user action as `ChatMessage`, (2) calls `TaskFlow`, (3) sends updated state to WebView, (4) triggers next AI prompt.

## Task Categories

| Category Key | Label | Use Case |
|-------------|-------|----------|
| `requirement_dev` | 需求开发 | Feature development |
| `code_review` | 代码评审 | Code/PR review |
| `problem_analysis` | 问题分析 | Bug investigation |
| `defect_analysis` | 逻辑缺陷分析 | Logic defect analysis |
| `log_analysis` | 日志分析 | Log/error analysis |

Each provides input fields, analysis framework prompts, and acceptance criteria.

*Source: `/src/taskflow/templates.ts`*

## Change Guidance

1. **Phase transitions**: Update both `TaskFlow.ts` and `TaskFlowHandler.ts`
2. **Prompts**: Add to `/src/taskflow/prompts/` — never hard-code prompt text in handlers
3. **TASK_UPDATE parsing**: The regex parser is fragile — new phase types need parsing updates
4. **LangGraph migration (I5)**: `TaskFlow` interface must be preserved as the contract; internals replaced with `StateGraph` nodes
5. **Tests**: `/src/taskflow/__tests__/TaskFlow.test.ts` — 7 test cases covering state machine transitions
