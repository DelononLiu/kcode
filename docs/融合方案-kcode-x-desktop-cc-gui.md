# KCode × desktop-cc-gui 融合方案

> **形式**：VS Code 扩展
>
> **原则**：Webview 只负责 AI 工作台，VS Code 负责编辑器（文件、Git、终端、设置等原生功能各司其职）
>
> **目标**：将 desktop-cc-gui 的 React AI 功能 UI 作为 VS Code Webview 基座，融合 kcode 的 5 阶段管线、ACP Agent 接入、小助手、知识库，构建专业级的 VS Code AI 工程工作台。

---

## 1. 核心原则：各司其职

```
VS Code 原生提供                           kcode Webview 提供
(不进 Webview)                             (AI 专用功能)
┌─────────────────────────┐               ┌──────────────────────────────┐
│ 文件浏览器 (explorer)    │               │ AI 对话 (Composer + Threads) │
│ 代码编辑 + Diff          │               │ 消息渲染 (Markdown/工具块等) │
│ Git 面板 (Source Control)│               │ 任务看板 (Kanban)           │
│ 内置终端                 │               │ 计划面板 (Plan)             │
│ 设置 (settings.json)     │               │ 知识库 (Project Memory)     │
│ 搜索                     │               │ 引擎选择/状态 (Engine)       │
│ 调试器                   │               │ Agent 编排                  │
│ 通知                     │               │ 上下文审计 (Context Ledger)  │
└─────────────────────────┘               │ ACP 通信日志                │
                                           │ 5 阶段管线可视化            │
                                           │ 会话管理                    │
                                           │ 状态面板                    │
                                           └──────────────────────────────┘
```

这个模式即 **Copilot Chat** 的架构——VS Code 做编辑器，AI 面板做对话和辅助。

---

## 2. 全景架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                            │
│                                                                          │
│  ┌──────────────────────────────┐    ┌────────────────────────────────┐ │
│  │  kcode 核心服务               │    │  VS Code API 利用              │ │
│  │                              │    │                                │ │
│  │  AgentService + AcpClient    │    │  workspace.fs  ← 文件操作      │ │
│  │  TaskFlow (5阶段管线)         │    │  Git extension  ← Git 操作     │ │
│  │  ConfigService               │    │  createTerminal ← 终端         │ │
│  │  KnowledgeStore              │    │  showTextDocument ← 打开文件   │ │
│  │  PluginManager               │    │  commands.executeCommand       │ │
│  │  CommandRegistry             │    │  window.showXxx ← 对话框       │ │
│  │  AssistantHandler            │    │  context.state  ← 持久化存储   │ │
│  └─────────────┬────────────────┘    └────────────────────────────────┘ │
│                │                                                         │
│                ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  WebviewBridge.ts              ← 扩展端消息路由                      │ │
│  │                                                                     │ │
│  │  commands:                    handlers:                              │ │
│  │  engine/connect              → AgentService.connectByLabel()         │ │
│  │  engine/sendMessage          → AgentService.sendMessage()            │ │
│  │  engine/interrupt            → AgentService.disconnect()             │ │
│  │  taskflow/processChunk       → TaskFlow.processChunk()               │ │
│  │  taskflow/updatePhase        → TaskFlow → onPhaseChanged             │ │
│  │  knowledge/read              → KnowledgeStore.getAllEntries()        │ │
│  │  knowledge/write             → KnowledgeStore.addEntry()             │ │
│  │  store/get                   → context.workspaceState.get()          │ │
│  │  store/set                   → context.workspaceState.update()       │ │
│  │  editor/getContext           → vscode.window.activeTextEditor        │ │
│  │  editor/openFile             → vscode.window.showTextDocument()      │ │
│  └──────────────────────────┬──────────────────────────────────────────┘ │
│                             │                                            │
│                             │ postMessage / onDidReceiveMessage         │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    VS Code Webview（浏览器环境）                           │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  desktop-cc-gui React 18 + TypeScript + Vite (AI 功能子集)       │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  AI 对话系统                                              │   │   │
│  │  │                                                          │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │   │   │
│  │  │  │ threads/   │  │ composer/  │  │ messages/        │   │   │   │
│  │  │  │ 会话管理   │  │ 输入框     │  │ 消息渲染         │   │   │   │
│  │  │  │            │  │ slash cmd  │  │ LiveMarkdown     │   │   │   │
│  │  │  │            │  │ 附件       │  │ Mermaid/工具卡片  │   │   │   │
│  │  │  └────────────┘  └────────────┘  │ 流式渲染/推理    │   │   │   │
│  │  │                                  └──────────────────┘   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  AI 任务管理                                              │   │   │
│  │  │                                                          │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │   │   │
│  │  │  │ kanban/    │  │ tasks/     │  │ plan/            │   │   │   │
│  │  │  │ 看板      │  │ 任务记录   │  │ 计划面板         │   │   │   │
│  │  │  └────────────┘  └────────────┘  └──────────────────┘   │   │   │
│  │  │                                                          │   │   │
│  │  │  ┌──────────────────────────────────────────────────┐   │   │   │
│  │  │  │ 5 阶段管线可视化 (kcode TaskFlow 映射)             │   │   │   │
│  │  │  │ Goal → Plan → Execute → SelfVerify → Review      │   │   │   │
│  │  │  └──────────────────────────────────────────────────┘   │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  AI 基础能力                                              │   │   │
│  │  │                                                          │   │   │
│  │  │  engine/           ← 引擎选择/状态 (Claude/Codex等)       │   │   │
│  │  │  project-memory/   ← 知识库                              │   │   │
│  │  │  agent-orchestration/ ← 任务编排                         │   │   │
│  │  │  context-ledger/   ← 上下文审计                          │   │   │
│  │  │  status-panel/     ← AI 运行状态                         │   │   │
│  │  │  session-activity/ ← 会话活动记录                        │   │   │
│  │  │  notifications/    ← AI 通知                             │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │  通用支撑                                                │   │   │
│  │  │                                                          │   │   │
│  │  │  components/ui/     ← shadcn 组件库                       │   │   │
│  │  │  styles/            ← CSS 主题系统                       │   │   │
│  │  │  services/bridge.ts ← VS Code 桥接层                      │   │   │
│  │  │  layout/            ← 布局管理                           │   │   │
│  │  │  app/               ← 应用壳                             │   │   │
│  │  │  i18n/              ← 国际化                             │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 职责边界：什么进 Webview，什么不进

### 3.1 不进 Webview（用 VS Code 原生）

| 功能 | VS Code 实现 | 原因 |
|---|---|---|
| 文件浏览/编辑 | `explorer` + `vscode.diff` | VS Code 的文件编辑能力远强于任何自定义实现 |
| Git 操作 | `Source Control` + Git extension | `git add/commit/push/branch/diff` 全部原生支持 |
| 终端 | `vscode.window.createTerminal` | 成熟稳定的 PTY 实现 |
| 设置 | `settings.json` + Settings UI | VS Code 的设置 UI 完善，且扩展可以贡献配置项 |
| 搜索/替换 | `Search` view | 全文搜索、正则、文件类型过滤 |
| 通知 | `vscode.window.showXxxMessage` | 原生通知，不会和 VS Code 其他通知割裂 |

**交互方式**：Webview 内的操作直接调用 `vscode.commands.executeCommand()`，不需要经过 bridge。

```typescript
// 示例：Webview 中打开文件
// 不需要 fs 命令，不需要 git 命令
executeCommand('vscode.open', Uri.file(filePath));
executeCommand('git.commit');
executeCommand('workbench.view.explorer');
```

### 3.2 进 Webview（VS Code 没有的 AI 功能）

| Feature | 来源 | 功能描述 |
|---|---|---|
| `threads/ + composer/ + messages/` | desktop-cc-gui | AI 对话系统（富文本输入、流式渲染、工具调用卡片、Mermaid、推理展示） |
| `kanban/` | desktop-cc-gui | AI 任务看板（todo → inprogress → testing → done） |
| `tasks/` | desktop-cc-gui | AI 任务运行记录、状态、诊断 |
| `plan/` | desktop-cc-gui | AI 计划面板 |
| `engine/` | desktop-cc-gui | AI 引擎选择/状态/能力矩阵 |
| `project-memory/` | desktop-cc-gui | 知识库（多类型语义记忆） |
| `agent-orchestration/` | desktop-cc-gui | AI 任务编排 |
| `context-ledger/` | desktop-cc-gui | AI 上下文来源/成本审计 |
| `status-panel/` | desktop-cc-gui | AI 运行状态面板 |
| `session-activity/` | desktop-cc-gui | AI 会话活动记录/导航 |
| `notifications/` | desktop-cc-gui | AI 操作通知 |
| `app/ + layout/` | desktop-cc-gui | 应用壳和布局管理 |
| `home/` | desktop-cc-gui | 首页视图 |
| 5 阶段管线可视化 | kcode | Goal→Plan→Execute→SelfVerify→Review 流程 |
| ACP 日志面板 | kcode | ACP 协议通信日志 |
| Setup Wizard | kcode | 首次使用引导 |

### 3.3 弃用（VS Code 有更好替代，或与核心无关）

| Feature | 原因 |
|---|---|
| `files/` | VS Code explorer + editor |
| `git/` + `git-history/` | VS Code Source Control + timeline |
| `terminal/` | VS Code 内置终端 |
| `settings/` | VS Code settings.json |
| `search/` | VS Code search |
| `update/` | VS Code 扩展更新机制 |
| `startup-orchestration/` | Tauri 启动逻辑，VS Code 不需要 |
| `collaboration/` | 协作模式，后续考虑 |
| `dictation/` | 语音输入，非核心 |
| `codex/` + `opencode/` | 单一引擎，通过 engine 通用层覆盖 |
| `spec/` + `governance/` | OpenSpec 规范，可选保留 |
| `parallel/` | 并行任务，可选 |
| `note-cards/` | Note Card，可选 |
| `live-edit-preview/` | 预览，VS Code 有原生 |
| `client-documentation/` | 文档视图，可选 |
| `browser-agent/` + `computer-use/` | 浏览器代理，可选保留 |
| `about/` | 关于页，可选 |

---

## 4. 通信架构 (Bridge)

因为文件/Git/终端/对话框等功能全部用 VS Code 原生实现，Webview 和扩展宿主之间的通信**简化到只传递 AI 相关数据**：

### 4.1 消息类型

```
Webview → Extension Host（请求式）:
  engine/connect              → AgentService.connectByLabel()
  engine/disconnect           → AgentService.disconnect()
  engine/sendMessage          → AgentService.sendMessage()
  engine/interrupt            → AgentService.disconnect()
  engine/getStatus            → AgentService.isConnected / agentName
  engine/getModels            → ConfigService.get('model')

  taskflow/init               → TaskFlow.loadTask()
  taskflow/processChunk       → TaskFlow.processChunk()
  taskflow/getInfo            → TaskFlow → sendTaskInfo()
  taskflow/updatePhase        → TaskFlow → onPhaseChanged
  taskflow/updateGoal         → store.updateTaskGoal()
  taskflow/updatePlan         → store.updatePlanSteps()
  taskflow/executeAck         → TaskFlow execute 确认
  taskflow/selfVerifyAck      → TaskFlow self_verify 确认
  taskflow/reviewAck          → TaskFlow review 确认

  knowledge/list              → store.getAllKnowledgeEntries()
  knowledge/add               → store.addKnowledgeEntry()
  knowledge/update            → store.updateKnowledgeEntry()
  knowledge/delete            → store.deleteKnowledgeEntry()
  knowledge/getByTask         → store.getTaskKnowledgeEntries()

  store/get                   → context.workspaceState.get()
  store/set                   → context.workspaceState.update()

  editor/getSelection         → vscode.window.activeTextEditor.selection
  editor/getDocument          → vscode.workspace.openTextDocument()
  editor/getActiveFilePath    → vscode.window.activeTextEditor.document.uri

  config/get                  → ConfigService.get()
  config/set                  → ConfigService.set()


Extension Host → Webview（推送式）:
  stream:chunk                → 流式消息文本
  stream:done                 → 流式结束
  stream:thinking             → 推理过程
  stream:tool_call            → 工具调用状态
  engine:status               → 连接状态变更
  taskflow:phase_changed      → 阶段变更通知
  taskflow:plan_proposed      → 计划提案
  taskflow:execute_finished   → 执行完成
  knowledge:updated           → 知识条目变更
```

### 4.2 Bridge 实现

```typescript
// webview/services/bridge.ts — Webview 侧桥接层
class VSCODE_BRIDGE {
  private pending = new Map<string, { resolve, reject }>();
  private msgId = 0;
  private listeners = new Map<string, Set<Function>>();

  constructor() {
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (!msg?.type) return;

      if (msg.type === 'bridge:result') {
        const pending = this.pending.get(msg.id);
        if (pending) {
          msg.error ? pending.reject(msg.error) : pending.resolve(msg.result);
          this.pending.delete(msg.id);
        }
        return;
      }

      if (msg.type === 'bridge:event') {
        const handlers = this.listeners.get(msg.event);
        handlers?.forEach(fn => fn(msg.data));
      }
    });
  }

  /** 请求式：调用扩展侧方法，等待返回 */
  async invoke(method: string, ...params: unknown[]): Promise<unknown> {
    const id = `br_${++this.msgId}`;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      acquireVsCodeApi().postMessage({ type: 'bridge:invoke', id, method, params });
    });
  }

  /** 推送式：订阅扩展侧事件 */
  on(event: string, handler: (data: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Function) {
    this.listeners.get(event)?.delete(handler);
  }
}

export const bridge = new VSCODE_BRIDGE();
```

```typescript
// adapters/WebviewBridge.ts — 扩展侧消息路由
export class WebviewBridge {
  private handlers = new Map<string, (params: unknown[]) => Promise<unknown>>();

  constructor(private panel: vscode.WebviewPanel, private services: ServiceContainer) {
    this.registerHandlers();
    this.panel.webview.onDidReceiveMessage(this.onMessage);
  }

  private registerHandlers() {
    this.register('engine/connect',    ([label]) => this.services.agent.connectByLabel(label));
    this.register('engine/sendMessage',([msg])   => this.services.agent.sendMessage(msg));
    this.register('engine/interrupt',  ()        => this.services.agent.disconnect());
    this.register('engine/getStatus',  ()        => ({
      connected: this.services.agent.isConnected,
      agentName: this.services.agent.agentName,
      modelName: this.services.agent.modelName,
      lastError: this.services.agent.lastError,
    }));
    // ...
  }

  /** 向 Webview 推送事件 */
  emit(event: string, data: unknown) {
    this.panel.webview.postMessage({ type: 'bridge:event', event, data });
  }

  private onMessage = async (msg: any) => {
    if (msg.type !== 'bridge:invoke') return;
    const handler = this.handlers.get(msg.method);
    if (!handler) {
      this.panel.webview.postMessage({ type: 'bridge:result', id: msg.id, error: `unknown method: ${msg.method}` });
      return;
    }
    try {
      const result = await handler(msg.params);
      this.panel.webview.postMessage({ type: 'bridge:result', id: msg.id, result });
    } catch (err) {
      this.panel.webview.postMessage({ type: 'bridge:result', id: msg.id, error: String(err) });
    }
  };

  private register(method: string, handler: (params: unknown[]) => Promise<unknown>) {
    this.handlers.set(method, handler);
  }
}
```

---

## 5. 项目结构（融合后）

```
kcode-vscode-extension/
│
├── package.json                        ← VS Code 扩展清单
├── tsconfig.json
├── vite.config.ts                      ← Vite 构建 Webview
├── scripts/
│   ├── build-webview.js                ← 打包 webview bundle
│   └── dev.js                          ← 开发脚本
│
├── src/
│   ├── extension.ts                    ← VS Code 扩展入口 (保留 kcode 现有)
│   │
│   ├── core/                           ← kcode 核心服务 (保留)
│   │   ├── AgentService.ts
│   │   ├── AgentConfigManager.ts
│   │   ├── ConfigService.ts
│   │   └── plugin/
│   │
│   ├── taskflow/                       ← 5 阶段管线 (保留)
│   │   ├── TaskFlow.ts
│   │   ├── prompts/
│   │   └── templates/
│   │
│   ├── store/                          ← 数据存储 (保留)
│   │   ├── TaskStore.ts
│   │   └── ProjectFs.ts
│   │
│   ├── acp/                            ← ACP 协议客户端 (保留)
│   │   └── AcpClient.ts
│   │
│   ├── adapters/                       ← ★ 新增：扩展侧适配层
│   │   ├── WebviewBridge.ts            ←  消息路由
│   │   ├── EngineAdapter.ts            ←  Engine → AgentService
│   │   ├── StorageAdapter.ts           ←  存储 → context.state
│   │   └── EditorAdapter.ts            ←  编辑器上下文获取
│   │
│   ├── view/                           ← VS Code 扩展视图 (精简)
│   │   ├── Panel.ts                    ←  主 Webview Panel (重构)
│   │   ├── SidebarProvider.ts          ←  侧边栏
│   │   ├── SettingsProvider.ts         ←  设置面板 (如需要)
│   │   └── templates/
│   │       └── webviewHtml.ts          ←  Webview HTML 模板
│   │
│   ├── commands/                       ← VS Code 命令注册 (保留/扩展)
│   │   └── index.ts
│   │
│   ├── env/                            ← 环境管理 (保留)
│   │   └── NodeManager.ts
│   │
│   └── webview/                        ← ★ desktop-cc-gui AI 功能前端
│       ├── index.html
│       ├── main.tsx                    ← React 入口
│       ├── App.tsx
│       ├── router.tsx
│       ├── bootstrap.ts                ← 启动 (去 Tauri 化)
│       │
│       ├── features/                   ← 仅 AI 相关 features
│       │   ├── threads/                ← 对话管理
│       │   ├── composer/               ← 输入框
│       │   ├── messages/               ← 消息渲染
│       │   ├── kanban/                 ← 看板
│       │   ├── tasks/                  ← 任务记录
│       │   ├── plan/                   ← 计划
│       │   ├── engine/                 ← 引擎选择/状态
│       │   ├── project-memory/         ← 知识库
│       │   ├── agent-orchestration/    ← 任务编排
│       │   ├── context-ledger/         ← 审计
│       │   ├── status-panel/           ← 状态面板
│       │   ├── session-activity/       ← 会话活动
│       │   ├── notifications/          ← 通知
│       │   ├── home/                   ← 首页
│       │   ├── app/                    ← 应用壳
│       │   ├── layout/                 ← 布局
│       │   ├── shared/                 ← 跨 feature 共享
│       │   └── about/                  ← 关于
│       │
│       ├── components/                 ← 通用 UI 组件
│       │   ├── ui/                     ← shadcn/ui 组件
│       │   └── common/
│       │
│       ├── services/                   ← ★ 适配服务层
│       │   ├── bridge.ts               ← VS Code Bridge 核心
│       │   └── clientStorage.ts        ← 改为 VS Code state
│       │
│       ├── hooks/                      ← 全局 hooks
│       ├── styles/                     ← CSS 主题 (desktop-cc-gui)
│       ├── lib/                        ← 工具库
│       ├── types.ts                    ← 类型定义
│       ├── i18n/                       ← 国际化
│       └── utils/                      ← 工具函数
│
├── resources/                          ← 图标等资源
│
└── __tests__/
```

---

## 6. 核心适配细节

### 6.1 Engine → AgentService（AI 引擎选择）

desktop-cc-gui 的 `features/engine/` 有引擎选择器、状态指示、能力矩阵。
kcode 有 `AgentService` 通过 ACP 协议连接 agent。

**适配方式**：

```
desktop-cc-gui engine UI        bridge           kcode AgentService
┌────────────────────┐                          ┌─────────────────────┐
│ EngineSelector     │  invoke("engine/connect")│                     │
│  └─ Claude Code   │ ────────────────────────► │ connectByLabel()    │
│  └─ Codex CLI     │                          │                     │
│  └─ Kilo          │                          │ sendMessage()       │
│  └─ OpenCode      │                          │ disconnect()        │
│                    │  ◄─ engine:status event  │ isConnected         │
│ EngineStatusPanel  │ ──────────────────────── │ agentName           │
└────────────────────┘                          └─────────────────────┘
```

### 6.2 Threads/Composer/Messages → 小助手

desktop-cc-gui 的 `threads` + `composer` + `messages` 构成完整的 AI 对话 UI。
kcode 的 `AssistantHandler` 是后端逻辑。

```
Bridge 消息流:
  user 输入  →  composer/ChatInputBox
              →  bridge.invoke("engine/sendMessage", text)
              →  kcode AgentService.sendMessage(text)
              →  streaming response
              →  bridge.emit("stream:chunk", text)
              →  messages/LiveMarkdown 实时渲染

  工具调用:
              →  bridge.emit("stream:tool_call", {name, args, result})
              →  messages/tool-call cards 渲染
```

**消息类型映射**：

| desktop-cc-gui 消息 | kcode 概念 | 桥梁处理 |
|---|---|---|
| `user_message` | `user` role message | 直接传递 |
| `assistant_message` + streaming | `agent` role + stream | stream:chunk → LiveMarkdown |
| `tool_call` block | `tool` role | tool_call card |
| `thinking` block | thinking block | 推理过程展示 |
| `tool_result` | tool 执行结果 | tool 卡片结果展示 |

### 6.3 Kanban/Plan → 5 阶段管线

desktop-cc-gui 的 Kanban 有 `todo → inprogress → testing → done`。
kcode 的 TaskFlow 有 `goal → plan → execute → self_verify → review`。

**状态映射**：

| Kanban 状态 | TaskFlow 阶段 | 图示 |
|---|---|---|
| `todo` | `goal` + `plan` | 目标确认 → 计划制定 |
| `inprogress` | `execute` | AI 执行中 |
| `testing` | `self_verify` | AI 自我验证 |
| `done` | `review` | 人工验收 |

**数据流**：

```
看板卡片拖动                    bridge                   TaskFlow
┌────────────┐                                         ┌────────────────┐
│ todo →     │  invoke("taskflow/updatePhase")          │ onPhaseChanged │
│ inprogress │ ──────────────────────────────────────► │ processChunk() │
└────────────┘                                         │ parseTaskUpd.  │
       │                                                └────────────────┘
       │ taskflow:phase_changed event                        │
       │ ◄───────────────────────────────────────────────────┘
       ▼
┌────────────┐
│ 看板更新    │
│ 消息渲染    │
└────────────┘
```

### 6.4 Project Memory → 知识库

desktop-cc-gui 的 `project-memory` 是多类型语义记忆系统。
kcode 的 `KnowledgeStore` 是知识条目管理。

```
project-memory UI          bridge              kcode KnowledgeStore
┌──────────────────┐                         ┌────────────────────────┐
│ ProjectMemory    │  invoke("knowledge/list")│ getAllKnowledgeEntries│
│ MemoryPanel      │ ◄──────────────────────► │ addEntry()            │
│ MemoryPicker     │                         │ updateEntry()         │
│ MemoryEditor     │                         │ deleteEntry()         │
└──────────────────┘                         │ getByTask()           │
                                             └────────────────────────┘
```

kcode 现有的 `KnowledgePanel`（独立的 WebviewPanel）**废弃**，功能合并到 desktop-cc-gui 的 ProjectMemoryPanel 中。

### 6.5 编辑器上下文集成

这是 VS Code 插件独有的优势——Webview 可以直接获取编辑器状态传给 AI。

```typescript
// adapters/EditorAdapter.ts
export class EditorAdapter {
  getSelection(): string | null {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return null;
    return editor.document.getText(editor.selection);
  }

  getActiveFilePath(): string | null {
    return vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
  }

  getFileContent(filePath: string): Promise<string> {
    return vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
      .then(bytes => new TextDecoder().decode(bytes));
  }

  /** Webview 请求编辑器上下文时调用 */
  async getContext(): Promise<EditorContext> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { type: 'no_editor' };
    return {
      type: 'editor',
      filePath: editor.document.uri.fsPath,
      language: editor.document.languageId,
      selection: editor.document.getText(editor.selection),
      contextBefore: editor.document.getText(
        new vscode.Range(Math.max(0, editor.selection.start.line - 20), 0, editor.selection.start.line, 0)
      ),
      contextAfter: editor.document.getText(
        new vscode.Range(editor.selection.end.line, 0, Math.min(editor.document.lineCount - 1, editor.selection.end.line + 20), 0)
      ),
    };
  }
}
```

### 6.6 VS Code 原生功能调用

Webview 内直接调 VS Code 命令打开文件/Git/终端等：

```typescript
// 在 webview 的合适位置
// 打开文件（代替 files/ feature）
const openFile = (path: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'vscode.open',
    args: [Uri.file(path)]
  });
};

// 查看 Git Diff（代替 git/ feature）
const showGitDiff = (filePath: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'vscode.diff',
    args: [oldUri, newUri, title]
  });
};

// 打开终端（代替 terminal/ feature）
const openTerminal = (cwd: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'workbench.action.terminal.new',
    args: [{ cwd }]
  });
};
```

---

## 7. 融合后的用户视角

```
VS Code 窗口
┌─────────────────────────────────────────────────────────────────┐
│  File  Edit  Selection  View  Go  Run  Terminal  Help  KCode   │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                      │
│ Explorer │  ┌──────────────────────────────────────────────────┐ │
│          │  │  kcode Webview Panel                            │ │
│ src/     │  │                                                  │ │
│  ├─ app/ │  │  [Claude Code ●]  [⚙️ 引擎] [📋 任务] [📚 知识]  │ │
│  ├─ comp │  │                                                  │ │
│  └─ feat │  │  ┌──────────────────────────────────────────────┐ │ │
│          │  │  │  用户: 优化这个函数的性能                     │ │ │
│          │  │  │  ──────────────────────────────────────────── │ │ │
│ SOURCE   │  │  │  Agent:                                      │ │ │
│ CONTROL  │  │  │  ┌─ 推理过程 ──────────────────────────┐    │ │ │
│          │  │  │  │ 正在分析函数的复杂度...               │    │ │ │
│          │  │  │  └────────────────────────────────────┘    │ │ │
│          │  │  │                                             │ │ │
│          │  │  │  分析发现该函数有 O(n²) 复杂度，建议改为    │ │ │
│          │  │  │  哈希表查找方案：                            │ │ │
│          │  │  │                                             │ │ │
│          │  │  │  ┌─ 🛠 编辑文件 ───────────────────────┐    │ │ │
│          │  │  │  │ src/utils/search.ts                 │    │ │ │
│          │  │  │  │ +25 / -8 行                        │    │ │ │
│          │  │  │  │ [📂 打开文件] [📊 查看 Diff]        │    │ │ │
│          │  │  │  └────────────────────────────────────┘    │ │ │
│          │  │  │                                             │ │ │
│          │  │  │  ═══ 执行完成 ═══                           │ │ │
│          │  │  │  [🔁 重新执行] [✅ 自验通过] [🏁 人工验收]  │ │ │
│          │  │  │                                             │ │ │
│          │  │  └──────────────────────────────────────────────┘ │ │
│          │  └──────────────────────────────────────────────────┘ │
├──────────┴──────────────────────────────────────────────────────┤
│  TERMINAL                                                       │
└─────────────────────────────────────────────────────────────────┘
```

用户操作流程示例：

1. 用户在 VS Code 中打开文件，选中一段代码
2. 在 kcode Webview 面板中输入"优化这个函数的性能"
3. AI 回复分析结果，建议修改方案
4. 用户点击工具卡片中的 **📂 打开文件** → VS Code 打开该文件
5. 用户点击 **📊 查看 Diff** → VS Code 显示 Diff 视图
6. AI 执行完后，用户点击 **✅ 自验通过** → 自动切换到下一阶段
7. Git 操作直接在 VS Code 的 Source Control 面板完成

**VS Code 原生能力和 AI 能力无缝衔接，用户不需要切换上下文。**

---

## 8. 实施步骤

### Phase 1：项目骨架

```
1. 创建 kcode-vscode-extension 项目目录
2. 配置 package.json (VS Code 扩展清单)
3. 配置 Vite (输出 iife 格式供 Webview)
4. 复制 kcode 现有 extension.ts + 核心服务
5. 实现最小 Webview：
   - main.tsx → React 入口
   - App.tsx + router.tsx
   - bridge.ts (前端侧) + WebviewBridge.ts (扩展侧)
6. 验证: "Hello World" React 在 VS Code Webview 中渲染
```

### Phase 2：核心 AI 对话

```
7. 迁移 desktop-cc-gui 的:
   - styles/ (70+ CSS 文件，精简到 AI 相关)
   - components/ui/ (shadcn 组件)
   - features/layout/ + features/app/ (应用壳)
   - features/threads/ (对话管理)
   - features/composer/ (输入框)
   - features/messages/ (消息渲染)
8. 实现 EngineAdapter (engine ↔ AgentService)
9. 对接 ACP 通信流程
10. 验证: 对话功能正常工作 (发送消息→流式渲染→工具调用展示)
```

### Phase 3：任务管线

```
11. 迁移 features/kanban/、features/tasks/、features/plan/
12. 实现 kanban 状态 → TaskFlow 阶段映射
13. 实现 5 阶段管线可视化
14. 验证: 创建任务 → 走完 goal→plan→execute→verify→review
```

### Phase 4：知识库

```
15. 迁移 features/project-memory/
16. 对接 kcode KnowledgeStore
17. 废弃 kcode 现有 KnowledgePanel (独立 Webview)
18. 验证: 知识条目 CRUD + 关联任务 + 对话中引用
```

### Phase 5：编辑器集成 + AI 编排

```
19. 实现 EditorAdapter (选中代码、文件上下文)
20. 迁移 features/engine/ (引擎选择)、features/status-panel/、features/notifications/
21. 迁移 features/agent-orchestration/ (任务编排)
22. 迁移 features/context-ledger/ (上下文审计)
23. 迁移 features/session-activity/ (会话管理)
24. 迁移 kcode 的 Setup Wizard + ACP 日志
25. 验证: 完整工作流
```

---

## 9. 关键技术决策

### 9.1 Webview 格式

VS Code Webview 不支持浏览器原生 ESM，Vite 需要输出 IIFE：

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    outDir: 'out/webview',
    rollupOptions: {
      input: 'src/webview/index.html',
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
});
```

### 9.2 主题适配

desktop-cc-gui 有完整 CSS 主题系统。在 Webview 中通过 `data-vscode-theme-kind` 适配：

```typescript
// webview/bootstrap.ts
const updateTheme = () => {
  const kind = document.body.getAttribute('data-vscode-theme-kind');
  document.documentElement.setAttribute('data-theme', kind === 'dark' ? 'dark' : 'light');
};
const observer = new MutationObserver(updateTheme);
observer.observe(document.body, { attributes: true, attributeFilter: ['data-vscode-theme-kind'] });
updateTheme();
```

### 9.3 消息流式传输

AI 回复是流式的，使用 bridge event 推送：

```typescript
// 扩展侧
acpClient.onChunk((text) => {
  bridge.emit('stream:chunk', { taskId, text, phase: currentPhase });
});
bridge.emit('stream:done', { taskId });

// Webview 侧
bridge.on('stream:chunk', ({ text }) => {
  liveMarkdown.append(text); // 实时渲染
});
```

### 9.4 命令注册

扩展侧注册 VS Code 命令，供 Webview 调用：

```typescript
// commands/index.ts
export function registerCommands(context: vscode.ExtensionContext, services: ServiceContainer) {
  context.subscriptions.push(
    vscode.commands.registerCommand('kcode.openAI', () => { /* 打开 Webview */ }),
    vscode.commands.registerCommand('kcode.explainCode', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      // 发送到 AI
    }),
    vscode.commands.registerCommand('kcode.openFileInEditor', (filePath: string) => {
      vscode.window.showTextDocument(vscode.Uri.file(filePath));
    }),
    vscode.commands.registerCommand('kcode.showGitDiff', (oldUri, newUri, title) => {
      vscode.commands.executeCommand('vscode.diff', oldUri, newUri, title);
    }),
    // ...
  );
}
```

---

## 10. 融合前后对比

| 维度 | 当前 kcode | 融合后 |
|---|---|---|
| **UI 框架** | 手写 vanilla JS + DOM 操作 | React 18 + shadcn 专业组件库 |
| **消息渲染** | 基础 Markdown | LiveMarkdown + Mermaid + 工具卡片 + 推理展示 + 图片 |
| **AI 对话** | 简单文本输入 | 富文本 Composer + slash commands + 附件 + 文件引用 |
| **任务管理** | 文本列表 + 阶段流转 | Kanban 看板 + Plan 面板 + TaskRun 记录 |
| **知识库** | 独立 WebviewPanel | Project Memory 面板（侧边栏/内嵌） |
| **AI 引擎** | ACP 单一协议 | 多引擎 Capability Matrix + 状态面板 |
| **编辑器集成** | 代码选中 → 发送 | 完整的 EditorAdapter（选中 + 前后文 + 文件上下文） |
| **上下文审计** | 无 | Context Ledger（来源归因 + 成本追踪） |
| **会话管理** | 无 | Session Activity（跨会话导航） |
| **文件系统** | 手写 fs | VS Code workspace.fs |
| **Git** | 无 | VS Code Source Control |
| **终端** | 无 | VS Code Terminal |
| **设置** | 简单 Webview | VS Code settings.json |
| **国际化** | 中文 only | i18n 完整 |

---

## 11. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| VS Code Webview 沙箱限制（CSP、localStorage、跨域） | AI 功能受限 | 合理配置 CSP，不需要的 API 禁用；localStorage 改为 VS Code state |
| desktop-cc-gui 的 CSS 有 70+ 文件，精简工作量大 | 工期长 | 先全量迁移，再逐步裁剪未使用样式 |
| desktop-cc-gui 的 hooks 直接 import `services/tauri.ts` | 编译报错 | 将 `services/tauri.ts` 替换为同名同签名的 `services/bridge.ts`，不动 hooks |
| 流式渲染 + React 大树导致 Webview 性能问题 | 交互卡顿 | 虚拟列表 + 增量渲染 + React.memo |
| desktop-cc-gui 某些 feature 深度依赖 Tauri（如 detached window） | 功能不可用 | 在 VS Code 中简化为非浮窗版本 |
