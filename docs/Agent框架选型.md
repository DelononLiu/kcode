# Agent 框架选型

## 结论

**使用 LangGraph.js（TypeScript）**，与后端 OpenCodeWiki 统一技术栈。

---

## 背景

kcode 现有两种 Agent 模式：
1. **ACP Agent 模式**（主力）—— Kilo/OpenCode/Claude ACP 子进程，通过 `@agentclientprotocol/sdk` 通信
2. **纯聊模式**（`AssistantHandler.ts`）—— 一次 prompt → 一次回答，无 tool-use 循环

纯聊模式效果不理想，原因是缺乏 agentic loop—— LLM 不能自主调工具、看结果、再决策。

---

## 为什么选 LangGraph.js 而非 Vercel AI SDK

kcode 已经有一个手写的状态机 `TaskFlow.ts`（goal→plan→execute→verify→review 五阶段）：

```
goal → plan → execute → verify → review
                          ↑ ↓
                      失败→重做
```

这是**状态图模式**，不是简单的线性 tool-use 循环。
- Vercel AI SDK 只有 `maxSteps` 的线性 tool-use，无法表达分支/回退/中断
- LangGraph.js 的 `StateGraph` + conditional edges + interrupt 机制天然匹配

| 能力 | 需要吗 | Vercel AI SDK | LangGraph.js |
|------|--------|:---:|:---:|
| tool-use 循环 | ✅ | ✅ | ✅ |
| 状态持久化（掉线恢复） | ✅ | ❌ | ✅ SQLite |
| Human-in-loop（用户确认） | ✅（确认计划/修改/验收） | ❌ | ✅ interrupt |
| 条件分支（自验失败回退） | ✅ | ❌ | ✅ conditional edges |
| 自定义 Agent 类型 | ✅（local/新增） | ❌ | ✅ |

---

## 改动方案

### 第一阶段：纯聊模式 + Local Agent（最小改动）

**文件**：`src/view/AssistantHandler.ts`、`src/core/AgentService.ts`、`package.json`

```typescript
// AgentService 新增 local 类型
export class LocalAgentProvider implements IAgentProvider {
  private agent: CompiledStateGraph

  async connect(config: AgentConfig) {
    this.agent = createReactAgent({
      llm: chatModel,
      tools: [readFile, writeFile, runTerminal],
      prompt: ASSISTANT_SYSTEM_PROMPT,
      checkpointSaver: new SqliteSaver(dbPath),
    })
  }

  async sendPrompt(sessionId: string, text: string, handler: AcpMessageHandler) {
    // 用 LangGraph 替代 ACP 子进程
    const stream = this.agent.streamEvents(
      { messages: [{ role: 'user', content: text }] },
      { version: 'v2' }
    )
    for await (const event of stream) {
      // 映射到 ACP 的流式事件格式
      if (event.event === 'on_chat_model_stream') handler.onText(event.data.chunk)
      if (event.event === 'on_tool_start') handler.onToolCall(...)
    }
  }
}
```

ACP 原有的 Kilo/OpenCode/Claude Agent 连接逻辑**完全不变**。新增一个 local 类型即可。

### 第二阶段（可选）：TaskFlow 迁移到 StateGraph

现在 `TaskFlow.ts` 的手写状态机可以用 LangGraph StateGraph 替代：

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

优势：
- SQLite checkpoint 自动保存每个阶段状态，VSCode 重启后恢复
- interrupt 机制在"等待用户确认"处自然停顿
- 所有阶段切换由框架管理，不再需要 `confirmGoal`/`confirmPlan`/`confirmExecuteDone` 等手写事件处理

### 依赖新增

```
package.json:
  "@langchain/langgraph": "^1.4.0"
  "@langchain/langgraph-checkpoint-sqlite": "^1.0.0"
```

已有依赖 `better-sqlite3` 可用于 checkpoint（如选 SQLite 持久化）。

---

## 与 ACP 协议的关系

LangGraph.js 和 ACP 协议**不冲突**：

```
ACP 协议 → 通信层（扩展↔Agent 子进程），保留不变
LangGraph → 编排层（Agent 内部的循环/状态管理）

两种场景：
  ACP Agent（原有）：外部子进程 → 通过 ACP 流回扩展
  Local Agent（新增）：扩展内 LangGraph → 直接流回渲染层

共存方式：AgentService 的 provider 模式已经支持多 Agent 类型
```

---

## 实施顺序

1. 加 `@langchain/langgraph` 依赖
2. `AgentService` 新增 `local` provider 类型
3. `AssistantHandler.ts` 替换纯聊逻辑为 `createReactAgent`
4. 验证：纯聊模式可以调文件/终端工具
5. 可选：TaskFlow 迁移到 StateGraph
