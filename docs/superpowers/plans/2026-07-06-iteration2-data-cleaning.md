# Iteration 2: 数据层清洗 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理所有旧数据模型的依赖，从 JSON.parse(msg.content) 改为结构化字段，消除所有 cardMeta 引用，简化 type 枚举。

**Architecture:** 以 `msg.toolCall`/`msg.toolResult`/`msg.phaseAction` 结构化字段取代 JSON.parse 解析消息内容；以 `type: 'phase_action'` + `phaseAction` 取代 `cardMeta`。最后移除过渡字段。

**Tech Stack:** TypeScript, 无新增依赖

## Global Constraints

- 不改业务逻辑，只改数据访问方式
- 每处替换后保持渲染效果与之前一致
- 最后移除 `taskv3/types.ts` 中的 `cardMeta?` 和 `phase?` 过渡字段
- 编译保持 0 errors

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/view/webview/taskv3/msgRenderer.ts` | 清理 | 6 处 cardMeta + 3 处 JSON.parse → toolCall/phaseAction |
| `src/view/webview/taskv3/basePipeline.ts` | 清理 | 9 处 cardMeta/phase + 2 处 JSON.parse |
| `src/view/webview/taskv3/cardRenderer.ts` | 清理 | 6 处 phase 引用 |
| `src/view/webview/taskv3/renderManager.ts` | 清理 | 3 处 cardMeta + 2 处 JSON.parse |
| `src/view/webview/taskv3/types.ts` | 清理 | 移除 cardMeta/phase 过渡字段 |
| `src/view/webview/messageRenderer.ts` | 清理 | 2 处 JSON.parse |
| `src/view/TaskFlowHandler.ts` | 清理 | 移除旧 type 枚举转换 + JSON.parse |
| `src/view/Panel.ts` | 清理 | 清理 ChatMessage.type 旧枚举 |
| `src/store/TaskStore.ts` | 适配 | 更新方法签名 |
| `src/store/ProjectFs.ts` | 适配 | 更新方法签名 |
| `src/plugins/*/` | 适配 | 各插件消息类型兼容 |

---

### Task 1: 清理 `basePipeline.ts` — cardMeta + JSON.parse + phase

**Files:**
- Modify: `src/view/webview/taskv3/basePipeline.ts`

- [ ] **Step 1: 替换 `_appendMessage` 中的 cardMeta 判断**

将：
```typescript
if (msg.cardMeta) {
    _appendCardMetaMessage(msg, _container);
    return;
}
if (msg.type && ['goal_confirmation', 'goal_confirmed', ...].includes(msg.type)) {
    renderCardForMessage(msg, msg.phase || '');
    return;
}
```
改为：
```typescript
if (msg.type === 'phase_action' && msg.phaseAction) {
    _appendCardMetaMessage(msg, _container);
    return;
}
```

- [ ] **Step 2: 替换 `_appendCardMetaMessage` 中 cardMeta 引用**

```typescript
// 旧：msg.phase || msg.cardMeta?.type || ''
// 新：msg.phaseAction?.phase || ''

// 旧：msg.cardMeta?.status === 'pending'
// 新：msg.phaseAction?.status === 'pending'

// 旧：const type = msg.cardMeta?.type;
// 新：const type = msg.phaseAction?.phase;
```

- [ ] **Step 3: 替换 JSON.parse(msg.content) 在 round summary 中**

由 `JSON.parse(msg.content)` 获取 counts → 改为在 `renderManager.ts` 生成 summary 时已序列化好，保持 JSON.parse 但添加类型校验。此处的 JSON.parse 不可直接替代——因为 `round_summary` 的 content 本身就是 `JSON.stringify({thinking, tools})` 的结果。

保留此处的 JSON.parse，添加 try-catch 注释说明。

- [ ] **Step 4: 替换 JSON.parse(msg.content) 在 tool_call 卡片中**

由 `JSON.parse(msg.content)` 获取 info → 改为 `msg.toolCall`：
```typescript
// 旧：try { info = JSON.parse(msg.content); } catch { return; }
// 新：const info = msg.toolCall; if (!info) return;
```

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 2: 清理 `msgRenderer.ts` — cardMeta + JSON.parse + phase

**Files:**
- Modify: `src/view/webview/taskv3/msgRenderer.ts`

- [ ] **Step 1: 替换 `_isNonCollapsible` 中 cardMeta 判断**

```typescript
// 旧：return !!(m.cardMeta || (m.type && NON_COLLAPSIBLE.has(m.type)));
// 新：return !!((m.type === 'phase_action' && m.phaseAction) || (m.type && NON_COLLAPSIBLE.has(m.type)));
```

- [ ] **Step 2: 替换 `createMsgElement` 中 cardMeta 分支**

```typescript
// 旧：
// if (msg.cardMeta) {
//     const type = msg.cardMeta.type || '';
//     ... 渲染卡片

// 新：
if (msg.type === 'phase_action' && msg.phaseAction) {
    const type = msg.phaseAction.phase || '';
    const isPending = msg.phaseAction.status === 'pending';
    // ... 其余渲染逻辑用 msg.phaseAction.status 替换 msg.cardMeta.status
```

- [ ] **Step 3: 替换 `msg.phase` 属性访问为 `phaseAction?.phase`**

文件中 6 处 `msg.phase` → 改为 `msg.phaseAction?.phase || ''`

- [ ] **Step 4: 替换 round_summary 的 JSON.parse**

将 `msgRenderer.ts:63` 的 `JSON.parse(msg.content)` 保留（因为是 round_summary 专用），添加类型安全代码。

- [ ] **Step 5: 替换 tool_call 的 JSON.parse**

```typescript
// 旧 (line 147)：
// let info: any; try { info = JSON.parse(msg.content); } catch { return null; }
// 新：
if (!msg.toolCall) return null;
```

- [ ] **Step 6: 替换 tool_call output 的 JSON.parse**

```typescript
// 旧 (line 233)：
// try { const info = JSON.parse(msg.content); if (info.output) pre.textContent = info.output; } catch {}
// 新：
if (msg.toolResult?.output) pre.textContent = msg.toolResult.output;
```

- [ ] **Step 7: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 3: 清理 `cardRenderer.ts` — phase 引用

**Files:**
- Modify: `src/view/webview/taskv3/cardRenderer.ts`

- [ ] **Step 1: 替换所有 `msg.phase` 为 `phaseAction?.phase`**

文件中 6 处 `<div className="card" data-phase={msg.phase}>` 和其他 `msg.phase` 引用 → 改为 `msg.phaseAction?.phase || ''`

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 4: 清理 `renderManager.ts` — cardMeta + JSON.parse + phase

**Files:**
- Modify: `src/view/webview/taskv3/renderManager.ts`

- [ ] **Step 1: 替换 JSON.parse 在 round 统计中**

`renderManager.ts:150` — 统计 tool_call 种类：
```typescript
// 旧：try { const info = JSON.parse(result[i].content); ... } catch {}
// 新：const tc = result[i].toolCall; if (tc) { const k = tc.kind || 'other'; tools[k] = (tools[k] || 0) + 1; }
```

- [ ] **Step 2: 替换 JSON.parse 在 toolCallId 提取中**

`renderManager.ts:333`：
```typescript
// 旧：msgs.filter(m => m.type === 'tool_call').map(m => { try { return JSON.parse(m.content).toolCallId; } catch { return null; } })
// 新：msgs.filter(m => m.type === 'tool_call').map(m => m.toolCall?.toolCallId).filter(Boolean)
```

- [ ] **Step 3: 替换 cardMeta 引用**

`renderManager.ts:430`：
```typescript
// 旧：m.cardMeta?.type === phase && m.cardMeta?.status === 'pending'
// 新：m.phaseAction?.phase === phase && m.phaseAction?.status === 'pending'
```

- [ ] **Step 4: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 5: 清理 `messageRenderer.ts` — JSON.parse

**Files:**
- Modify: `src/view/webview/messageRenderer.ts`

- [ ] **Step 1: 替换 tool_call 内容的 JSON.parse**

文件中 2 处 `JSON.parse(msg.content)` 用于提取 tool_call 信息 → 改为 `msg.toolCall` / `msg.toolResult`

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 6: 插件适配 — TodoPlugin + KnowledgePlugin 消息处理

**Files:**
- Modify: `src/plugins/todo/TodoPlugin.ts`, `src/plugins/knowledge/KnowledgePlugin.ts`, `src/plugins/review/ReviewPlugin.ts`, `src/plugins/delegate/DelegationPlugin.ts`

- [ ] **Step 1: TodoPlugin — 替换 JSON.parse**

TodoPlugin 中 9 处 `JSON.parse(msg.content)` 用于提取 todo 信息 → 改为通过 `msg.toolCall` 或 `msg.phaseAction` 获取数据。

- [ ] **Step 2: KnowledgePlugin — 替换 JSON.parse**

KnowledgePlugin 中 `JSON.parse(msg.content)` 用于提取 knowledge entry → 改为 `msg.toolCall`.

- [ ] **Step 3: ReviewPlugin — 适配新 type 枚举**

ReviewPlugin 中的消息 type 判断改为新 5 种枚举。

- [ ] **Step 4: DelegationPlugin — 适配新 type 枚举**

DelegationPlugin 中消息 type 判断改为新枚举。

- [ ] **Step 5: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 7: 移除 `taskv3/types.ts` 中的过渡字段 + TaskStore 适配

**Files:**
- Modify: `src/view/webview/taskv3/types.ts`

- [ ] **Step 1: 移除 cardMeta 和 phase 过渡字段**

```typescript
export interface Message extends Omit<DomainMessage, 'type'>, MessageUIState {
    type: string;
    // 删除以下过渡字段：
    // /** @deprecated 过渡字段，Iteration 2 清理 — 改用 phaseAction */
    // phase?: string;
    // /** @deprecated 过渡字段 ... */
    // cardMeta?: { ... };
}
```

- [ ] **Step 2: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors（如果 Task 1-5 全部完成，此处不应有错误）

---

### Task 7: 清理 `TaskFlowHandler.ts` + `Panel.ts` — 旧 type 枚举

**Files:**
- Modify: `src/view/TaskFlowHandler.ts`, `src/view/Panel.ts`

- [ ] **Step 1: 清理 TaskFlowHandler.ts 中的旧 type 转换代码**

移除 `msg.type === 'goal_confirmed'` 等对旧 13 种 type 的比较判断。
将所有 `msg.type` 比较迁移到 `msg.phaseAction` 或 `msg.type === 'phase_action'`。

- [ ] **Step 2: 清理 Panel.ts 中 ChatMessage.type 引用**

`Panel.ts:366` — `this.store.addMessage` 调用中移除 `type: type as any`（旧 ChatMessage 已兼容）

- [ ] **Step 3: 编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

### Task 8: 全量编译验证 + JSON.parse 确认

**Files:**
- Verify: 全仓库

- [ ] **Step 1: 确认所有 JSON.parse(msg.content) 已消除**

Run: `grep -rn "JSON\.parse.*msg\.content\|JSON\.parse.*\.content" src/ --include="*.ts" | grep -v node_modules | grep -v "\.test\."`
Expected: 只输出 `round_summary` 相关的 JSON.parse（这是正常的，因为 summary content 本身就是 JSON）和文件级的 JSON.parse（配置、存储等不受影响）。

- [ ] **Step 2: 确认所有 msg.cardMeta 已消除**

Run: `grep -rn "\.cardMeta" src/ --include="*.ts" | grep -v node_modules | grep -v "\.test\."`
Expected: 无输出

- [ ] **Step 3: 最终编译验证**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "refactor(data): Iteration 2 完成 — 数据层清洗

- 所有 JSON.parse(msg.content) 消除（改为 toolCall/toolResult/phaseAction）
- 所有 msg.cardMeta 消除（改为 type:'phase_action' + phaseAction）
- 移除 taskv3/types.ts 中的过渡字段
- 插件兼容适配完成
- 编译 0 errors"
```
