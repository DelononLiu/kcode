# KCode × desktop-cc-gui 融合方案

> **形式**：VS Code 扩展
>
> **原则**：Webview 只负责 AI 工作台，VS Code 负责编辑器（文件、Git、终端、设置等原生功能各司其职）
>
> **策略**：**复制跑起来，而非移植重写** — 将 desktop-cc-gui 的 React 前端源码直接复制到 kcode webview 目录，替换 Tauri IPC 层为 VS Code Bridge，对接 kcode 现有后端服务（AgentService、TaskFlow、KnowledgeStore）。
>
> **目标**：让 desktop-cc-gui 的 AI 功能 UI 作为 VS Code Webview 运行，融合 kcode 的 5 阶段管线、ACP Agent 接入、小助手、知识库，构建专业级的 VS Code AI 工程工作台。

---

## 1. 融合策略：复制跑起来（vs 移植重写）

```
方案 A: 移植重写（原计划）              方案 B: 复制跑起来（当前选择）
desktop-cc-gui → 理解代码 → 重写组件     desktop-cc-gui → cp 源码 → 换 IPC 层
                 └─ 等价于"看着照片画一幅画"               └─ 等价于"直接把照片装进相框"
```

### 为什么选方案 B

| 维度 | 方案 A: 移植重写 | 方案 B: 复制跑起来 |
|------|:---:|:---:|
| 要写的代码量 | 全部重写（几千行） | 只换 IPC 层（~50 行适配器） |
| UI 一致性 | 容易走样 | **跟 desktop-cc-gui 完全一致** |
| AI 适配度 | AI 写新组件可能跑偏 | AI 只需改 import 路径 |
| 风险 | 重写引入新 bug | 已有的 UI 代码已经跑通了 |
| 改动量 | 大 | **小（只动数据层）** |

### 核心适配模式

```typescript
// 改前 (Tauri 调用)
import { invoke } from '@tauri-apps/api/core'
const agents = await invoke('get_agents')

// 改后 (vscodeBridge — 同一接口签名)
import { invoke } from '../services/vscodeBridge'
//         ↑ 实现: postMessage + onDidReceiveMessage，接口不变
const agents = await invoke('get_agents')
```

**Tauri 的 invoke(cmd, args) → Promise 和 VS Code 的 postMessage request/response 接口天然一致。** 写一个 `vscodeBridge.ts` 封装层（~50 行），所有 `@tauri-apps/api` 调用原地替换，不需要改业务组件。

### 执行路径

```
1. 建 vscodeBridge.ts  (桥接层, 1 个文件, ~50 行)
2. cp desktop-cc-gui/src/* → kcode_v5/src/webview/
   只复制 Phase 38 需要的:
   ├── features/composer/   (输入框)
   ├── features/threads/    (对话管理)
   ├── features/messages/   (消息渲染)
   ├── features/project-memory/ (知识库)
   ├── features/layout/     (布局)
   ├── components/ui/       (shadcn 组件)
   ├── services/  (除 tauri/ 以外)
   ├── styles/   (相关 CSS)
   └── types.ts, utils/, lib/
3. 全局替换 @tauri-apps/api → vscodeBridge
4. ReactPanel.ts (扩展侧) 处理 bridge invoke → 接 AgentService/KnowledgeStore
5. 构建、运行、验证
```

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
│  │  接收 desktop-cc-gui 的 Tauri IPC 调用，映射到 kcode 后端服务：       │ │
│  │                                                                     │ │
│  │  Tauri IPC 命令              → kcode 服务                            │ │
│  │  ──────────────────────      ─────────────────                      │ │
│  │  engine/connect              AgentService.connectByLabel()           │ │
│  │  engine/sendMessage          AgentService.sendMessage()              │ │
│  │  engine/interrupt            AgentService.disconnect()              │ │
│  │  knowledge/read              KnowledgeStore.getAllEntries()          │ │
│  │  knowledge/write             KnowledgeStore.addEntry()              │ │
│  │  store/get                   context.workspaceState.get()            │ │
│  │  store/set                   context.workspaceState.update()         │ │
│  │  editor/getContext           vscode.window.activeTextEditor          │ │
│  │  editor/openFile             vscode.window.showTextDocument()        │ │
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
│  │  ★ 直接从 desktop-cc-gui 复制，不改 UI 逻辑，只换 IPC 层          │   │
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
│  │  │  services/vscodeBridge.ts ← ★ 替换 tauri.ts：同签名接口   │   │   │
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
executeCommand('vscode.open', Uri.file(filePath));
executeCommand('git.commit');
executeCommand('workbench.view.explorer');
```

### 3.2 进 Webview（VS Code 没有的 AI 功能）

| Feature | 来源 | 功能描述 | 迁移方式 |
|---|---|---|---|
| `threads/ + composer/ + messages/` | desktop-cc-gui | AI 对话系统（富文本输入、流式渲染、工具调用卡片、Mermaid、推理展示） | **cp 源码 → 换 IPC** |
| `kanban/` | desktop-cc-gui | AI 任务看板（todo → inprogress → testing → done） | **cp 源码 → 换 IPC** |
| `tasks/` | desktop-cc-gui | AI 任务运行记录、状态、诊断 | **cp 源码 → 换 IPC** |
| `plan/` | desktop-cc-gui | AI 计划面板 | **cp 源码 → 换 IPC** |
| `engine/` | desktop-cc-gui | AI 引擎选择/状态/能力矩阵 | **cp 源码 → 换 IPC** |
| `project-memory/` | desktop-cc-gui | 知识库（多类型语义记忆） | **cp 源码 → 换 IPC** |
| `agent-orchestration/` | desktop-cc-gui | AI 任务编排 | **cp 源码 → 换 IPC** |
| `context-ledger/` | desktop-cc-gui | AI 上下文来源/成本审计 | **cp 源码 → 换 IPC** |
| `status-panel/` | desktop-cc-gui | AI 运行状态面板 | **cp 源码 → 换 IPC** |
| `session-activity/` | desktop-cc-gui | AI 会话活动记录/导航 | **cp 源码 → 换 IPC** |
| `notifications/` | desktop-cc-gui | AI 操作通知 | **cp 源码 → 换 IPC** |
| `app/ + layout/` | desktop-cc-gui | 应用壳和布局管理 | **cp 源码 → 换 IPC** |
| `home/` | desktop-cc-gui | 首页视图 | **cp 源码 → 换 IPC** |
| 5 阶段管线可视化 | kcode | Goal→Plan→Execute→SelfVerify→Review 流程 | 新建 |
| ACP 日志面板 | kcode | ACP 协议通信日志 | 新建 |
| Setup Wizard | kcode | 首次使用引导 | 新建 |

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

因为文件/Git/终端/对话框等功能全部用 VS Code 原生实现，Webview 和扩展宿主之间的通信**简化到只传递 AI 相关数据**。

### 4.1 Tauri → VS Code Bridge 适配策略

desktop-cc-gui 大量使用 `@tauri-apps/api` 进行 IPC 通信。核心适配思路：

```typescript
// src/webview/services/vscodeBridge.ts
// 暴露与 @tauri-apps/api 相同的接口签名

// invoke(cmd, args) — 请求响应
export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return bridge.invoke(cmd, args)
}

// listen(event, handler) — 事件订阅
export async function listen<T = unknown>(event: string, handler: (payload: T) => void): Promise<() => void> {
  bridge.on(event, handler)
  return () => bridge.off(event, handler)
}

// convertFileSrc — VS Code 不需要，返回空
export function convertFileSrc(path: string): string { return path }

// 其他 @tauri-apps/api 按需填充...
```

**Tauri IPC 命令 → kcode 服务映射表：**

```
Tauri invoke 命令                    → kcode 处理
───────────────────────────────────── ────────────────────────
list_agent_bridges                    AgentService.listAvailableAgents()
get_agent_status                      { isConnected, agentName, modelName }
prompt_agent (streaming)              AgentService.sendMessage() → stream:chunk
cancel_agent_prompt                   AgentService.disconnect()
read_project_memory_entries           KnowledgeStore.getAllEntries()
write_project_memory_entry            KnowledgeStore.addEntry()
delete_project_memory_entry           KnowledgeStore.deleteEntry()
get_setting / set_setting             ConfigService.get() / set()
read_text_file                        vscode.workspace.fs.readFile()
write_text_file                       vscode.workspace.fs.writeFile()
```

### 4.2 消息类型

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

### 4.3 Bridge 实现

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
│   ├── build-webview.js                ← 打包旧版 webview (esbuild)
│   └── build-webview-vite.js           ← 打包新 React webview (Vite)
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
│   ├── view/                           ← VS Code 扩展视图
│   │   ├── Panel.ts                    ←  旧版 Webview Panel (保留)
│   │   ├── ReactPanel.ts               ←  ★ 新版 React Webview Panel
│   │   ├── SettingsProvider.ts         ←  设置面板 (如需要)
│   │   └── templates/
│   │       └── webviewHtml.ts          ←  Webview HTML 模板
│   │
│   │   ★ 侧边栏不再作为独立 VS Code webview view，而是融合进 React
│   │     Webview 主面板内（threads/left panel），与 desktop-cc-gui
│   │     的布局方式一致。SidebarProvider.ts 废弃。
│   │
│   ├── commands/                       ← VS Code 命令注册 (保留/扩展)
│   │   └── index.ts
│   │
│   ├── env/                            ← 环境管理 (保留)
│   │   └── NodeManager.ts
│   │
│   ├── plugins/                        ← kcode 插件系统 (保留)
│   │
│   └── webview/                        ← ★ desktop-cc-gui AI 功能前端
│       ├── index.html                  ←  (直接复制, 仅改 import)
│       ├── main.tsx                    ←  React 入口
│       ├── App.tsx
│       ├── router.tsx
│       ├── bootstrap.ts                ←  启动 (去 Tauri 化)
│       │
│       ├── features/                   ←  AI 相关 features (直接复制)
│       │   ├── threads/                ←  (cp → 换 IPC)
│       │   ├── composer/               ←  (cp → 换 IPC)
│       │   ├── messages/               ←  (cp → 换 IPC)
│       │   ├── kanban/                 ←  (cp → 换 IPC, Phase 39)
│       │   ├── tasks/                  ←  (cp → 换 IPC, Phase 39)
│       │   ├── plan/                   ←  (cp → 换 IPC, Phase 39)
│       │   ├── engine/                 ←  (cp → 换 IPC, Phase 40)
│       │   ├── project-memory/         ←  (cp → 换 IPC)
│       │   ├── agent-orchestration/    ←  (cp → 换 IPC, Phase 40)
│       │   ├── context-ledger/         ←  (cp → 换 IPC, Phase 40)
│       │   ├── status-panel/           ←  (cp → 换 IPC, Phase 40)
│       │   ├── session-activity/       ←  (cp → 换 IPC, Phase 40)
│       │   ├── notifications/          ←  (cp → 换 IPC, Phase 40)
│       │   ├── home/                   ←  (cp → 换 IPC, Phase 40)
│       │   ├── app/                    ←  (cp → 换 IPC)
│       │   ├── layout/                 ←  (cp → 换 IPC)
│       │   ├── shared/                 ←  (cp → 换 IPC)
│       │   └── about/                  ←  (cp → 换 IPC)
│       │
│       ├── components/                 ← 通用 UI 组件 (直接复制)
│       │   ├── ui/                     ←  shadcn/ui 组件
│       │   └── common/
│       │
│       ├── services/                   ← ★ 适配服务层
│       │   ├── bridge.ts               ←  VS Code Bridge 核心
│       │   ├── vscodeBridge.ts         ←  ★ Tauri API 兼容层
│       │   └── clientStorage.ts        ←  改为 VS Code state
│       │
│       ├── hooks/                      ←  全局 hooks (直接复制)
│       ├── styles/                     ←  CSS 主题 (直接复制)
│       ├── lib/                        ←  工具库 (直接复制)
│       ├── types.ts                    ←  类型定义 (直接复制)
│       ├── i18n/                       ←  国际化 (直接复制)
│       └── utils/                      ←  工具函数 (直接复制)
│
├── resources/                          ← 图标等资源
│
└── __tests__/
```

---

## 6. 核心适配细节

### 6.1 Tauri → VS Code 桥接层 (vscodeBridge.ts)

desktop-cc-gui 中 `services/tauri/` 下的文件是按功能分类的 Tauri IPC 调用封装。适配策略：

```typescript
// src/webview/services/tauri/agents.ts (原文件)
import { invoke } from '@tauri-apps/api/core'

export async function listAgents(): Promise<AgentInfo[]> {
  return invoke('list_agent_bridges')
}

// ↓ 改为

// src/webview/services/tauri/agents.ts (改后 — 不动函数签名)
import { invoke } from '../vscodeBridge'  // ★ 只改 import 路径

export async function listAgents(): Promise<AgentInfo[]> {
  return invoke('list_agent_bridges')  // → 走 VS Code Bridge
}
```

或者更彻底：将所有 `services/tauri/` 下的文件合并为一个 `services/vscodeBridge.ts`，暴露同名函数。

### 6.2 Engine → AgentService（AI 引擎选择）

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

### 6.3 Threads/Composer/Messages → 小助手

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
| `tool_result` | tool 执行结果 | 工具卡片结果展示 |

### 6.4 Kanban/Plan → 5 阶段管线

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

### 6.5 Project Memory → 知识库

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

### 6.6 编辑器上下文集成

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

### 6.7 VS Code 原生功能调用

Webview 内直接调 VS Code 命令打开文件/Git/终端等：

```typescript
// 在 webview 的合适位置
const openFile = (path: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'vscode.open',
    args: [Uri.file(path)]
  });
};

const showGitDiff = (filePath: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'vscode.diff',
    args: [oldUri, newUri, title]
  });
};

const openTerminal = (cwd: string) => {
  acquireVsCodeApi().postMessage({
    type: 'command',
    command: 'workbench.action.terminal.new',
    args: [{ cwd }]
  });
};
```

### 6.8 Client Storage 适配

desktop-cc-gui 的 `clientStorage.ts` 使用 Tauri 插件（`tauri-plugin-store`），改为 VS Code `context.workspaceState`：

```typescript
// src/adapters/StorageAdapter.ts
export class StorageAdapter {
  constructor(private state: vscode.Memento) {}

  get<T>(key: string): T | undefined {
    return this.state.get<T>(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.state.update(key, value);
  }
}
```

### 6.9 主题适配

desktop-cc-gui 有完整 CSS 主题系统。在 Webview 中通过 `data-vscode-theme-kind` 适配：

```typescript
// webview/bootstrap.ts
const updateTheme = () => {
  const kind = document.body.getAttribute('data-vscode-theme-kind');
  document.documentElement.setAttribute('data-theme', kind === 'vscode-dark' ? 'dark' : 'light');
};
const observer = new MutationObserver(updateTheme);
observer.observe(document.body, { attributes: true, attributeFilter: ['data-vscode-theme-kind'] });
updateTheme();
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

### Phase 38：核心骨架 + 对话 + 知识库（当前阶段）

```
P38-01  项目骨架
  - 安装 Vite + React 18 依赖
  - 配置 vite.config.ts、tsconfig.webview.json
  - 创建 ReactPanel.ts（新版 webview panel）
  - 创建 main.tsx + App.tsx（hello world）
  - 注册 kcode.openReactView 命令
  ★ Vite 构建 → Webview 渲染出 React 页面

P38-02  Bridge 通信层
  - src/webview/services/bridge.ts（webview 侧：invoke + on/off）
  - src/adapters/WebviewBridge.ts（扩展侧：消息路由）
  ★ 两端双向通信验证通过

P38-03  CSS + 组件库
  - cp desktop-cc-gui/src/styles/ → src/webview/styles/
  - cp desktop-cc-gui/src/components/ui/ → src/webview/components/ui/
  - cp desktop-cc-gui/src/components/common/ → src/webview/components/common/
  ★ desktop-cc-gui 主题风格在 Webview 中渲染

P38-04  对话 UI
  - cp desktop-cc-gui/src/features/threads/ → (对话管理)
  - cp desktop-cc-gui/src/features/composer/ → (输入框)
  - cp desktop-cc-gui/src/features/messages/ → (消息渲染)
  - cp desktop-cc-gui/src/features/layout/ + app/ → (布局)
  - 创建 vscodeBridge.ts（@tauri-apps/api 兼容层）
  - 全局替换 @tauri-apps/api → vscodeBridge
  ★ 能打字发送和显示回复（先走 mock）

P38-05  Agent 连接
  - 实现 EngineAdapter（bridge ↔ AgentService）
  - Webview 发消息 → bridge → AgentService → ACP Agent → 流式回 Webview
  ★ 对话输入真实 Agent，流式回复实时渲染

P38-06  知识库
  - cp desktop-cc-gui/src/features/project-memory/ →
  - bridge 对接 kcode KnowledgeStore（CRUD）
  ★ 知识条目增删改查，数据持久化

P38-07  验证
  - 端到端跑通：安装插件 → 打开 Webview → AI 对话 → 知识库读写
```

### Phase 39：任务管线（看板 + Plan + 5 阶段）

```
P39-01  cp features/kanban/
P39-02  cp features/tasks/
P39-03  cp features/plan/
P39-04  PlanAdapter — Kanban 状态 ↔ TaskFlow 5 阶段映射
P39-05  5 阶段管线可视化
P39-06  cp features/project-memory/ (如果在 P38 还没做全)
P39-07  KnowledgeStore 对接
P39-08  废弃 kcode 现有 KnowledgePanel
P39-09  StorageAdapter — desktop-cc-gui clientStorage → VS Code context.state
P39-10  验证: 创建任务 → 走完 goal→plan→execute→verify→review
```

### Phase 40：引擎集成 + 编辑器上下文 + 完善

```
P40-01  cp features/engine/
P40-02  cp features/status-panel/
P40-03  cp features/notifications/
P40-04  cp features/agent-orchestration/
P40-05  cp features/context-ledger/
P40-06  cp features/session-activity/
P40-07  cp features/home/
P40-08  EditorAdapter — 编辑器上下文获取 + 右键菜单
P40-09  slash 命令上下文感知
P40-10  SetupWizard 迁移
P40-11  ACP 日志面板迁移
P40-12  验证: 完整交互闭环
```

---

## 9. 关键技术决策

### 9.1 Webview 构建

```typescript
// vite.config.ts — Vite 构建单文件 bundle
export default defineConfig({
  root: 'src/webview',
  base: '/webview-assets/',
  build: {
    outDir: '../../out/webview',
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/webview/index.html',
      output: { inlineDynamicImports: true },
    },
  },
});
```

### 9.2 两套 Webview 共存

旧版 `Panel.ts` (vanilla JS) 和新版 `ReactPanel.ts` (React 18) 通过不同命令共存：

```typescript
// 旧版 — 照常运行
vscode.commands.registerCommand('kcode.open', openOldPanel);

// 新版 — 通过不同命令打开
vscode.commands.registerCommand('kcode.openReactView', () => ReactPanel.createOrShow(context));
```

### 9.3 Tauri 调用的全局替换策略

```bash
# 找出所有 Tauri 引用
grep -r "@tauri-apps/api" src/webview/ --include="*.ts" --include="*.tsx"

# 替换为 vscodeBridge（同签名）
sd "@tauri-apps/api" "../services/vscodeBridge" src/webview/**/*.ts src/webview/**/*.tsx

# 按需补全 vscodeBridge.ts 的导出函数
```

### 9.4 desktop-cc-gui 源码管理

复制的代码作为 kcode 仓库的一部分，直接修改（不保持与 desktop-cc-gui 的同步）。原因：
- 两边的演进方向不同（Tauri 桌面端 vs VS Code 扩展）
- 修改 IPC 层必然导致代码差异
- 维护同步成本 > 重写成本

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
| desktop-cc-gui 的 CSS 有 175+ 文件，全部复制过多 | 包体积大 | 先全量复制 Phase 38 需要的样式，后续按需裁剪 |
| desktop-cc-gui 的 hooks 直接 import `services/tauri.ts` | 编译报错 | 用 `vscodeBridge.ts` 替换 `@tauri-apps/api`，保持同名导出 |
| 流式渲染 + React 大树导致 Webview 性能问题 | 交互卡顿 | 虚拟列表 + 增量渲染 + React.memo |
| desktop-cc-gui 某些 feature 深度依赖 Tauri（如 detached window） | 功能不可用 | 在 VS Code 中简化为非浮窗版本 |
