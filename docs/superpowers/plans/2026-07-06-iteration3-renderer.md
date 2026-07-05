# Iteration 3: 渲染组件化 + 双管线统一 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `msgRenderer.ts` 拆分为独立渲染器注册表，提取共享 stream handler，消除 `assistantPipeline.ts` 中的重复渲染逻辑。

**Architecture:** `renderers/` 目录存放独立渲染器（按 type 分发），`streamHandler.ts` 提取公共流处理逻辑（`_handleStreamChunk`, `_handleThinkingChunk`, `_handleToolChunk`），`assistantPipeline.ts` 和 `renderManager.ts` 都引用同一套 handler。两个管线只维持各自的 StateManager 实例和任务/小助手特有的逻辑。

**Tech Stack:** TypeScript, 无新增依赖

## Global Constraints

- 渲染效果与重构前一致（两种模式分别验证）
- 新增消息类型只需加一个渲染器文件
- 不改动消息数据模型（Domain Model 不变）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/view/webview/renderers/registry.ts` | 新增 | 渲染器注册表 + `MessageRenderer` 类型 |
| `src/view/webview/renderers/text.ts` | 新增 | 文本消息渲染器 |
| `src/view/webview/renderers/thinking.ts` | 新增 | 思考消息渲染器 |
| `src/view/webview/renderers/tool_call.ts` | 新增 | 工具调用渲染器 |
| `src/view/webview/renderers/phase_action.ts` | 新增 | 阶段操作卡片渲染器 |
| `src/view/webview/renderers/round_summary.ts` | 新增 | 折叠摘要渲染器 |
| `src/view/webview/renderers/user.ts` | 新增 | 用户消息渲染器 |
| `src/view/webview/taskv3/msgRenderer.ts` | 简化 | import 并 re-export 渲染器注册表 |
| `src/view/webview/streamHandler.ts` | 新增 | 公共流处理逻辑（取代 assistantPipeline 的重复方法） |
| `src/view/webview/assistantPipeline.ts` | 简化 | 移除重复的 _handle* 方法，改用 streamHandler |
| `src/view/webview/taskv3/renderManager.ts` | 适配 | 部分逻辑改走统一渲染器 |

---

### Task 1: 创建渲染器注册表和独立渲染器

**Files:**
- Create: `src/view/webview/renderers/registry.ts`
- Create: `src/view/webview/renderers/text.ts`
- Create: `src/view/webview/renderers/thinking.ts`
- Create: `src/view/webview/renderers/tool_call.ts`
- Create: `src/view/webview/renderers/phase_action.ts`
- Create: `src/view/webview/renderers/round_summary.ts`
- Create: `src/view/webview/renderers/user.ts`

- [ ] **Step 1: 定义渲染器接口和注册表**

`renderers/registry.ts`:
```typescript
import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/msgRenderer';

export interface MessageRenderer {
    type: string;
    render: (msg: Message, sm: MsgStateAccess) => HTMLElement | null;
    update?: (el: HTMLElement, msg: Message, sm: MsgStateAccess) => void;
}

const registry = new Map<string, MessageRenderer>();

export function registerRenderer(renderer: MessageRenderer): void {
    registry.set(renderer.type, renderer);
}

export function getRenderer(type: string): MessageRenderer | undefined {
    return registry.get(type);
}

export function getAllRenderers(): MessageRenderer[] {
    return Array.from(registry.values());
}
```

- [ ] **Step 2: 创建 text 渲染器**

`renderers/text.ts`:
```typescript
import type { Message } from '../../taskv3/types';
import type { MsgStateAccess } from '../../taskv3/msgRenderer';
import { registerRenderer, MessageRenderer } from './registry';
import { renderMarkdown } from '../../markdownRenderer';

const textRenderer: MessageRenderer = {
    type: 'text',
    render: (msg: Message, _sm: MsgStateAccess) => {
        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
        if (msg.streaming) div.classList.add('streaming');
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = renderMarkdown(msg.content);
        div.appendChild(bubble);
        return div;
    },
};
registerRenderer(textRenderer);
```

- [ ] **Step 3: 创建 thinking 渲染器**

`renderers/thinking.ts`：
从 `msgRenderer.ts` 的 thinking 渲染逻辑（原 line 126-141）提取。

- [ ] **Step 4: 创建 tool_call 渲染器**

`renderers/tool_call.ts`：
从 `msgRenderer.ts` 的 tool_call 渲染逻辑（原 line 144-157）提取，使用 `msg.toolCall`。

- [ ] **Step 5: 创建 phase_action 渲染器**

`renderers/phase_action.ts`：
从 `msgRenderer.ts` 的 cardMeta 渲染逻辑（原 line 85-130）提取，使用 `msg.phaseAction`。

- [ ] **Step 6: 创建 round_summary 渲染器**

`renderers/round_summary.ts`：
从 `msgRenderer.ts` 的 round_summary 渲染逻辑提取。

- [ ] **Step 7: 创建 user 渲染器**

`renderers/user.ts`：
从 `msgRenderer.ts` 的 user 渲染逻辑（原 line 161-175）提取。

- [ ] **Step 8: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: 简化 `msgRenderer.ts` — 改为分发到注册表

**Files:**
- Modify: `src/view/webview/taskv3/msgRenderer.ts`

- [ ] **Step 1: 将 `createMsgElement` 改为从注册表分发**

```typescript
export function createMsgElement(msg: Message, sm: MsgStateAccess): HTMLElement | null {
    // round_summary 特殊处理
    if (msg.type === 'round_summary') {
        return renderRoundSummary(msg, sm);
    }
    // phase_action (原 cardMeta)
    if (msg.type === 'phase_action' && msg.phaseAction) {
        return renderPhaseAction(msg, sm);
    }
    // user
    if (msg.role === 'user') {
        return renderUserMessage(msg);
    }
    // 从注册表获取
    const renderer = getRenderer(msg.type);
    if (renderer) return renderer.render(msg, sm);
    return null;
}
```

实际上，更简洁的方式：直接 import 每个渲染器并在 `createMsgElement` 中按 type 分发，不需要注册表查找的开销。

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: 创建共享 stream handler

**Files:**
- Create: `src/view/webview/streamHandler.ts`
- Modify: `src/view/webview/assistantPipeline.ts`

- [ ] **Step 1: 创建 `streamHandler.ts`**

提取 `assistantPipeline.ts` 中的 `_handleStreamChunk`, `_handleThinkingChunk`, `_handleToolChunk`, `_handleStreamDone` 到 `streamHandler.ts`，改为接收 StateManager 接口：

```typescript
import type { Message } from './taskv3/types';

export interface StreamStateAccess {
    state: { messages: Message[] };
    patch(delta: { messages: Message[] }): void;
}

export function handleStreamChunk(text: string, sm: StreamStateAccess) {
    const msgs = [...sm.state.messages];
    let streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx < 0) {
        const newMsg: Message = {
            id: 'msg_' + Date.now(),
            taskId: '',
            role: 'agent',
            type: 'text',
            content: '',
            timestamp: Date.now(),
            streaming: true,
            collapsed: false,
            roundGroup: null,
        };
        msgs.push(newMsg);
        streamIdx = msgs.length - 1;
    }
    msgs[streamIdx] = { ...msgs[streamIdx], content: text };
    sm.patch({ messages: msgs });
}

export function handleStreamDone(sm: StreamStateAccess) {
    const msgs = sm.state.messages.map(m =>
        m.streaming ? { ...m, streaming: false } : m
    );
    sm.patch({ messages: msgs });
}

export function handleThinkingChunk(msg: { text: string; status: string }, sm: StreamStateAccess) {
    // 从 assistantPipeline.ts 提取
}

export function handleToolChunk(msg: { toolCallId: string; title: string; kind: string; status: string; content: string }, sm: StreamStateAccess) {
    // 从 assistantPipeline.ts 提取，改用 toolCall 结构化字段
}
```

- [ ] **Step 2: 简化 `assistantPipeline.ts` — 移除重复方法**

删除 `_handleStreamChunk`, `_handleThinkingChunk`, `_handleToolChunk`, `_handleStreamDone`，改为调用 `streamHandler` 中的公共函数。

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: 适配 `renderManager.ts` 使用渲染器

**Files:**
- Modify: `src/view/webview/taskv3/renderManager.ts`

- [ ] **Step 1: 将渲染调用改为使用渲染器注册表**

`renderManager.ts` 中的消息渲染调用 `msgRenderer.createMsgElement(msg, sm)` 保持不变（它已经是分发函数），不需要修改。

重点确认 `_syncMessages` 和增量渲染逻辑是否正常工作。

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: 全量编译验证 + 提交

**Files:**
- Verify: 全仓库

- [ ] **Step 1: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 最终提交**

```bash
git add -A
git commit -m "refactor(render): Iteration 3 完成 — 渲染组件化 + 双管线统一

- 新增 renderers/ 目录，按消息类型分发渲染
- 提取 streamHandler.ts 共享流处理逻辑
- 简化 assistantPipeline.ts（移除重复 _handle* 方法）
- msgRenderer.ts 改为渲染器分发入口
- 新增消息类型只需加一个渲染器文件"
```
