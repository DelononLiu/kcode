# KCode 任务全流程设计

> 依据代码 5 阶段流程（demand → goal → plan → execute → review），融合协议化阶段通信与自然对话式阶段迁移。

---

## 一、核心原则

1. **KCode 是状态唯一控制器**。大模型只输出 `<TASK_UPDATE>` 指令建议，KCode 解析后决定是否执行状态迁移，并校验阶段合法性。
2. **对话驱动阶段迁移**。阶段切换融入自然对话流，不强制弹窗阻断。协商卡片保留，但仅在多轮讨论收敛后才呈现汇总结果供用户确认。
3. **协议化通信**。大模型输出结构化 `<TASK_UPDATE>` JSON 标记，替代脆弱的文本正则匹配，解析统一、扩展灵活。

---

## 二、5 阶段固定流转

代码已定义的 5 个节点阶段，不可跳过、固定顺序流转：

```
demand → goal → plan → execute → review
```

| 阶段 | 含义 | 行为约束 |
|------|------|---------|
| demand | 用户提出原始需求 | 大模型只倾听/追问，不输出 `<TASK_UPDATE>` 迁移指令 |
| goal | 目标协商与锁定 | 大模型只做需求归纳、与用户确认，**不得写代码** |
| plan | 计划提案与批准 | 大模型只制定执行步骤，**不得实际执行** |
| execute | 按计划执行 | 大模型按 plan 步骤执行，完成后用 `<TASK_UPDATE>` 申请进入验收 |
| review | 结构化验收 | 大模型展示变更 + 验收要点，等待用户确认或驳回 |

---

## 三、`<TASK_UPDATE>` 协议标记

### 格式

```
<TASK_UPDATE>
{
  "phase": "goal | plan | execute | review",
  "action": "propose_goal | lock_goal | propose_plan | lock_plan | finish_execute | accept | reject",
  "confirmed_items": ["已共识条目1", "已共识条目2"],
  "pending_items": ["待讨论点1", "待讨论点2"]
}
</TASK_UPDATE>
```

### 解析规则

| 规则 | 说明 |
|------|------|
| **后端剥离** | KCodePanel 用正则匹配 `<TASK_UPDATE>[\s\S]*?</TASK_UPDATE>`，从流式内容中剥离后再发送给前端渲染 |
| **JSON 解析** | 解析 JSON，更新 TaskStore 中的阶段、confirmed_items、pending_items |
| **状态迁移校验** | 检查 action 是否合法（如 goal 阶段不能输出 `lock_plan`），非法指令忽略 |
| **看板自动刷新** | 解析后自动调用 `sendTaskInfo()` 和 `sendNodePanelUpdate()` 刷新顶部看板和节点面板 |

### 各阶段合法 action

| 当前阶段 | 合法 action |
|---------|------------|
| demand | （大模型不输出迁移指令，仅对话） |
| goal | `propose_goal`, `lock_goal` |
| plan | `propose_plan`, `lock_plan` |
| execute | `finish_execute` |
| review | `accept`, `reject` |

---

## 四、自然对话式阶段迁移

### 场景对比

**当前做法（显式阻断）**：

```
Agent: ┌─── 任务目标确认 ───┐     ← 卡片弹窗，用户必须操作
        │ ...                │
        │ [确认] [修改] [取消]│
        └────────────────────┘
```

**改进做法（对话隐式）**：

```
用户: 帮我做个导出功能
Agent: 我理解需要 CSV 导出，对吗？       ← 继续协商
用户: 还要支持 JSON
Agent: 明白了，CSV + JSON，编码可选 UTF-8/GBK   ← 归纳
用户: 对
       ← Agent 输出 <TASK_UPDATE lock_goal> 后台切换至 plan 阶段
       ← 看板自动更新，节点面板 goal 标记完成
User: 说说你的计划
Agent: 📋 计划: 1. 添加配置 2. 实现CSV 3. 实现JSON 4. 菜单入口 5. 下载逻辑
        ← Agent 输出 <TASK_UPDATE propose_plan>，卡片展示计划
用户: 可以，开始吧
       ← Agent 输出 <TASK_UPDATE lock_plan> 后台切换至 execute 阶段
```

### 卡片定位

卡片**不是必经过户**，而是**协商收敛后的汇总展示**：

- 多轮对话自然推进阶段
- 当 Agent 判断共识已达成时，输出 `lock_*` 指令
- 卡片可选呈现代理归纳的结果，供用户最终确认或继续修改
- 用户可直接在对话中说"好"，无需点按钮

---

## 五、系统提示词分层设计

### 原则

1. **不覆盖 OpenCode 底层提示词**，叠加追加，互不冲突。
2. 提示词分三部分：
   - 任务 5 阶段定义 + 每阶段行为约束
   - `<TASK_UPDATE>` 指令格式与使用时机
   - 统一输出结构要求
3. **每轮只注入当前阶段上下文**，不重复堆砌全量目标（节约 token）。

### 阶段分发逻辑

`buildTaskPrompt()` 按 task.status 分派：

| 阶段 | 注入内容 |
|------|---------|
| goal | goal 阶段行为约束 + `<TASK_UPDATE>` 格式 + 本轮用户输入 |
| plan | plan 阶段约束 + 已锁定 goal + `<TASK_UPDATE>` 格式 + 用户输入 |
| execute | execute 阶段约束 + 已锁定 goal + 已锁定 plan 步骤 + `<TASK_UPDATE>` 格式 + 用户输入 |
| review | review 阶段约束 + `<TASK_UPDATE>` 格式 + 用户输入 |

### 输出结构要求

大模型回复建议按以下四段组织（写入提示词）：

1. 当前任务阶段
2. 已锁定共识
3. 当前待协商/待执行
4. 本轮小结与建议

---

## 六、数据模型调整

基于 `src/types/index.ts` 现有类型：

```typescript
interface Task {
    id: string;
    title: string;
    goal: string;
    type: 'task' | 'chat';
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    // 新增：
    phase: 'demand' | 'goal' | 'plan' | 'execute' | 'review';  // 当前所处阶段
    confirmedItems: string[];    // 已锁定共识条目
    pendingItems: string[];      // 待讨论条目
    planSteps: { content: string; status: 'pending' | 'active' | 'completed' }[];
    createdAt: number;
    pinned?: boolean;
    archived?: boolean;
    group?: string;
    nodeMessageIds?: Partial<Record<'demand' | 'goal' | 'plan' | 'execute' | 'review', string>>;
}
```

> `status` 保留原值作为任务整体生命周期（如 completed/cancelled），`phase` 管理 5 阶段内流转。

---

## 七、改造范围小结

| 改动点 | 文件 | 说明 |
|-------|------|------|
| `<TASK_UPDATE>` 解析器 | `KCodePanel.ts` — 合并 `stripTaskMarker()` + `stripFileMarkers()` 为 `parseTaskUpdate()` | 核心，用 JSON 解析代替正则文本 |
| 阶段分发提示词 | `KCodePanel.ts` — `buildTaskPrompt()` 按 `task.phase` 分派 4 套提示词 | 每个阶段不同行为约束 |
| 极简上下文注入 | `KCodePanel.ts` — 每轮只传当前 phase + confirmedItems，不重复全量 goal | 节约 token |
| 阶段校验 | `KCodePanel.ts` — 解析后校验 action 合法性 | 防越阶段 |
| 对话式阶段迁移 | `KCodePanel.ts` — `handleConfirmGoal()` 改为后台流转 + 看板刷新 | 移除强制卡片阻断 |
| 数据模型扩展 | `types/index.ts` + `TaskStore.ts` — 新增 `phase`, `confirmedItems`, `pendingItems`, `planSteps` | 基座 |
| 顶部看板增强 | `KCodePanel.ts` + `app.ts` — 显示当前阶段 + 共识条目 | 随 `sendTaskInfo` 刷新 |
