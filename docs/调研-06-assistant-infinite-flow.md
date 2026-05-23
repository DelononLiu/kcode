# 小助手无限流 + 后台自动 Compact 设计

## 问题

小助手（Assistant 模式）对话消息存储在单个 JSON 文件中，随对话增长无限膨胀。原有方案在 `ProjectFs.ts:454` 硬编码 200 条上限，超出后直接 `splice` 丢弃旧消息——数据丢失且用户无通知。

## 目标

- **无限流**：小助手消息可无限增长，用户看不到上限
- **后台自动 compact**：旧消息被 LLM 摘要替代，用户无感知
- **重启一致性**：VS Code 重启后本地与 ACP agent 端状态一致

## 存储改动

### ProjectFs.ts

- 移除 `addAssistantMessage()` 中的 200 条 splice 逻辑
- 新增 `setAssistantMessages(messages: AssistantMessage[])`：直接覆盖写入 `assistant_messages_<wsHash>.json`

### TaskStore.ts

- 新增 `setAssistantMessages()` 透传方法

## Compact 流程

**触发条件**：每次 `handleMessage()` 完成（agent 回复已存储）后检查，当 `getAssistantMessages().length > COMPACT_THRESHOLD` 时触发。

```
handleMessage(text)
  → 存储用户消息 + sendPrompt(agent 回复)
  → _needsCompaction() 检查条数
  → _compact():
    1. closeTaskSession('__assistant__')     // 关闭当前 ACP session
    2. setAssistantSessionId('')             // 清除本地 sessionId
    3. sendPrompt('__assistant_compact__',   // 用临时 session 发摘要 prompt
         buildSummaryPrompt(allMessages), compactHandler)
       ↓
    compactHandler.onDone:
      a. closeTaskSession('__assistant_compact__')  // fire-and-forget
      b. setAssistantMessages([ summary, ...tail ]) // 存储 compact 后消息
      c. loadMessages()                              // 刷新 UI
  → _compacting = false
```

### 摘要 prompt 格式

```typescript
`请用中文总结下面全部对话内容，只输出总结本身，不要提及"总结"或"压缩"。
保留关键决策、当前进度、已完成工作和用户偏好。

用户: xxx
AI助手: xxx
工具: xxx
...`
```

- 每条消息 content 截断 500 字
- 总对话文本截断 12000 字符
- tool_call 消息替换为 `[工具调用: title]`

### 存储结果

compact 后本地存储结构：

```json
[
  { "id": "compact_summary", "role": "agent", "type": "summary",
    "content": "摘要文本...", "timestamp": ... },
  { "id": "msg_41", "role": "user", "content": "最近消息", "timestamp": ... },
  ...  // 保留最近 COMPACT_TAIL (10) 条
]
```

### 重启一致性保证

- Compact 后 `sessionId` 被清除 (`setAssistantSessionId('')`)
- 下次用户发消息 → `handleMessage` 检查 `!hasSession('__assistant__')` → 创建新 session
- 新 session 的初始上下文 = 本地 compacted 消息（摘要 + tail）
- Agent 看到的上下文与本地完全一致 ✅

## 已知问题/BUG

### B1: Compact 占用用户交互时间

`_compact()` 在 `handleMessage()` 内部串行执行，compact 期间用户消息会被入队等待。若 compact 的 summary prompt 耗时较长（>5s），用户会感知到延迟。

**后续改进**：将 `_compact()` 改为独立调度，不阻塞 `handleMessage` 返回。

### B2: Compact 失败后 session 已关闭

若 `_compact()` 中 `closeTaskSession` 成功但后续 `sendPrompt(compact)` 失败，`__assistant__` session 已关闭。下次用户发消息会创建新 session，但本地消息仍完整保留，不会丢数据。只是 agent 失去了之前 session 的上下文。

**后续改进**：先发 summary prompt，成功后再 close 旧 session；或失败时 close session 后不 setAssistantMessages，让下次 handleMessage 重建 session。

### B3: 摘要 prompt 可能被 agent 拒绝

某些 agent（如 Kilo 的 `compaction` agent 是 `hidden` 内部 agent，权限 `*: deny`）可能对摘要 prompt 回复为空或拒绝回答。当前静默处理：`summary.trim()` 为 falsy 时不做任何事。

**后续改进**：若摘要为空或包含拒绝标记，不进行 compact，等待下次触发。

### B4: `onDone` 由于 async 被吞

`AcpClient.prompt()` 调用 `handler.onDone()` 后不 await 返回值。若 onDone 是 `async`，其中抛出的异常或关键逻辑可能无法执行。当前已改为同步 onDone，`closeSession` 做 fire-and-forget。

### B5: Compact 触发阈值固定

当前 `COMPACT_THRESHOLD = 5`（调试用），生产应调大（30-50）。但固定值不适应不同使用场景。

**后续改进**：改为可配置项（`kcode.compactThreshold`）。

## 前端渲染

### app.ts `addMessageElement`

新增 `msg.type === 'summary'` 分支：

```
📋 早前对话摘要           ← summary-card-header（绿色底色）
摘要文本内容...            ← summary-card-body（灰白色）
```

样式见 `chatPanelCss.ts` `.summary-card-*`。

## 测试覆盖

`src/kcodeView/__tests__/AssistantHandler.test.ts` 新增 5 个测试：

| 测试 | 验证点 |
|------|--------|
| 不触发 compact 消息数未超阈值 | 条数 <= 阈值时不做任何操作 |
| 触发 compact 消息数超阈值 | closeTaskSession + clear sessionId |
| compact 发送摘要 prompt | sendPrompt 被调用于 __assistant_compact__，prompt 含"总结" |
| compact 成功时替换本地消息 | setAssistantMessages 调用参数含 summary + tail |
| compact 失败时静默处理 | 异常不抛到外部，不存储 |
