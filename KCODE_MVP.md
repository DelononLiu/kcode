# KCode MVP 功能规格 (VS Code Extension)

## 定位

KCode 是一个 VS Code 扩展，参考 ZCode 的 ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

## MVP 布局

采用 Hybrid 模式：**VS Code 原生侧边栏视图 (WebviewView) + 编辑器面板 (WebviewPanel)**。

```
┌────────────────────────────────────────────────────────────────────┐
│ VS Code Activity Bar │  Editor Area: KCodePanel                    │
│                      │                                             │
│  ● Explorer          │  ┌────────────────────────────┬───────────┐ │
│  ● Search            │  │  Chat Messages             │ Preview   │ │
│  ● KCode (selected)  │  │  User: xxx                │ Diff      │ │
│    ────────────      │  │  Agent: yyy               │ WebView   │ │
│    [+ New Task]      │  │  ```code```               │ Device    │ │
│    ────────────      │  │                           │           │ │
│    ○ Task1           │  │  [input...]      [发送]   │           │ │
│    ○ Task2           │  └────────────────────────────┴───────────┘ │
│    ○ Task3           │                                             │
└────────────────────────────────────────────────────────────────────┘
```

### 各区域职责

| 区域 | 实现 | 功能 |
|------|------|------|
| **左侧栏 (侧边栏)** | VS Code WebviewView (KCodeSidebarProvider) | 新建任务、扁平任务列表 |
| **中间对话区** | WebviewPanel (KCodePanel) | AI 对话消息流 + 输入框 |
| **右侧面板** | WebviewPanel 内嵌 | 多 Tab: FilePreview / DiffView / WebView / Device |

### 交互方式

- **右侧面板可隐藏**：点击关闭按钮隐藏
- **三栏宽度可拖拽调整**: 栏之间可拖动分割条
- **点击任务**：中间对话区加载该任务的对话历史

### 与 VS Code 原生功能的关系

- **文件编辑**：Agent 修改文件后，VS Code 原生 Editor 中自动更新
- **文件浏览**：用户可通过 VS Code 原生 Sidebar (Explorer) 浏览文件
- **文件搜索**：用户可使用 VS Code 原生搜索 (⌘+Shift+F)

## ZCode vs KCode MVP 功能对标

| 功能 | ZCode | KCode MVP | 实现状态 | 备注 |
|------|-------|-----------|----------|------|
| **三栏布局** | ✅ 统一 WebView | ✅ 统一 WebView | ⚠️ 2栏(侧边栏为独立WebviewView) | 左侧栏分离为 VS Code 原生 Sidebar View |
| **左侧任务列表** | ✅ 文件树+任务 | ✅ 仅任务(扁平) | ✅ | 工作区分组延后 |
| **中间AI对话** | ✅ 标签页: Chat | ✅ 对话区 | ✅ | Terminal KCode暂无 |
| **右侧预览面板** | ✅ 版本管理/配置 | ✅ Preview/Diff/WebView/Device | ⚠️ 部分(Frontend UI完整, Device无真实连接) | FilePreview/Diff/WebView 已实现 |
| **Terminal** | ✅ 中心区标签页 | ❌ MVP 不实现 | ❌ 不做 | 用户通过 VS Code 原生终端代替 |
| **权限模式** | ✅ 4种模式 | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |
| **多Agent切换** | ✅ 多种AI | ❌ 先接一种 | ❌ 不做 | 后续迭代 |
| **会话版本管理** | ✅ 时间线+Git | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |
| **代码编辑** | ✅ 内置编辑器 | ✅ 复用VS Code | ✅ | KCode优势 |
| **文件管理** | ✅ 内置文件树 | ✅ 复用VS Code Explorer | ✅ | VS Code 原生能力 |
| **顶部导航** | ✅ Logo/搜索/权限 | ❌ 无(VS Code原生标题栏) | ❌ 不做 | 非必要 |
| **Web预览** | ✅ 中心区标签页 | ✅ 右侧面板 Tab | ✅ | 对齐 |
| **MCP协议** | ✅ 支持 | ❌ 暂不实现 | ❌ 不做 | 后续迭代 |

## 核心功能流程

### 1. 任务管理
- **新建任务**：点击 New Task → 创建（首条消息自动设为标题）
- 任务扁平展示
- 任务状态: pending (默认) → active (选中后) → completed
- **点击任务** → 中间对话区加载该任务的 AI 对话

### 2. AI 对话 (基于 ACP 协议)
- 在中间区底部输入框输入需求，发送给 Agent
- KCode 作为 **ACP Client**：创建 ACP 会话 → 发送 `user_message` → 接收 `agent_message_chunk` 流式输出
- Agent 通过 ACP 协议进行 Tool calling：`read_text_file` / `write_text_file` / `list_files` 等
- KCode 实现 `ClientSideConnection` 回调：`requestPermission`、`sessionUpdate`、`writeTextFile`、`readTextFile`
- 对话历史与 Task 绑定存储

### 3. 右侧面板预览
- **FilePreview**：只读展示文件内容
- **DiffView**：文件修改前后对比
- **WebView**：iframe 嵌入前端项目实时预览
- **Device**：展示/交互在远程设备 (telnet/ssh) 上运行的 demo 程序；与 WebView 类似的内嵌视图，但面向后端开发场景，显示设备终端输出或 demo 运行界面

## MVP 不包含 (后续迭代)

- 多 Agent 切换（MVP 通过 ACP 连接一个 Agent，如 OpenCode）
- 权限模式选择（ACP 的 `requestPermission` 回调 MVP 默认 auto-accept）
- 会话版本管理 / Git 集成
- 内置 Terminal
- MCP 协议
- 远程开发
- 工作区管理（延后，待与 VS Code 多工作区协作需求明确后再设计）

## 技术路线

- **框架**: VS Code Extension API
- **WebView**: TypeScript + HTML/CSS (Vanilla, 无需 React/Vue 等框架)
- **数据存储**: VS Code `ExtensionContext.workspaceState`
- **AI 通信**: ACP 协议 (`@agentclientprotocol/sdk`)
  - KCode 作为 **ACP Client** (`ClientSideConnection`)
  - Agent 后端（OpenCode、Claude 等）作为 **ACP Agent** (`AgentSideConnection`)
  - 通信方式: stdio (spawn 子进程建立 JSON-RPC 流)
- **ACP 会话流程**:
  ```
  **依赖**: `@agentclientprotocol/sdk`
  
  KCode (ACP Client)                 Agent (ACP Agent)
        │                                   │
        ├── initialize() ──────────────────►│
        │◄─ {capabilities} ────────────────┤
        │                                   │
        ├── session_new() ────────────────►│
        │◄─ session_id ────────────────────┤
        │                                   │
        ├── user_message(text) ───────────►│
        │◄─ agent_message_chunk (stream) ──┤
        │◄─ tool_call (读/写文件) ─────────┤
        │  ├─ ClientSide: 读文件并返回 ────►│
        │◄─ agent_message_chunk (继续) ────┤
        │◄─ session_complete ──────────────┤
        │                                   │
        ├── session_close() ──────────────►│
  ```

## 项目结构

```
kcode/
├── package.json
├── tsconfig.json
├── .vscode/launch.json
├── src/
│   ├── extension.ts                 # activate: 注册命令、面板、视图
│   │
│   ├── kcodeView/
│   │   ├── KCodePanel.ts            # 创建/管理 Editor WebviewPanel + 内部三栏布局
│   │   └── webview/
│   │       ├── index.html            # 三栏布局 HTML 骨架
│   │       ├── style.css             # 布局 + 样式
│   │       ├── app.ts                # 主逻辑: 通信、渲染、交互
│   │       ├── sidebar.ts            # 左侧栏渲染 (任务列表)
│   │       ├── chat.ts               # 中间对话区渲染
│   │       ├── preview.ts            # 右侧面板渲染 (含Tab切换)
│   │       └── device.ts             # Device Tab (远程设备demo展示/交互)
│   │
│   ├── commands/
│   │   ├── newTask.ts
│   │   └── selectTask.ts
│   │
│   ├── acp/
│   │   ├── AcpClient.ts              # ACP ClientSideConnection 封装
│   │   ├── AgentManager.ts           # Agent 进程管理 (spawn/通信)
│   │   └── callbacks.ts              # Client 回调实现 (文件读写/权限等)
│   │
│   ├── store/
│   │   └── TaskStore.ts
│   │
│   └── types/
│       └── index.ts
└── resources/
    └── icon.svg
```

## 当前实现状态 (2026-05-02)

### ✅ 已实现功能

| 模块 | 子功能 | 状态 |
|------|--------|------|
| 扩展骨架 | VS Code Extension 激活/停用 | ✅ |
| 扩展骨架 | `kcode.open` / `kcode.newTask` 命令 | ✅ |
| 编辑器面板 | WebviewPanel 创建与管理 | ✅ |
| 编辑器面板 | 三栏布局 HTML+CSS (中间+右侧) | ✅ |
| 编辑器面板 | 右侧面板 Tab 切换 (Preview/Diff/WebView/Device) | ✅ |
| 编辑器面板 | 右侧面板隐藏/显示 | ✅ |
| 编辑器面板 | 中间/右侧拖拽分割条 | ✅ |
| 编辑器面板 | 流式消息渲染 (agentStreamUpdate) | ✅ |
| 编辑器面板 | Focus Input 消息 | ✅ |
| 侧边栏 | WebviewViewProvider 注册 | ✅ |
| 侧边栏 | New Task 按钮 | ✅ |
| 侧边栏 | 任务列表渲染 (扁平的) | ✅ |
| 侧边栏 | 右键 Delete 任务 | ✅ |
| 侧边栏 | 点击任务打开面板 | ✅ |
| AI 对话 | 输入框 + 发送按钮 (Enter/点击) | ✅ |
| AI 对话 | Markdown 渲染 (代码块/加粗/链接) | ✅ |
| AI 对话 | 用户消息即时渲染 | ✅ |
| AI 对话 | 对话历史与 Task 绑定加载 | ✅ |
| 右侧面板 | FilePreview 只读展示 | ✅ |
| 右侧面板 | DiffView 行对比 | ✅ |
| 右侧面板 | WebView iframe 嵌入 (含刷新) | ✅ |
| 右侧面板 | Device Tab UI 壳 (connect/disconnect/输入) | ✅ |
| ACP | AcpClient 多会话管理 | ✅ |
| ACP | AgentManager 进程管理 | ✅ |
| ACP | callbacks: requestPermission (auto-accept) | ✅ |
| ACP | callbacks: sessionUpdate (流式路由) | ✅ |
| ACP | callbacks: writeTextFile / readTextFile | ✅ |
| ACP | ACP 集成到 ChatPanel (prompt 发送 + 流式接收) | ✅ |
| 数据层 | TaskStore CRUD (getTasks/addTask/deleteTask/updateTask) | ✅ |
| 数据层 | 消息存储 (getMessages/addMessage/clearMessages) | ✅ |
| 数据层 | findEmptyTask 复用空任务 | ✅ |

### ⚠️ 部分实现

| 模块 | 缺失详情 | 状态 |
|------|----------|------|
| 三栏布局 | 左栏在独立 WebviewView，非三栏内联；无左栏折叠按钮 | ⚠️ 架构取舍 |
| 右侧面板 | Device Tab 无真实 SSH/Telnet 连接 (仅 UI placeholder) | ⬜ 待实现 |

### ❌ 未实现 (MVP 范围内待实现)

| 模块 | 缺失详情 | 优先级 |
|------|----------|--------|
| **设备连接** | Device Tab SSH/Telnet 真实连接逻辑 | 中 |
| **设置页面** | 自有设置 UI (API Key/Agent Path) | 低 (待任务+AI打通后处理) |
| **状态栏** | 底部用户信息/设置入口状态栏 | 低 |
| **侧边栏折叠** | 左侧栏 (侧边栏) 无折叠/展开按钮 | 低 |

### ❌ 不做 (MVP 明确排除)

- 多 Agent 切换
- 权限模式选择器
- 会话版本管理 / Git 集成
- 内置 Terminal
- MCP 协议
- 远程开发
- 工作区管理（延后，待与 VS Code 多工作区协作需求明确）
- Agent 写文件 → Editor 实时刷新（VS Code 原生能力，非需求点）

---

## 实现顺序

### Phase 1: 项目初始化 + 三栏布局骨架
1. VS Code 扩展项目初始化 ✅
2. `KCodePanel.ts` — WebviewPanel ✅
3. `style.css` — 两栏布局（中间/右侧） ✅
4. 拖拽分割条调整宽度 ✅
5. 右侧面板隐藏 ✅

### Phase 2: 数据层 + 左侧任务列表
1. `TaskStore` 持久化（任务 CRUD） ✅
2. `sidebar.ts` — 扁平任务列表 ✅
3. `New Task` 命令 ✅
4. 任务选中高亮 ✅

### Phase 3: 中间 AI 对话区
1. `app.ts` — 消息列表 + 输入框 + 发送按钮 ✅
2. Markdown 渲染 + 代码块高亮 ✅
3. `postMessage` 通信协议 ✅
4. 点击任务加载对应对话历史 ✅

### Phase 4: 右侧面板 (UI 先于后端)
1. `preview.ts` — Tab 切换 UI ✅
2. FilePreview Tab ✅
3. DiffView Tab ✅
4. WebView Tab (iframe) ✅
5. Device Tab (telnet/ssh 远程设备 demo 展示视图) ⬜ 待实现真实连接

### Phase 5: ACP Agent 通信
1. `AcpClient.ts` — 封装 `ClientSideConnection` ✅
2. `AgentManager.ts` — Agent 进程管理 ✅
3. `callbacks.ts` — Client 回调实现 ✅
4. 集成到 ChatPanel：流式渲染 ✅

## 验证方式

1. **F5** 启动 Extension Dev Host
2. 执行 `KCode: Open` 命令 → 打开侧边栏 + 编辑器面板
3. 左侧新建任务 → 中间对话区可交互
4. 输入消息 → Agent 流式回复
5. 右侧面板 Preview/Diff/WebView/Device Tab 可切换
6. 重启后数据不丢失
