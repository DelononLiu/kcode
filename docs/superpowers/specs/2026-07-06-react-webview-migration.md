# KCode WebView UI 迁移方案 — React 重写

> 日期：2026-07-06
> 状态：提案
> 涉及：构建管线 / 组件设计 / 状态管理

---

## 设计原则

1. **全部重写** — 新开 `src/webview-ui/`，完成后一次性替换，不与旧代码共存
2. **核心优先** — 先迁移对话区（消息列表 + 输入框 + 阶段卡片 + 折叠），侧边栏/知识/设置等后续
3. **文件职责单一** — 单文件超过 500 行时拆分，不堆积
4. **不引入运行时服务** — Vite 仅用于构建，最终产物是静态文件

---

## 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 框架 | React 18 + TypeScript | 标准选择，社区活跃 |
| 构建 | Vite | 开箱支持 React + TS，产出静态文件 |
| 样式 | Tailwind CSS 3 + CSS 变量 | 主题化、暗色模式天然支持 |
| 组件 | shadcn/ui (Radix UI 底座) | 无障碍、键盘导航、默认美观 |
| 状态 | Zustand | 轻量、无 boilerplate，比 Redux 简单 10 倍 |
| 图标 | Lucide React | 与 shadcn/ui 配套 |

## 参考项目

`~/Code/taskit` — 同样的技术栈，组件风格和 CSS 变量体系直接参考。

---

## 目录结构

```
src/webview-ui/
├── index.html                  Vite 入口
├── vite.config.ts              配置：base: './'、无 hash
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── src/
│   ├── main.tsx                ReactDOM.createRoot
│   ├── App.tsx                 消息路由层（监听 postMessage → store）
│   ├── index.css               Tailwind 指令 + CSS 变量
│   │
│   ├── stores/
│   │   ├── chatStore.ts        消息列表 + 流式状态（核心，~400 行）
│   │   └── uiStore.ts          折叠/滚动/UI 杂项（~150 行）
│   │
│   ├── components/
│   │   ├── ui/                 shadcn/ui 组件（通过 cli 添加）
│   │   ├── ChatArea.tsx        消息列表容器（~200 行）
│   │   ├── ChatInput.tsx       输入框 + 发送/停止（~200 行）
│   │   ├── ChatHeader.tsx      标题/状态/阶段标签（~150 行）
│   │   ├── messages/
│   │   │   ├── TextMessage.tsx    agent 文本回复（~100 行）
│   │   │   ├── ThinkingCard.tsx   思考过程卡片（~150 行）
│   │   │   ├── ToolCallCard.tsx   工具调用卡片（~200 行）
│   │   │   ├── PhaseCard.tsx      阶段交互卡片（~250 行）
│   │   │   ├── RoundSummary.tsx   折叠摘要条（~150 行）
│   │   │   └── UserMessage.tsx    用户消息气泡（~80 行）
│   │   └── streaming/
│   │       └── StreamingMessage.tsx  正在流式的消息（~100 行）
│   │
│   └── lib/
│       ├── utils.ts            cn() 工具函数
│       └── types.ts            WebView 消息类型
│
├── .gitignore                  排除 node_modules、dist
└── components.json              shadcn/ui 配置文件
```

---

## 状态管理

### chatStore（核心）

```typescript
import { create } from 'zustand';

interface ChatState {
  // ── 数据 ──
  messages: Message[];
  streaming: boolean;
  activeTaskId: string | null;
  activePhase: string;
  activeStatus: string;
  taskTitle: string;
  agentConnected: boolean;

  // ── 消息处理（继承自 streamHandler.ts 逻辑）──
  loadMessages: (messages: Message[], taskId: string) => void;
  handleStreamChunk: (text: string) => void;
  handleStreamDone: () => void;
  handleThinkingChunk: (data: { text: string; status: string }) => void;
  handleToolChunk: (data: ToolChunkData) => void;
  handleMessagesSync: (messages: Message[]) => void;
  addUserMessage: (text: string) => void;

  // ── 折叠 ──
  expandedRounds: Record<string, boolean>;
  toggleRound: (roundGroup: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  activeTaskId: null,
  activePhase: '',
  activeStatus: '',
  taskTitle: '',
  agentConnected: false,
  expandedRounds: {},

  handleStreamChunk: (text) => set((state) => {
    // 找到或创建 streaming message，更新 content
    // 逻辑等同于 streamHandler.handleStreamChunk
  }),

  handleStreamDone: () => set((state) => {
    // 取消 streaming 标记
    // 触发 _collapseAllRounds（折叠逻辑）
    // 逻辑等同于 streamHandler.handleStreamDone + renderManager._collapseAllRounds
  }),

  toggleRound: (rg) => set((state) => {
    const next = { ...state.expandedRounds };
    if (next[rg]) delete next[rg];
    else next[rg] = true;
    return { expandedRounds: next };
  }),
}));
```

### uiStore

```typescript
interface UIState {
  scrolledUp: boolean;
  pendingMessages: { text: string; taskId: string }[];
  setScrolledUp: (v: boolean) => void;
  addPendingMessage: (msg: { text: string; taskId: string }) => void;
}
```

---

## 消息流（postMessage → React）

```typescript
// App.tsx — 监听 extension 消息，分发到 store
useEffect(() => {
  const handler = (event: MessageEvent) => {
    const msg = event.data;
    switch (msg.type) {
      case 'stream-chunk':
        useChatStore.getState().handleStreamChunk(msg.text);
        break;
      case 'stream-done':
        useChatStore.getState().handleStreamDone();
        break;
      case 'thinking-chunk':
        useChatStore.getState().handleThinkingChunk(msg);
        break;
      case 'messages-sync':
        useChatStore.getState().handleMessagesSync(msg.messages);
        break;
      case 'addUserMessage':
        useChatStore.getState().addUserMessage(msg.content);
        break;
      case 'state-delta':
        if (msg.activeTaskId) useChatStore.getState().loadMessages([], msg.activeTaskId);
        break;
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, []);
```

---

## 组件设计

### 颜色分配（Tailwind CSS 变量）

```css
/* 用户消息 —— 蓝色气泡，右对齐 */
<div className="flex justify-end">
  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
    {content}
  </div>
</div>

/* Agent 消息 —— 灰色气泡，左对齐 */
<div className="flex justify-start">
  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
    {content}
  </div>
</div>
```

### 折叠

```tsx
// RoundSummary 组件 — 点击切换展开/折叠
<button onClick={() => chatStore.toggleRound(roundGroup)}>
  <ChevronDown className={expanded ? '' : '-rotate-90'} />
  {thinking > 0 && `💭 ${thinking} 次思考`}
  {tools && ` 🔧 ${Object.keys(tools).length} 个工具`}
  <span className="text-muted-foreground text-sm">点击展开</span>
</button>
```

---

## 构建管线

### vite.config.ts

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

### chatPanelHtml.ts 变更

```typescript
// 原来是 esbuild 产物路径
// const scriptUri = (name: string) => webview.asWebviewUri(
//     vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview', `${name}.js`)
// ).toString();

// 改为读取 Vite 产物
import * as fs from 'fs';
export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const htmlPath = vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview-ui', 'index.html');
  let html = fs.readFileSync(htmlPath.fsPath, 'utf-8');
  // 替换资源路径为 webview URI
  html = html.replace(
    /(src|href)="\.\/assets\//g,
    (_, attr) => `${attr}="${webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview-ui', 'assets/')
    )}`
  );
  return html;
}
```

### 构建命令

```json
// package.json 新增 script
"build:webview-ui": "cd src/webview-ui && npx vite build"
// compile 改为同时跑两个构建
"compile": "tsc -p tsconfig.build.json && npm run build:webview-ui"
```

---

## 实施步骤

### Step 1: 项目脚手架
- 创建 `src/webview-ui/` 目录
- 初始化 Vite + React + TypeScript 项目
- 配置 Tailwind + shadcn/ui
- 配置 `vite.config.ts`（输出到 `out/view/webview-ui/`）
- 确认 `npx vite build` 产出静态文件

### Step 2: 基础组件
- 添加 shadcn/ui 组件（Button, Input, Card, Badge, ScrollArea 等）
- 创建 `cn()` 工具函数
- 配置 CSS 变量（亮色/暗色）
- 创建 Zustand stores（chatStore, uiStore）

### Step 3: 消息组件
- UserMessage → 右对齐蓝色气泡
- TextMessage → 左对齐灰色气泡 + markdown 渲染
- ThinkingCard → 思考过程卡片
- ToolCallCard → 工具调用卡片
- PhaseCard → 阶段交互卡片
- RoundSummary → 折叠摘要条

### Step 4: 组装对话 UI
- ChatArea — ScrollArea 包裹消息列表
- ChatInput — 输入框 + 发送/停止按钮
- ChatHeader — 标题 + 状态 + 阶段标签
- App.tsx — 消息路由

### Step 5: 集成到 Extension
- 修改 `chatPanelHtml.ts` 加载 Vite 产物
- 修改 `build-webview.js` / 构建脚本
- 确保 postMessage 协议与现有 extension 兼容
- 删除旧的 `app.bundle.js` 相关入口

### Step 6: 测试
- 任务模式全流程（goal → plan → execute → review）
- 小助手模式全流程
- 折叠功能
- 暗色/亮色切换
- 输入框/发送/停止

---

## 保留的旧代码

| 文件 | 原因 |
|------|------|
| `out/view/webview/app.bundle.js` | 迁移期间回退用 |
| `build-webview.js` | 迁移期间保留，Step 5 删除 |
| 侧边栏/知识/设备/设置 | 后续迭代迁移 |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Vite 产物在 WebView CSP 下被拦截 | `base: './'` 确保资源相对路径，`webview.asWebviewUri()` 加载 |
| shadcn/ui 组件过多导致 VSIX 体积增大 | 只按需添加，`npx shadcn add` 不会全装 |
| postMessage 协议不兼容 | 保持现有协议不变，只在 UI 层替换 |
| 构建管线冲突（Vite + esbuild 共存） | 两个构建互不覆盖，`compile` 先跑 esbuild 再跑 Vite |
