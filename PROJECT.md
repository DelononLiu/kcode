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
├── acp/
│   ├── AcpClient.ts              # ACP 客户端封装
│   ├── AgentManager.ts           # Agent 子进程管理
│   └── callbacks.ts              # ACP Client 回调实现
└── commands/
    ├── newTask.ts                # 新建任务（未使用）
    └── selectTask.ts             # 任务选择回调
```

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

## 当前实现状态

### ✅ 已实现功能

| 模块 | 子功能 |
|------|--------|
| 扩展骨架 | VS Code Extension 激活/停用 |
| 扩展骨架 | `kcode.open` / `kcode.newTask` 命令 |
| 编辑器面板 | WebviewPanel 创建与管理 |
| 编辑器面板 | 两栏布局 HTML+CSS (中间+右侧) |
| 编辑器面板 | 右侧面板 Tab 切换 (Preview/Diff/WebView/Device) |
| 编辑器面板 | 右侧面板隐藏/显示 |
| 编辑器面板 | 中间/右侧拖拽分割条 |
| 编辑器面板 | 流式消息渲染 (agentStreamUpdate) |
| 编辑器面板 | Focus Input 消息 |
| 侧边栏 | WebviewViewProvider 注册 |
| 侧边栏 | New Task 按钮 |
| 侧边栏 | 任务列表渲染 (扁平的) |
| 侧边栏 | 右键 Delete 任务 |
| 侧边栏 | 点击任务打开面板 |
| AI 对话 | 输入框 + 发送按钮 (Enter/点击) |
| AI 对话 | Markdown 渲染 (粗体/斜体/链接/换行) |
| AI 对话 | 用户消息即时渲染 |
| AI 对话 | 对话历史与 Task 绑定加载 |
| 右侧面板 | FilePreview 只读展示 |
| 右侧面板 | DiffView 行对比 |
| 右侧面板 | WebView iframe 嵌入 (含刷新) |
| 右侧面板 | Device Tab UI 壳 |
| ACP | AcpClient 多会话管理 |
| ACP | AgentManager 进程管理 |
| ACP | callbacks: requestPermission (auto-accept) |
| ACP | callbacks: sessionUpdate (流式路由) |
| ACP | callbacks: writeTextFile / readTextFile |
| ACP | ACP 集成到 ChatPanel (prompt 发送 + 流式接收) |
| 数据层 | TaskStore CRUD (getTasks/addTask/deleteTask/updateTask) |
| 数据层 | 消息存储 (getMessages/addMessage/clearMessages) |
| 数据层 | findEmptyTask 复用空任务 |

### ⚠️ 部分实现

| 模块 | 缺失详情 |
|------|----------|
| 三栏布局 | 左栏在独立 WebviewView，非两栏内联；无折叠按钮 (架构取舍) |
| Device Tab | 无真实 SSH/Telnet 连接，仅 UI 壳 (非 MVP 必须) |

### ❌ 未实现 (按 Phase 顺序)

#### Phase 1: Task 骨架
| 优先级 | 任务 |
|--------|------|
| P0 | 清理 `src/commands/newTask.ts` 和 `selectTask.ts` |
| P1 | ✅ `findEmptyTask` 已在 TaskStore 中实现 |
| P2 | **自定义分组 + 侧边栏重构**（三区块 + 底部） |
| P2 | **验收流程**（验收按钮 → diff/文件列表 → 确认/驳回） |
| P3 | 右键菜单增加"归档"入口 |

#### Phase 2: AI 对话完整化
| 优先级 | 任务 |
|--------|------|
| P0 | `package.json` 添加 `contributes.configuration`（kcode.agentPath） |
| P1 | Agent 连接失败的用户可见错误反馈 |
| P2 | 取消 prompt / 输入框 loading 态 |

#### Phase 3: 体验打磨
| 优先级 | 任务 |
|--------|------|
| P0 | Agent 在线/离线状态灯 |
| P1 | 右侧面板 Tab 默认引导内容 |
| P2 | sidebar 折叠按钮 |

---

## 实现顺序

### Phase 1: Task 骨架

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 清理 `src/commands/newTask.ts` 和 `selectTask.ts` | 消除与 `extension.ts` / `KCodeSidebarProvider` 的重复逻辑，统一入口 |
| P1 | ✅ `findEmptyTask` 已在 TaskStore 中实现 | 无需重复 |
| P2 | **侧边栏重构为三区块 + 底部** | 见下方新侧边栏 UI 规格 |
| P2 | **验收流程** | Agent 回复完毕后，对话区底部出现"验收"按钮 → 展示 diff + 变更文件列表 → 用户确认/驳回 |
| P3 | 右键菜单增加"归档"入口 | 从列表隐藏但数据保留，待后续版本支持历史回溯 |

### 新侧边栏 UI 规格

```
┌─────────────────────────────────┐
│ [+ 新建任务]           Ctrl+N   │  ← 顶部操作区
├─────────────────────────────────┤
│ ▾ 已置顶                     ▼  │  ← 已置顶任务（可折叠）
│   · 任务A                   10:30│
│   · 任务B                   昨天 │
├─────────────────────────────────┤
│ ▾ 任务                        ▼  │  ← 总框（未分组任务 + 分组）
│   · 任务1（未分组）         10:30 │
│   ▾ 分组1                  ▼    │  ← 用户自建分组（可折叠）
│     · 任务a                10:30 │
│     · 任务b                昨天  │
│   ▾ 分组2                  ▼    │
│     · 任务2.1              昨天 │
├─────────────────────────────────┤
│ 👤 用户 / ⚙️ 设置               │  ← 底部用户区
└─────────────────────────────────┘
```

**交互**：
- 点击分组头 → 折叠/展开
- 点击任务项 → 加载 AI 对话
- 右键任务项 → 置顶 / 移出分组 / 删除
- 右键分组头 → 重命名 / 删除分组

### Phase 2: AI 对话完整化

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | `package.json` 添加 `contributes.configuration` | 定义 `kcode.agentPath` / `kcode.agentArgs` |
| P1 | Agent 连接失败的用户可见错误反馈 | 当前 `ensureConnection` 失败仅 `console.error` |
| P2 | 取消 prompt / 输入框 loading 态 | 发送后禁用输入框和按钮 |

### Phase 3: 体验打磨

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | Agent 在线/离线状态灯 | 状态栏显示 Agent 实时连接状态 |
| P1 | 右侧面板 Tab 默认引导内容 | Tab 初始为空时显示友好说明 |
| P2 | sidebar 折叠按钮 | VS Code WebviewView 侧边栏折叠/展开 |

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

## 构建命令

```bash
npm run compile       # tsc 编译
npm run watch         # 监听模式
npx tsc --noEmit      # 类型检查
```

调试: F5 (Run Extension, 需要先编译)
