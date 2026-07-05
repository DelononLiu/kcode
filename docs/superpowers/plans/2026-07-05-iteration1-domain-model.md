# Iteration 1: Domain Model 落地 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将评审修正后的 Domain Model 落实到 `src/types/`，作为任务和小助手的唯一类型源。新旧类型通过别名暂时并存，现有代码不受影响。

**Architecture:** 在 `types/index.ts` 中重写 `Task`/`Message`/`ToolCallInfo`/`ToolResultInfo`/`PhaseActionInfo` 等核心类型，新增 `types/ui.ts` 和 `types/agent.ts` 分拆关注点。旧类型（`ChatMessage`、`AssistantMessage`）保留为别名指向新类型。`taskv3/types.ts` 改为引用 `types/index.ts` + `types/ui.ts`，只保留 WebView 特有的类型。

**Tech Stack:** TypeScript, 无新增依赖

## Global Constraints

- 新旧类型通过别名桥接，不能破坏现有编译
- 新增类型要精确匹配评审修正后的方案（见 `docs/架构重构方案.md` Domain Model 章节）
- 不改动任何业务逻辑代码（Iteration 1 只改类型定义）
- 不改动 `src/store/`、`src/taskflow/` 等目录的实现代码（只改类型引用）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/index.ts` | 重写 | 核心 Domain Model: Task, Message, ToolCallInfo, ToolResultInfo, PhaseActionInfo 等 + 旧类型别名 |
| `src/types/ui.ts` | 新增 | UI 状态类型: MessageUIState, AppUIState |
| `src/types/agent.ts` | 新增 | Agent 层类型: GraphState, AgentConfig |
| `src/view/webview/taskv3/types.ts` | 重写 | 改为引用 types/index.ts + types/ui.ts，扩展 WebView 特有类型 |

---

### Task 1: 重写 `types/index.ts` — 新 Domain Model + 旧类型别名

**Files:**
- Rewrite: `src/types/index.ts`

**Interfaces:**
- Produces: `Task`, `Message`, `ToolCallInfo`, `ToolResultInfo`, `PhaseActionInfo`, `Phase`, `TaskStatus`, `PlanStep`, `ChatMessage` (alias), `AssistantMessage` (alias), 及其他保留的辅助类型

- [ ] **Step 1: 在 `types/index.ts` 的头部，保留所有不动的辅助类型**

保留以下类型原样不动：
- `ContainerType`, `ContainerEntity`
- `TaskCategory`, `InputField`, `IterationRecord`, `TargetDef`, `CategoryDef`
- `TodoItem`
- `TaskSource`
- `ACPConfig`
- `FileChange`
- `ToolItem`, `ToolGroup`
- `KnowledgeEntry`, `TimelineEntry`
- `FileChangeSummary`, `TerminalLogEntry`, `MessageLogEntry`, `FileLogEntry`
- `ProgressNode`
- `AcpLogEntry`
- `DeviceType`, `DeviceConfig`, `DeviceConnection`, `IDeviceClient`
- `AcpMessageHandler`

- [ ] **Step 2: 定义新 Phase 和 TaskStatus 类型**

```typescript
export type Phase = 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
export type TaskStatus = 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
```

- [ ] **Step 3: 重写 Task 类型**

```typescript
export interface Task {
    id: string;
    title: string;
    type: 'task' | 'chat';

    originalRequest?: string;
    goal: string;

    phase: Phase;
    status: TaskStatus;

    confirmedItems: string[];
    pendingItems: string[];
    planSteps: PlanStep[];
    riskItems?: string[];
    boundaryItems?: string[];

    category?: TaskCategory;
    subType?: string;
    createdAt: number;
    workspace?: string;
    pinned?: boolean;
    group?: string;
    archived?: boolean;
    containerId?: string;
    hooks?: Partial<Record<Phase, string[]>>;

    source?: TaskSource;
    sessionId?: string;  // ACP session (Agent 层字段, 过渡期保留)
    nodeMessageIds?: Partial<Record<Phase, string>>;  // 过渡期保留
    flowIteration?: {    // 过渡期保留, Iteration 2 清理
        enabled: boolean;
        loopPhases: [string, string];
        config: {
            correctnessTests: string[];
            targets: Record<string, number>;
            iterationLimit: number;
        };
        state: {
            currentIteration: number;
            stagnatedCount: number;
            baselines: Record<string, number>;
            history: IterationRecord[];
        };
    };
}
```

- [ ] **Step 4: 定义 Message 及相关类型**

```typescript
export interface Message {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'phase_action';
    content: string;
    toolCall?: ToolCallInfo;
    toolResult?: ToolResultInfo;
    phaseAction?: PhaseActionInfo;
    timestamp: number;
}

export interface ToolCallInfo {
    toolCallId: string;
    title: string;
    kind: string;
    status: 'running' | 'completed' | 'failed';
}

export interface ToolResultInfo {
    toolCallId: string;
    output: string;
}

export interface PhaseActionInfo {
    phase: Phase;
    status: 'pending' | 'confirmed' | 'rejected';
}
```

- [ ] **Step 5: 添加旧类型别名（过渡用）**

```typescript
/** @deprecated 使用 Message 替代。ChatMessage 保留为别名以保证编译通过 */
export interface ChatMessage extends Message {
    // 兼容旧代码中直接访问 ChatMessage.type 等字段
}

/** @deprecated 使用 Message 替代。AssistantMessage 保留为别名以保证编译通过 */
export interface AssistantMessage extends Message {
    // 兼容旧代码中直接访问 AssistantMessage 字段
}
```

- [ ] **Step 6: 编译验证**

Run: `npx tsc --noEmit`
Expected: 编译通过，无类型错误

- [ ] **Step 7: 提交**

```bash
git add src/types/index.ts
git commit -m "refactor(types): 重写 Domain Model，Message/Task/Phase 等核心类型

- 新增 Phase/Status/Message/ToolCallInfo/ToolResultInfo/PhaseActionInfo
- Task 增加 type:'task'|'chat'/archived/containerId/hooks
- ChatMessage/AssistantMessage 保留为别名保证兼容
- 遵循架构方案评审结果"
```

---

### Task 2: 新增 `types/ui.ts` — UI 状态类型

**Files:**
- Create: `src/types/ui.ts`

**Interfaces:**
- Produces: `MessageUIState`, `AppUIState`

- [ ] **Step 1: 创建 `src/types/ui.ts`**

```typescript
/**
 * UI 状态类型（渲染层专属，不序列化，不混入 Domain Model）
 *
 * 遵循原则 2：UI 状态不混入 Domain Model
 */

// ── 消息级 UI 状态 ──
export interface MessageUIState {
    streaming: boolean;
    collapsed: boolean;
    roundGroup: string | null;
}

// ── 应用级 UI 状态 ──
export interface AppUIState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    expandedRounds: Record<string, boolean>;
    isGenerating: boolean;
    scrollLocked: boolean;
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 3: 提交**

```bash
git add src/types/ui.ts
git commit -m "refactor(types): 新增 UI 状态类型 types/ui.ts

- MessageUIState: streaming/collapsed/roundGroup
- AppUIState: viewMode/activeTaskId/expandedRounds 等
- 遵循原则 2：UI 状态不混入 Domain Model"
```

---

### Task 3: 新增 `types/agent.ts` — Agent 层类型

**Files:**
- Create: `src/types/agent.ts`

**Interfaces:**
- Produces: `GraphState`, `AgentConfig`, `AgentType`

- [ ] **Step 1: 创建 `src/types/agent.ts`**

```typescript
/**
 * Agent 层类型（Agent 运行时专属，不持久化到 Task/Message）
 *
 * 遵循原则 3：Agent 状态不混入 Domain Model
 */
import type { Phase, TaskStatus, PlanStep } from './index';

export type AgentType = 'acp' | 'langgraph';

export type GraphMessageRole = 'user' | 'assistant' | 'tool';

export interface GraphMessage {
    id: string;
    role: GraphMessageRole;
    content: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
    }>;
}

/** LangGraph StateGraph 状态 */
export interface GraphState {
    messages: GraphMessage[];
    phase: Phase;
    status: TaskStatus;
    goal: string;
    confirmedItems: string[];
    planSteps: PlanStep[];
    taskId: string;
}

/** Agent 配置 */
export interface AgentConfig {
    type: AgentType;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    graphThreadId?: string;  // LangGraph checkpoint 线程 ID
    sessionId?: string;      // ACP session ID
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 3: 提交**

```bash
git add src/types/agent.ts
git commit -m "refactor(types): 新增 Agent 层类型 types/agent.ts

- GraphState: LangGraph StateGraph 运行时状态
- AgentConfig: 统一 ACP/LangGraph 配置类型
- 遵循原则 3：Agent 状态不混入 Domain Model"
```

---

### Task 4: 重写 `taskv3/types.ts` — 引用新类型，只保留 WebView 扩展

**Files:**
- Rewrite: `src/view/webview/taskv3/types.ts`

**Interfaces:**
- Consumes: `Message` from `../../../types` (new Domain Model)
- Consumes: `MessageUIState`, `AppUIState` from `../../../types/ui`
- Produces: `AppState`, `TaskInfo`, `ReviewState`, `StreamResult`, `UserAction`, `PendingMessage`, `ToolCallState`

- [ ] **Step 1: 重写 `taskv3/types.ts`，删除旧的独立定义，改为 import + 扩展**

```typescript
/**
 * WebView 渲染层类型
 *
 * 此文件原为独立类型定义（与 types/index.ts 不同步），
 * 现在改为引用 Domain Model 类型 + 扩展 WebView 特有字段。
 *
 * 遵循原则 1：Domain Model 是唯一的 Task/Message 定义
 * 遵循原则 2：UI 状态不混入 Domain Model
 */

import type { Message as DomainMessage } from '../../../types';
import type { MessageUIState, AppUIState } from '../../../types/ui';

// ── 扩展：渲染层消息 = Domain Message + UI 状态 ──
export interface Message extends DomainMessage, MessageUIState {
    type: string;  // 覆盖为宽松类型，兼容 WebView 动态 type 赋值
}

// ── 扩展：渲染层 AppState ──
export interface AppState extends AppUIState {
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

// ── 以下为 WebView 特有类型（不涉及 Domain Model）──

export interface TaskInfo {
    title: string;
    goal: string;
    category: string;
    categoryLabel: string;
    phase: string;
    phaseLabel: string;
    status: string;
    taskType: string;
    createdAt: number;
    executeFinished: boolean;
}

export interface ToolCallState {
    toolCallId: string;
    title: string;
    kind: string;
    status: 'running' | 'completed' | 'failed';
    output?: string;
    content?: string;
    taskId?: string;
}

export interface ReviewState {
    changes: FileChange[];
    acceptanceCriteria: string[];
}

interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

export interface PendingMessage {
    text: string;
    taskId: string;
}

export interface StreamResult {
    cleanedText: string;
    planProposed: boolean;
    executeFinished: boolean;
    selfVerifyFinished: boolean;
    toolCalls: ToolCallState[];
}

export interface UserAction {
    type: 'confirmGoal' | 'confirmGoalWithEdit' | 'reviseGoal' | 'cancelTask'
        | 'confirmPlan' | 'confirmPlanWithEdit' | 'rejectPlan'
        | 'confirmExecuteDone'
        | 'confirmSelfVerifyDone'
        | 'approveReview' | 'rejectReview' | 'partialApproveReview'
        | 'stopGeneration' | 'convertToTask';
    taskId: string;
    payload?: unknown;
}

export type StateSubscriber = (state: AppState) => void;
export type StateDelta = Partial<AppState>;
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 编译通过

- [ ] **Step 3: 提交**

```bash
git add src/view/webview/taskv3/types.ts
git commit -m "refactor(types): taskv3/types.ts 改为引用 Domain Model

- Message 改为继承 Domain Message + MessageUIState
- AppState 改为继承 AppUIState + WebView 特有字段
- 删除独立定义的不同步类型"
```

---

### Task 5: 全量编译验证 + 修复

**Files:**
- Verify: 所有 `src/**/*.ts`

- [ ] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: 编译通过。如果失败，按以下方式修复：

| 问题 | 原因 | 修复 |
|------|------|------|
| `msg.cardMeta` 访问报错 | cardMeta 已从新 Message 移除 | 在 `taskv3/types.ts` 的 Message 扩展中临时加回 `cardMeta?: any`（Iteration 2 再清理） |
| `msg.type` 赋值报错 | WebView 中使用 `msg.type = 'xxx'` 但新类型是 readonly-like | 已经通过 Step 1 的 `type: string` 覆盖解决 |

- [ ] **Step 2: 记录 JSON.parse 清理点**

Run: `grep -rn "JSON\.parse.*content\|JSON\.parse(msg\.content)" src/ --include="*.ts" | grep -v node_modules`
Expected: 输出约 10 处，保存到 `docs/superpowers/notes/json-parse-sites.txt` 供 Iteration 2 使用

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "refactor(types): Iteration 1 完成 — Domain Model 落地

- 新增 Phase/Status/Message/ToolCallInfo/ToolResultInfo/PhaseActionInfo
- 新增 types/ui.ts types/agent.ts 分拆关注点
- taskv3/types.ts 改为引用 Domain Model
- 旧类型通过别名保持兼容
- 全量编译通过"
```
