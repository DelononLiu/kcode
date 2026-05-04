# KCode 问题案例索引

记录 VS Code 扩展 / Webview 开发中的典型问题及解决方案。

---

## case001 — 中间对话框滚动条位置与背景色

**分类**: `case:scrollbar` `case:flex-layout` `case:webview-css`

**严重程度**: 中

### 问题描述

中间聊天对话框 `#chat-area` 的滚动条：
1. 出现在 720px 处（`#chat-messages` 的 `max-width`），而非 `#chat-area` 最右边缘
2. 滚动条 track 背景色为 `#121314`（VS Code 默认），无法通过 `::-webkit-scrollbar-track` 覆盖

### 根因分析

**问题1 — 位置**：`<div id="chat-scroll">` 是 `#chat-area`（`display:flex`，`align-items:center`）的 flex 子元素。`align-items: center` 使 flex 子元素沿交叉轴居中并 shrink-to-content，导致 `#chat-scroll` 宽度被内容（720px）约束，而非填满父容器。

**问题2 — track 颜色**：`#chat-scroll` 使用 `overflow-y: overlay`，VS Code Webview 由自身绘制滚动条（不走浏览器原生渲染），`::-webkit-scrollbar-track` 伪元素不生效。

### 涉及文件

| 文件 | 作用 |
|------|------|
| `src/kcodeView/KCodePanel.ts` | HTML 模板 + 内联 CSS（唯一实际生效的样式） |
| `src/kcodeView/webview/app.ts` | 引用 `#chat-scroll` 做 `scrollTop` 操作 |
| `src/kcodeView/webview/style.css` | 未被引用，无效 |

### 解决方案

1. **HTML 结构调整**：将 `#chat-input-area` 移入 `#chat-scroll` 内，使 `#chat-scroll` 成为唯一滚动容器，独立撑满 `#chat-area` 全部宽度

2. **CSS 修复**：
   - 移除 `#chat-area` 的 `align-items: center`
   - 将 `overflow-y: overlay`（VS Code 自绘）改为 `overflow-y: auto`（浏览器原生渲染）
   - 使用标准 CSS `scrollbar-color: #28292b #1e1e1e` 控制 track 和 thumb 颜色
   - 补充 VS Code Webview CSS 变量（`--vscode-scrollbarSlider-background` 等）作为兜底

### 关键改动

```diff
- #chat-area{...;align-items:center}
- #chat-scroll{width:100%;overflow-y:overlay;...}
- #chat-scroll::-webkit-scrollbar{width:0}  /* 隐藏滚动条 */
- #chat-scroll{scrollbar-width:thin}
+ #chat-area{...}                           /* 移除 align-items:center */
+ #chat-scroll{overflow-y:auto;scrollbar-color:#28292b #1e1e1e;--vscode-scrollbarSlider-background:#28292b80}
```

### 教训

- `align-items: center` 在 flex 容器中会导致子元素 shrink-to-content，而非撑满可用空间
- VS Code Webview 新版本滚动条走自绘路径，`overflow: overlay` 时 `::-webkit-scrollbar` 伪元素全部失效
- `style.css` 未被 `KCodePanel.ts` 引用（内联样式优先），所有样式必须写在 `getInlineStyles()` 中

---

## case002 — 对话框输入后无回复（综合问题）

**分类**: `case:agent-connection` `case:session-management` `case:messaging`

**严重程度**: 高

### 问题描述

用户在聊天输入框输入内容并发送后，对话框无任何响应（Agent 不回复）。

该问题由**多个独立根因**叠加导致，单独修复任一个都无法完全解决。

### 根因分析（按时间顺序）

**根因 1 — Session 未按 Task 隔离**

| commit | 说明 |
|--------|------|
| `ad6fb83` | 所有 Task 共用同一个 ACP session，`sessionUpdate` 路由到错误的 handler |

`AcpClient` 最初只有单一 `sessionId`，多 Task 切换时 `sessionUpdate` 事件串线。

```diff
- private sessionId: string | null = null;
+ private sessions: Map<string, string> = new Map(); // taskId → sessionId
```

每个 Task 创建独立 session：`createSession(taskId, cwd)` → `sessions.set(taskId, result.sessionId)`。

---

**根因 2 — loadMessages 后 activeTaskId 未更新**

| commit | 说明 |
|--------|------|
| `9615b21` | `loadMessages` 只在 `messages.length > 0` 时更新 `activeTaskId`，导致空消息 Task 消息发到上一个 Task |

Webview 侧 `activeTaskId` 决定消息路由到哪个 Task，若切换到空 Task 后发送消息，实际发到了前一个 Task 的 session。

---

**根因 3 — 面板打开时未自动建立 Agent 连接**

| commit | 说明 |
|--------|------|
| `d53ac74` | `ensureConnection()` 只在首次 `handleSendMessage` 时调用，面板打开到首次发送之间 Connection 尚未建立 |

时序问题：面板打开 → 用户立即切换 Task → 点击发送 → `ensureConnection()` 才刚触发，5秒超时内无响应。

修复：`constructor` 中直接调用 `ensureConnection()`。

---

**根因 4 — agentUrl 默认值短路 agentName 逻辑**

| commit | 说明 |
|--------|------|
| `af50737` | `kcode.agentUrl` 默认为 `http://127.0.0.1:8080`，导致 `agentName` 判断逻辑被跳过 |

```ts
// 修复前
const agentUrl = config.get<string>('agentUrl') || '';
// 默认值导致 agentUrl 真值，优先走 HTTP 模式，跳过了 stdio agentName 判断
```

---

**根因 5 — createSession 异常未捕获，用户看不到错误**

| commit | 说明 |
|--------|------|
| `12c91c9` | `createSession` 抛出异常时直接 `return`，用户看到的是输入消失而非错误提示 |

`try/catch` 捕获后调用 `showAgentError()` 将错误展示到聊天区域。

---

### 涉及文件

| 文件 | 作用 |
|------|------|
| `src/kcodeView/KCodePanel.ts` | 消息发送、Connection 管理、Session 创建 |
| `src/acp/AcpClient.ts` | ACP 多会话管理（Map<taskId, sessionId>） |
| `src/acp/callbacks.ts` | sessionUpdate 按 sessionId 路由到对应 handler |
| `src/kcodeView/webview/app.ts` | activeTaskId 状态管理、消息渲染 |

### 解决方案

综合修复：

1. **Session per Task**：`AcpClient.sessions: Map<taskId, sessionId>`，每次 `loadTask` 调用 `createSession(taskId)`
2. **activeTaskId 始终更新**：无论消息是否为空，`loadMessages` 都更新 `activeTaskId`
3. **面板打开即建连**：`constructor` 中调用 `ensureConnection()`
4. **配置优先级修正**：明确 `agentName > agentUrl`，避免默认值干扰
5. **异常可视化**：`createSession` 异常捕获后 `showAgentError()` 展示到聊天区域

### 教训

- **复合故障**：同一表象（无回复）可能由多层独立 bug 叠加，逐一排查后才知道需全部修复
- **时序敏感**：异步建连 + 首次发送消息的竞态条件，构造阶段就应建连而非延迟到首条消息
- **空状态边界**：空消息数组 ≠ 无 Task，应始终更新 `activeTaskId`
