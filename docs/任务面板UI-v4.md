# KCode 任务面板 UI v4

同一条垂直时间轴中，按 6 个阶段组织消息——已完成阶段自动折叠为摘要行，点击展开查看内部工具调用过程。Agent 头始终在折叠框上方可见，标识当前消息所有者。

---

## 6 阶段顺序与标签

| 顺序 | 阶段 ID | 标签 |
|------|---------|------|
| 1 | `demand` | 需求提取 |
| 2 | `goal` | 目标确定 |
| 3 | `plan` | 计划确定 |
| 4 | `execute` | 执行修改 |
| 5 | `self_verify` | 自验结果 |
| 6 | `review` | 确认验收 |

---

## DOM 结构

```
#chat-messages                              ← 容器
│
├── .tv4-phase-group[data-phase="demand"].folded[data-collapsed="true"]
│   ├── .tv4-pg-toggle                      ← 折叠标题（始终可见）
│   │   └── "▶ 需求提取 5条 — 经过 2轮思考，调用 3个工具，用时 12秒"
│   └── .tv4-pg-body                        ← 折叠体（display:none 时隐藏）
│       ├── .chat-msg.tool                  ← 工具卡片（时间线条目）
│       │   └── .msg-bubble > .tl-entry[data-tl-kind="thinking"]
│       ├── .chat-msg.tool
│       │   └── .msg-bubble > .tl-entry[data-tl-kind="search"]
│       └── ...
│
├── .chat-msg.agent-header[data-phase="demand"]    ← Agent 头（移到折叠框外）
│   └── .msg-sender "Agent"
│
├── .tv4-phase-group[data-phase="execute"]         ← 当前阶段（未折叠）
│   ├── .chat-msg.agent-header
│   ├── .chat-msg.tool                             ← 工具卡片逐个展开
│   │   └── .tl-entry[data-tl-kind="command"]
│   │       ├── .tl-entry-bar                     ← 左侧色条
│   │       ├── .tl-entry-icon "💻"               ← 工具图标
│   │       ├── .tl-entry-title "npm run build"   ← 工具标题
│   │       └── .tl-entry-body                    ← 输出内容
│   │           └── .tl-body-bash > pre
│   └── .chat-msg.agent                            ← Agent 文本回复
│       └── .msg-bubble (渲染 Markdown)
│
├── .chat-msg.user                                 ← 用户消息（直接在容器中）
│   ├── .msg-sender "You 01:15"
│   └── .msg-bubble (用户输入)
│
└── #working-indicator                             ← 思考中指示器
```

### 折叠规则

1. 当前阶段之前的**所有历史阶段**自动折叠
2. 折叠触发时机：`renderMessages` 结束时遍历 `STAGE_ORDER`，当前阶段之前全部调 `foldPhase`
3. `foldPhase` 内部：
   - 过滤 `agent-header` 不参与折叠，统计工具消息数
   - 创建 `tv4-pg-toggle`（阶段标签 + 条数 + 思考轮次/工具数/耗时摘要）
   - 创建 `tv4-pg-body`，移入除最后一条外的所有工具消息
   - 将 `agent-header` 移到折叠框上方（`group.parentNode.insertBefore(headerEl, group)`）
   - 最后一条工具消息移到折叠框下方作为摘要
   - 设置 `folded` 类和 `data-collapsed="true"`（CSS 控制 `tv4-pg-body` 为 `display:none`）
4. 点击 toggle 切换 `data-collapsed` 展开/收起

### 时间线条目类型

| type | icon | 说明 |
|------|------|------|
| `thinking` | 💭 | 思考过程，标题强制显示"思考" |
| `command` (bash/command/terminal) | 💻 | 命令执行，pre 内 monospace 展示 |
| `file` (read) | 📖 | 文件读取 |
| `file` (write/edit) | ✏️ | 文件写入/修改，可能展示 diff |
| `search` (grep/glob) | 🔍 | 搜索/查找 |
| `device` | 🔧 | 设备连接操作 |

### 思考 + 工具合并

同一轮中 `thinking` 后紧接的工具调用会被合并为一个 `tl-entry.tl-merged` 卡片：
- 合并卡片标题显示 "思考 → icon 工具1 → icon 工具2 ..."
- 思考预览行（首行文本）在合并卡片上方
- 点击展开/收起合并卡片

---

## Text UI 1：任务完成时全折叠效果

```
═══════════════════════════════════════════════════════════════════
🤖 KCode | 任务：修复任务面板折叠 Bug
═══════════════════════════════════════════════════════════════════

You    01:05
  帮我修一下任务面板折叠展开失效的问题。

Agent
┌─ ▶ 需求提取 3条 — 经过 1轮思考，调用 2个工具，用时 8秒 ───┐
│                                                               │
└───────────────────────────────────────────────────────────────┘
Agent
┌─ ▶ 目标确定 2条 — 调用 2个工具，用时 5秒 ────────────────────┐
│                                                               │
└───────────────────────────────────────────────────────────────┘
Agent
  确认目标：修复 chatPanelHtml.ts 中的折叠展开逻辑

Agent
┌─ ▶ 计划确定 2条 — 经过 1轮思考，调用 1个工具，用时 4秒 ────┐
│                                                               │
└───────────────────────────────────────────────────────────────┘
Agent
  计划步骤：1. 排查 foldPhase 的 chatMsgs 过滤逻辑
           2. 修复 insertRef 引用失效问题
           3. 将 agent-header 移出折叠框

Agent
┌─ ▶ 执行修改 8条 — 经过 2轮思考，调用 6个工具，用时 24秒 ───┐
│                                                               │
└───────────────────────────────────────────────────────────────┘

💻 npm run build      ✓ 编译通过
💻 npx vitest run      ✓ 482 tests passed

Agent
  修改完成。taskView.ts chatMsgs 过滤 agent-header、insertRef
  移至循环后计算、agent-header 移出折叠框。类型检查和测试全通过。


[ 输入后续指令...                                         ] [发送]
═══════════════════════════════════════════════════════════════════
```

---

## Text UI 2：点击展开"执行修改"阶段

```
═══════════════════════════════════════════════════════════════════
🤖 KCode | 任务：修复任务面板折叠 Bug
═══════════════════════════════════════════════════════════════════

...省略前 3 个折叠阶段...

Agent
┌─ ▼ 执行修改 8条 — 经过 2轮思考，调用 6个工具，用时 24秒 ───┐
│                                                               │
│ 💭 思考                                                       │
│ ─────────────────────────────────────────────────────────────  │
│ 用户报告折叠时 Agent 头被框在折叠区内。需要排查 foldPhase    │
│ 中的 chatMsgs 过滤条件和 insertRef 计算时机。                 │
│                                                               │
│ 🔍 glob taskView.ts                                           │
│ ─────────────────────────────────────────────────────────────  │
│ src/view/webview/taskView.ts                                  │
│                                                               │
│ 📖 读取 taskView.ts                                           │
│ ─────────────────────────────────────────────────────────────  │
│ export function foldPhase(phase: string): void {              │
│   const chatMsgs = elements.filter(...)                       │
│   ...                                                         │
│                                                               │
│ 💭 思考                                                       │
│ ─────────────────────────────────────────────────────────────  │
│ 定位到两个问题：1) agent-header 被包含在 chatMsgs 中参与     │
│ 折叠。2) insertRef 在 body.appendChild 前计算，指向的节点    │
│ 已被移出 group 导致 insertBefore 静默失败。                   │
│                                                               │
│ ✏️ 修改 taskView.ts (+3, -1)                                  │
│ ─────────────────────────────────────────────────────────────  │
│ - const chatMsgs = elements.filter(e => ...)                  │
│ + const chatMsgs = elements.filter(e => ...                   │
│ +   && !e.classList.contains('agent-header'));                │
│ + const insertRef = headerEl ? ...  // moved after loop       │
│                                                               │
│ 💻 npx tsc --noEmit                                           │
│ ─────────────────────────────────────────────────────────────  │
│ (no errors)                                                   │
│                                                               │
│ 💻 npx vitest run                                             │
│ ─────────────────────────────────────────────────────────────  │
│ Test Files  38 passed (38)                                    │
│      Tests 482 passed (482)                                   │
│                                                               │
└───────────────────────────────────────────────────────────────┘

💻 npm run build      ✓ 编译通过
💻 npx vitest run      ✓ 482 tests passed

Agent
  修改完成。两个核心修复：1) chatMsgs 过滤排除 agent-header；
  2) insertRef 在 body.appendChild 循环后计算，避免 DOM 引用
  失效导致 insertBefore 失败。

[ 输入后续指令...                                         ] [发送]
═══════════════════════════════════════════════════════════════════
```

---

## 实现文件索引

| 文件 | 职责 |
|------|------|
| `src/view/webview/taskView.ts` | `foldPhase` 折叠逻辑、`STAGE_ORDER` 阶段顺序、toggle 交互 |
| `src/view/webview/timelineRenderer.ts` | `createTimelineEntry` 时间线条目渲染、`createMergedTimelineEntry` 合并卡片 |
| `src/view/webview/chatStream.ts` | `handleToolCallUpdate` 流式工具卡片追加、`flushMerge` 思考+工具合并 |
| `src/view/webview/messageRenderer.ts` | `renderMessages` 全量重绘、`addMessageElement` 单条消息渲染 |
| `src/view/templates/chatPanelCss.ts` | `.tv4-phase-group.folded` 折叠样式、`.tv4-pg-body` 显隐控制 |
