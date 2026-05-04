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

_延后：P3-02 验收流程（方案待定）_

**验收标准**：侧边栏支持分组和折叠。

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
