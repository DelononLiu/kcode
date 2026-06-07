# TaskV3 架构 — 可验证的质量关卡

> 继承 `taskv2-arch.md`（1780729910919-glowing-star.md）的设计原则，但加入**硬约束 & 可验证检查点**，防止实现走回头路。

## 架构原则（同 V2 计划，重申）

- 单一渲染路径 — 所有 UI 变更通过 state → render flow
- 单向数据流 — 扩展 → state-delta → subscriber → DOM
- Base + Strategy 分离 — basePipeline 负责共用渲染，viewStrategy 负责模式特有行为
- 卡片统一生命周期 — 一个 `renderCardForMessage()` 出口
- 流式 + 批量分离 — stream-chunk 增量追加，stream-done 批量执行卡片渲染

## 新增：数据模型约束

`ChatMessage` 必须包含折叠/展开状态：

```typescript
interface ChatMessage {
  // ... 现有字段
  collapsed?: boolean;   // ★ 新增：折叠状态是消息的属性
  cardMeta?: {           // ★ 新增：卡片元数据，统一存放
    type?: string;       // goal|plan|execute|self_verify|review
    confirmed?: boolean;
    status?: string;
  };
}
```

`AppState` 不再持有独立于 messages 的 UI 状态数组。

## 验证清单（实现完成后逐条 check off）

### 🔴 Blockers（一处不通过则拒绝合并）

| # | 检查项 | 验证命令 | 预期 |
|---|--------|---------|------|
| 1 | `innerHTML = ''` 或全量重置 | `grep -rn "innerHTML" src/view/webview/taskv3/` | 仅 ssr 安全场景 |
| 2 | 直接操作 `#chat-messages` 的 DOM | `grep -rn "chat-messages" src/view/webview/taskv3/` | 只出现在 `renderManager.ts` |
| 3 | `classList` 操作 collapsed | `grep -rn "classList.*collapsed" src/view/webview/taskv3/` | 零匹配 |
| 4 | `style.display` 命令式显隐 | `grep -rn "style\.display" src/view/webview/taskv3/` | 零匹配 |
| 5 | `subscribe` 死代码 | `grep -rn "\.subscribe" src/view/webview/taskv3/` | 至少 1 个调用点 |
| 6 | stream chunk 全量替换 | `grep -rn "stream.*innerHTML\|innerHTML.*stream\|innerHTML.*text" src/view/webview/taskv3/` | 零匹配（必须用 append/insertAdjacent） |
| 7 | 模块级 mutable 变量 | `grep -rn '^let _\|^var _' src/view/webview/taskv3/` | 零匹配 |

### 🟡 Quality Gates

| # | 检查项 | 验证方式 |
|---|--------|---------|
| 6 | `cardRenderer.renderCardForMessage()` 是唯一卡片创建入口 | `codegraph_callers renderCardForMessage` 覆盖全部 5 种卡片 |
| 7 | 流式追加只走 `basePipeline.appendStreamChunk` | 无第二个模块写 stream DOM |
| 8 | `ChatMessage` 接口包含 `collapsed` 字段 | `codegraph_node ChatMessage` |
| 9 | 消息列表增量更新（非全量重建） | 检查是否有 `key` 概念或 diff 策略 |
| 10 | Partial JSON 防御性解析 | 检查 `JSON.parse` 调用处有 partial 处理（非 try-catch 摆烂） |

## API 面缩减

| 方向 | V2 消息类型 | V3 目标 |
|------|------------|--------|
| ext → web | 43 种 | ≤ 8 种 |
| web → ext | ~15 种 | ≤ 6 种 |

## 文件结构

```
src/view/webview/taskv3/         ← 新增
  ├── types.ts                   类型定义（AppState, ChatMessage 带 collapsed）
  ├── state.ts                   StateManager（subscribe 必须有消费者）
  ├── basePipeline.ts            共用渲染（stream/markdown/tool/message）
  ├── cardRenderer.ts            统一卡片出口（renderCardForMessage）
  ├── renderManager.ts           唯一 DOM 写入入口
  ├── viewStrategy.ts            接口
  └── taskStrategy.ts            任务模式策略
```

## 实施阶段

| Phase | 内容 | 验证关卡 |
|-------|------|---------|
| 1 | types + state + basePipeline 框架 | #1-#5 全过 |
| 2 | cardRenderer + renderManager | #6, #9 全过 |
| 3 | taskStrategy + 消息集成 | #7, #8, #10 全过 |
| 4 | 并行验证（V3 vs V2 各跑 3 次全流程） | 功能清单矩阵逐条匹配 |
| 5 | 切主 + 清理旧代码 | 旧 flowCards/messageRenderer/chatStream 删除 |
