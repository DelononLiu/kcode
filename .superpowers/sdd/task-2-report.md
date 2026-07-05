# Task 2 Report: 简化 msgRenderer.ts — 改为分发到注册表

## Summary

Refactored `msgRenderer.ts` to dispatch message rendering to individual renderer modules in `renderers/`, replacing the previous inline rendering approach.

## Changes

### New file
- **`src/view/webview/taskv3/rendererShared.ts`** — Shared types and utilities extracted from `msgRenderer.ts` to break circular dependencies between `msgRenderer.ts` and `renderers/*.ts`:
  - `MsgStateAccess` interface
  - `buildSummaryHtml()` function
  - `isNonCollapsible()` function
  - `setMsgPostAction()` / `getPostAction()` (postAction global)

### Modified: renderers/ (each gains a named export)
- **`src/view/webview/renderers/round_summary.ts`** — Added `renderRoundSummary()` export, imports shared utils from `rendererShared.ts`
- **`src/view/webview/renderers/phase_action.ts`** — Added `renderPhaseAction()` export, moved `appendPhaseActionsToCard()` here from `msgRenderer.ts`, uses `getPostAction()` from `rendererShared.ts`
- **`src/view/webview/renderers/thinking.ts`** — Added `renderThinking()` export
- **`src/view/webview/renderers/tool_call.ts`** — Added `renderToolCall()` export
- **`src/view/webview/renderers/user.ts`** — Added `renderUserMessage()` export
- **`src/view/webview/renderers/text.ts`** — Added `renderText()` export
- **`src/view/webview/renderers/registry.ts`** — Updated `MsgStateAccess` import path

### Modified: msgRenderer.ts
- **`src/view/webview/taskv3/msgRenderer.ts`** — Simplified `createMsgElement` to import renderer functions directly and dispatch by type (`round_summary` → `renderRoundSummary`, `phase_action` → `renderPhaseAction`, `thinking` → `renderThinking`, `tool_call` → `renderToolCall`, `user` → `renderUserMessage`, `agent` → `renderText`). Removed inline rendering code. Re-exports `setMsgPostAction`, `isNonCollapsible`, `buildSummaryHtml` from `rendererShared.ts` for backward compatibility.

### Modified: import path updates
- **`src/view/webview/taskv3/basePipeline.ts`** — Imports `buildSummaryHtml` from `./rendererShared`

## Verification
- `npx tsc --noEmit` passes with 0 errors.
