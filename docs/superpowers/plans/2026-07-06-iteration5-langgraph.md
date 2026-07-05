# Iteration 5: LangGraph Provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 在 AgentService 中增加 LangGraph 类型，使其能通过 LangGraph StateGraph 管理任务阶段流转。

**Architecture:** `LocalAgentProvider.ts` 使用 LangGraph.StateGraph 定义 goal→plan→execute→self_verify→review 节点。流式事件通过 `StreamAdapter` 映射为现有的 postMessage 格式。不与 ACP 共享任何协议代码。

**Tech Stack:** @langchain/langgraph, @langchain/langgraph-checkpoint-sqlite, better-sqlite3 (已有)

## Global Constraints
- 不继承 ACP 的任何协议（[TASK_UPDATE] 等）
- postMessage 协议与 ACP 一致，WebView 端无感知
- 第一阶段仅实现 goal 节点（验证集成），后续节点逐步添加

---

### Task 1: 安装 LangGraph 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

```bash
npm install @langchain/langgraph @langchain/langgraph-checkpoint-sqlite
```

Expected: 安装成功，`package.json` 和 `package-lock.json` 更新

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: 提交**

---

### Task 2: 创建 StreamAdapter

**Files:**
- Create: `src/core/StreamAdapter.ts`

将 LangGraph 的 `streamEvents` 事件映射为 WebView postMessage 格式。

- [ ] **Step 1: 创建 StreamAdapter.ts**

```typescript
import type { AcpMessageHandler } from '../types';

/**
 * StreamAdapter: 将 LangGraph streamEvents 事件映射为 ACP 兼容的 onText/onToolCall 回调
 * 
 * 遵循原则 5: LangGraph 从零构建，但 postMessage 协议与 ACP 一致
 * WebView 端无感知
 */
export type LangGraphEvent = 
    | { event: 'on_chat_model_stream'; chunk: { content: string } }
    | { event: 'on_tool_start'; name: string; toolCallId: string }
    | { event: 'on_tool_end'; toolCallId: string; output: string }
    | { event: 'on_llm_end' }
    | { event: 'on_chain_end' };

export class StreamAdapter {
    private handler: AcpMessageHandler;

    constructor(handler: AcpMessageHandler) {
        this.handler = handler;
    }

    push(event: LangGraphEvent): void {
        switch (event.event) {
            case 'on_chat_model_stream':
                if (event.chunk?.content) {
                    this.handler.onText(event.chunk.content);
                }
                break;
            case 'on_tool_start':
                this.handler.onToolCall?.(
                    event.toolCallId,
                    event.name,
                    event.name,
                    'running'
                );
                break;
            case 'on_tool_end':
                this.handler.onToolCallUpdate?.(
                    event.toolCallId,
                    'completed',
                    event.output
                );
                break;
            case 'on_llm_end':
            case 'on_chain_end':
                break;
        }
    }

    complete(stopReason?: string): void {
        this.handler.onDone(stopReason);
    }

    error(err: string): void {
        this.handler.onError(err);
    }
}
```

- [ ] **Step 2: 编译验证** — `npx tsc --noEmit` 0 errors

---

### Task 3: 创建 LocalAgentProvider（LangGraph 实现）

**Files:**
- Create: `src/core/LocalAgentProvider.ts`

实现 LangGraph StateGraph，初始支持 goal 节点。

- [ ] **Step 1: 创建基础 StateGraph**

```typescript
import { StateGraph, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { StreamAdapter } from './StreamAdapter';

export class LocalAgentProvider {
    private graph: StateGraph<typeof MessagesAnnotation.State>;
    private app: any; // CompiledGraph
    private config: { model?: string; apiKey?: string; baseUrl?: string };

    constructor(config: { model?: string; apiKey?: string; baseUrl?: string }) {
        this.config = config;
        this.graph = new StateGraph(MessagesAnnotation);
        this._buildGraph();
    }

    private _buildGraph() {
        const llm = new ChatOpenAI({
            model: this.config.model || 'deepseek-v4-flash',
            apiKey: this.config.apiKey,
            configuration: { baseURL: this.config.baseUrl },
        });

        // goal 节点：格式化用户目标
        this.graph.addNode('goal', async (state: typeof MessagesAnnotation.State) => {
            const response = await llm.invoke(state.messages);
            return { messages: [response] };
        });

        this.graph.addEdge('__start__', 'goal');
    }

    async compile() {
        this.app = this.graph.compile();
    }

    async invoke(taskId: string, messages: any[], handler: any) {
        const adapter = new StreamAdapter(handler);
        // 暂时使用简单 invoke（后续改为 streamEvents）
        try {
            const result = await this.app.invoke({ messages });
            // 从 result 中提取最终消息内容
            const lastMsg = result.messages[result.messages.length - 1];
            if (lastMsg?.content) {
                adapter.complete('end_turn');
            }
        } catch (err: any) {
            adapter.error(err?.message || 'LangGraph 执行失败');
        }
    }
}
```

- [ ] **Step 2: 编译验证** — `npx tsc --noEmit` 0 errors
- [ ] **Step 3: 提交**

---

### Task 4: 扩展 AgentService — 支持 langgraph 类型

**Files:**
- Modify: `src/core/AgentService.ts`
- Modify: `src/core/AgentConfigManager.ts`

- [ ] **Step 1: 在 AgentService 中添加 LangGraph 支持**

```typescript
// 新增字段
private langGraphProvider: LocalAgentProvider | null = null;

// 新增方法（在 AgentService 类中）
async connectLangGraph(): Promise<boolean> {
    try {
        const apiKey = this._cfg().get<string>('provider.anthropic.apiKey', '') 
            || process.env.ANTHROPIC_API_KEY || '';
        const baseUrl = this._cfg().get<string>('provider.anthropic.baseUrl', '')
            || process.env.ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic';
        const model = this._cfg().get<string>('provider.anthropic.model', '')
            || process.env.CLAUDE_MODEL || 'deepseek-v4-flash';

        this.langGraphProvider = new LocalAgentProvider({ model, apiKey, baseUrl });
        await this.langGraphProvider.compile();
        this._isConnected = true;
        this._agentName = 'langgraph';
        this._modelName = model;
        this.agentType = 'langgraph';
        return true;
    } catch (err: any) {
        this._lastError = err?.message || 'LangGraph 连接失败';
        return false;
    }
}
```

- [ ] **Step 2: 在 `connectByLabel` 中添加 langgraph 分支**

```typescript
case 'langgraph': return await this.connectLangGraph();
```

- [ ] **Step 3: 编译验证** — `npx tsc --noEmit` 0 errors
- [ ] **Step 4: 提交**

---

### Task 5: 集成验证

- [ ] **Step 1: 全量编译** — `npx tsc --noEmit` 0 errors
- [ ] **Step 2: 最终提交**

```bash
git add -A
git commit -m "feat(agent): Iteration 5 完成 — LangGraph Provider 集成

- 新增 @langchain/langgraph 依赖
- 新增 StreamAdapter (LangGraph 事件 → postMessage 格式)
- 新增 LocalAgentProvider (StateGraph 实现)
- AgentService 扩展 langgraph 类型
- 遵循原则 5: 不继承 ACP 协议代码"
```
