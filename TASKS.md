# KCode 任务注册中心

> 每个 session 从这里开始。AI 读取此文件定位到具体任务，获取涉及文件列表后直接开工，无需重扫工程。
>
> **Phase 概述**详见 `PROJECT.md > 计划章节`。

## 任务格式

```markdown
## PX-XX: 任务标题

**涉及文件**: _待调研_ 或 文件路径列表
**调研步骤**: (涉及文件为空时，调研阶段填充)
**调研结果**: (调研后填充，含具体函数/行号)
**状态**: ⬜ 未开始 | 🔍 调研中 | 📋 已调研 | 🛠️ 实现中 | ✅ 已完成
```

## Phase 1: Task 骨架

_目标：建立 Task 驱动的开发模式基础，实现任务管理与 AI 对话的基础集成。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P1-01 | 扩展骨架激活/停用 | ✅ 已完成 |
| P1-02 | kcode.open / kcode.newTask 命令注册 | ✅ 已完成 |
| P1-03 | 任务创建、选择、删除 CRUD | ✅ 已完成 |
| P1-04 | 侧边栏 WebviewViewProvider 注册 | ✅ 已完成 |
| P1-05 | 任务列表扁平展示于侧边栏 | ✅ 已完成 |
| P1-06 | 点击任务加载对话历史 | ✅ 已完成 |
| P1-07 | Task 与 ACP Session 一对一绑定 | ✅ 已完成 |
| P1-08 | 侧边栏UI布局与样式实现 | ✅ 已完成 |

**验收标准**：侧边栏可正常创建和管理任务，AI 对话内容与任务绑定存储。

## Phase 2: AI 对话完整化

_目标：完善 AI 对话体验，配置可自定义，连接状态可知。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P2-01 | Agent 路径可配置（kcode.agentPath） | ✅ 已完成 |
| P2-02 | Agent 连接状态实时反馈 | ✅ 已完成 |
| P2-03 | 对话支持流式输出 | ✅ 已完成 |
| P2-04 | 用户消息即时渲染 | ✅ 已完成 |
| P2-05 | Markdown 渲染（粗体/斜体/链接/换行） | ✅ 已完成 |
| P2-06 | 输入框 + 发送按钮（Enter/点击） | ✅ 已完成 |
| P2-07 | FakeAgent 调试模式（agentPath="fake"） | ✅ 已完成 |

**验收标准**：用户可配置 Agent，连接状态可见，对话流畅无阻塞。

## Phase 3: 体验打磨

_目标：提升交互体验。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P3-01 | 侧边栏分组管理（已置顶/普通任务/分组） | ✅ 已完成 |
| P3-04 | 右键菜单扩展（置顶/取消置顶、删除） | ✅ 已完成 |
| P3-05 | 聊天面板任务信息栏 | ✅ 已完成 |

_注：P3-02 验收流程已被 Phase 5 的新状态模型覆盖，不再独立实现。_

**验收标准**：侧边栏支持分组和折叠。

---

## Phase 5: 任务状态重构

_目标：重新设计 Task 生命周期，引入 用户设定目标→确认→执行→AI 自验→用户验收的简洁状态机。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P5-01 | Task 数据模型重构（goal 字段 + 状态集 + store 适配） | ✅ 已完成 |
| P5-02 | AI 格式化目标输出 + 用户确认交互（unknown→pending→active） | ✅ 已完成 |
| P5-03 | AI 任务完成标记 + 验收触发 | ✅ 已完成 |
| P5-04 | 用户验收交互 | ✅ 已完成 |
| P5-05 | 侧边栏状态显示 + 手动状态操作（取消/完成） | ✅ 已完成 |

**验收标准**：任务有明确的 goal 字段，状态可按状态机完整流转，用户确认/验收流程闭环。

---

### P5-01: Task 数据模型重构

**涉及文件**: `src/types/index.ts`, `src/store/TaskStore.ts`

**调研步骤**:
1. 确认当前 Task 接口定义和 TaskStore CRUD 方法
2. 按讨论结论设计新类型

**调研结果**:
- `types/index.ts` — Task 需加 `goal: string`，`status` 更新为 `'pending' | 'active' | 'in_review' | 'completed' | 'cancelled'`
- `TaskStore.ts` — `updateTaskStatus` 需改为只更新指定任务，不再强制重置其他任务为 pending；`addTask` 需支持带 goal 创建；`findEmptyTask` 需移除或改为 `goal` 为空判断
- `ChatMessage` 需加可选的 `type` 字段用于标记确认卡片/验收请求等特殊消息

**涉及文件**: `src/types/index.ts`, `src/store/TaskStore.ts`, `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/KCodePanel.ts`, `src/extension.ts`
**状态**: ✅ 已完成

---

### P5-02: 用户确认执行交互

**流程**:
1. 用户输入需求 → 系统创建 task，设定 goal → status = `pending`，侧边栏显示"待开始"标记
2. 用户点击"开始执行" → status → `active`，AI 收到执行指令
3. 用户取消 → status → `cancelled`

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/kcodeView/webview/sidebar.ts`, `src/kcodeView/KCodeSidebarProvider.ts`
**状态**: ✅ 已完成

---

### P5-03: AI 任务完成标记 + 验收触发

**方案**: 通过系统提示词让 AI 在回答末尾标记 `[TASK_STATUS: completed]`，系统在 `onText` 中实时解析并剥离标记，`onDone` 时触发验收。

**流程**:
1. `handleSendMessage` 中 `task.type === 'task'` → 拼接系统提示词到 prompt 头部
2. AI 流式输出，`onText` 实时扫描 `[TASK_STATUS: (completed|in_progress)]`
3. 匹配完成标记 → 从显示文本剥离，记录状态
4. `onDone` 检查标记 → 若为 `completed` → `triggerReviewRequest()` 存储 `review_request` 消息 + 更新状态为 `in_review`
5. `loadMessages` 触发 WebView 渲染验收卡片（含 AI 回复内容 + 验收/驳回按钮）

**涉及文件**: `src/types/index.ts`, `src/store/TaskStore.ts`, `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

---

### P5-04: 用户验收交互

**流程**:
1. 用户看到 review 请求卡片（独立消息，含 AI 回复内容 + 验收/驳回按钮）
2. 用户验收通过 → `store.addMessage(type: 'approve')` → 状态 `completed`
3. 用户驳回 → 状态回退 `active`，AI 继续修改（后续迭代）

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

---

### P5-05: 侧边栏状态显示 + 手动状态操作

**说明**:
- 侧边栏任务项显示 status 徽标/颜色（unknown/pending 特殊标记）
- 右键菜单扩展：增加"标记完成"、"取消任务"选项
- pending 态任务显示"待确认"提示

**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`

**实现说明**:
- `sidebar.ts` — `createTaskItem` 中新增 `getStatusIndicator` 函数，根据 `task.status` 返回对应 Unicode 字符和 CSS 类名
  - `completed`: ✓ (绿色)
  - `cancelled`: ✕ (灰色)
  - `active`: ● (绿色)
  - `in_review`: ● (蓝色)
  - `pending`: ○ (琥珀色)
- `KCodeSidebarProvider.ts` — CSS 新增 `.task-status` 样式，各状态对应不同颜色

**状态**: ✅ 已完成

## Phase 4: 后端接入

_目标：支持通过 HTTP 协议接入后端 Agent（如 opencode），替代当前仅支持 stdio 子进程的模式，便于调试和常驻后端。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P4-01 | ACP HTTP 传输层实现（HttpStream） | ✅ 已完成 |
| P4-02 | 配置及连接逻辑改造 | ✅ 已完成 |
| P4-03 | OpenAI Agent（HTTP 直连 OpenAI API） | ✅ 已完成 |

**涉及文件**: `src/acp/AcpClient.ts`, `src/acp/AgentManager.ts`, `src/kcodeView/KCodePanel.ts`, `package.json`

**调研步骤**:
1. 确认 ACP SDK 的 Stream 接口（readable/writable JSON-RPC）
2. 确认 fetch 流式读取 NDJSON 的可行性
3. 确定配置字段（kcode.agentUrl）

**调研结果**:
- ACP SDK 的 `ClientSideConnection` 接收 `Stream { writable, readable }`，`ndJsonStream()` 将 stdio 转为 Stream
- 实现 HTTP 模式只需创建自定义 `Stream`，writable 通过 `fetch` POST 发送 JSON-RPC 消息，readable 从响应体流式读取 NDJSON
- 新增配置 `kcode.agentUrl`，当设置此值时走 HTTP 模式，否则保持 stdio 模式

### P4-03: OpenAI Agent（HTTP 直连 OpenAI API）

**涉及文件**: `src/acp/OpenAIAgent.ts`, `src/kcodeView/KCodePanel.ts`

**状态**: ✅ 已完成

---

## 已完成任务详情

### P1-01: 扩展骨架激活/停用
**涉及文件**: `src/extension.ts`
**状态**: ✅ 已完成

### P1-02: kcode.open / kcode.newTask 命令注册
**涉及文件**: `src/extension.ts`
**状态**: ✅ 已完成

### P1-03: 任务创建、选择、删除 CRUD
**涉及文件**: `src/store/TaskStore.ts`, `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`
**状态**: ✅ 已完成

### P1-04: 侧边栏 WebviewViewProvider 注册
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`
**状态**: ✅ 已完成

### P1-05: 任务列表扁平展示于侧边栏
**涉及文件**: `src/kcodeView/webview/sidebar.ts`
**状态**: ✅ 已完成

### P1-06: 点击任务加载对话历史
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/store/TaskStore.ts`
**状态**: ✅ 已完成

### P1-07: Task 与 ACP Session 一对一绑定
**涉及文件**: `src/acp/AcpClient.ts`
**状态**: ✅ 已完成

### P1-08: 侧边栏UI布局与样式实现
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 整体布局`（左侧栏四区块）
- `KCodeSidebarProvider.ts` — `getHtml()` 内联 HTML+CSS，当前为扁平列表 + 硬编码 dark 色
- `sidebar.ts` — `renderTaskList()` 渲染任务项，需要适配新结构
- `style.css` 仅用于 KCodePanel（聊天/右侧面板），侧边栏样式独立维护
**状态**: ✅ 已完成

### P2-01: Agent 路径可配置
**涉及文件**: `src/acp/AgentManager.ts`
**状态**: ✅ 已完成

### P2-02: Agent 连接状态实时反馈
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/acp/callbacks.ts`
**状态**: ✅ 已完成

### P2-03: 对话支持流式输出
**涉及文件**: `src/acp/AcpClient.ts`, `src/kcodeView/KCodePanel.ts`
**状态**: ✅ 已完成

### P2-04: 用户消息即时渲染
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

### P2-05: Markdown 渲染
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

### P2-06: 输入框 + 发送按钮
**涉及文件**: `src/kcodeView/webview/app.ts`
**状态**: ✅ 已完成

### P2-07: FakeAgent 调试模式
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `package.json`
**状态**: ✅ 已完成

## Phase 3 任务详情

### P3-01: 侧边栏分组管理
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `src/types/index.ts`, `src/store/TaskStore.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 整体布局`（左侧栏）
- `KCodeSidebarProvider.ts` — `resolveWebviewView()` 设置 HTML/JS，`refresh()` 发更新
- `sidebar.ts` — `renderTaskList(tasks)` 渲染扁平列表，需改为分组渲染
- `types/index.ts` — Task 类型需增加 `pinned`、`group` 字段
**实现说明**:
- TaskStore 新增 `getGroups/addGroup/updateTaskGroup` 方法
- KCodeSidebarProvider 处理 `newGroup`/`moveTaskToGroup` 消息
- "任务"标题旁新增「+」新建分组按钮，弹出 `showInputBox`
- 任务项支持 HTML5 Drag & Drop 拖入分组
- 未分组区也是 drop target，拖入可移出分组
**状态**: ✅ 已完成

### P3-02: 验收流程
**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/kcodeView/webview/preview.ts`, `src/acp/callbacks.ts`, `src/types/index.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 聊天面板布局`（验收按钮）
- `KCodePanel.ts` — 扩展侧处理 ACP 回调，收集文件变更，通知 WebView
- `app.ts` — `initMessageHandler` 添加验收相关消息处理器
- `preview.ts` — `showDiff(original, modified)` 已实现
- `callbacks.ts` — `writeTextFile()` 需记录变更文件的原内容和新内容
**状态**: ⬜ 未开始

### P3-04: 右键菜单扩展
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `src/store/TaskStore.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 任务右键菜单`
- `KCodeSidebarProvider.ts` — `onDidReceiveMessage` 处理 `pinTask` 消息
- `sidebar.ts` — `showContextMenu` 显示"置顶/取消置顶" + "Delete"
- `TaskStore.ts` — 新增 `updateTaskPin` 方法
**状态**: ✅ 已完成

### P3-05: 聊天面板任务信息栏

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`

**实现说明**:
- 聊天面板顶部新增固定任务信息栏，不随消息滚动
- 第一行：任务标题 + 状态徽标（Pending/Active/Completed）
- 第二行：创建时间 + 待验收文件数（预留，当前恒为 0）
- `loadTask()` 时通过 `updateTaskInfo` 消息发送任务信息到 WebView
- `updateTaskInfo()` 函数处理 WebView 端 DOM 更新

**状态**: ✅ 已完成
