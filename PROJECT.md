# KCode

VS Code 扩展，参考 ZCode ADE 设计理念，聚焦 **Task 管理 + AI 对话** 驱动的开发模式。文件编辑复用 VS Code 原生能力。

采用 Hybrid 模式：**VS Code 原生侧边栏视图 (WebviewView) + 编辑器面板 (WebviewPanel)**。

> Kcode is inspired by [Kilo Code](https://github.com/Kilo-Org/kilocode) (MIT license).


---

## 目录结构

```
src/
├── extension.ts                  # 扩展入口
├── types/index.ts                # 类型定义
├── store/TaskStore.ts            # 数据持久化
├── taskflow/
│   ├── TaskFlow.ts               # 阶段状态机 + TASK_UPDATE 协议（纯逻辑，不依赖 UI）
│   ├── prompts/                  # 分层提示词模块（base/protocol/goal/plan/execute/review/demand）
│   │   ├── base.ts
│   │   ├── protocol.ts
│   │   ├── demand.ts
│   │   ├── goal.ts
│   │   ├── plan.ts
│   │   ├── execute.ts
│   │   └── review.ts
│   └── __tests__/
│       └── TaskFlow.test.ts      # 7 个测试用例，覆盖完整状态机流程
├── kcodeView/
│   ├── KCodePanel.ts             # 编辑器聊天面板（使用 TaskFlow 管理阶段）
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
    ├── OpenAIAgent.ts            # OpenAI Agent (HTTP 直连 OpenAI API)
    └── callbacks.ts              # ACP Client 回调实现
```

---

## 功能概览

| 模块 | 已实现 | 待实现 |
|------|--------|--------|
| 扩展骨架 | 激活/停用、命令注册 | - |
| 侧边栏 | 任务列表、分组管理、右键菜单（重命名/置顶/归档/移至分组） | GitHub Issue 导入 |
| 编辑器面板 | 两栏布局、Tab切换、拖拽分割、流式消息、Goal 固定显示与编辑、进度线 5 阶段节点 | 5 阶段全流程协议 |
| AI 对话 | 流式消息、Markdown渲染(代码块语法高亮)、增量流式渲染、Tool UI 改进、停止按钮 | `<TASK_UPDATE>` 协议解析 + 阶段分发提示词 |
| 右侧面板 | Preview、Diff、WebView、Device UI壳、验收卡片（文件关联+驳回带原因） | - |
| ACP | 多会话管理、Agent进程、文件读写、流式回调、工具调用/计划事件 | - |
| 数据层 | Task CRUD、消息存储、5 阶段字段扩展 | - |

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

### Phase 5: 任务状态重构

**目标**：重新定义 Task 生命周期，引入 用户设定目标→确认→执行→AI 自验→用户验收的简洁流转。

详见下方 [任务状态机](#任务状态机) 章节。

**验收标准**：任务有明确的 goal 字段，状态可按状态机完整流转，用户确认/验收流程闭环。

---

### Phase 6: 对话显示体验升级

**目标**：升级 AI 对话消息渲染质量，达到与 Kilo 接近的消息展示体验。按优先级分三档：

- **P0 — 最急需**：Markdown 渲染升级（`marked` + 代码块语法高亮）、流式消息增量渲染
- **P1 — 提升可用性**：工具调用按类型差异渲染（bash 实时输出、read/glob 折叠卡片、状态动画）
- **P2 — 锦上添花**：代码块复制按钮、消息时间戳、Agent 回复底部 Diff 总结

**验收标准**：AI 回复代码块带语法高亮，流式输出不闪烁不碎裂，工具调用状态清晰可辨。

---

### Phase 7: 自举之路 Level 1 — 能改（已完结）

**目标**：端到端验证目标确认与验收流程，修复发现的真实问题。三个任务均已完成：

- **P7-01**: Goal 中心化 — 对话区顶部固定显示 + 行内可编辑 + 变更记录卡片
- **P7-02**: 验收增强 — 变更文件关联 VS Code 原生 diff + 驳回带原因输入
- **P7-03**: 进度线节点重构为固定 5 阶段 — demand/goal/plan/execute/review，颜色区分状态

**验收标准**：Goal 在对话区固定可见、随时可改，验收时文件变化可逐条审阅、驳回时可填写原因，进度线稳定展示 5 阶段。

---

### Phase 8: 自举之路 Level 2 — 能造（当前阶段）

**目标**：实现 `<TASK_UPDATE>` 协议驱动的 5 阶段全流程（demand → goal → plan → execute → review），用 KCode 自身完成独立小功能。

- **P8-01**: 数据模型扩展 — Task 增加 phase/confirmedItems/pendingItems/planSteps
- **P8-02**: `<TASK_UPDATE>` 协议解析器 — JSON 解析 + 阶段合法性校验
- **P8-03**: 阶段分发提示词 — buildTaskPrompt() 按 phase 分派 4 套行为约束
- **P8-04**: 对话式阶段迁移 — 移除强制卡片阻断，自然对话推进阶段
- **P8-05**: 顶部看板增强 — 显示当前阶段 + 共识条目 tag

**验收标准**：AI 能通过 `<TASK_UPDATE>` 协议自主推进阶段，用户通过自然对话完成需求 → 目标锁定 → 计划 → 执行 → 验收全流程。

---

### Phase 9—10: 自举之路

**自举定义**：使用 KCode 自身来开发 KCode，即 KCode 的 AI Agent 能够对 KCode 源码进行读、写、编译、调试、打包的全流程操作，开发者只需通过对话下达指令即可完成开发任务。

```
能力线：Phase 6 打磨体验 → Phase 7 修小bug → Phase 8 做小功能
     → Phase 9 主导开发 → Phase 10 完全切换
```

| Phase | 自举等级 | 目标 | 条件 |
|-------|---------|------|------|
| **6** | 🟫 Level 0 — 能看 | 提升 AI 输出可读性，开发者能看清 AI 写的代码 | P0 完成：语法高亮 + 流畅流式 |
| **7** | 🟥 Level 1 — 能改 | KCode 可参与修小 bug，开发者信任 AI 做局部修复 | Phase 6 全量完成 + 实践中修复若干真实 issue |
| **8** | 🟧 Level 2 — 能造 | KCode 能完成独立小功能，从零到 PR 全流程 | 验证：用 KCode 完成至少 1 个 Phase 功能 |
| **9** | 🟨 Level 3 — 能带 | KCode 主导功能开发，开发者只做 code review | 验证：连做 3 个功能，AI 产出代码无需大改 |
| **10** | 🟩 Level 4 — 能吃 | 团队完全切换到 KCode 开发 KCode，不再用其他 AI 工具 | 验证：用 KCode 完成一次完整的 release 迭代 |

> **当前阶段：🟧 Level 2 — 能造** — 实现 `<TASK_UPDATE>` 协议全流程，用 KCode 自身完成独立功能。

---

## 任务状态机

### 状态定义

| 状态 | 含义 | 条件 | 对应进度线节点 |
|------|------|------|--------------|
| `pending` | 原始需求已提交，goal 已格式化，**等待用户确认** | AI 格式化 goal 后，用户还没点"确认" | 📝 🟢 → 🎯 🔵 |
| `active` | 用户已确认，AI 正在执行 | 用户点了"确认目标" | 🎯 🟢 → ⚡ 🔵 |
| `in_review` | AI 完成，**等待用户验收** | AI 通知"已完成" | ⚡ 🟢 → ✅ 🔵 |
| `completed` | 验收通过，终态 | 用户点了"验收通过" | 全部 🟢 |
| `cancelled` | 用户主动放弃，任务中断 | 用户取消或驳回但不重试 | 中断点 ❌，后续 ⚪ |

### 状态转换图

```
                        ┌── 修改需求 ──┐
                        │              │
pending ──[确认目标]──→ active ──→ in_review ──→ completed
  ↑                      ↑              │
  └──── 驳回修改 ────────┘              │
                                        │
所有状态 ────────── [用户取消] ────────→ cancelled
```

### 状态转换表

| 从 | 到 | 触发者 | 条件/动作 |
|----|----|--------|----------|
| `pending` | `active` | **用户** | 用户点击"确认目标" |
| `pending` | `pending` | **用户** | 用户点击"修改需求"，goal 清空重新提取 |
| `pending` | `cancelled` | **用户** | 用户点击"取消" |
| `active` | `in_review` | **AI** | AI 完成，通知"已完成，等待验收" |
| `in_review` | `completed` | **用户** | 用户验收通过 |
| `in_review` | `active` | **用户** | 用户驳回，AI 继续修改 |
| `active` / `in_review` | `cancelled` | **用户** | 用户主动放弃 |

---

### 进度线节点（对话区左侧时间线）

对话区左侧的垂直进度线，用 5 个固定阶段节点展示任务进展，**所有节点始终显示**，通过颜色区分状态。

#### 5 个固定阶段

```
📝 需求提交  →  🎯 目标确认  →  📋 计划  →  ⚡ 执行  →  ✅ 验收
```

| 节点 | 参与者交接 | 说明 |
|------|-----------|------|
| 📝 **需求提交** | 👤 → ⚙️ | 用户原始输入（起点）。以后 GitHub issue 导入也落在此节点 |
| 🎯 **目标确认** | 🤖 → 👤 | AI 格式化 goal，用户确认/修改 |
| 📋 **计划** | 🤖 | AI onPlan 事件（纯 AI 阶段） |
| ⚡ **执行** | 🤖 (+ 👤 可打断) | AI 推理/读写/命令循环 |
| ✅ **验收** | 👤 | 用户最终决策，**通过则任务结束**（终点） |

设计原则：**任务从用户开始，到用户终止**。中间是 AI 工作区间。

#### 节点颜色状态

| 颜色 | 状态 | 含义 |
|------|------|------|
| 🟢 绿 | `completed` | 该阶段已完成 |
| 🔵 蓝（脉冲动画） | `active` | 该阶段正在进行中 |
| ⚪ 灰 | `pending` | 该阶段尚未到达 |
| ❌ 红 | `cancelled` | 在该阶段被用户中断 |

#### Status → 节点颜色映射

| Task Status | 📝 需求提交 | 🎯 目标确认 | 📋 计划 | ⚡ 执行 | ✅ 验收 |
|-------------|-----------|-----------|--------|--------|--------|
| `pending`（初始） | 🟢 | 🔵 | ⚪ | ⚪ | ⚪ |
| `pending`（已格式化） | 🟢 | 🔵 | ⚪ | ⚪ | ⚪ |
| `active` | 🟢 | 🟢 | 🟢 | 🔵 | ⚪ |
| `in_review` | 🟢 | 🟢 | 🟢 | 🟢 | 🔵 |
| `completed` | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| `cancelled`（中断于 pending） | 🟢 | ❌ | ⚪ | ⚪ | ⚪ |
| `cancelled`（中断于 active） | 🟢 | 🟢 | 🟢/❌ | ❌ | ⚪ |
| `cancelled`（中断于 in_review） | 🟢 | 🟢 | 🟢 | 🟢/❌ | ❌ |

> 判定规则：节点状态根据 `task.status` 推断。`completed` 之前的节点全部标记 🟢，当前节点标记 🔵 或 ❌（cancelled），之后的节点标记 ⚪。

#### 涉及文件

| 文件 | 改动 |
|------|------|
| `types/index.ts` | ProgressNode type 改为 5 个固定类型 `demand \| goal \| plan \| execute \| review`，status 增加 `cancelled` |
| `KCodePanel.ts` | `deriveNodes()` 始终返回 5 个固定节点，不再动态计算 |
| `app.ts` | `getNodeEmoji()` 更新，`handleNodePanelUpdate()` 适配 5 节点固定渲染 |
| `KCodePanel.ts` | CSS `.tl-node.status-cancelled` 新增红色样式 |

---

## 系统提示词与任务状态标记

### 动机

Task 类型对话需要 AI 在完成时通知系统，以便触发验收流程。但 AI 无法直接调用系统 API，因此采用**在 prompt 中嵌入系统提示词**的方式，让 AI 通过文本标记来通信。

### 系统提示词

当任务类型为 `task` 且处于执行阶段（`active`），系统在发送给 AI 的 prompt 前自动拼接：

```
[System]
任务目标：{goal}
请在回答末尾标注任务状态标记（不显示给用户）：
- 已完成：[TASK_STATUS: completed]
- 进行中：[TASK_STATUS: in_progress]
[/System]
```

Chat 类型的对话不加此提示词。

### 标记解析流程

```
AI 流式响应 → onText 回调
                   │
                   ▼
           扫描 [TASK_STATUS: (completed|in_progress)]
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
      匹配成功             无匹配
         │                   │
   记录状态标记         正常追加文本
   从显示文本中          → 流式渲染
   剥离标记
         │
         ▼
   流式渲染（无标记）
         │
         ▼
    onDone 回调
         │
    ┌────┴────┐
    ▼         ▼
 标记为    标记为
completed  in_progress
    │         │
   触发     正常结束
   验收卡片
```

### 通信协议补充

| type | Source | Target | 说明 |
|------|--------|--------|------|
| `'showReviewRequest'` | KCodePanel | app.ts | AI 标记完成，显示验收卡片 |
| `'approveReview'` | app.ts | KCodePanel | 用户验收通过 |
| `'rejectReview'` | app.ts | KCodePanel | 用户驳回 |

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
KCode (ACP Client)                 Agent (ACP Agent / OpenCode)
      │                                   │
      ├── initialize() ──────────────────►│
      │◄─ {capabilities, clientInfo} ─────┤
      │                                   │
      ├── session/new() ────────────────►│
      │◄─ sessionId ─────────────────────┤
      │                                   │
      ├── session/prompt() ─────────────►│
      │◄─ session/update (plan) ─────────┤
      │◄─ session/update (agent_message_chunk) ──┤
      │◄─ session/update (tool_call) ────┤
      │◄─ session/update (tool_call_update) ─────┤
      │◄─ stopReason (end_turn) ─────────┤
      │                                   │
      ├── session/cancel() (optional) ──►│
      ├── session/close() (optional) ───►│
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
    title: string;               // 从 goal 自动截取，用于列表显示
    goal: string;                // 用户设定的任务目标描述
    type: 'task' | 'chat';      // classifyIntent 在第一轮消息确定
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    createdAt: number;
    pinned?: boolean;
    group?: string;
}

interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type?: 'text' | 'goal_confirmation' | 'goal_confirmed' | 'review_request' | 'review_approved' | 'review_rejected' | 'tool_call';  // 消息子类型
    content: string;
    timestamp: number;
}

interface ACPConfig {
    agentName: string;
    apiKey?: string;
}

interface AcpMessageHandler {
    onText: (text: string) => void;
    onReasoning?: (text: string) => void;
    onToolCall?: (toolCallId: string, title: string, kind: string, status: string) => void;
    onToolCallUpdate?: (toolCallId: string, status: string, content?: string, title?: string, kind?: string) => void;
    onPlan?: (entries: { content: string; priority: string; status: string }[]) => void;
    onError: (error: string) => void;
    onDone: (stopReason?: string) => void;
}

interface ProgressNode {
    id: string;
    type: 'demand' | 'goal' | 'plan' | 'execute' | 'review';  // 5 个固定阶段
    label: string;
    status: 'pending' | 'active' | 'completed' | 'cancelled';  // 4 种颜色状态
    order: number;
}
```

### `src/store/TaskStore.ts`

包装 `ExtensionContext.workspaceState` (Memento)。

存储结构：
- `tasks` → `Task[]`
- `messages_{taskId}` → `ChatMessage[]`
- `groups` → `string[]`

| 方法 | 说明 |
|---|---|
| `getTasks()` | 全部任务 |
| `addTask(task)` | 新增 |
| `deleteTask(taskId)` | 删除任务及其消息 |
| `updateTaskStatus(id, status)` | 改状态 |
| `updateTaskTitle(id, title)` | 改标题 |
| `updateTaskType(id, type)` | 改类型 |
| `updateTaskPin(id, pinned)` | 置顶/取消置顶 |
| `updateTaskGroup(id, group)` | 移入/移出分组 |
| `getGroups()` | 获取全部分组名 |
| `addGroup(name)` | 新增分组 |
| `getTask(id)` | 单个任务 |
| `findEmptyTask()` | 找第一条消息数为 0 的任务 |
| `getMessages(taskId)` | 获取对话消息 |
| `addMessage(msg)` | 添加消息 |
| `clearMessages(taskId)` | 清空消息 |

### `src/taskflow/TaskFlow.ts`

阶段状态机 + `<TASK_UPDATE>` 协议解析器。不依赖任何 UI（VS Code WebView / DOM），可 CLI 测试。

| 接口 | 说明 |
|------|------|
| `ITaskStore` | TaskFlow 依赖的 Store 接口（与 `TaskStore` 结构兼容） |
| `TaskFlowDelegate` | 阶段变更/执行完成/goal 格式化等事件回调 |
| `TaskFlow` | 核心类 |

**主要方法**:

| 方法 | 说明 |
|------|------|
| `loadTask(taskId)` | 加载任务，初始化内部状态 |
| `resetGeneration(taskId)` | 重置生成态（accumulatedText, planProposed, executeFinished） |
| `processChunk(taskId, chunk)` | 处理流式文本 chunk，剥离 TASK_UPDATE 标记，返回清洗后文本 |
| `getCleanText(taskId)` | 获取已剥离标记的文本 |
| `getGenResult(taskId)` | 获取当前生成的 planProposed/executeFinished 状态 |
| `buildPrompt(taskId, userText)` | 4 层组装：BASE_PROMPT → PROTOCOL_PROMPT → buildTaskContext → buildPhasePrompt + userText |
| `buildTaskContext(task)` | 提取 task.goal/confirmedItems/planSteps/pendingItems 格式化输出 |
| `buildPhasePrompt(task)` | 按 task.phase 分派对应提示词（从 prompts/ 目录加载） |
| `validateAction(phase, action)` | 校验 AI 当前阶段可输出的动作 |
| `executeAction(taskId, payload)` | 执行 AI 协议动作（propose_goal, propose_plan） |
| `processGoalProposal(taskId, ...)` | AI 格式化 goal 后存储并通知 UI |
| `confirmGoal / confirmPlan / confirmExecuteDone` | 用户确认操作，执行阶段迁移 |
| `rejectPlan / finishReview / rejectReview` | 用户拒绝/完成操作 |

**Prompt 分层架构** (`src/taskflow/prompts/`):

```
buildPrompt() 输出结构:

Layer 1: base.ts     — AI 人格基线
Layer 2: protocol.ts — TASK_UPDATE 协议全量参考
Layer 3: 动态生成    — buildTaskContext() 输出 task 当前状态
Layer 4: 按 phase 分 — demand|goal|plan|execute|review.ts
```

每个阶段提示词是独立文件，可直接编辑无需改动 TypeScript 代码。

**测试**：

```bash
npm test               # vitest run — 7 个测试用例
npm run test:watch     # vitest watch 模式
```

测试覆盖：
1. `buildPrompt` — 5 个阶段分别输出正确的 System Prompt，chat 类型返回裸文本
2. `processChunk` — propose_goal/propose_plan/finish_execute 协议解析 + TASK_UPDATE 标签剥离
3. **完整流程** — demand → goal → plan → execute → review → completed 状态机全链路

---

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
| `prompt(taskId, text, handler)` | 发送 prompt + 流式回调（含 stopReason 传递） |
| `cancel(taskId)` | 取消指定 task 的 prompt |
| `closeTaskSession(taskId)` | 关闭 ACP 会话（发送 session/close 请求 + 本地删除） |
| `closeSession(taskId)` | 别名，发送 session/close 到 Agent |
| `getReviewChanges(taskId)` | 获取 task 的文件变更记录 |
| `dispose()` | 关闭所有会话 + 停止 Agent 进程 |

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
| `sessionUpdate()` | 完整路由：`agent_message_chunk` → `onText`，`tool_call` → `onToolCall`，`tool_call_update` → `onToolCallUpdate`，`plan` → `onPlan` |
| `writeTextFile()` | 写文件（路径解析到 workspaceRoot，记录变更供验收） |
| `readTextFile()` | 读文件 |

---

## 通信协议汇总

### WebView → Extension

| type | Source | Target |
|---|---|---|
| `'newTask'` | sidebar.ts | KCodeSidebarProvider |
| `'selectTask'` | sidebar.ts | KCodeSidebarProvider |
| `'deleteTask'` | sidebar.ts | KCodeSidebarProvider |
| `'pinTask'` | sidebar.ts | KCodeSidebarProvider |
| `'newGroup'` | sidebar.ts | KCodeSidebarProvider |
| `'moveTaskToGroup'` | sidebar.ts | KCodeSidebarProvider |
| `'reorderTask'` | sidebar.ts | KCodeSidebarProvider |
| `'renameTask'` | sidebar.ts | KCodeSidebarProvider |
| `'archiveTask'` | sidebar.ts | KCodeSidebarProvider |
| `'renameGroup'` | sidebar.ts | KCodeSidebarProvider |
| `'moveGroup'` | sidebar.ts | KCodeSidebarProvider |
| `'openSettings'` | sidebar.ts / app.ts | KCodeSidebarProvider |
| `'sendMessage'` | app.ts | KCodePanel |
| `'confirmGoal'` | app.ts | KCodePanel |
| `'confirmGoalWithEdit'` | app.ts | KCodePanel |
| `'reviseGoal'` | app.ts | KCodePanel |
| `'cancelTask'` | app.ts | KCodePanel |
| `'stopGeneration'` | app.ts | KCodePanel |
| `'approveReview'` | app.ts | KCodePanel |
| `'rejectReview'` | app.ts | KCodePanel |

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
| `'flashInput'` | KCodePanel | app.ts |
| `'generationState'` | KCodePanel | app.ts |
| `'updateTaskInfo'` | KCodePanel | app.ts |
| `'showGoalConfirmation'` | KCodePanel | app.ts |
| `'toolCallUpdate'` | KCodePanel | app.ts | 实时工具调用状态更新（独立消息，不混入 agent 文本） |

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
│  重命名               │
│  ──────────────       │
│  置顶 / 取消置顶       │
│  归档 / 取消归档       │
│  ──────────────       │
│  移至分组  ▸           │  →  未分组
│                        │     分组1
│                        │   ✔ 分组2
└──────────────────────┘
```

### 分组右键菜单

```
┌──────────────────────┐
│  重命名               │
│  ──────────────       │
│  上移                 │
│  下移                 │
│  ──────────────       │
│  删除                 │
└──────────────────────┘
```

---

## 构建命令

```bash
npm run compile       # tsc 编译
npm run watch         # 监听模式
npm test              # vitest 运行测试
npm run test:watch    # vitest 监听模式
npm run lint          # eslint 检查
npx tsc --noEmit      # 类型检查
```

调试: F5 (Run Extension, 需要先编译)
