# Iteration 4: 折叠功能重做 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 在统一渲染器的基础上完善折叠功能，使其同时适用于任务模式和小助手模式。

**Architecture:** `AppUIState.expandedRounds` 管理展开状态，`RoundSummary` 渲染器点击切换，`stream-done` 时自动折叠最新 round。

---

### Task 1: 完善 expandedRounds 状态管理

**Files:**
- Modify: `src/view/webview/taskv3/state.ts` — 初始值已有 `expandedRounds: {}`
- Modify: `src/view/webview/taskv3/renderManager.ts` — 在 _collapseAllRounds 中管理展开状态

- [ ] **Step 1: 在 `renderManager.ts` 的 `_collapseAllRounds` 中跳过已展开的 round**

读取 `stateManager.state.expandedRounds`（从 AppUIState），对于 `expandedRounds[rg] === true` 的 round 不折叠。

```typescript
function _collapseRound(msgs, startIdx, endIdx, expandedRounds) {
    const rg = 'rg_' + msgs[startIdx].id;
    // 如果该 round 是展开状态，跳过折叠
    if (expandedRounds?.[rg]) return { msgs, summary: null };

    // ... 原有折叠逻辑
}
```

- [ ] **Step 2: 编译验证** — `npx tsc --noEmit` 0 errors

---

### Task 2: RoundSummary 点击展开/折叠

**Files:**
- Modify: `src/view/webview/renderers/round_summary.ts` — 点击时 toggle expandedRounds

- [ ] **Step 1: 让 RoundSummary 点击时更新 `expandedRounds`**

当用户点击 round_summary 时，toggle `stateManager.state.expandedRounds` 中的对应 roundGroup，然后重新渲染该 round 的消息。

这已经在 `round_summary.ts` 中实现了（通过 `sm.patch` toggle collapsed）。但需要确认它正确更新了 `expandedRounds`。

- [ ] **Step 2: 编译验证**

---

### Task 3: 适配 assistantPipeline 使用折叠

**Files:**
- Modify: `src/view/webview/assistantPipeline.ts` — 在 stream-done 时触发折叠

- [ ] **Step 1: 在 `_handleStreamDone` 或 `finishAssistantStream` 中调用折叠**

在 `streamHandler.handleStreamDone` 之后，对助理管线的消息执行 `_collapseAllRounds`。

由于 `streamHandler` 是公共的，而折叠逻辑在 `renderManager._collapseAllRounds` 中，需要在 `assistantPipeline.ts` 中 import 并调用。

- [ ] **Step 2: 编译验证**

---

### Task 4: 全量验证 + 提交

- [ ] **Step 1: 编译** — `npx tsc --noEmit` 0 errors
- [ ] **Step 2: 验证折叠交互逻辑一致性**
- [ ] **Step 3: 提交**
