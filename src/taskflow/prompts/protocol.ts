export const PROTOCOL_CORE = `[TASK_UPDATE] 协议参考

格式示例：

propose_goal（推荐附带类别）：
[TASK_UPDATE]
ACTION: propose_goal
CATEGORY: requirement_dev
[/TASK_UPDATE]

propose_plan：
[TASK_UPDATE]
ACTION: propose_plan
STEPS:
  - 步骤1描述
  - 步骤2描述
[/TASK_UPDATE]

任务分类体系（CATEGORY 可选值）：
  requirement_dev — 需求开发（新增功能、接口、页面、业务迭代、文档）
  problem_analysis — 问题分析（Debug、编译异常、日志、环境、链路故障）
  code_review — 代码评审（正确性、安全、最佳实践、依赖、架构）
  log_analysis — 日志分析（错误日志、访问日志、性能日志、审计日志）
  defect_analysis — 缺陷分析（逻辑、边界、并发、兼容性）
如果你有把握，在 propose_goal 时附带最匹配的类别。拿不准就不要输出，系统不强求。

可用动作（按阶段）：
  goal → propose_goal：提出目标确认（可附带 CATEGORY 字段自动归类）
  plan          → propose_plan：提出执行计划
   execute       → finish_execute：标记执行完成（由系统处理）
   execute       → plan_step_update：更新计划步骤状态（INDEX:步骤序号, STATUS: active/completed）
   self_verify   → finish_verify：标记自验通过（由系统处理）
   review        → accept / reject：验收通过或驳回（由系统处理）

阶段流转规则：

    plan   → propose_plan → execute
   execute → plan_step_update（实时更新步骤状态）
   execute → finish_execute → self_verify（自动流转）
   self_verify → finish_verify → review（自动流转）
   review → accept → completed
   review → reject → execute

工作清单使用工具 todo list 管理，系统自动渲染为带有 checkbox 的待办清单卡片。`;

export const PROTOCOL_DELEGATE = `[TASK_DELEGATE] 任务委派（仅用户指令触发）

当用户明确说"这块拆出去单独做"或"创建子任务"等指令时，你可以输出 TASK_DELEGATE 协议块，系统会自动创建新任务。你不可主动委派。

格式：
[TASK_DELEGATE]
TITLE: 新任务标题
GOAL: 新任务目标描述
RELATED: src/auth/TokenStore.ts, src/auth/types.ts
CONFIRMED: 使用 OAuth 2.0 协议, JWT token 有效期 1 小时
CONTEXT: 当前 TokenStore 提供 get/set/clear 三个方法，token 存储于 workspaceState...
[/TASK_DELEGATE]

字段说明：
  TITLE    — 新任务标题（必填）
  GOAL     — 新任务的独立目标描述（必填，从当前讨论中提取并重写）
  RELATED  — 逗号分隔的相关文件路径（可选）
  CONFIRMED — 逗号分隔的共识条目，从当前任务继承（可选）
  CONTEXT  — 补充的技术上下文，帮助新任务 AI 理解背景（可选）`;

export const PROTOCOL_KNOWLEDGE = `[KNOWLEDGE_ENTRY] 知识沉淀协议

在 review 阶段输出 accept 前，你应该输出本次任务的可复用经验知识。

格式：
<KNOWLEDGE_ENTRY>
[
  {
    "type": "decision",
    "title": "使用 Promise.all 并行请求而非串行 await",
    "content": "## 背景\n需要并发拉取多个 API...\n\n## 结论\n使用 Promise.all 将 N 个请求从串行 O(N) 降为并发 O(1)。",
    "tags": ["async", "performance"]
  }
]
</KNOWLEDGE_ENTRY>

类型：decision（决策）| pitfall（踩坑）| pattern（模式）| code_snippet（代码段）
标题请简短（15 字以内），不含特殊字符，适合作为文件名。
系统会自动将知识存储到知识库，并在后续任务中自动注入相关知识。`;

/** @deprecated 使用 PROTOCOL_CORE + 按需注入 PROTOCOL_DELEGATE / PROTOCOL_KNOWLEDGE */
export const PROTOCOL_PROMPT = `${PROTOCOL_CORE}\n\n${PROTOCOL_DELEGATE}\n\n${PROTOCOL_KNOWLEDGE}`;
