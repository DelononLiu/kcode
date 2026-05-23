# Task Update ACP 工具注册方案（调研）

## 现状

KCode 通过 `[TASK_UPDATE]...[/TASK_UPDATE]` 文本协议在 AI 回复中嵌入阶段更新指令，由 `parseSimplePayload()` 解析。

## 理想方案

将 `task_update` 注册为 ACP 工具，与 `read`、`write` 等并列。LLM 直接以工具调用（结构化 JSON）输出阶段更新，KCode 在 `onToolCall` 回调中处理。

### 优点

- **结构化可靠**：工具调用参数天然 JSON Schema，无文本解析容错问题
- **LLM 原生支持**：模型更擅长输出工具调用而非特定文本标记
- **无剥离开销**：不需要正则从流式文本中剥离标记

### 在 opencode 中的实现方式

需要在 agent 侧（`@opencode-ai/sdk`）添加：

1. `tool/task-update.ts` — 工具定义，参数 Schema：
   - `action`: `"propose_goal" | "propose_plan" | "finish_execute" | "finish_verify"`
   - `confirmed?`: `string[]`
   - `pending?`: `string[]`
   - `steps?`: `string[]`
2. `tool/task-update.txt` — 工具描述
3. `tool/registry.ts` — 注册到 builtin 列表
4. `acp/agent.ts` — 在 `toToolKind()` 中添加映射

### KCode 侧适配

1. `AcpMessageHandler.onToolCall` 增加 `rawInput` 参数
2. `callbacks.ts` 透传 `update.rawInput`
3. `KCodePanel.ts` 在 `onToolCall` 中拦截 `title === 'task_update'` 的工具调用
4. 调用 `TaskFlow.executeAction()` 直接处理阶段迁移

### 阻塞因素

opencode 以独立二进制分发，KCode 通过 ACP stdio 调用，无法修改其内置工具注册表。

## 后续

如果 opencode（或其他 ACP Agent）未来支持客户端通过协议注册自定义工具，可废弃 `[TASK_UPDATE]` 文本协议，全面切换到工具调用方案。当前文本协议作为 Agent 无关的 fallback 保留。
