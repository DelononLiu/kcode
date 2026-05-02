# KCode — 项目指南 for AI Agents

## 项目定位

KCode 是一个 VS Code 扩展，参考 ZCode ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | VS Code Extension API (v1.96+) |
| WebView | TypeScript + HTML/CSS (Vanilla, 无框架) |
| 数据持久化 | `ExtensionContext.workspaceState` (Memento) |
| AI 通信 | ACP 协议 (`@agentclientprotocol/sdk`) |

## 项目结构

```
kcode/
├── package.json
├── tsconfig.json
├── AGENTS.md
├── resources/icon.svg              # 扩展图标
└── src/
    ├── extension.ts                 # 入口: activate/deactivate, 注册命令 + 侧边栏 Provider
    ├── kcodeView/
    │   ├── KCodePanel.ts            # WebviewPanel (编辑器区域: 聊天 + 右侧面板)
    │   ├── KCodeSidebarProvider.ts   # WebviewViewProvider (左侧 activity bar 侧边栏视图)
    │   └── webview/
    │       ├── style.css            # 全部样式
    │       ├── app.ts               # 主逻辑: 布局交互, 消息分派
    │       ├── sidebar.ts           # 左侧栏: 任务列表渲染
    │       ├── chat.ts              # 中间对话区: 消息渲染
    │       ├── preview.ts           # 右侧面板: Preview/Diff/WebView
    │       └── device.ts            # 右侧面板: Device tab
    ├── commands/
    │   ├── newTask.ts               # 新建任务 (输入标题)
    │   └── selectTask.ts
    ├── acp/
    │   ├── AcpClient.ts             # ACP ClientSideConnection 封装
    │   ├── AgentManager.ts          # Agent 子进程 spawn/管理
    │   └── callbacks.ts             # Client 回调(文件读写/权限/sessionUpdate)
    ├── store/
    │   └── TaskStore.ts             # CRUD: 任务 / 消息
    └── types/
        └── index.ts                 # Task, ChatMessage 等类型
```

---

## 核心架构

### UI 架构

采用 Hybrid 模式：**VS Code 侧边栏视图 + 编辑器面板**。

**侧边栏视图** (`KCodeSidebarProvider`)：显示在左侧 activity bar 中，包含：
- New Task 按钮
- 扁平任务列表
- 底部版本号

**编辑器面板** (`KCodePanel`)：点击侧边栏中任务后，在编辑器区域打开，包含：
- 中间 AI 对话区（消息流 + 输入框）
- 右侧面板（Preview | Diff | WebView | Device）

```
┌───────────────────────────────────────────────────────────────────┐
│ VS Code Activity Bar         │  Editor Area: KCodePanel           │
│                              │                                    │
│  ● Explorer                  │  ┌────────────────────────┬──────┐ │
│  ● Search                    │  │  Chat Messages         │Preview│ │
│  ● KCode  (selected)         │  │  User: xxx             │Diff   │ │
│    ────────────              │  │  Agent: yyy            │WebView│ │
│    [+ New Task]              │  │  ```code```            │Device │ │
│    ────────────              │  │                        │       │ │
│    ○ Task1                   │  │  [input...]   [发送]   │       │ │
│    ○ Task2                   │  └────────────────────────┴──────┘ │
│    ○ Task3                   │                                    │
└───────────────────────────────────────────────────────────────────┘
```

### 数据流

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

### WebView ↔ Extension 通信协议

**WebView → Extension** (postMessage):
- `{ type: 'newTask' }` — 创建任务
- `{ type: 'selectTask', taskId }` — 选中任务
- `{ type: 'sendMessage', text, taskId }` — 发送消息给 Agent
- `{ type: 'openSettings' }` — 打开设置

**Extension → WebView** (webview.postMessage):
- `{ type: 'updateTaskList', tasks: [...] }` — 刷新任务列表
- `{ type: 'loadMessages', messages: [...] }` — 加载对话历史
- `{ type: 'agentStreamUpdate', text: string }` — Agent 流式回复
- `{ type: 'agentStatus', status, message }` — Agent 连接状态
- `{ type: 'showFilePreview', filePath, content }` — 文件预览
- `{ type: 'showDiff', original, modified }` — 差异对比
- `{ type: 'showWebView', url }` — 嵌入网页
- `{ type: 'deviceConnect', host, port, connectionType }` — 远程设备

### ACP 通信架构

```
KCode (ACP Client)                    Agent (ACP Agent)
      │                                      │
      ├── initialize() ─────────────────────►│
      │◄─ {capabilities} ───────────────────┤
      │                                      │
      ├── session_new() ───────────────────►│
      │◄─ session_id ───────────────────────┤
      │                                      │
      ├── prompt(text) ────────────────────►│
      │◄─ agent_message_chunk (流式) ───────┤
      │◄─ tool_call (读/写文件等) ──────────┤
      │  ├─ Client 执行并返回结果 ──────────►│
      │◄─ agent_message_chunk (继续) ───────┤
      │◄─ stop_reason ──────────────────────┤
```

---

## 关键实现细节

### TaskStore 存储结构

```typescript
tasks      → Task[]                // key: 'tasks'
messages   → ChatMessage[]         // key: `messages_${taskId}`
```

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

## 构建与调试

```bash
npm run compile       # 编译 TypeScript → out/
npm run watch         # 监听模式自动编译
npx tsc --noEmit      # 仅类型检查
```

调试配置在 `.vscode/launch.json`:
- **Run Extension**: F5 启动，先编译再打开扩展开发窗口
- **Run Extension (Watch)**: 以 watch 模式启动

F5 后，左侧 activity bar 出现 KCode 图标，点击图标显示侧边栏视图。
`Ctrl+Shift+P` → `KCode: Open` 聚焦侧边栏。
在侧边栏点击任务 → 编辑器区域打开聊天面板。

---

## 开发流程 (Agent 工作流)

每次开发任务按以下步骤执行：

```
1. 更新文档 ── 先阅读 AGENTS.md 和 KCODE_MVP.md，必要时更新 AGENTS.md
2. 指定计划 ── 用 EnterPlanMode 探索代码，设计实现方案，待用户确认后实施
3. 实现     ── 按计划编写代码，编译通过 (npm run compile)
4. 验收     ── 验证构建成功，确认改动符合预期
5. 再次更新 ── 如果项目结构/接口/流程有变化，更新 AGENTS.md
```

### 各步骤说明

**步骤 1 — 更新文档**
- 先阅读 `AGENTS.md`（本项目指南）和 `KCODE_MVP.md`（MVP 功能规格）
- 如果任务涉及本项目指南未覆盖的内容，先补充 `AGENTS.md`
- 目的是让 Agent 在动代码前对项目有完整理解

**步骤 2 — 指定计划**
- 使用 `EnterPlanMode` 工具进入计划模式
- 探索相关代码文件，理解现有实现
- 设计实现方案，写 plan 文件
- 调用 `ExitPlanMode` 让用户确认计划

**步骤 3 — 实现**
- 按用户确认的计划编写代码
- 确保 `npm run compile` 编译通过，无类型错误
- 遵循"开发约定"中的规范

**步骤 4 — 验收**
- `npm run compile` 确保零错误
- 检查改动的完整性：新增/修改的文件是否正确
- 如果涉及 UI 变化，说明 F5 后如何验证

**步骤 5 — 再次更新文档**
- 如果项目结构有变化（新增/移动/删除文件），更新 `AGENTS.md` 的项目结构图
- 如果新增了通信消息类型，更新 WebView ↔ Extension 通信协议部分
- 如果新增了命令或接口，更新常见操作指引
- 确保 `AGENTS.md` 始终反映项目最新状态

---

## 开发约定

1. **不要引入 UI 框架** — WebView 使用 Vanilla JS，保持轻量
2. **不要添加多余的 error handling** — 只在系统边界（用户输入、外部 API）做校验
3. **不要写注释** — 除非有非显而易见的 WHY（隐藏约束、微妙的不变性、特定 bug 的 workaround）
4. **消息类型需同步更新** — 新增 `postMessage` 类型时，同时在 `app.ts` 的 `initMessageHandler` 中注册处理器
5. **数据存储用 `workspaceState`** — 不要用文件系统存储，不要用全局变量持久化
6. **ACP Client 回调 auto-accept 权限** — MVP 阶段不做权限 UI

---

## 常见操作指引

### 新增一个命令

1. 在 `src/commands/` 下新建文件，导出一个 async 函数
2. 在 `package.json` 的 `contributes.commands` 中注册
3. 在 `src/extension.ts` 中 `vscode.commands.registerCommand` 并 push 到 `context.subscriptions`

### 新增 WebView 消息类型

1. Extension → WebView：在 `KCodePanel.ts` 中调用 `webview.postMessage`，在 `app.ts` 的 `switch` 中添加 case
2. WebView → Extension：在 WebView 中调用 `vscode.postMessage`，在 `KCodePanel` 的 `setupMessageHandler` switch 中添加 case

### 新增右侧面板 Tab

1. 在 `KCodePanel.ts` 的 `getWebviewContent()` HTML 中添加 tab 按钮和 tab-content 容器
2. 新建 `src/kcodeView/webview/xxx.ts` 实现渲染逻辑
3. 在 `preview.ts` 或新建文件中暴露全局函数，在 `app.ts` 消息处理中调用
4. 在 `style.css` 中添加对应样式
