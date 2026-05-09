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
| P3-06 | 右键菜单重新设计（任务/分组） | ✅ 已完成 |

_注：P3-02 验收流程已被 Phase 5 的新状态模型覆盖，不再独立实现。_

**验收标准**：侧边栏支持分组和折叠。

---

## Phase 6: 对话显示体验升级

_目标：升级 AI 对话消息渲染质量，实现与 Kilo 接近的消息展示体验。_

| 任务 | 说明 | 状态 | 优先级 |
|------|------|------|--------|
| P6-01 | Markdown 渲染升级（marked + 代码块语法高亮） | 📋 已调研 | P0 |
| P6-02 | 流式消息增量渲染优化 | 📋 已调研 | P0 |
| P6-03 | Tool 调用 UI 改进（按工具类型差异渲染） | 📋 已调研 | P1 |
| P6-04 | 对话消息 UX 细节完善（Code 复制、时间戳、Diff 总结） | 📋 已调研 | P2 |

**验收标准**：AI 回复代码块带语法高亮，流式输出不闪烁不碎裂，工具调用状态清晰可辨，对话消息信息完整。

---

### P6-01: Markdown 渲染升级（P0）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`, `package.json`

**Kilo 参考**:
- `packages/kilo-ui/src/components/markdown.tsx` — Markdown 组件，用 `marked` + `shiki` 渲染
- `packages/kilo-ui/src/components/markdown.css` — Markdown 样式
- `packages/kilo-ui/src/components/code.tsx` — 代码块渲染（高亮 + 复制按钮）

**调研结果**:
- `app.ts:89-106` — `simpleMarkdown()` 纯正则替换，缺失：代码块语法高亮、标题、列表、表格、引用、分割线
- `KCodePanel.ts:764-853` — `getInlineStyles()` 内联 CSS，代码块预/码样式需扩展
- WebView 当前通过 `<script src="out/...js">` 加载编译后 JS（无打包工具），无法直接 npm import。需引入 CDN 加载 `marked` + `highlight.js`，或引入 esbuild/vite 打包 webview 脚本

**调研步骤**:
1. 读取 Kilo 的 `markdown.tsx` 确认 `marked` 用法和配置
2. 确认 `package.json` 已安装的构建工具情况
3. 决定方案：CDN 加载 vs 内置打包
4. 安装 `marked` 库并集成到 webview

**状态**: 📋 已调研

---

### P6-02: 流式消息增量渲染优化（P0）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**Kilo 参考**:
- `packages/kilo-ui/src/components/message-part.tsx:1258-1412` — `TextPartDisplay` 用 `createThrottledValue` 节流流式文本，每次只更新文本内容而非重建 DOM
- `packages/kilo-ui/src/components/markdown.tsx` — 底层的 Markdown 组件支持增量文本更新

**调研结果**:
- `app.ts:112-141` — `handleAgentStreamUpdate()` 每 chunk 全量 `innerHTML = rendered`，破坏流式过程中的代码块
- 方案：追踪已渲染文本长度，每次只追加新内容
- `marked.Lexer` 可部分解析不完整 markdown，配合增量策略避免代码块中间状态渲染
- 扩展侧（`KCodePanel.ts`）可考虑发送增量文本而非全量

**调研步骤**:
1. 在 P6-01 基础上实现增量渲染策略
2. 处理边界：代码块未闭合时的渲染降级

**状态**: 📋 已调研

---

### P6-03: Tool 调用 UI 改进（P1）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**Kilo 参考**:
- `packages/kilo-ui/src/components/basic-tool.tsx` — `BasicTool` 可折叠卡片（图标 + 参数 + 展开输出），所有工具的基础 UI
- `packages/kilo-ui/src/components/message-part.tsx:1153-1241` — `ToolPartDisplay` 通过 `PART_MAPPING` + `ToolRegistry` 按工具类型分发渲染
- `packages/kilo-ui/src/components/message-part.tsx:184-293` — `getToolInfo()` 根据工具名返回对应 icon/title/subtitle
- `packages/kilo-ui/src/components/shell-rolling-results.tsx` — bash 工具的实时输出流渲染
- `packages/kilo-ui/src/components/context-tool-results.tsx` — read/glob/list 上下文工具的折叠渲染
- `packages/kilo-ui/src/components/tool-utils.ts` — 工具状态工具函数（`busy`、`useToolFade` 等）

**调研结果**:
- `app.ts:785-839` — Tool 消息渲染只有一种深绿色气泡样式，不区分工具类型
- `app.ts:810-838` — `renderToolBubbleContent()` 通用展示 `status + kind: title`，output 折叠在 `pre` 中
- Kilo 做法：每种工具注册独立渲染器。bash 用 `ShellRollingResults` 实时输出流；read/glob/list 用 `BasicTool` 折叠卡片（图标 + 参数 + 展开内容）；pending 状态有 shimmer 动画
- 当前 KCode 每个 tool 都是同一套样式，没有 pending/running/completed 的状态动画

**调研步骤**:
1. 读 Kilo `getToolInfo()` + `PART_MAPPING` 理解工具注册机制
2. 定义工具类型和对应的渲染配置映射表（KCode 用 Object 映射即可）
3. 为 bash 工具增加实时输出流渲染
4. 为 read/write/glob 增加文件路径 subtitle
5. 添加 pending → running → completed 状态过渡动画

**状态**: 📋 已调研

---

### P6-04: 对话消息 UX 细节完善（P2）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**Kilo 参考**:
- `packages/kilo-ui/src/components/code.tsx` — 代码块 + 右上角复制按钮实现
- `packages/kilo-ui/src/components/message-part.tsx:724-925` — `UserMessageDisplay` 时间戳 + model 名渲染
- `packages/kilo-vscode/webview-ui/src/components/chat/VscodeSessionTurn.tsx:80-92` — Diff 总结条（`diffs()` 提取文件变更，`DiffChanges` 组件渲染 +X -Y）

**调研结果**:
- `app.ts:279-301` — `addUserMessage()` 只有文本，没有时间戳、文件附件、model 信息
- `app.ts:527-542` — Agent 消息底部没有 Code 复制按钮、没有反馈 thumbs
- 当前无 Diff 总结 — Agent 回复后不在消息底部显示文件变更摘要
- Kilo 做法：用户消息带时间 + model 名；代码块 hover 出复制按钮；每个 turn 底部自动显示 `N files changed (+X -Y)` 摘要条

**调研步骤**:
1. 读 Kilo `UserMessageDisplay` 了解时间戳 + model 信息渲染
2. 读 Kilo `code.tsx` 了解代码块复制按钮实现
3. 读 Kilo `VscodeSessionTurn` 了解 Diff 总结条的实现
4. 消息元信息扩展：时间戳、状态标签
5. 代码块右上角增加复制按钮
6. Agent 回复末尾增加 Diff 总结条（文件数 + 增删行数），点击跳转右侧 Diff tab

**状态**: 📋 已调研

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
| P4-04 | OpenCode ACP 协议完整接入 | ✅ 已完成 |
| P4-05 | Tool 调用独立消息渲染 | ✅ 已完成 |

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

### P4-05: Tool 调用独立消息渲染

**目标**: 将 Tool 调用从 agent 文本流中分离出来，渲染为独立消息卡片，只显示一行摘要，多余内容可折叠展开。

**涉及文件**: `src/types/index.ts`, `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`

**实现内容**:
- `ChatMessage` 新增 `role: 'tool'`、`type: 'tool_call'`
- `KCodePanel.createAgentResponseHandler` — `onToolCall`/`onToolCallUpdate` 发送独立 `toolCallUpdate` 消息到 WebView，不再混入 agent 文本流
- `onDone` 时将所有 `activeToolCalls` 持久化为 `ChatMessage` 存入 store
- `app.ts` 处理 `toolCallUpdate` 消息，实时创建/更新 tool 消息 DOM 元素
- `addMessageElement` 支持 `role === 'tool'` 渲染（从 store 加载时的静态渲染）
- Tool 消息 UI：深绿色气泡，左侧对齐，`sender = "🔧 Tool"`，仅显示 `{status_icon} kind: title` 一行；有点击展开箭头查看完整 output

**状态**: ✅ 已完成

### P4-04: OpenCode ACP 协议完整接入

**目标**: 完成插件与 opencode ACP 协议的完整对接，确保协议全流程（初始化→会话→提示→流式更新→工具调用→计划→完成）正常运作。

**涉及文件**: `src/types/index.ts`, `src/acp/callbacks.ts`, `src/acp/AcpClient.ts`, `src/acp/AgentManager.ts`, `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/acp/FakeAgent.ts`, `src/acp/OpenAIAgent.ts`, `package.json`

**实现内容**:
- `AcpMessageHandler` 新增 `onToolCall`、`onToolCallUpdate`、`onPlan` 回调，`onDone` 支持 `stopReason` 参数
- `KCodeClient.sessionUpdate` 完整路由 `tool_call`、`tool_call_update`、`plan` 到 handler
- `AcpClient` 初始化传递 `clientInfo`；`prompt` 结果传递 `stopReason` 到 `onDone`；新增 `closeSession` 远程关闭
- `AgentManager` 新增 `startOpenCodeAgent` 便捷方法
- `KCodePanel` 新增 `opencode` 专用 Agent 类型，自动构造 `opencode acp --port 0 --cwd <workspace>` 命令
- 工具调用和计划事件实时渲染到对话流中（🔧 工具状态、📋 执行计划）
- 配置项 `kcode.opencodePath` 支持自定义 opencode 可执行文件路径

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

**涉及文件**: `src/kcodeView/KCodePanel.ts`, `src/kcodeView/webview/app.ts`, `src/kcodeView/webview/preview.ts`, `src/acp/callbacks.ts`, `src/types/index.ts`, `src/acp/AcpClient.ts`

**实现内容**:
- `callbacks.ts` — `writeTextFile()` 覆盖前读取原内容，按 session 记录变更文件列表（filePath + original + modified）
- `AcpClient.ts` — `setCurrentSession(sessionId)` 在 prompt 前设置, `getReviewChanges(taskId)` 对外暴露变更
- `KCodePanel.ts` — `triggerReviewRequest()` 收集变更，发送 `showReviewRequest` 消息（含 changes 数组）
- `app.ts` — 处理 `showReviewRequest`，在验收卡片底部展示文件变更列表，点击条目调用 `showDiff` 在右侧面板 Diff tab 展示
- `preview.ts` — `showDiff` 已有实现，验收流程中直接调用
- `types/index.ts` — 新增 `FileChange` 接口

**状态**: ✅ 已完成

### P3-04: 右键菜单扩展
**涉及文件**: `src/kcodeView/KCodeSidebarProvider.ts`, `src/kcodeView/webview/sidebar.ts`, `src/store/TaskStore.ts`
**调研结果**:
- UI 设计参考 `PROJECT.md > UI 设计 > 任务右键菜单`
- `KCodeSidebarProvider.ts` — `onDidReceiveMessage` 处理 `pinTask` 消息
- `sidebar.ts` — `showContextMenu` 显示"置顶/取消置顶" + "Delete"
- `TaskStore.ts` — 新增 `updateTaskPin` 方法
**状态**: ✅ 已完成

### P3-06: 右键菜单重新设计（任务/分组）

**涉及文件**: `src/kcodeView/webview/sidebar.ts`, `src/kcodeView/KCodeSidebarProvider.ts`, `src/store/TaskStore.ts`, `src/types/index.ts`

**实现说明**:
- 任务右键菜单改为：重命名 / 置顶 / 归档 / 移至分组（含未分组和所有分组，当前分组带 ✔ 标记）
- 分组右键菜单改为：重命名 / 上移 / 下移 / 删除
- Task 类型新增 `archived` 字段，归档任务自动从列表隐藏
- TaskStore 新增 `renameGroup`、`moveGroup`、`updateTaskArchive` 方法
- 删除分组时自动清空关联任务的 group 字段
- 右键子菜单通过 CSS hover 实现（`.has-submenu` + `.submenu`）

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
