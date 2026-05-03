# KCode

VS Code 扩展，参考 ZCode ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

采用 Hybrid 模式：**VS Code 原生侧边栏视图 (WebviewView) + 编辑器面板 (WebviewPanel)**。


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
│       ├── chat.ts               # 空壳(渲染逻辑在 app.ts)
│       ├── preview.ts            # 右侧面板 Preview/Diff/WebView
│       ├── device.ts             # Device tab
│       └── style.css             # 样式
└── acp/
    ├── AcpClient.ts              # ACP 客户端封装
    ├── AgentManager.ts           # Agent 子进程管理
    ├── FakeAgent.ts              # FakeAgent 调试模式
    ├── OpenAIAgent.ts            # OpenAI Agent (HTTP 直连 OpenAI API)
    └── callbacks.ts              # ACP Client 回调实现
```

---

## 功能概览

| 模块 | 已实现 | 待实现 |
|------|--------|--------|
| 扩展骨架 | 激活/停用、命令注册 | - |
| 侧边栏 | 任务列表、New Task、右键删除 | 分组管理、右键菜单扩展 |
| 编辑器面板 | 两栏布局、Tab切换、拖拽分割、流式消息 | - |
| AI 对话 | 输入/发送、Markdown渲染、历史绑定 | - |
| 右侧面板 | Preview、Diff、WebView、Device UI壳 | 验收流程 |
| ACP | 多会话管理、Agent进程、文件读写、流式回调 | - |
| 数据层 | Task CRUD、消息存储 | - |

---

## MVP 功能对标

| 功能 | ZCode | KCode MVP | 实现状态 | 备注 |
|------|-------|-----------|----------|------|
| **三栏布局** | ✅ 统一 WebView | ✅ 统一 WebView | ⚠️ 2栏(侧边栏为独立WebviewView) | 左侧栏分离为 VS Code 原生 Sidebar View |
| **左侧任务列表** | ✅ 文件树+任务 | ✅ 仅任务(扁平) | ✅ | 工作区分组延后 |
| **中间AI对话** | ✅ 标签页: Chat | ✅ 对话区 | ✅ | Terminal KCode暂无 |
| **右侧预览面板** | ✅ 版本管理/配置 | ✅ Preview/Diff/WebView/Device | ⚠️ 部分(UI完整, Device非MVP) | 验收流程通过 Diff/FilePreview 承载 |
| **Terminal** | ✅ 中心区标签页 | ❌ MVP 不实现 | ❌ 不做 | 用户通过 VS Code 原生终端代替 |
| **权限模式** | ✅ 4种模式 | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |
| **多Agent切换** | ✅ 多种AI | ❌ 先接一种 | ❌ 不做 | 后续迭代 |
| **会话版本管理** | ✅ 时间线+Git | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |
| **代码编辑** | ✅ 内置编辑器 | ✅ 复用VS Code | ✅ | KCode优势 |
| **文件管理** | ✅ 内置文件树 | ✅ 复用VS Code Explorer | ✅ | VS Code 原生能力 |
| **顶部导航** | ✅ Logo/搜索/权限 | ❌ 无(VS Code原生标题栏) | ❌ 不做 | 非必要 |
| **Web预览** | ✅ 中心区标签页 | ✅ 右侧面板 Tab | ✅ | 对齐 |
| **MCP协议** | ✅ 支持 | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |

---

## 计划（Phase 功能目标总纲）

### Phase 1: Task 骨架

**目标**：建立 Task 驱动的开发模式基础，实现任务管理与 AI 对话的基础集成。

- 任务创建、选择、删除的基本 CRUD
- 任务列表扁平展示于侧边栏
- 点击任务加载对话历史
- Task 与 ACP Session 一对一绑定

**验收标准**：侧边栏可正常创建和管理任务，AI 对话内容与任务绑定存储。

---

### Phase 2: AI 对话完整化

**目标**：完善 AI 对话体验，配置可自定义，连接状态可知。

- Agent 路径可配置（`kcode.agentPath`）
- Agent 连接状态实时反馈（在线/离线指示灯）
- 对话支持流式输出
- 用户消息即时渲染

**验收标准**：用户可配置 Agent，连接状态可见，对话流畅无阻塞。

---

### Phase 3: 体验打磨

**目标**：提升交互体验，完善右侧预览面板，引入分组和验收流程。

- 侧边栏分组管理（已置顶 / 普通任务 / 分组）
- 验收流程（Agent 回复 → 验收按钮 → diff 预览 → 确认/驳回）
- 右侧面板 Tab 默认引导内容
- 右键菜单扩展（归档、置顶、移出分组）

**验收标准**：侧边栏支持分组和折叠，验收流程可闭环，右侧面板体验友好。

---

## 技术路线

| 层 | 技术 |
|---|---|
| 框架 | VS Code Extension API (v1.96+) |
| WebView | TypeScript + HTML/CSS (Vanilla) |
| 数据存储 | `ExtensionContext.workspaceState` (Memento) |
| AI 通信 | ACP 协议 (`@agentclientprotocol/sdk`) |

ACP 会话流程：

```
KCode (ACP Client)                 Agent (ACP Agent)
      │                                   │
      ├── initialize() ──────────────────►│
      │◄─ {capabilities} ────────────────┤
      │                                   │
      ├── session_new() ────────────────►│
      │◄─ session_id ────────────────────┤
      │                                   │
      ├── prompt({ sessionId, prompt }) ───────────►│
      │◄─ agent_message_chunk (stream) ──┤
      │◄─ tool_call (读/写文件) ─────────┤
      │  ├─ Client 执行并返回结果 ────────►│
      │◄─ agent_message_chunk (继续) ────┤
      │◄─ stop_reason ───────────────────┤
      │                                   │
      ├── session_close() ──────────────►│
```

---

## 文件详细索引

### `src/extension.ts`

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

### `src/types/index.ts`

```typescript
interface Task {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'completed';
    createdAt: number;
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

interface AcpMessageHandler {
    onText: (text: string) => void;
    onError: (error: string) => void;
    onDone: () => void;
}
```

### `src/store/TaskStore.ts`

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

### `src/kcodeView/KCodePanel.ts`

聊天面板，生命周期：
1. `constructor` → 创建 WebviewPanel → 设置 HTML → 注册消息监听
2. `loadTask(taskId)` → 加载对话历史 + 为该 task 创建独立 ACP session
3. `dispose()` → 关闭 ACP 连接 → 清理

每个 Task 有独立的 ACP session，任务间对话上下文互不干扰。

| 公共方法 | 说明 |
|---|---|
| `loadTask(taskId)` | 加载任务消息到 WebView + 创建 ACP session |
| `reveal()` | 面板聚焦 |
| `focusInput()` | 聚焦输入框 |
| `showFilePreview(path, content)` | 发送预览到 WebView |
| `showDiff(original, modified)` | 发送 diff 到 WebView |
| `showWebView(url)` | 发送嵌入式页面 |
| `deviceConnect(host, port, type)` | 发送设备连接 |
| `setRefreshSidebarCallback(cb)` | 注册侧边栏刷新回调 |
| `onDidDispose(callback)` | 注册 dispose 回调 |
| `dispose()` | 销毁面板 |

### `src/kcodeView/KCodeSidebarProvider.ts`

| 方法 | 说明 |
|---|---|
| `constructor(context, store, onTaskSelected)` | 构造函数 |
| `resolveWebviewView(webviewView, ...)` | VS Code 调用，设置 HTML/消息监听 |
| `createNewTask()` | 复用空任务或新建 |
| `refresh()` | 读取 store → postMessage 更新 WebView |

### `src/kcodeView/webview/app.ts`

KCodePanel WebView 主入口（初始化布局、Tab 切换、聊天输入、消息调度）。

| 全局导出 | 说明 |
|---|---|
| `(window as any).addMessage` | 兼容旧接口 |
| `(window as any).simpleMarkdown` | Markdown 渲染器 |
| `(window as any).__resetStream` | 重置流状态 |
| `(window as any).renderMessages` | 渲染消息列表 |

### `src/kcodeView/webview/sidebar.ts`

| 全局导出 | 说明 |
|---|---|
| `renderTaskList(tasks)` | 渲染扁平任务列表 |

### `src/kcodeView/webview/preview.ts`

```typescript
function showPreview(filePath: string, content: string): void
function showDiff(original: string, modified: string): void
function showWebView(url: string): void
function showDeviceFallback(): void
```

### `src/kcodeView/webview/device.ts`

```typescript
function connectToDevice(host: string, port: number, connectionType: 'ssh' | 'telnet'): void
function disconnectDevice(): void
function appendDeviceOutput(data: string): void
```

### `src/acp/AcpClient.ts`

每个 Task 对应独立的 ACP session，`sessions: Map<taskId, sessionId>`。

| 方法 | 说明 |
|---|---|
| `connect(agentPath, args)` | 连接 Agent（共享一个连接） |
| `createSession(taskId, cwd)` | 为指定 task 创建会话 |
| `getSessionId(taskId)` | 获取 task 的 sessionId |
| `hasSession(taskId)` | 检查 task 是否有会话 |
| `prompt(taskId, text, handler)` | 发送 prompt + 流式回调 |
| `cancel(taskId)` | 取消指定 task 的 prompt |
| `closeTaskSession(taskId)` | 关闭指定 task 的会话（本地删除，暂未发送 ACP 关闭请求） |
| `dispose()` | 释放资源 |

### `src/acp/AgentManager.ts`

| 方法 | 说明 |
|---|---|
| `startAgent(command, args)` | spawn 子进程 |
| `startAgentWithNpx(scriptPath)` | 通过 npx 启动 |
| `stopAgent()` | 终止进程 |
| `isRunning()` | 是否运行 |

### `src/acp/callbacks.ts`

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
                    ┌───────────────────────────────────────────┤
                    │                                           │
            TaskStore/Memento                             KCodePanel
                    │                                       ↕ ACP
                    │                                  Agent 子进程 (stdio)
                    │                                           │
                    └─── refreshSidebar() ←── 命令完成 ────────┘
                                │
                    sidebarProvider.refresh()
                                │
                    侧边栏 WebView ← postMessage ──
                               (updateTaskList)
```

---

## 关键实现细节

### WebView script 加载方式

所有 JS 通过 TypeScript 编译后输出到 `out/kcodeView/webview/*.js`，通过 `webview.asWebviewUri` 加载。HTML 直接在 `KCodePanel.ts` 中通过 `getWebviewContent()` 方法内联生成。

### KCodePanel 生命周期

- `constructor` → 创建 `WebviewPanel` → 设置 HTML → 注册消息监听
- `loadTask(taskId)` → 从侧边栏加载指定任务的消息
- `dispose()` → 关闭 ACP 连接 → 清理监听器

### KCodeSidebarProvider 生命周期

- `constructor(context, store, onTaskSelected)` → 由 `extension.ts` 创建
- `resolveWebviewView()` → 由 VS Code 在侧边栏显示时调用 → 设置 HTML、JS、消息监听
- `refresh()` → 外部调用（如命令完成后）→ 读取 TaskStore → postMessage 更新 WebView
- 注册方式：`vscode.window.registerWebviewViewProvider('kcode.viewsMain', provider, options)`

### `extension.ts` 关键模块关系

- `sidebarProvider` → `KCodeSidebarProvider` 实例，管理侧边栏视图
- `panel` → `KCodePanel` 实例，管理编辑器面板（聊天界面）
- `openTaskInPanel()` → 侧边栏点击任务时的回调：创建/复用 `KCodePanel` 并调用 `loadTask()`
- `refreshSidebar()` → 命令完成后同时刷新侧边栏和面板的任务列表

---

## UI 设计

### 整体布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  [+ 新建任务]       Ctrl+N   │  ┌──────────────────────┬──────────┐ │
│  ─────────────────────────   │  │  Chat Messages       │ Preview  │ │
│  ▾ 已置顶                    │  │  User: xxx           │ Diff     │ │
│    · 任务A                   │  │  Agent: yyy          │ WebView  │ │
│    · 任务B                   │  │                      │ Device   │ │
│  ▾ 任务                      │  │                      │          │ │
│    · 任务1（未分组）         │  │  [input...]  [发送]  │          │ │
│    ▾ 分组1                   │  └──────────────────────┴──────────┘ │
│      · 任务a                 │                                      │
│  ─────────────────────────   │                                      │
│  👤 用户 / ⚙️ 设置          │                                      │
└─────────────────────────────────────────────────────────────────────┘
```

左侧栏布局规则：
- **顶部操作区**：新建任务按钮 + 键盘快捷键提示
- **已置顶区**：用户手动置顶的任务，支持折叠/展开
- **任务区**：未分组任务平铺 + 自定义分组（每个分组可折叠）
- **底部用户区**：用户信息 + 设置入口

### 聊天面板布局 (Chat)

```
┌────────────────────────────────────────────┐
│  ▸ 任务3                            ☰ ⋯   │  ← 标题栏（任务名 + 菜单）
├────────────────────────────────────────────┤
│                                            │
│  消息区（滚动）                             │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  👤 User        今天 10:30           │  │
│  │  实现一个统计函数                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  🤖 Agent       今天 10:31           │  │
│  │  已创建 `stats.py`，包含：            │  │
│  │  - average() 计算平均值               │  │
│  │  - median()  计算中位数               │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │ ✅ 验收      ❌ 驳回           │  │  │  ← 验收按钮
│  │  └────────────────────────────────┘  │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │  🤖 Agent (正在输入...)              │  │  ← 流式输出中
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  ┌──────────────────────────┐ ┌──────┐     │
│  │  输入消息...             │ │ 发送 │     │  ← 输入区
│  └──────────────────────────┘ └──────┘     │
└────────────────────────────────────────────┘
```

布局规则：
- **标题栏**：当前任务标题 + 菜单按钮（清空对话、导出等）
- **消息区**：按时间排列的对话消息，用户消息左对齐，Agent 消息右对齐
- **验收按钮**：出现在每条 Agent 回复末尾，点击打开 diff 预览
- **输入区**：文本输入框 + 发送按钮

### 右侧面板布局 (Right Panel)

```
┌──────────────────────────────┐
│  Preview │ Diff │ Web │ Dev  │  ← Tab 栏
├──────────────────────────────┤
│                              │
│  默认引导内容（P3-03）        │
│                              │
│  ┌────────────────────────┐  │
│  │  📖 欢迎使用 KCode    │  │
│  │                        │  │
│  │  选择一个任务开始对话， │  │
│  │  或使用 ⌘N 新建任务。 │  │
│  │                        │  │
│  │  ✨ 快捷键              │  │
│  │  ⌘N  新建任务          │  │
│  │  ⌘I  聚焦输入框        │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │  Tab 内容区             │  │
│  │  - Preview: 文件预览    │  │
│  │  - Diff:    差异对比    │  │
│  │  - Web:     嵌入页面    │  │
│  │  - Dev:     设备连接    │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

布局规则：
- **Tab 栏**：四个 Tab 可切换，激活态高亮
- **默认引导**：无内容时展示欢迎/快捷键信息
- **内容区**：根据选中 Tab 展示对应内容

### 任务右键菜单

```
┌──────────────────────┐
│  📌 置顶 / 取消置顶   │
│  📂 移至分组...       │  →  分组1
│                        │     分组2
│  🗄️ 归档              │     新分组...
│  🗑️ 删除              │
└──────────────────────┘
```

---

## 构建命令

```bash
npm run compile       # tsc 编译
npm run watch         # 监听模式
npx tsc --noEmit      # 类型检查
```

调试: F5 (Run Extension, 需要先编译)
