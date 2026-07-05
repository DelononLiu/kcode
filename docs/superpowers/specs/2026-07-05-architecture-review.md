# 架构重构方案评审报告

> 日期：2026-07-05
> 基于：Superpowers brainstorming 流程
> 评审对象：`docs/架构重构方案.md`

---

## 新增设计原则

在原有 4 条核心原则基础上，增加第 5 条：

**5. LangGraph 模式从零构建，不继承 ACP 的任何协议包袱**

- 没有 `[TASK_UPDATE]` / `[TASK_DELEGATE]` 正则解析
- 没有 `<TODO_UPDATE>` / `<KNOWLEDGE_ENTRY>` JSON 内嵌
- 没有 `Map<string, boolean>` 手写状态集群
- 没有 `V2StreamHandler` 的文本拼接 hack
- ACP 和 LangGraph 共享 Domain Model，但共享到类型定义为止，执行路径完全独立

---

## 发现 1（严重）：Message.role 缺少 'tool'

### 问题

新 `Message` 模型定义 `role: 'user' | 'agent'`，但：

- 当前代码中 96 处引用 `role: 'tool'`
- LangGraph.js 原生产生 `ToolMessage`，需要映射为 `role: 'tool'`
- ACP 模式的 tool 相关消息（tool_call 结果等）无处安放

### 修正

```typescript
interface Message {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';     // ← 加回 tool
    type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'phase_action';
    //                    ↑ 新增 tool_result
    content: string;
    toolCall?: ToolCallInfo;             // type='tool_call' 时有效
    toolResult?: ToolResultInfo;         // type='tool_result' 时有效
    phaseAction?: PhaseActionInfo;       // type='phase_action' 时有效
    timestamp: number;
}

interface ToolCallInfo {
    toolCallId: string;
    title: string;
    kind: string;          // 'bash' | 'read' | 'write' | 'edit' | ...
    status: 'running' | 'completed' | 'failed';
    // output 移出，放到 ToolResultInfo
}

interface ToolResultInfo {
    toolCallId: string;    // 关联到对应的 ToolCallInfo
    output: string;
}

interface PhaseActionInfo {
    phase: Phase;
    status: 'pending' | 'confirmed' | 'rejected';
}
```

### 改动范围

- `src/types/index.ts` — Message 类型定义
- `src/view/webview/taskv3/msgRenderer.ts` — tool_call 渲染不再 JSON.parse
- 新增 tool_result 渲染器

---

## 发现 2（严重）：自定义协议块没有迁移策略

### 问题

Iteration 5 只讨论了 `[TASK_UPDATE]` 被 LangGraph 节点取代，但共有 5 种协议在 TaskFlow.ts 中解析：

| 协议 | 格式 | ACP 模式 | LangGraph 模式 |
|------|------|---------|---------------|
| `[TASK_UPDATE]` | 自定义 block | 正则解析 → 阶段迁移 | **StateGraph 条件边** |
| `[TASK_DELEGATE]` | 自定义 block | 正则解析 → 任务委派 | **tool call**: `delegateTask()` |
| `<TODO_UPDATE>` | JSON 协议 | 正则解析 → TodoPlugin | **tool call**: `updateTodos()` |
| `<KNOWLEDGE_ENTRY>` | JSON 协议 | 正则解析 → KnowledgePlugin | **tool call**: `saveKnowledge()` |
| `<KNOWLEDGE_TABLE>` | 表格解析 | 正则解析 → KnowledgePlugin | **tool call** 或废弃 |

### 修正

在 Iteration 5 中明确声明：**LangGraph 模式下所有 `[TASK_*]`/`<*_UPDATE>`/`<KNOWLEDGE_*>` 协议块全部废弃**，转用 tool call + StateGraph 状态更新。ACP 模式继续保留现有正则解析逻辑，不做迁移。

---

## 发现 3（中等）：Task 模型字段遗漏

### 问题

新 `Task` 模型删除了多个必要字段，且未说明理由。

### 修正

```typescript
interface Task {
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

    // ── 保留字段 ──
    category?: TaskCategory;
    subType?: string;
    createdAt: number;
    workspace?: string;
    pinned?: boolean;
    group?: string;
    archived?: boolean;              // ← 保留：侧边栏归档功能
    containerId?: string;            // ← 保留：项目/分组树形组织

    // ── 跨模式共享 ──
    hooks?: Partial<Record<Phase, string[]>>;  // ← 保留：阶段钩子

    // ── 移除字段 ──
    // sessionId → 移到 Agent 层（符合原则 3）
    // nodeMessageIds → 可从消息时间线推导
    // flowIteration → 已确认移除
    // planVersion → 已确认移除

    source?: TaskSource;
}
```

---

## 发现 4（中等）：Phase 包含 'demand' 与现状冲突

### 问题

- 提交 `8518314` 已移除 demand 阶段（5 阶段定稿）
- 当前 `Task.phase` 类型为 `'goal' | 'plan' | 'execute' | 'self_verify' | 'review'`
- 经确认：demand = 用户原始输入，不需要作为独立阶段

### 修正

```typescript
type Phase = 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
type TaskStatus = 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
```

LangGraph 条件边相应调整：

```typescript
.addConditionalEdges('__start__', (s) => s.phase || 'goal')
```

---

## 发现 5（较轻）：JSON.parse 清理范围过宽

### 问题

方案中说"消除所有 `JSON.parse(msg.content)`"，但全局 40+ 处 JSON.parse 中约 30 处是文件级解析（配置、存储、日志等），与消息内容无关。

### 修正

Iteration 2 目标精确化为：

> 清理**消息内容中**的 `try { JSON.parse(msg.content) }`（约占 10 处，均与 `role: 'tool'` 或 `type: 'tool_call'` 消息相关），改为使用 `msg.toolCall` / `msg.toolResult` 结构化字段。文件级 JSON.parse（配置文件、存储文件、日志等）不受影响。

### 需要清理的 10 处

| 文件 | 行号 | 替换方式 |
|------|------|---------|
| `taskv3/msgRenderer.ts:63` | tool_call 计数 | 改为 `msg.toolCall` |
| `taskv3/msgRenderer.ts:147` | tool_call 信息 | 改为 `msg.toolCall` |
| `taskv3/msgRenderer.ts:233` | tool_call output | 改为 `msg.toolResult` |
| `taskv3/basePipeline.ts:178` | tool_call 计数 | 改为 `msg.toolCall` |
| `taskv3/basePipeline.ts:337` | tool_call 信息 | 改为 `msg.toolCall` |
| `taskv3/renderManager.ts:150` | tool_call 统计 | 改为 `msg.toolCall` |
| `taskv3/renderManager.ts:324` | tool_callId 提取 | 改为 `msg.toolCall` |
| `TaskFlowHandler.ts:194` | 阶段信息 | 改为 `msg.phaseAction` |
| `TaskFlowHandler.ts:311` | 阶段信息 | 改为 `msg.phaseAction` |
| `messageRenderer.ts:146` | tool_call | 改为 `msg.toolCall` |

---

## 发现 6（较轻）：插件系统适配未讨论

### 问题

10 个插件通过 `MessageRouter` 消费消息。Domain Model 变更后，插件的消息类型需要同步更新。

### 涉及的插件

| 插件 | 受影响的消息类型 | 适配内容 |
|------|----------------|---------|
| todo | `type: 'tool_call'`, `<TODO_UPDATE>` | 改为 `type: 'tool_call'` + `toolCall` |
| knowledge | `<KNOWLEDGE_ENTRY>` | 改为 `type: 'tool_call'` + `toolCall` |
| review | review/approve 消息 | 改为 `type: 'phase_action'` + `phaseAction` |
| delegate | `[TASK_DELEGATE]` | 改为 `type: 'tool_call'` + `toolCall` |
| diff | file change 消息 | 适配新 type 枚举 |
| demo | 无直接影响 | 只读 |
| device | 无直接影响 | 只读 |

### 建议

Iteration 2 增加一步：遍历所有 `pluginManager.register()` 调用，确认每个 plugin 的消息处理函数兼容新 Message 类型。

---

## 发现 7（较轻）：存量数据迁移策略缺失

### 问题

现有持久化数据使用旧格式（`ChatMessage.type` 13 种枚举，`content` 含 JSON），迁移到新模型需要策略。

### 建议

在 `TaskStore` / `ProjectFs` 层做透明兼容：

```typescript
// 读时兼容
function readMessage(data: any): Message {
    if (data.cardMeta) {
        // 旧格式 → 新格式
        return {
            ...data,
            type: 'phase_action',
            phaseAction: {
                phase: data.cardMeta.type,
                status: data.cardMeta.status,
            },
        };
    }
    // ...
}
```

Iteration 1（Domain Model 落地）时新旧类型通过别名并存，Iteration 2 实施迁移，不在 Iteration 1 中处理。

---

## 发现 8（风险）：Iteration 3 和 5 并行的接口冻结

### 问题

Iteration 3（渲染组件化）和 Iteration 5（LangGraph Provider）可以并行，但两者都依赖 Iteration 1-2 的新 Domain Model。

### 建议

在 Iteration 2 结束时**冻结 `Message` 类型定义**，作为 Iteration 3 和 5 之间的契约。两边从同一个 commit 开始并行开发，任何对 `Message` 类型的修改必须双方确认。

---

## 总结与优先级

| 编号 | 严重程度 | 发现 | 影响 Iteration | 建议操作 |
|------|---------|------|---------------|---------|
| 1 | 🔴 严重 | Message.role 缺 'tool' | 1 | 补充 `role: 'tool'` + `type: 'tool_result'` |
| 2 | 🔴 严重 | 自定义协议无迁移策略 | 5 | 声明协议废弃，改 tool call |
| 3 | 🟡 中等 | Task 字段遗漏 | 1 | 补回 `archived`/`containerId`/`hooks` |
| 4 | 🟡 中等 | Phase 含 'demand' | 1 | 移除 demand，5 阶段 |
| 5 | 🟢 较轻 | JSON.parse 范围过宽 | 2 | 精确化目标，只清理消息内容 |
| 6 | 🟢 较轻 | 插件适配未讨论 | 2 | 补充插件适配步骤表 |
| 7 | 🟢 较轻 | 数据迁移策略缺失 | 2 | 补充透明兼容方案 |
| 8 | ⚠️ 风险 | 并行迭代的接口冻结 | 2→3/5 | 冻结 Message 类型定义 |
