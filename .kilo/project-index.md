# KCode Project Index
> 代码库详细索引，方便 AI Agent 快速定位目标文件，无需重复全局搜索。
> 项目结构变更时需同步更新此文件。

---

## 目录结构

```
src/
├── extension.ts                  # 扩展入口
├── types/index.ts                # 类型定义
├── store/TaskStore.ts            # 数据持久化
├── kcodeView/
│   ├── KCodePanel.ts             # 编辑器聊天面板
│   ├── KCodeSidebarProvider.ts   # 侧边栏视图
│   └── webview/
│       ├── app.ts                # 主 WebView 逻辑
│       ├── sidebar.ts            # 侧边栏任务列表渲染
│       ├── chat.ts               # 对话消息渲染
│       ├── preview.ts            # 右侧面板 Preview/Diff/WebView
│       ├── device.ts             # Device tab
│       └── style.css             # 样式
├── acp/
│   ├── AcpClient.ts              # ACP 客户端封装
│   ├── AgentManager.ts           # Agent 子进程管理
│   └── callbacks.ts              # ACP Client 回调实现
└── commands/
    ├── newTask.ts                # 新建任务（未使用）
    └── selectTask.ts             # 任务选择回调
```

---

## 文件详细索引

### `src/extension.ts` — Entry Point

| 导出 | 说明 |
|---|---|
| `activate(context)` | VS Code 激活入口 |
| `deactivate()` | VS Code 停用清理 |

**模块级变量**: `panel` (KCodePanel), `store` (TaskStore), `sidebarProvider` (KCodeSidebarProvider)

**内部函数**: `openTaskInPanel(taskId)`, `refreshSidebar()`

**注册命令**:

| ID | 行为 |
|---|---|
| `kcode.open` | 聚焦侧边栏 + 打开面板 |
| `kcode.newTask` | 检查空任务 → 复用或新建 → 打开面板 |

---

### `src/types/index.ts` — Type Definitions

```typescript
interface Task {
  id: string;           // "task_1746000000000"
  title: string;        // "New Task" / 用户首条消息截取
  status: 'pending' | 'active' | 'completed';
  createdAt: number;    // Date.now()
}

interface ChatMessage {
  id: string;
  taskId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

interface ACPConfig {
  agentPath: string;
  apiKey?: string;
}
```

---

### `src/store/TaskStore.ts` — Data Layer

包装 `ExtensionContext.workspaceState` (Memento)。

存储结构：
- `tasks` → `Task[]`
- `messages_{taskId}` → `ChatMessage[]`

| 方法 | 说明 |
|---|---|
| `getTasks()` | 全部任务 |
| `addTask(task)` | 新增 |
| `deleteTask(taskId)` | 删除任务及其消息 |
| `updateTaskStatus(id, status)` | 改状态 |
| `updateTaskTitle(id, title)` | 改标题 |
| `getTask(id)` | 单个任务 |
| `findEmptyTask()` | 找第一条消息数为 0 的任务 |
| `getMessages(taskId)` | 获取对话消息 |
| `addMessage(msg)` | 添加消息 |
| `clearMessages(taskId)` | 清空消息 |

---

### `src/kcodeView/KCodePanel.ts` — Editor Panel

聊天面板，生命周期：
1. `constructor` → 创建 WebviewPanel → 设置 HTML → 注册消息监听
2. `loadTask(taskId)` → 加载对话历史 + 为该 task 创建独立 ACP session
3. `dispose()` → 关闭 ACP 连接 → 清理

每个 Task 有独立的 ACP session，任务间对话上下文互不干扰。

| 公共方法 | 说明 |
|---|---|
| `loadTask(taskId)` | 加载任务消息到 WebView + 为该 task 创建独立 ACP session |
| `reveal()` | 面板聚焦 |
| `focusInput()` | 聚焦输入框 |
| `showFilePreview(path, content)` | 发送预览到 WebView |
| `showDiff(original, modified)` | 发送 diff 到 WebView |
| `showWebView(url)` | 发送嵌入式页面 |
| `deviceConnect(host, port, type)` | 发送设备连接 |
| `setRefreshSidebarCallback(cb)` | 注册侧边栏刷新回调 |
| `onDidDispose(callback)` | 注册 dispose 回调 |
| `dispose()` | 销毁面板 |

**WebView → Extension** 消息：

| type | 数据 | 处理 |
|---|---|---|
| `sendMessage` | `{ text, taskId? }` | `handleSendMessage()` |

**Extension → WebView** 消息：

| type | 数据 | 时机 |
|---|---|---|
| `loadMessages` | `{ messages }` | 加载任务 |
| `addUserMessage` | `{ content }` | 用户发消息后 |
| `agentStreamUpdate` | `{ text }` | Agent 流式回复 |
| `agentStatus` | `{ status, message }` | Agent 连接状态 |
| `showFilePreview` | `{ filePath, content }` | 文件预览 |
| `showDiff` | `{ original, modified }` | 差异对比 |
| `showWebView` | `{ url }` | 嵌入网页 |
| `deviceConnect` | `{ host, port, connectionType }` | 远程设备 |
| `focusInput` | — | 聚焦输入框 |

---

### `src/kcodeView/KCodeSidebarProvider.ts` — Sidebar View

侧边栏视图，负责任务列表展示 + 交互。

| 方法 | 说明 |
|---|---|
| `constructor(context, store, onTaskSelected)` | 构造函数 |
| `resolveWebviewView(webviewView, ...)` | VS Code 调用，设置 HTML/消息监听 |
| `createNewTask()` | 复用空任务或新建 |
| `refresh()` | 读取 store → postMessage 更新 WebView |

**WebView → Extension** 消息：

| type | 数据 | 处理 |
|---|---|---|
| `newTask` | — | `createNewTask()` |
| `selectTask` | `{ taskId }` | `_onTaskSelected(taskId)` |
| `deleteTask` | `{ taskId }` | `store.deleteTask()` + `refresh()` |
| `openSettings` | — | 打开 KCode 设置 |

**Extension → WebView** 消息：

| type | 数据 | 时机 |
|---|---|---|
| `updateTaskList` | `{ tasks }` | `refresh()` |

---

### `src/kcodeView/webview/sidebar.ts` — Sidebar WebView Script

| 全局导出 | 说明 |
|---|---|
| `renderTaskList(tasks)` | 渲染任务列表 |

**行为**:
- `+ New Task` 按钮 → 发 `newTask`
- 点击任务项 → 发 `selectTask`，含 `taskId`
- 右键任务项 → 弹出自定义 `Delete` 菜单 → 发 `deleteTask`
- 接收 `updateTaskList` → 重新渲染

---

### `src/kcodeView/webview/app.ts` — Main WebView Script

KCodePanel WebView 主入口。初始化布局、 Tab 切换、聊天输入、消息调度。

| 全局导出 | 说明 |
|---|---|
| `(window as any).addMessage` | 兼容旧接口 |
| `(window as any).simpleMarkdown` | Markdown 渲染器 |
| `(window as any).__resetStream` | 重置流状态 |

**消息流转发**:
- `loadMessages` → `(window as any).renderMessages(messages)` (chat.ts)
- `showFilePreview` → `(window as any).showPreview(...)` (preview.ts)
- `showDiff` → `(window as any).showDiff(...)` (preview.ts)
- `showWebView` → `(window as any).showWebView(url)` (preview.ts)
- `deviceConnect` → `(window as any).connectToDevice(...)` (device.ts)
- `agentStreamUpdate` → 内部流渲染
- `addUserMessage` → 附加用户气泡

**发往 Extension**:
- `sendMessage` — 点击发送 / Enter
- `openSettings` — 设置按钮

---

### `src/kcodeView/webview/chat.ts`

```typescript
function renderMessages(messages: ChatMessage[]): void   // 全量渲染
function addMessageElement(msg: ChatMessage): void         // 追加单条
```

### `src/kcodeView/webview/preview.ts`

```typescript
function showPreview(filePath: string, content: string): void
function showDiff(original: string, modified: string): void
function showWebView(url: string): void
```

### `src/kcodeView/webview/device.ts`

```typescript
function connectToDevice(host: string, port: number, connectionType: 'ssh' | 'telnet'): void
function disconnectDevice(): void
function appendDeviceOutput(data: string): void
```

---

### `src/acp/AcpClient.ts` — ACP Client (多会话)

每个 Task 对应独立的 ACP session，`sessions: Map<taskId, sessionId>`。

| 方法 | 说明 |
|---|---|
| `connect(agentPath, args)` | 连接 Agent（共享一个连接） |
| `createSession(taskId, cwd)` | 为指定 task 创建会话 |
| `getSessionId(taskId)` | 获取 task 的 sessionId |
| `hasSession(taskId)` | 检查 task 是否有会话 |
| `prompt(taskId, text, handler)` | 为指定 task 发送 prompt + 流式回调 |
| `cancel(taskId)` | 取消指定 task 的 prompt |
| `closeTaskSession(taskId)` | 关闭指定 task 的会话 |
| `dispose()` | 释放资源 |

Handler: `{ onText, onError, onDone }` (定义在 `types/index.ts`)

### `src/acp/AgentManager.ts` — Agent Process Manager

| 方法 | 说明 |
|---|---|
| `startAgent(command, args)` | spawn 子进程 |
| `startAgentWithNpx(scriptPath)` | 通过 npx 启动 |
| `stopAgent()` | 终止进程 |
| `isRunning()` | 是否运行 |

### `src/acp/callbacks.ts` — ACP Client Callbacks

`KCodeClient` implements `acp.Client`（维护 `sessionHandlers: Map<sessionId, AcpMessageHandler>`）：

| 方法 | 说明 |
|---|---|
| `setSessionHandler(sessionId, handler)` | 注册 session 流式处理器 |
| `removeSessionHandler(sessionId)` | 移除处理器 |
| `requestPermission()` | MVP auto-accept |
| `sessionUpdate()` | 按 `params.sessionId` 路由到对应 handler |
| `writeTextFile()` | 写文件（路径解析到 workspaceRoot） |
| `readTextFile()` | 读文件 |

---

## 通信协议汇总

### WebView → Extension

| type | Source | Target |
|---|---|---|
| `'newTask'` | sidebar.ts | KCodeSidebarProvider |
| `'selectTask'` | sidebar.ts | KCodeSidebarProvider |
| `'deleteTask'` | sidebar.ts | KCodeSidebarProvider |
| `'openSettings'` | sidebar.ts / app.ts | KCodeSidebarProvider |
| `'sendMessage'` | app.ts | KCodePanel |

### Extension → WebView

| type | Source | Target |
|---|---|---|
| `'updateTaskList'` | KCodeSidebarProvider | sidebar.ts |
| `'loadMessages'` | KCodePanel | app.ts / chat.ts |
| `'addUserMessage'` | KCodePanel | app.ts |
| `'agentStreamUpdate'` | KCodePanel | app.ts |
| `'agentStatus'` | KCodePanel | app.ts |
| `'showFilePreview'` | KCodePanel | app.ts / preview.ts |
| `'showDiff'` | KCodePanel | app.ts / preview.ts |
| `'showWebView'` | KCodePanel | app.ts / preview.ts |
| `'deviceConnect'` | KCodePanel | app.ts / device.ts |
| `'focusInput'` | KCodePanel | app.ts |

---

## 数据流

```
侧边栏 WebView → postMessage → KCodeSidebarProvider → Extension Host
                                                            │
                    ┌───────────────────────────────────────┤
                    │                                       │
            TaskStore/Memento                         KCodePanel
                    │                                   ↕ ACP
                    │                              Agent 子进程 (stdio)
                    │                                       │
                    └─── refreshSidebar() ←── 命令完成 ────┘
                                │
                    sidebarProvider.refresh()
                                │
                    侧边栏 WebView ← postMessage ──
                               (updateTaskList)
```

---

## 构建命令

```bash
npm run compile       # tsc 编译
npm run watch         # 监听模式
npx tsc --noEmit      # 类型检查
```

调试: F5 (Run Extension, 需要先编译)
