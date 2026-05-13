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
| P6-01 | Markdown 渲染升级（marked + 代码块语法高亮） | ✅ 已完成 | P0 |
| P6-02 | 流式消息增量渲染优化 | ✅ 已完成 | P0 |
| P6-03 | Tool 调用 UI 改进（按工具类型差异渲染） | ✅ 已完成 | P1 |
| P6-04 | 对话消息 UX 细节完善（Code 复制、时间戳、Diff 总结） | ✅ 已完成 | P2 |

**验收标准**：AI 回复代码块带语法高亮，流式输出不闪烁不碎裂，工具调用状态清晰可辨，对话消息信息完整。

---

### P6-05: 输入框停止按钮（生成中可中断）

**涉及文件**:
- `src/kcodeView/KCodePanel.ts`
- `src/kcodeView/webview/app.ts`
- `src/acp/FakeAgent.ts`
- `src/acp/OpenAIAgent.ts`

**调研结果**:
- `KCodePanel.ts:26` — 新增 `isGenerating` 状态跟踪
- `KCodePanel.ts:68-75` — 新增 `stopGeneration` 消息处理 + `handleStopGeneration()` 调用对应 agent 的 cancel
- `KCodePanel.ts:720-745` — HTML 新增 send/stop 按钮（SVG图标），通过 `generationState` 消息通知 WebView 切换
- `app.ts:294-318` — `initChat()` 绑定 send/stop 按钮点击事件
- `app.ts:320-334` — `handleGenerationState()` 切换按钮显隐
- `FakeAgent.ts:14-16` — 新增 `cancel()` 设置取消标记，prompt 循环中检查
- `OpenAIAgent.ts` — 新增 `abortControllers` map、`cancel(sessionId)` 方法调用 AbortController.abort()

**实现说明**:
- 发送按钮（↑ 箭头图标，蓝色 hover）和停止按钮（■ 方块图标，红色 hover）共享 input-actions 位置
- 生成开始时（`setGenerationState(true)`），Extension 向 WebView 发送 `generationState { isGenerating: true }`，WebView 隐藏发送按钮、显示停止按钮
- 生成结束（onDone/onError），Extension 发送 `generationState { isGenerating: false }`，恢复发送按钮
- 停止按钮点击 → `vscode.postMessage({ type: 'stopGeneration', taskId })` → `handleStopGeneration` → 调用 agent.cancel(taskId)
- ACP: `AcpClient.cancel()` 发送 `connection.cancel({ sessionId })` 给 Agent 进程
- FakeAgent: 设置 cancelled flag，prompt 循环检测到后调用 `handler.onDone('cancelled')`
- OpenAIAgent: AbortController.abort() 中断 fetch，catch 中识别 `AbortError` + 检查 controller 是否已从 map 移除（区分用户取消 vs 超时）
- 取消后 `onDone('cancelled')` 触发 `setGenerationState(false)` 恢复 UI

**状态**: ✅ 已完成

> 🟫 Level 0 — 自举之路第一步：能看清 AI 写的代码

---

## Phase 7—10: 自举之路

_目标：逐步用 KCode 自身开发 KCode，从"能看"到"完全切换"。_

| Phase | Level | 目标 | 状态 |
|-------|-------|------|------|
| **6** | 🟫 Level 0 — 能看 | 提升 AI 输出可读性 | ✅ 当前 |
| **7** | 🟥 Level 1 — 能改 | 参与修小 bug | ✅ 已完成 |
| **8** | 🟧 Level 2 — 能造 | 完成独立小功能 | ✅ 已完成 |
| **9** | 🟨 Level 3 — 能带 | 主导功能开发 | ⬜ 未开始 |
| **10** | 🟩 Level 4 — 能吃 | 完全切换到 KCode | ⬜ 未开始 |

各阶段详细目标和验收标准见 `PROJECT.md > 自举之路`。

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

**状态**: ✅ 已完成

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

**状态**: ✅ 已完成

---

### P6-03: Tool 调用 UI 改进（按工具类型差异渲染）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**调研结果**:
- `app.ts:852-992` — `renderToolBubbleContent()` 重写为按工具类型差异渲染
- `app.ts:971-991` — `getToolKindIcon()` 按 tool kind 返回对应图标
- `KCodePanel.ts:859-875` — 新增 tool 类型 CSS（spinner、bash终端、diff 样式、thinking 样式）

**实现说明**:
- **bash/command/terminal**: 运行中自动展开且绿色终端风格，完成后自动折叠，支持点击切换
- **read/glob/grep/search**: 默认折叠卡片，带 ▶/▼ 切换
- **write/edit**: 默认折叠，内容以 diff 颜色展示，点击展开查看
- **thinking**: 极简样式（灰色斜体），无展开内容
- **其他**: 保持原有折叠卡片行为
- **运行中状态**: 统一显示旋转动画代替 ⏳，完成后切换为 ✅/❌
- 每个工具类型都有对应的图标前缀（`$` / 📖 / ✏️ / 🔍 / 🔎 / 💭）

**状态**: ✅ 已完成

---

### P6-04: 对话消息 UX 细节完善（Code 复制、时间戳、Diff 总结）

**涉及文件**: `src/kcodeView/webview/app.ts`, `src/kcodeView/KCodePanel.ts`

**调研结果**:
- Code 复制按钮已通过 marked 渲染器内建（`code-copy-btn`），hover 时显示，点击复制到剪贴板
- `app.ts:340-345` — `formatTimestamp()` 日期格式化（今天显示 HH:mm，之前显示 MM/DD HH:mm）
- `app.ts:306-328` — `addUserMessage()` 新增消息时间戳
- `app.ts:567-592` — `addMessageElement()` 所有消息类型增加时间戳渲染
- `app.ts:413-430` — `collectChangedFiles()` / `renderMessages()` 扫描 agent 消息后的 write/edit 工具调用，在 agent 消息底部展示变更文件列表
- `KCodePanel.ts:860` — `.msg-timestamp` CSS
- `KCodePanel.ts:875` — `.agent-diff-summary` CSS

**实现说明**:
- 时间戳：每条消息 sender 旁显示，今天仅显示 HH:mm，之前显示 MM/DD HH:mm
- Diff 总结：agent 文本消息底部自动扫描其后跟随的 write/edit 工具调用，汇总展示📄 变更文件列表，带绿色左边框视觉区隔

**状态**: ✅ 已完成

---

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

---

## Phase 7: 自举之路 Level 1 — 能改

_目标：端到端验证目标确认与验收流程，修复发现的真实问题。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P7-01 | Goal 中心化 — 固定显示与可编辑 | ✅ 已完成 |
| P7-02 | 验收增强 — 变更文件关联 + 驳回带原因 | ✅ 已完成 |
| P7-03 | 进度线节点重构为固定 5 阶段 | ✅ 已完成 |
| P7-04 | ACP 尾部数据丢失修复 — prompt 响应后 200ms 缓冲 | ✅ 已完成 |

---

### P7-01: Goal 中心化 — 固定显示与可编辑

**涉及文件**:
- `src/types/index.ts` — ChatMessage type 增加 `'goal_updated'`
- `src/kcodeView/KCodePanel.ts` — HTML 增加 goal-header 区域；CSS 增加 goal-header 样式；`sendTaskInfo` 增加 goal/goalHint/taskType；新增 `handleUpdateGoal` 方法；消息处理注册 `updateGoal`
- `src/kcodeView/webview/app.ts` — `updateTaskInfo` 更新 goal header；新增 `showGoalViewMode`/`showGoalEditMode`/`initGoalHeader`；`addMessageElement` 处理 `goal_updated` 类型渲染

**实现说明**:
- **G1 Goal 固定显示**：对话区顶部添加 sticky `#goal-header`，task 类型且 goal 非空时显示，cancelled/completed 状态隐藏
- **G2 随时修改 Goal**：点击 ✏️ 按钮进入行内编辑，Enter 保存/ Escape 取消，保存后更新 store 并刷新 UI
- **G3 Goal 变更记录**：每次修改生成 `goal_updated` 类型消息，以卡片形式展示变更 diff

**状态**: ✅ 已完成

---

### P7-02: 验收增强 — 变更文件关联 + 驳回带原因

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleRejectReview` 接受 reason 参数；消息处理 `rejectReview` 传递 reason
- `src/kcodeView/webview/app.ts` — `handleShowReviewRequest` 增强显示（文件类型图标/行数摘要）；新增 `showRejectInput` 驳回输入 UI；`rejectReview` 消息带 reason
- `src/kcodeView/KCodePanel.ts` — CSS 新增 `.review-changes-icon/name/type/summary`、`.reject-input-area/input/btn-row`

**实现说明**:
- **R6 变更文件关联**：每个文件显示类型图标（📄新建/📝修改/🗑️删除）+ 行数摘要，点击通过 VS Code 原生 diff 编辑器打开对比（`vscode.diff`）
- **R5 驳回带原因**：点击"驳回"显示文本输入框，填写原因后确认驳回；原因作为用户消息发送给 AI，AI 可针对性修改
- diff 不再在右侧面板内联渲染，复用 VS Code 原生 diff 能力

**状态**: ✅ 已完成

---

### P7-03: 进度线节点重构为固定 5 阶段

**涉及文件**:
- `src/types/index.ts` — ProgressNode type 改为 5 固定阶段 + status 新增 cancelled
- `src/kcodeView/KCodePanel.ts` — 重写 `deriveNodes()`，始终返回 5 节点；CSS 新增 `.tl-node.status-cancelled`
- `src/kcodeView/webview/app.ts` — `getNodeEmoji()` 对应 5 阶段；`handleNodePanelUpdate()` 适配固定渲染
- `PROJECT.md` — 已先更新状态机文档

**调研结果**:
- 设计已在 PROJECT.md 确认：5 固定阶段，4 种颜色状态
- ProgressNode: `type: 'demand' | 'goal' | 'plan' | 'execute' | 'review'`
- ProgressNode: `status: 'pending' | 'active' | 'completed' | 'cancelled'`
- 节点始终显示，颜色区分状态
- "从用户开始，到用户终止"设计原则
- 中断点标记 ❌，后续节点 ⚪

**状态**: ✅ 已完成

---

### P8-09: TaskFlow 模块抽取 — 阶段状态机与 UI 解耦

**涉及文件**:
- `src/taskflow/TaskFlow.ts` — **新建**：阶段状态机 + TASK_UPDATE 协议 + 阶段提示词 + 用户确认操作，零 UI 依赖
- `src/kcodeView/KCodePanel.ts` — 移除 `parseTaskUpdate/validatePhaseAction/executePhaseAction/buildTaskPrompt/buildPlanSection/processGoalProposal` 等内联方法，改为委托 `this.taskFlow.*`
- `src/kcodeView/webview/app.ts` — 无改动（UI 渲染不变）
- `PROJECT.md` — 新增 `src/taskflow/TaskFlow.ts` 模块文档

**实现说明**:
- **TaskFlow 职责**：phase 迁移、TASK_UPDATE 解析/执行/拦截、prompt 构建、用户确认操作的状态迁移
- **KCodePanel 职责**：agent 通信、WebView 消息、消息存储、UI 渲染 — 通过 `TaskFlowDelegate` 接收事件
- **纯逻辑模块**：`TaskFlow.ts` 不 import VS Code API，`ITaskStore` 接口可通过 mock 替换，适合 CLI 测试
- **已迁移的方法**：
  - `parseTaskUpdate()` → `TaskFlow.processChunk()`
  - `validatePhaseAction()` → `TaskFlow.validateAction()`
  - `executePhaseAction()` → `TaskFlow.executeAction()`
  - `buildTaskPrompt()` → `TaskFlow.buildPrompt()`
  - `processGoalProposal()` → `TaskFlow.processGoalProposal()`
  - `buildPlanSection()` → `TaskFlow.buildPlanSection()`
  - `handleConfirm*` → 拆分为状态迁移（TaskFlow）+ 消息/agent 操作（KCodePanel）

**状态**: ✅ 已完成

---

### P7-04: ACP 尾部数据丢失修复 — prompt 响应后 200ms 缓冲

**涉及文件**:
- `src/acp/AcpClient.ts` — `prompt()` 方法增加 200ms 缓冲

**调研结果**:
- KiloCode ACP agent (`agent.ts`) 的事件循环与 `sdk.session.prompt()` 存在竞态：`message.part.delta` 通过独立 `for await...of` 事件循环处理，最后几个 delta 可能在 `prompt()` resolve 后才处理完毕，导致最后几个 `agent_message_chunk` 通知在 `session/prompt` 响应之后到达
- KCode 侧 `AcpClient.prompt()` 在 `connection.prompt()` resolve 后立即调用 `removeSessionHandler()`，后续到达的 `sessionUpdate` 被丢弃
- 表现为 ACP 日志中 `[TASK_UPDATE]` 块不完整（缺少 PENDING 段和 `[/TASK_UPDATE]`）
- `@agentclientprotocol/sdk` 的 `sendMessage` 使用 Promise 链写队列，但 `sendNotification` 的 `await` 在写排入队列后就返回，不等实际写入完成

**实现说明**:
- `AcpClient.prompt()` 在 `connection.prompt()` resolve 后添加 `await new Promise(resolve => setTimeout(resolve, 200))`
- 200ms 缓冲让 straggler `agent_message_chunk` 通知到达并被 `sessionHandler` 处理，然后再移除 handler 并调用 `onDone()`

**状态**: ✅ 已完成

---

## Phase 8: 自举之路 Level 2 — 能造

_目标：实现 `<TASK_UPDATE>` 协议驱动的 5 阶段全流程（demand → goal → plan → execute → review），用 KCode 自身完成独立小功能。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P8-01 | 数据模型扩展 — Task 增加 phase / confirmedItems / pendingItems / planSteps | ✅ 已完成 |
| P8-02 | `<TASK_UPDATE>` 协议解析器 — 替换旧 `[TASK_STATUS]` / `[FILE]` 标记 | ✅ 已完成 |
| P8-03 | 阶段分发提示词 — buildTaskPrompt() 按 phase 分派 4 套提示词 | ✅ 已完成 |
| P8-04 | 对话式阶段迁移 — 移除强制卡片阻断，自然对话推进阶段 | ✅ 已完成 |
| P8-05 | 顶部看板增强 — 显示当前阶段 + 共识条目 | ✅ 已完成 |
| P8-06 | 计划确认按钮 — 计划方案卡片 + 确认/调整按钮 | ✅ 已完成 |
| P8-07 | 验收文件列表 — 点击文件打开 diff 对比窗口 | ✅ 已完成 |
| P8-08 | 全阶段确认按钮 — 每阶段必须用户点击确认才进入下一阶段 | ✅ 已完成 |
| P8-09 | TaskFlow 模块抽取 — 阶段状态机与 UI 解耦 | ✅ 已完成 |
| P8-10 | Self-Verify 自验阶段 — Execute 后 AI 自动审查代码再交人类验收 | ✅ 已完成 |

---

### P8-01: 数据模型扩展 — Task 增加 phase / confirmedItems / pendingItems / planSteps

**涉及文件**:
- `src/types/index.ts` — Task interface 新增 `phase`, `confirmedItems`, `pendingItems`, `planSteps`
- `src/store/TaskStore.ts` — CRUD 适配新字段（含 `updateTaskPhase()`, `updateConfirmedItems()`, `updatePendingItems()`, `updatePlanSteps()`, `updatePlanStepStatus()`）

**调研结果**:
- `Task` 当前无 phase / confirmedItems / pendingItems / planSteps 字段（`src/types/index.ts:1-12`）
- `TaskStore` 当前有 `updateTaskGoal()`, `updateTaskStatus()`, `updateTaskPin()`, `updateTaskArchive()`, `updateTaskNodeMessageId()`, `updateTaskTitle()`, `updateTaskGroup()`, `renameGroup()`, `moveGroup()` 方法
- `Task.status` 保留原值，新增 `phase` 管理 5 阶段内流转（design doc §六）

**实现说明**:
- Task.phase: `'demand' | 'goal' | 'plan' | 'execute' | 'review'`，新任务默认 `'demand'`
- Task.confirmedItems: `string[]`，已锁定共识条目
- Task.pendingItems: `string[]`，待讨论条目
- Task.planSteps: `{ content: string; status: 'pending' | 'active' | 'completed' }[]`，计划步骤
- `buildTaskPrompt()` 和 `parseTaskUpdate()` 依赖此模型，必须先完成

**状态**: ✅ 已完成

---

### P8-02: `<TASK_UPDATE>` 协议解析器 — 替换旧标记

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 合并 `stripTaskMarker()` + `stripFileMarkers()` 为 `parseTaskUpdate()`；新增 `validatePhaseAction()` 校验

**调研结果**:
- `KCodePanel.ts:370-400` — `stripTaskMarker()` 匹配 `[TASK_STATUS:...]`，`stripFileMarkers()` 匹配 `[FILE]...`，均需替换为 `<TASK_UPDATE>` JSON 协议
- 新解析器需兼容流式输出：每次 chunk 到达后扫描 `<TASK_UPDATE>...</TASK_UPDATE>`，剥离后送给前端渲染
- 解析规则见 design doc §三

**实现说明**:
- **正则匹配**: `/<TASK_UPDATE>([\s\S]*?)<\/TASK_UPDATE>/g` 从累积文本中提取，剥离后不展示给用户
- **JSON 解析**: 解析 `{ phase, action, confirmed_items, pending_items }`
- **阶段校验**: `validatePhaseAction(currentPhase, action)` — 按 design doc §3.3 表校验
  - demand: 大模型不输出迁移指令
  - goal: 仅 `propose_goal`, `lock_goal`
  - plan: 仅 `propose_plan`, `lock_plan`
  - execute: 仅 `finish_execute`
  - review: 仅 `accept`, `reject`
- **副作用**: 解析成功后自动调用 `sendTaskInfo()` + `sendNodePanelUpdate()` 刷新看板+节点
- **非法指令**: 日志警告，不执行，不报错给用户
- `stripTaskMarker()` + `stripFileMarkers()` 保留到下游兼容期结束再删除

**状态**: ✅ 已完成

---

### P8-03: 阶段分发提示词 — 分层外置架构

**涉及文件**:
- `src/taskflow/prompts/base.ts` — AI 人格基线
- `src/taskflow/prompts/protocol.ts` — TASK_UPDATE 协议全量参考
- `src/taskflow/prompts/demand.ts` — 需求收集阶段
- `src/taskflow/prompts/goal.ts` — 目标确认阶段
- `src/taskflow/prompts/plan.ts` — 计划制定阶段
- `src/taskflow/prompts/execute.ts` — 执行阶段
- `src/taskflow/prompts/review.ts` — 验收阶段
- `src/taskflow/TaskFlow.ts` — `buildPrompt()` 分层组装 + `buildTaskContext()` + `buildPhasePrompt()`
- `src/kcodeView/KCodePanel.ts` — 移除硬编码 demand 格式化字符串，统一走 `buildPrompt()`

**实现说明**:

提示词从 KCodePanel 内联字符串 → TaskFlow.ts 独立文件分层，参考 kilocode 的 "分层 + 外置 + 动态" 模式。

`buildPrompt()` 输出组装顺序：
1. **BASE_PROMPT** — "你是一个专注于任务驱动的 AI 编程助手"
2. **PROTOCOL_PROMPT** — TASK_UPDATE 协议规则（一次定义，不重复）
3. **buildTaskContext()** — 动态提取 task.goal/confirmedItems/planSteps/pendingItems
4. **buildPhasePrompt()** — 按 task.phase 从 prompts/ 目录加载对应文件

| Phase | 提示词文件 | 行为约束 |
|-------|-----------|---------|
| `demand` | `demand.ts` | 只做目标归纳，不写代码，输出 propose_goal |
| `goal` | `goal.ts` | 与用户讨论确认，输出 propose_goal/lock_goal |
| `plan` | `plan.ts` | 基于锁定目标制定计划，输出 propose_plan |
| `execute` | `execute.ts` | 可写代码/改文件/执行命令，输出 finish_execute |
| `review` | `review.ts` | 展示变更，输出 accept/reject |

**额外变更**:
- `parseTaskUpdate()` 修复 `const text` 造成的 regex 死循环（改为 `let text` + 同步局部变量）
- `src/taskflow/__tests__/TaskFlow.test.ts` — 7 个测试用例覆盖分层 prompt/协议解析/完整流程
- KCodePanel `handleSendMessage` 首条消息不再走硬编码字符串，统一从 buildPrompt 获得 demand 阶段提示词

**状态**: ✅ 已完成

---

### P8-06: 计划确认按钮

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `planProposed` 状态跟踪、`showPlanConfirmation()`、`handleConfirmPlan()`、`handleRejectPlan()`、计划阶段提示词移除自动 lock_plan；HTML 新增 `#plan-confirm-btn`；CSS 新增 `.plan-confirm-btn` 样式
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 在 phase='plan' 时显示确认按钮；`initChat()` 绑定按钮点击事件；`handleShowPlanProposal()` 渲染计划卡片（带确认/调整按钮）

**实现说明**:
- **持久按钮（主要路径）**: 顶部看板阶段标识旁新增「确认计划」按钮，当 `task.phase === 'plan'` 时始终可见，不依赖 AI 输出 TASK_UPDATE 协议
- **AI 提案卡片（辅助路径）**: AI 输出 `propose_plan` 时仍在对话区渲染计划方案卡片，提供相同的确认/调整按钮
- 两路均调用 `handleConfirmPlan()` → `executePhaseAction('lock_plan')` → 推进到执行阶段并重新提示 AI
- 兼容对话模式：用户也可直接输入文字确认，AI 输出 `lock_plan` 仍会正确处理

**状态**: ✅ 已完成

### P8-07: 验收文件列表 — 点击打开 diff

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `triggerReviewRequest()` 已有变更收集 + `showReviewRequest` 消息发送
- `src/kcodeView/webview/app.ts` — `handleShowReviewRequest()` 渲染文件列表，每项点击触发 `toggleReviewFileSelection()` → 右侧面板 diff + 原生 diff 按钮
- `src/kcodeView/webview/preview.ts` — `showDiffWithFile()` 全局注册，支持在 diff tab 显示文件名头 + 内联 diff + "打开原生对比" 按钮

**功能说明**:
- `triggerReviewRequest()` 从 agent 收集 `FileChange[]`（含 filePath/original/modified），发送 `showReviewRequest` 到 WebView
- WebView 在验收消息底部渲染文件变更列表（带类型图标 📄新建/📝修改/🗑️删除 + 行数摘要）
- 点击文件 → 右侧面板 Diff tab 显示内联 diff + 文件名头
- 点击"⇱ 打开原生对比" → VS Code `vscode.diff` 命令打开原生 diff 编辑器
- 各 agent 实现 `getReviewChanges()` 返回当前会话的变更文件列表

**状态**: ✅ 已完成

---

### P8-08: 全阶段确认按钮 — 每阶段必须用户点击确认才进入下一阶段

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — 添加 `executeFinished` 状态追踪、`parseTaskUpdate()` 拦截 AI 自动迁移、`handleConfirmExecuteDone()` / `handleConfirmGoalFromHeader()` 处理器、HTML header 新增 goal/execute 确认按钮
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 新增 goal/execute 阶段 header 按钮显隐逻辑、`initChat()` 绑定按钮事件

**实现说明**:
- **拦截 AI 自动迁移**: `parseTaskUpdate()` 禁止 AI 输出的 `lock_goal`, `lock_plan`, `accept`, `reject` 自动触发阶段迁移，必须用户点击确认按钮
- **execute → review**: AI 输出 `finish_execute` 时不再自动迁移，仅设置 `executeFinished` 标志 → header 显示"确认完成 ✓"按钮 → 用户点击后调用 `handleConfirmExecuteDone()` 完成迁移
- **goal 阶段**: header 新增"确认目标 ✓"按钮，与 goal 卡片确认按钮功能一致（`handleConfirmGoalFromHeader()` → `handleConfirmGoal()`）
- **所有阶段按钮**:
  | 阶段 | 按钮 | 位置 |
  |------|------|------|
  | 🎯 goal | 确认目标 ✓ | header + 目标卡片 |
  | 📋 plan | 确认计划 | header + 计划卡片 |
  | ⚡ execute | 确认完成 ✓ | header |
  | ✅ review | 验收通过 ✓ / 驳回 ↩ | 验收卡片 |
- 即使 AI 未输出协议标记，用户仍可通过 header 按钮手动推进阶段

**状态**: ✅ 已完成

---

### P8-04: 对话式阶段迁移 — 移除强制卡片阻断

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `handleConfirmGoal()` 改为后台流转 + 看板刷新；新增 `handlePhaseTransition()` 统一处理 lock_* 后的状态迁移
- `src/kcodeView/webview/app.ts` — 适配新阶段迁移消息（移除对 goal_confirmation 卡片的强制依赖）

**调研结果**:
- `KCodePanel.ts:435-455` — `handleConfirmGoal()` 当前通过 `showGoalConfirmation` 消息发送卡片，用户必须点确认
- design doc §四定义"对话隐式"迁移流程：Agent 输出 `<TASK_UPDATE lock_goal>` 后台切换 phase，看板自动刷新
- 卡片保留但改为**可选的协商汇总展示**，不再强制阻断

**实现说明**:
- **新增 `handlePhaseTransition(tid, action)`**:
  - `lock_goal` → task.phase = 'plan', 更新 confirmedItems, 刷新看板+节点
  - `lock_plan` → task.phase = 'execute', 更新 planSteps, 刷新看板+节点
  - `finish_execute` → task.phase = 'review', task.status = 'in_review', 刷新看板+节点
  - `accept` → task.status = 'completed', 终态
  - `reject` → task.phase = 'execute', task.status = 'active'（驳回后 AI 继续）
- **卡片降级**: goal_confirmation / plan_proposal 卡片仅做汇总展示，用户可通过对话说"好"来确认，无需点按钮
- **看板自动刷新**: phase 切换后 `sendTaskInfo()` + `sendNodePanelUpdate()` 自刷新
- 兼容现有 `handleConfirmGoal` / `handleRejectReview` / `handleAcceptReview` 等已有方法

**状态**: ✅ 已完成

---

### P8-05: 顶部看板增强 — 显示当前阶段 + 共识条目

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — `sendTaskInfo()` 增加 phase / confirmedItems / pendingItems 字段
- `src/kcodeView/webview/app.ts` — `updateTaskInfo()` 渲染阶段标识和共识条目列表

**调研结果**:
- `KCodePanel.ts:1256` — `sendTaskInfo()` 当前发送 title, status, createdAt, type, goal
- `app.ts` — `updateTaskInfo()` 渲染信息栏（任务标题 + 状态徽标 + 创建时间）
- design doc §七要求顶部看板显示当前阶段 + 共识条目

**实现说明**:
- `sendTaskInfo()` 新增字段: `phase`, `confirmedItems`, `pendingItems`, `planSteps`
- 信息栏新增区域：
  - **阶段标识**: 显示当前 phase 名称（中文：需求 / 目标 / 计划 / 执行 / 验收）+ 对应 emoji
  - **共识条目**: confirmedItems 以标签(tag)形式展示，pendingItems 以灰色待定列表展示
  - **计划步骤**: planSteps 在 execute 阶段展示带状态标记的步骤列表
- CSS 新增 `.task-phase-badge`, `.confirmed-tag`, `.pending-tag`, `.plan-step-item`

**状态**: ✅ 已完成

---

### P8-10: Self-Verify 自验阶段 — Execute 后 AI 自动审查代码再交人类验收

**涉及文件**:
- `src/types/index.ts` — phase 增加 `'self_verify'`，ProgressNode type 增加 `'self_verify'`
- `src/taskflow/prompts/self_verify.ts` — **新建**：自验阶段提示词
- `src/taskflow/prompts/protocol.ts` — 添加 `execute → finish_execute → self_verify → finish_verify → review` 流转规则
- `src/taskflow/TaskFlow.ts` — `confirmExecuteDone()` 改为转 `self_verify`；新增 `confirmSelfVerifyDone()` → `review`；新增 `onSelfVerifyNeeded`/`onSelfVerifyFinished` delegate；`parseTaskUpdate` 处理 `finish_verify`；`buildPhasePrompt` 加入 `SELF_VERIFY_PROMPT`
- `src/kcodeView/KCodePanel.ts` — `onExecuteFinished` 后自动 `confirmExecuteDone` + `startAutoGeneration()` 自动发起自验；`onSelfVerifyFinished` 自动过渡到 review + triggerReviewRequest；Add `startAutoGeneration()` 方法；CSS 增加 `.chat-msg.system` 样式
- `src/kcodeView/webview/app.ts` — `deriveNodes` 增加 `self_verify` 节点（6 阶段）；`getNodeLetter` 增加 'V' 映射；`phaseLabels` 增加自验

**实现说明**:

1. **自动流转**：AI 在 execute 阶段输出 `finish_execute` → `parseTaskUpdate` 标记完成 → onDone 时自动调用 `confirmExecuteDone()` 切到 `self_verify` → `startAutoGeneration()` 用新 prompt 发起下一轮生成
2. **边界清晰**：Execute prompt 约束"只做实现"，Self-Verify prompt 约束"只做审查"，靠 phase prompt 切换实现语义分界
3. **自验通过**：AI 输出 `finish_verify` → 自动推进到 `review` → 显示验收卡片给人的
4. **失败兜底**：prompt 约束 AI 最多自验 3 轮，仍失败则向用户说明情况请求协助
5. **进度节点**：看板节点从 5 个扩展为 6 个：需求(D) → 目标(T) → 计划(P) → 执行(E) → 自验(V) → 验收(C)

**状态**: ✅ 已完成

---

## Phase 9: 自举之路 Level 3 — 能带

_目标：KCode 主导功能开发，开发者只做 code review。用 KCode 完成导入 GitHub Issue 的独立功能，从设计到发布的全流程。_

> **来源 Issue**: [DelononLiu/kcode#1 — 调整 markdown 渲染表格简洁](https://github.com/DelononLiu/kcode/issues/1)

| 任务 | 说明 | 状态 |
|------|------|------|
| P9-01 | 导入 GitHub Issue — Task 模型增加 source 字段 | ✅ 已完成 |
| P9-02 | 导入 GitHub Issue — 命令 + 侧边栏按钮 + 输入框 | ✅ 已完成 |
| P9-03 | 导入 GitHub Issue — GitHub API fetch 实现 | ✅ 已完成 |
| P9-04 | 导入 GitHub Issue — rate limit 处理 + token 配置 | ✅ 已完成 |
| P9-05 | 输入队列 — 生成中消息不会丢失，生成结束后自动发送 | ⬜ 未开始 |

---

### P9-01: 导入 GitHub Issue — Task 模型增加 source 字段

**涉及文件**:
- `src/types/index.ts` — 新增 `TaskSource` 接口，`Task` 增加 `source` 字段

**调研结果**:
- 设计文档：`docs/import-github-issue.md §二`
- `Task` 当前无 `source` 字段（`src/types/index.ts:1-12`）

**实现说明**:
- 新增 `TaskSource` 接口：

  ```typescript
  interface TaskSource {
    type: 'github_issue';
    url: string;
    owner: string;
    repo: string;
    issueNumber: number;
  }
  ```
- `Task` 新增 `source?: TaskSource`
- 数据映射见设计文档 §三：`title → GH#{n}: {title}`, `body → task.goal`, `html_url → source.url`

**状态**: ✅ 已完成

---

### P9-02: 导入 GitHub Issue — 命令 + 侧边栏按钮 + 输入框

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — **新建**：URL 输入框 → fetch → 创建 Task → 打开面板
- `src/kcodeView/KCodeSidebarProvider.ts` — 注册 `importGitHubIssue` 消息处理，HTML 新增按钮
- `src/kcodeView/webview/sidebar.ts` — 新增导入按钮点击事件
- `src/extension.ts` — 注册 `kcode.importGitHubIssue` 命令

**调研结果**:
- 交互流程见设计文档 §一：action bar 新增 `[⤓ 导入 Issue]` 按钮
- 输入流程见 §二：`vscode.window.showInputBox` 接收 URL 或 `owner/repo#123`

**实现说明**:
- 侧边栏 action bar 新增 SVG 导入按钮（`⤓` 风格），与 `[+ 新建任务]` 同级
- 点击后调用 `vscode.window.showInputBox`：
  - placeholder: `GitHub Issue URL 或 owner/repo#123`
  - 支持 `https://github.com/owner/repo/issues/123` 和 `owner/repo#123` 两种格式
- URL 解析：`parseGitHubUrl(input)` 提取 owner / repo / issueNumber
- 成功后调用 `vscode.window.withProgress` 显示进度通知
- 导入成功 → `store.createTask()` + 切换到新建任务面板
- 导入失败 → `vscode.window.showErrorMessage`
- 命令注册名：`kcode.importGitHubIssue`

**状态**: ✅ 已完成

---

### P9-03: 导入 GitHub Issue — GitHub API fetch 实现

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — `fetchGitHubIssue()` 函数

**调研结果**:
- API 策略见设计文档 §四：MVP 走无 token 方案，调用 `GET /repos/{owner}/{repo}/issues/{number}`

**实现说明**:
- `fetchGitHubIssue(owner, repo, number, token?)`：
  - 构造 URL: `https://api.github.com/repos/{owner}/{repo}/issues/{number}`
  - 请求头: `Accept: application/vnd.github.v3+json`，有 token 时加 `Authorization: Bearer {token}`
  - 返回: `{ title: string, body: string, html_url: string }`
- URL 解析函数 `parseGitHubUrl(input)`：
  - 支持 `https://github.com/owner/repo/issues/123` → `{ owner, repo, number }`
  - 支持 `owner/repo#123` → `{ owner, repo, number }`
  - 格式不匹配 → 返回 null，上层提示格式错误
- 错误处理：
  - 404 → 提示"Issue 不存在"
  - 403 → 提示"API rate limit 超限，请配置 kcode.githubToken"
  - 网络错误 → 提示"网络异常，请重试"

**状态**: ✅ 已完成

---

### P9-04: 导入 GitHub Issue — rate limit 处理 + token 配置

**涉及文件**:
- `src/commands/importGitHubIssue.ts` — 集成 token 读取
- `package.json` — `contributes.configuration` 新增 `kcode.githubToken`

**调研结果**:
- 设计文档 §四：初始无 token 方案（60 req/h），后续支持配置 token（5000 req/h）

**实现说明**:
- `package.json` 新增配置项：

  ```json
  "kcode.githubToken": {
    "type": "string",
    "default": "",
    "description": "GitHub Personal Access Token，用于提高 API rate limit"
  }
  ```
- `fetchGitHubIssue()` 先读 `vscode.workspace.getConfiguration('kcode').get('githubToken')`
- 有 token → 带 Authorization header；无 token → 匿名请求
- 403 响应头 `x-ratelimit-remaining` 为 0 时，显示具体提示"Rate limit 已用完，请配置 token 或等待 ${resetTime} 后重试"
- 不暴露 token 到日志或 UI

**状态**: ✅ 已完成

---

### P9-05: 输入队列 — 生成中消息不会丢失，生成结束后自动发送

**涉及文件**: _待调研_
**调研步骤**:
1. 读 PROJECT.md 确认当前消息发送流程
2. 读 `KCodePanel.ts` 中 `handleSendMessage` 和 `setGenerationState` 确认生成中拦截逻辑
3. 读 `app.ts` 中 `handleGenerationState` 和 `sendMessage` 确认 WebView 侧 send 按钮切换

**调研结果**:
- `KCodePanel.ts:212` — `if (this.isGenerating) return;` 生成中消息被静默丢弃
- `KCodePanel.ts:835-838` — `setGenerationState()` 只做 isGenerating 状态切换 + 通知 WebView 切换 send/stop 按钮
- `app.ts:502-514` — `handleGenerationState()` 只是 send 按钮 / stop 按钮显隐切换，无队列指示

**实现说明**:
- **KCodePanel.ts**:
  - 新增 `private pendingMessages: { text: string; taskId: string }[] = []`
  - `handleSendMessage()` 中 `if (this.isGenerating) return;` → 改为入队并通知 WebView
  - `setGenerationState(false)` 末尾调用 `flushPendingMessages()`
  - `flushPendingMessages()` 出队调用 `handleSendMessage()` 发送，逐条发送（上一条完成再取下一条）
  - 新增消息类型 `pendingQueueUpdate { count: number }` 通知 WebView 队列状态
- **app.ts**:
  - `handleGenerationState(isGenerating)` 当 `isGenerating=false` 时，检查是否有 pending 标记，显示 "已发送 x 条待发消息" 的 toast 或 badge
  - input area 增加队列数 badge（`#queue-badge`），有排队时显示红色圆点 + 数字
- **边界情况**：
  - Flush 过程中再次遇到 `isGenerating`（AI 又开始生成了）→ 剩余消息继续排队
  - 切换任务时清空队列（`loadTask()` 中重置）
  - 用户手动 stop 后队列保留，flushPendingMessages 在 onDone('cancelled') 后也执行

**状态**: ⬜ 未开始

---

## Phase 10 — 五阶段流程之上

### P10-01: 任务类型分类 + 模板系统

**涉及文件**: _待调研_
**调研步骤**:
1. 读 PROJECT.md 确认现有 Task 类型定义和 5 阶段流程
2. 读 types/index.ts 确认 Task interface
3. 读 KCodePanel.ts 确认空闲态渲染逻辑和消息处理
4. 读 app.ts 确认 WebView 侧交互
5. 读 TaskFlow.ts 确认 buildPrompt 和 review 流程

**调研结果**:
1. **分类层级**: Task 新增 `category?: TaskCategory` + `subType?: string`，4 大类 × 5 子类，存量 task 不受影响
2. **新建页布局**: 复用电 `#chat-area:has(#chat-scroll.chat-empty)` CSS 规则，在空闲态展示分类选择卡片 + 模板输入表单，新增 `selectTaskType` 消息
3. **模板系统**: 纯数据文件 `src/taskflow/templates.ts`，每个子类型定义 `inputFields`/`analysisFramework`/`executionHints`/`acceptanceCriteria` 4 个注入点，不改 5 阶段引擎
4. 3 个需求全部可行，实现顺序：分类层级 + 模板数据（无依赖）→ UI 改造

**涉及文件**:
- `src/types/index.ts` — 新增 `TaskCategory`、`InputField`、`TaskTemplate`、`CategoryDef` 类型 + Task 加 category/subType
- `src/taskflow/templates.ts` — **新建**，定义全部 20 个子类型模板，导出 `getCategories()` / `getTemplate()`
- `src/store/TaskStore.ts` — 新增 `updateTaskCategory()` / `updateTaskSubType()`
- `src/kcodeView/KCodePanel.ts` — 空闲态 HTML 渲染分类卡片 + 表单；消息处理 `selectTaskType`；`buildPrompt` 注入模板的 analysisFramework/executionHints；`triggerReviewRequest` 带上 acceptanceCriteria
- `src/kcodeView/webview/app.ts` — 空闲态渲染分类选择 + 输入表单；新增 `selectTaskType` 消息发送
- `src/taskflow/TaskFlow.ts` — `buildPrompt` / `buildPhasePrompt` 根据 subType 读取模板内容注入

**状态**: ✅ 已完成

---

## 阶段流程增强（基于已有功能补全）

_目标：在 P7/P8 已实现的基础上，补全三个功能群的缺失环节。_

| 任务 | 说明 | 状态 |
|------|------|------|
| P1-P6 | 计划逐步执行跟踪 — AI 通过 `plan_step_update` 协议实时标记步骤进度 | ✅ 已完成 |
| N1-N7 | 进度节点面板增强 — 折叠/展开 + 节点 label 显示 + 点击跳转补全 | ✅ 已完成 |
| R1-R6 | 结构化逐条验收 — 交互式勾选清单 + 部分通过（逐条通过/驳回） | ✅ 已完成 |

---

### Plan-before-Execute (P1-P6): 逐步执行跟踪

**涉及文件**:
- `src/taskflow/TaskFlow.ts` — 新增 `plan_step_update` 协议动作、`onPlanStepUpdate` delegate
- `src/taskflow/prompts/protocol.ts` — 文档 `plan_step_update` 用法
- `src/kcodeView/KCodePanel.ts` — 注册 `onPlanStepUpdate` 回调 → `sendTaskInfo`
- `src/kcodeView/webview/app.ts` — 步骤进度条、活跃步骤高亮

**实现说明**:
1. `TaskFlow.ts`: `plan_step_update` 加入 `validateAction`(execute 阶段可用), `executeAction` 中解析 `INDEX` + `STATUS` 调用 `updatePlanStepStatus`
2. `app.ts`: `updateTaskInfo` 中的 plan steps 渲染增加进度条 (`.plan-progress-bar`)、完成比例显示、活跃步骤蓝色高亮 (`.step-active`)
3. AI 通过 `[TASK_UPDATE]ACTION: plan_step_update\nINDEX: 0\nSTATUS: active[/TASK_UPDATE]` 标记步骤状态
4. `ITaskStore` + `MockTaskStore` + `MockDelegate` 均新增对应接口

**状态**: ✅ 已完成

---

### 进度节点面板增强 (N1-N7): 折叠/展开 + 点击跳转

**涉及文件**:
- `src/kcodeView/KCodePanel.ts` — HTML 新增 `#tl-collapse-btn`；CSS 新增 collapse button 样式 + collapsed 态样式
- `src/kcodeView/webview/app.ts` — `initNodePanel()` 新增 collapse 逻辑（sessionStorage 持久化）；`loadMessages` 清除 acceptanceCheckedState

**实现说明**:
1. **折叠/展开**: `#tl-collapse-btn` 按钮在 gutter 顶部，点击切换 `.collapsed` 类（宽度 28px → 12px，隐藏 dots），状态存 `sessionStorage`
2. **节点 label**: 每个 `.tl-node` 已有 `title` 属性显示中文标签，hover 时浏览器原生 tooltip 展示
3. **self_verify 节点 messageId**: `startAutoGeneration()` 中新增 `updateTaskNodeMessageId(tid, 'self_verify', ...)` 确保自验阶段可点击跳转

**状态**: ✅ 已完成

---

### 结构化验收 (R1-R6): 逐条验收标准

**涉及文件**:
- `src/kcodeView/webview/app.ts` — `lastAcceptanceCriteria` checkboxes 改为交互式勾选 + 跟踪 `acceptanceCheckedState`；新增 `updateAcceptanceButtons()` + `#partial-approve-btn` 逐条通过按钮
- `src/kcodeView/KCodePanel.ts` — `handlePartialApproveReview()` 方法；`partialApproveReview` 消息处理；CSS 新增 `#partial-approve-btn` 样式

**实现说明**:
1. **交互式勾选**: `addMessageElement` 中 review_request 的验收清单 checkbox 改为受控组件，跟踪 `acceptanceCheckedState` Map
2. **逐条通过**: 勾选部分项后显示「逐条通过」按钮（`.secondary` 样式），点击发送 `partialApproveReview` 消息
3. **处理逻辑**:
   - 全部通过 → `finishReview` 完成
   - 部分未通过 → 回退到 `execute` 阶段，将通过的/未通过的逐条告知 AI，自动重新生成
4. **UI 清空**: `loadMessages` 消息中检测到新的 reviewChanges 或 acceptanceCriteria 时清除之前的勾选状态

**状态**: ✅ 已完成
