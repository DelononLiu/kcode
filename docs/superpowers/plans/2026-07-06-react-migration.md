# WebView React 迁移 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `src/webview-ui/` React 项目，替换现有 vanilla DOM WebView，覆盖任务模式和小助手模式的对话区。

**Architecture:** 独立的 Vite + React 18 项目，产物输出到 `out/view/webview-ui/`，与现有 esbuild 管线并存。Zustand 管理消息状态，shadcn/ui 提供基础组件。

**Tech Stack:** Vite 5 + React 18 + TypeScript + Tailwind CSS 3 + shadcn/ui (Radix UI) + Zustand 5 + Lucide React

## Global Constraints

- 单文件超过 500 行时拆分
- 不引入运行时服务（Vite 仅构建）
- postMessage 协议与现有 Extension 保持一致
- 覆盖任务模式和小助手模式两种视图
- shadcn/ui 组件按需添加，不全量安装

---

## 文件结构

```
src/webview-ui/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── components.json              shadcn/ui 配置
├── src/
│   ├── main.tsx
│   ├── App.tsx                  postMessage 路由 + 视图切换
│   ├── index.css                Tailwind 指令 + CSS 变量
│   ├── stores/
│   │   ├── chatStore.ts         消息 + 流式状态
│   │   └── uiStore.ts           折叠/滚动
│   ├── components/
│   │   ├── ui/                  shadcn/ui (通过 cli 添加)
│   │   ├── ChatArea.tsx
│   │   ├── ChatInput.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── messages/
│   │   │   ├── TextMessage.tsx
│   │   │   ├── ThinkingCard.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── PhaseCard.tsx
│   │   │   ├── RoundSummary.tsx
│   │   │   └── UserMessage.tsx
│   │   └── streaming/
│   │       └── StreamingMessage.tsx
│   └── lib/
│       ├── utils.ts             cn()
│       └── types.ts             Message 类型
```

---

### Task 1: 项目脚手架 — Vite + React + Tailwind + shadcn/ui

**Files:**
- Create: `src/webview-ui/package.json`
- Create: `src/webview-ui/vite.config.ts`
- Create: `src/webview-ui/tsconfig.json`
- Create: `src/webview-ui/tailwind.config.ts`
- Create: `src/webview-ui/postcss.config.js`
- Create: `src/webview-ui/index.html`
- Create: `src/webview-ui/src/main.tsx`
- Create: `src/webview-ui/src/index.css`
- Create: `src/webview-ui/src/App.tsx`
- Create: `src/webview-ui/components.json`

- [ ] **Step 1: 创建 `src/webview-ui/package.json`**

```json
{
  "name": "kcode-webview",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd src/webview-ui
npm install react@^18 react-dom@^18 zustand@^5 lucide-react
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
npx shadcn@latest init
npx shadcn@latest add button input card badge scroll-area separator
```

- [ ] **Step 3: 创建 `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../out/view/webview-ui',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 4: 创建 `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))', input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))', background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
```

- [ ] **Step 5: 创建 `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --muted: 217.2 32.6% 17.5%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
  }
}
```

- [ ] **Step 6: 创建 `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 7: 创建 `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)
```

- [ ] **Step 8: 创建 `src/App.tsx` — 占位**

```tsx
export default function App() {
  return <div className="h-screen flex flex-col bg-background text-foreground">
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      KCode WebView — React
    </div>
  </div>
}
```

- [ ] **Step 9: 确认构建成功**

```bash
cd src/webview-ui && npx vite build
ls ../out/view/webview-ui/index.html
```

- [ ] **Step 10: 提交**

```bash
git add src/webview-ui/ && git commit -m "feat(ui): Vite + React + Tailwind + shadcn/ui 项目脚手架"
```

---

### Task 2: Zustand 状态层

**Files:**
- Create: `src/webview-ui/src/lib/types.ts`
- Create: `src/webview-ui/src/stores/chatStore.ts`
- Create: `src/webview-ui/src/stores/uiStore.ts`

- [ ] **Step 1: 创建 `src/lib/types.ts`**

```typescript
export interface Message {
  id: string; taskId: string;
  role: 'user' | 'agent' | 'tool';
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'phase_action';
  content: string;
  toolCall?: { toolCallId: string; title: string; kind: string; status: string };
  toolResult?: { toolCallId: string; output: string };
  phaseAction?: { phase: string; status: 'pending' | 'confirmed' | 'rejected' };
  timestamp: number;
  streaming?: boolean;
  collapsed?: boolean;
  roundGroup?: string | null;
}
export interface ToolChunkData {
  toolCallId: string; title: string; kind: string; status: string; content: string;
}
```

- [ ] **Step 2: 创建 `chatStore.ts`**

```typescript
import { create } from 'zustand';
import type { Message, ToolChunkData } from '../lib/types';

interface ChatState {
  messages: Message[];
  streaming: boolean;
  activeTaskId: string | null;
  activePhase: string;
  activeStatus: string;
  taskTitle: string;
  agentConnected: boolean;
  agentName: string;
  viewMode: 'task' | 'assistant';
  expandedRounds: Record<string, boolean>;

  loadMessages: (messages: Message[], taskId: string, taskType?: string) => void;
  handleStreamChunk: (text: string) => void;
  handleStreamDone: () => void;
  handleThinkingChunk: (data: { text: string; status: string }) => void;
  handleToolChunk: (data: ToolChunkData) => void;
  handleMessagesSync: (messages: Message[]) => void;
  addUserMessage: (content: string) => void;
  setStateDelta: (d: Partial<ChatState>) => void;
  toggleRound: (roundGroup: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  activeTaskId: null,
  activePhase: '', activeStatus: '', taskTitle: '',
  agentConnected: false, agentName: '', viewMode: 'task',
  expandedRounds: {},

  loadMessages: (messages, taskId, taskType) => set({
    messages, activeTaskId: taskId,
    viewMode: taskType === 'assistant' ? 'assistant' : 'task', streaming: false,
  }),

  handleStreamChunk: (text) => set((state) => {
    const msgs = [...state.messages];
    let idx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (idx < 0) {
      msgs.push({
        id: 'msg_' + Date.now(), taskId: state.activeTaskId || '',
        role: 'agent', type: 'text', content: '', timestamp: Date.now(),
        streaming: true, collapsed: false, roundGroup: null,
      });
      idx = msgs.length - 1;
    }
    msgs[idx] = { ...msgs[idx], content: text };
    return { messages: msgs, streaming: true };
  }),

  handleStreamDone: () => set((state) => {
    let msgs = state.messages.map(m => m.streaming ? { ...m, streaming: false } : m);
    const cleaned = msgs.filter(m => m.type !== 'round_summary');
    const userIdx: number[] = [];
    cleaned.forEach((m, i) => { if (m.role === 'user') userIdx.push(i); });
    if (userIdx.length > 0) {
      const result = [...cleaned];
      for (let ri = 0; ri < userIdx.length; ri++) {
        const start = userIdx[ri] + 1;
        const end = ri + 1 < userIdx.length ? userIdx[ri + 1] - 1 : result.length - 1;
        if (start > end) continue;
        const rg = 'rg_' + result[start].id;
        if (state.expandedRounds[rg]) continue;
        let finalAgent = -1;
        for (let i = start; i <= end; i++) {
          if (result[i].role === 'agent' && !result[i].phaseAction) finalAgent = i;
        }
        for (let i = start; i <= end; i++) {
          if (i !== finalAgent) result[i] = { ...result[i], collapsed: true };
        }
      }
      msgs = result;
    }
    return { messages: msgs, streaming: false };
  }),

  handleThinkingChunk: (data) => set((state) => {
    const msgs = [...state.messages];
    const idx = msgs.findIndex(m => m.type === 'thinking' && m.streaming);
    if (idx >= 0) {
      msgs[idx] = { ...msgs[idx], content: data.text, streaming: data.status !== 'completed' };
    } else {
      msgs.push({
        id: 'thinking_' + Date.now(), taskId: state.activeTaskId || '',
        role: 'agent', type: 'thinking', content: data.text, timestamp: Date.now(),
        streaming: data.status !== 'completed', collapsed: false, roundGroup: null,
      });
    }
    return { messages: msgs };
  }),

  handleToolChunk: (data) => set((state) => {
    const msgs = [...state.messages];
    const ci = { toolCallId: data.toolCallId, title: data.title, kind: data.kind, status: data.status };
    const idx = msgs.findIndex(m => m.type === 'tool_call' && m.toolCall?.toolCallId === data.toolCallId);
    if (idx >= 0) {
      const existing = msgs[idx];
      msgs[idx] = { ...existing, toolCall: { ...existing.toolCall, ...ci } };
      if (data.content) msgs[idx] = { ...msgs[idx], toolResult: { toolCallId: data.toolCallId, output: data.content } };
    } else {
      msgs.push({
        id: 'tool_' + data.toolCallId, taskId: state.activeTaskId || '',
        role: 'tool', type: 'tool_call', content: '', timestamp: Date.now(),
        streaming: false, collapsed: false, roundGroup: null, toolCall: ci,
      });
    }
    return { messages: msgs };
  }),

  handleMessagesSync: (messages) => set({ messages }),
  addUserMessage: (content) => set((s) => ({ messages: [...s.messages, { id: 'user_' + Date.now(), taskId: s.activeTaskId || '', role: 'user', type: 'text', content, timestamp: Date.now(), streaming: false, collapsed: false, roundGroup: null }] })),
  setStateDelta: (d) => set(d),
  toggleRound: (rg) => set((s) => {
    const next = { ...s.expandedRounds };
    if (next[rg]) { delete next[rg]; return { expandedRounds: next }; }
    next[rg] = true; return { expandedRounds: next };
  }),
}));
```

- [ ] **Step 3: 创建 `uiStore.ts`**

```typescript
import { create } from 'zustand';
interface UIState {
  scrolledUp: boolean; pendingCount: number;
  setScrolledUp: (v: boolean) => void;
  setPendingCount: (n: number) => void;
}
export const useUIStore = create<UIState>((set) => ({
  scrolledUp: false, pendingCount: 0,
  setScrolledUp: (v) => set({ scrolledUp: v }),
  setPendingCount: (n) => set({ pendingCount: n }),
}));
```

- [ ] **Step 4: 提交**

```bash
git add src/webview-ui/src/lib/ src/webview-ui/src/stores/
git commit -m "feat(ui): Zustand stores + 消息类型"
```

---

### Task 3: 消息组件

**Files:**
- Create: `src/webview-ui/src/components/messages/UserMessage.tsx`
- Create: `src/webview-ui/src/components/messages/TextMessage.tsx`
- Create: `src/webview-ui/src/components/messages/ThinkingCard.tsx`
- Create: `src/webview-ui/src/components/messages/ToolCallCard.tsx`
- Create: `src/webview-ui/src/components/messages/PhaseCard.tsx`
- Create: `src/webview-ui/src/components/messages/RoundSummary.tsx`
- Create: `src/webview-ui/src/components/streaming/StreamingMessage.tsx`

- [ ] **Step 1: UserMessage — 蓝色气泡右对齐**

```tsx
export default function UserMessage({ content, timestamp }: { content: string; timestamp: number }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        <span className="text-[10px] opacity-60 mt-1 block text-right">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TextMessage — 灰色气泡左对齐**

```tsx
export default function TextMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[80%]">
        <div className="text-sm whitespace-pre-wrap">{content}</div>
        {streaming && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ThinkingCard — 思考过程**

```tsx
import { Brain } from 'lucide-react';
export default function ThinkingCard({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-2">
      <div className="bg-muted/50 rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
        <Brain className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="line-clamp-2">{content || '思考中...'}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: ToolCallCard — 工具调用**

渲染 `toolCall` 信息，根据 kind 显示图标，根据 status 显示状态。

- [ ] **Step 5: PhaseCard — 阶段交互卡片**

使用 `Card` 组件，根据 `phaseAction.phase` 显示阶段标题，根据 `status` 显示确认按钮或已完成状态。

- [ ] **Step 6: RoundSummary — 折叠摘要**

```tsx
import { ChevronDown } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

export default function RoundSummary({ roundGroup, thinking, tools }: {
  roundGroup: string; thinking: number; tools: Record<string, number>;
}) {
  const expanded = useChatStore(s => s.expandedRounds[roundGroup]);
  const toggle = () => useChatStore.getState().toggleRound(roundGroup);

  return (
    <button onClick={toggle} className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 hover:bg-muted/50 rounded-md w-full mb-2">
      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      {thinking > 0 && <span>💭 {thinking} 次思考</span>}
      {Object.keys(tools).length > 0 && <span>🔧 {Object.keys(tools).length} 个工具</span>}
      <span className="ml-auto">{expanded ? '收起' : '展开'}</span>
    </button>
  );
}
```

- [ ] **Step 7: 编译验证** — `cd src/webview-ui && npx tsc --noEmit`

---

### Task 4: 对话区组装

**Files:**
- Create: `src/webview-ui/src/components/ChatArea.tsx`
- Create: `src/webview-ui/src/components/ChatInput.tsx`
- Create: `src/webview-ui/src/components/ChatHeader.tsx`
- Modify: `src/webview-ui/src/App.tsx`

- [ ] **Step 1: ChatArea — 消息列表容器**

```tsx
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/stores/chatStore';
import UserMessage from './messages/UserMessage';
import TextMessage from './messages/TextMessage';
import ThinkingCard from './messages/ThinkingCard';
import ToolCallCard from './messages/ToolCallCard';
import PhaseCard from './messages/PhaseCard';
import RoundSummary from './messages/RoundSummary';

export default function ChatArea() {
  const messages = useChatStore(s => s.messages);

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      {messages.map((msg) => {
        if (msg.type === 'round_summary') {
          try { const c = JSON.parse(msg.content); return <RoundSummary key={msg.id} roundGroup={msg.roundGroup || ''} thinking={c.thinking || 0} tools={c.tools || {}} />; } catch { return null; }
        }
        if (msg.type === 'phase_action' && msg.phaseAction) return <PhaseCard key={msg.id} {...msg} />;
        if (msg.type === 'thinking') return <ThinkingCard key={msg.id} content={msg.content} />;
        if (msg.type === 'tool_call') return <ToolCallCard key={msg.id} {...msg} />;
        if (msg.role === 'user') return <UserMessage key={msg.id} content={msg.content} timestamp={msg.timestamp} />;
        if (msg.type === 'text') return <TextMessage key={msg.id} content={msg.content} streaming={msg.streaming} />;
        return null;
      })}
    </ScrollArea>
  );
}
```

- [ ] **Step 2: ChatInput — 输入框 + 发送/停止**

```tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Square } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';

export default function ChatInput() {
  const streaming = useChatStore(s => s.streaming);
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim() || streaming) return;
    (window as any).vscode.postMessage({
      type: useChatStore.getState().viewMode === 'assistant' ? 'sendAssistantMessage' : 'stageInput',
      text: text.trim(),
      taskId: useChatStore.getState().activeTaskId,
    });
    setText('');
  };

  const stop = () => (window as any).vscode.postMessage({ type: 'stopGeneration' });

  return (
    <div className="border-t border-border p-3 flex gap-2">
      <Input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
        placeholder={streaming ? '正在生成...' : '输入消息，Enter 发送'}
        disabled={streaming} />
      {streaming
        ? <Button size="icon" variant="destructive" onClick={stop}><Square className="w-4 h-4" /></Button>
        : <Button size="icon" onClick={send}><Send className="w-4 h-4" /></Button>
      }
    </div>
  );
}
```

- [ ] **Step 3: ChatHeader — 标题 + 阶段标签**

```tsx
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/stores/chatStore';

const phaseLabels: Record<string, string> = {
  goal: '确认目标', plan: '制定计划', execute: '执行',
  self_verify: '自我验证', review: '验收',
};

export default function ChatHeader() {
  const viewMode = useChatStore(s => s.viewMode);
  const phase = useChatStore(s => s.activePhase);
  const title = useChatStore(s => s.taskTitle);
  const connected = useChatStore(s => s.agentConnected);

  return (
    <div className="border-b border-border px-4 py-2.5 flex items-center gap-3">
      <span className="font-medium text-sm truncate">
        {viewMode === 'assistant' ? '小助手' : title || '任务'}
      </span>
      {viewMode === 'task' && phase && phaseLabels[phase] && (
        <Badge variant="outline">{phaseLabels[phase]}</Badge>
      )}
      <span className={`ml-auto text-xs ${connected ? 'text-green-500' : 'text-muted-foreground'}`}>
        {connected ? '已连接' : '未连接'}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: 更新 App.tsx — postMessage 路由**

```tsx
import { useEffect } from 'react';
import { useChatStore } from './stores/chatStore';
import ChatHeader from './components/ChatHeader';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';

export default function App() {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data; const s = useChatStore.getState();
      switch (msg.type) {
        case 'loadMessages': s.loadMessages(msg.messages || [], msg.taskId, msg.taskType); break;
        case 'stream-chunk': s.handleStreamChunk(msg.text); break;
        case 'stream-done': s.handleStreamDone(); break;
        case 'thinking-chunk': s.handleThinkingChunk(msg); break;
        case 'tool-chunk': s.handleToolChunk(msg); break;
        case 'messages-sync': s.handleMessagesSync(msg.messages || []); break;
        case 'addUserMessage': s.addUserMessage(msg.content); break;
        case 'state-delta': if (msg.activeTaskId) s.setStateDelta(msg); break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <ChatHeader />
      <ChatArea />
      <ChatInput />
    </div>
  );
}
```

- [ ] **Step 5: 构建验证** — `cd src/webview-ui && npx vite build`

---

### Task 5: 集成到 Extension

**Files:**
- Modify: `src/view/templates/chatPanelHtml.ts`
- Modify: `package.json`

- [ ] **Step 1: 修改 `chatPanelHtml.ts`**

```typescript
import * as fs from 'fs';
import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview-ui', 'index.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf-8');

  html = html.replace(
    /(src|href)=(["'])(\.\/assets\/)/g,
    (_, attr, quote) => {
      const uri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview-ui', 'assets/')
      ).toString();
      return `${attr}=${quote}${uri}`;
    }
  );

  return html;
}
```

- [ ] **Step 2: 更新 `package.json`**

```json
{
  "scripts": {
    "build:webview-ui": "cd src/webview-ui && npx vite build",
    "compile": "tsc -p tsconfig.build.json && node scripts/build-webview.js && npm run build:webview-ui"
  }
}
```

- [ ] **Step 3: 全量编译**

```bash
npm run compile
```

Expected: `out/view/webview-ui/index.html` + `assets/` 生成，扩展启动正常

---

### Task 6: 清理旧代码（按需）

- [ ] **Step 1: 当 React 版本稳定后，删除旧的入口文件**
- [ ] **Step 2: 清理 `scripts/build-webview.js` 中不再使用的入口**
- [ ] **Step 3: 最终提交**
