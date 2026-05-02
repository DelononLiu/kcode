# KCode MVP 功能规格 (VS Code Extension)

## 定位

KCode 是一个 VS Code 扩展，参考 ZCode 的 ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

## MVP 三栏布局

VS Code Editor Area 中打开一个 **统一的三栏 WebView**，内部渲染完整布局：

```
┌──────────────────────────────────────────────────────────────────────┐
│                    KCode 三栏布局 (WebView 内部)                      │
├────────────┬────────────────────────────┬───────────────────────────┤
│  左侧栏     │  中间:                     │  右侧面板                 │
│  (240px)   │  AI 对话区 (flex-1)        │  (320px, 可隐藏)         │
│            │                            │                           │
│  ┌────────┐│  ┌──────────────────────┐  │  ┌─Tab────────────────┐  │
│  │New Task││  │   Chat Messages      │  │  │ Preview | Diff    │  │
│  │Open Wk ││  │                      │  │  │ WebView | Device  │  │
│  ├────────┤│  │  User: xxx           │  │  └───────────────────┘  │
│  │Worksp-1││  │  ────────────        │  │                           │
│  │ ├Task1 ││  │  Agent: yyy          │  │                           │
│  │ ├Task2 ││  │  ```code```          │  │                           │
│  │Worksp-2││  │  [edit file]         │  │                           │
│  │ ├Task3 ││  │                      │  │                           │
│  ├────────┤│  ├──────────────────────┤  │                           │
│  │⚪ | ⚙️││  │  [input...]    [发送] │  │                           │
│  └────────┘│  └──────────────────────┘  │                           │
└────────────┴────────────────────────────┴───────────────────────────┘
```

### 各栏职责

| 区域 | 实现 | 功能 |
|------|------|------|
| **左侧栏** | WebView 内 HTML 渲染 | 新建任务、打开工作区、按工作区分组展示任务列表；底部用户+设置 |
| **中间对话区** | WebView 内 HTML 渲染 | AI 对话消息流 + 输入框 |
| **右侧面板** | WebView 内 HTML 渲染 | 多 Tab: FilePreview / DiffView / WebView / Device |

### 交互方式

- **左侧栏可折叠**：点击折叠按钮收起/展开
- **右侧面板可隐藏**：点击关闭按钮隐藏
- **三栏宽度可拖拽调整**: 栏之间可拖动分割条
- **点击任务**：中间对话区加载该任务的对话历史

### 与 VS Code 原生功能的关系

- **文件编辑**：Agent 修改文件后，VS Code 原生 Editor 中自动更新
- **文件浏览**：用户可通过 VS Code 原生 Sidebar (Explorer) 浏览文件
- **文件搜索**：用户可使用 VS Code 原生搜索 (⌘+Shift+F)

## ZCode vs KCode MVP 功能对标

| 功能 | ZCode | KCode MVP | 备注 |
|------|-------|-----------|------|
| **三栏布局** | ✅ 统一 WebView | ✅ 统一 WebView | 对齐 |
| **左侧任务列表** | ✅ 文件树+任务 | ✅ 仅任务(按工作区) | KCode简化，文件由VS Code负责 |
| **中间AI对话** | ✅ 标签页: Chat | ✅ 对话区 | Terminal KCode暂无 |
| **右侧预览面板** | ✅ 版本管理/配置 | ✅ Preview/Diff/WebView/Device | KCode更聚焦预览 |
| **Terminal** | ✅ 中心区标签页 | ❌ MVP 不实现 | 用户通过 VS Code 原生终端代替 |
| **权限模式** | ✅ 4种模式 | ❌ 暂不实现 | 后续迭代 |
| **多Agent切换** | ✅ 多种AI | ❌ 先接一种 | 后续迭代 |
| **会话版本管理** | ✅ 时间线+Git | ❌ 暂不实现 | 后续迭代 |
| **代码编辑** | ✅ 内置编辑器 | ✅ 复用VS Code | KCode优势 |
| **文件管理** | ✅ 内置文件树 | ✅ 复用VS Code Explorer | KCode优势 |
| **顶部导航** | ✅ Logo/搜索/权限 | ❌ 无(VS Code原生标题栏) | 非必要 |
| **Web预览** | ✅ 中心区标签页 | ✅ 右侧面板 Tab | 对齐 |
| **MCP协议** | ✅ 支持 | ❌ 暂不实现 | 后续迭代 |

## 核心功能流程

### 1. 工作区管理
- **创建/打开工作区**：点击 Open Workspace → 选择本地目录 → 创建工作区
- 工作区名称基于目录名
- 数据显示在左侧栏顶部

### 2. 任务管理
- **新建任务**：点击 New Task → 输入任务标题 → 创建
- 每个任务关联一个工作区
- 任务按工作区分组展示，可折叠展开
- 任务状态: pending (默认) → active (选中后) → completed
- **点击任务** → 中间对话区加载该任务的 AI 对话

### 3. AI 对话 (基于 ACP 协议)
- 在中间区底部输入框输入需求，发送给 Agent
- KCode 作为 **ACP Client**：创建 ACP 会话 → 发送 `user_message` → 接收 `agent_message_chunk` 流式输出
- Agent 通过 ACP 协议进行 Tool calling：`read_text_file` / `write_text_file` / `list_files` 等
- KCode 实现 `ClientSideConnection` 回调：`requestPermission`、`sessionUpdate`、`writeTextFile`、`readTextFile`
- Agent 执行文件操作时，VS Code Editor 中自动同步更新
- 对话历史与 Task 绑定存储

### 4. 右侧面板预览
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
│   │   ├── openWorkspace.ts
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

## 实现顺序

### Phase 1: 项目初始化 + 三栏布局骨架
1. 用 `yo code` 或手动创建 VS Code 扩展项目
2. `KCodePanel.ts` — 在 Editor Area 创建 WebviewPanel
3. `index.html` + `style.css` — 三栏 HTML 布局（左/中/右 flex）
4. 拖拽分割条调整各栏宽度
5. 左侧栏折叠/右侧面板隐藏

### Phase 2: 数据层 + 左侧任务列表
1. `TaskStore` 持久化（工作区 + 任务 CRUD）
2. `sidebar.ts` — 渲染任务树
3. `New Task` / `Open Workspace` 命令
4. 任务分组展示、选中高亮

### Phase 3: 中间 AI 对话区
1. `chat.ts` — 消息列表 + 输入框 + 发送按钮
2. Markdown 渲染 + 代码块高亮
3. `postMessage` 通信协议 (WebView ↔ Extension)
4. 点击任务加载对应对话历史

### Phase 4: 右侧面板 (UI 先于后端)
1. `preview.ts` — Tab 切换 UI 框架
2. FilePreview Tab
3. DiffView Tab
4. WebView Tab (iframe)
5. Device Tab (telnet/ssh 远程设备 demo 展示视图)
6. 状态栏 (用户/设置)
7. 设置页面 (API Key)

### Phase 5: ACP Agent 通信 (后端功能)
1. `AcpClient.ts` — 封装 `ClientSideConnection`，实现 ACP 会话管理
2. `AgentManager.ts` — Agent 进程管理（检测本地 agent 路径、spawn 子进程、stdio 通信）
3. `callbacks.ts` — 实现 Client 回调：`readTextFile`、`writeTextFile`、`sessionUpdate`（流式更新 UI）、`requestPermission`
4. 集成到 ChatPanel：用户消息 → ACP `user_message_chunk` → 流式 `agent_message_chunk` 渲染到对话区
5. Agent 修改文件 → VS Code Editor 中实时更新

## 验证方式

1. **F5** 启动 Extension Dev Host
2. 执行 `KCode: Open` 命令 → 打开三栏 WebView
3. 左侧新建任务 → 中间对话区可交互
4. 输入消息 → Agent 流式回复
5. Agent 写文件 → VS Code 文件实时更新
6. 右侧面板 Preview/Diff/WebView/Device Tab 可切换
7. 重启后数据不丢失
