/**
 * PlanAdapter — Kanban 状态 ↔ TaskFlow 5 阶段映射
 *
 * Kanban 状态          TaskFlow 阶段          说明
 * ───────────          ─────────────          ──────────
 * todo                 goal + plan            目标确认 + 计划制定
 * inprogress           execute                执行中
 * testing              self_verify            AI 自验
 * done                 review                 人工验收
 */

export type KanbanStatus = 'todo' | 'inprogress' | 'testing' | 'done';
export type TaskFlowPhase = 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';

const KANBAN_TO_PHASE: Record<KanbanStatus, TaskFlowPhase[]> = {
  todo: ['goal', 'plan'],
  inprogress: ['execute'],
  testing: ['self_verify'],
  done: ['review'],
};

const PHASE_TO_KANBAN: Record<TaskFlowPhase, KanbanStatus> = {
  goal: 'todo',
  plan: 'todo',
  execute: 'inprogress',
  self_verify: 'testing',
  review: 'done',
};

export class PlanAdapter {
  /** Kanban 状态 → TaskFlow 阶段列表 */
  static toPhases(status: KanbanStatus): TaskFlowPhase[] {
    return KANBAN_TO_PHASE[status] ?? ['goal'];
  }

  /** TaskFlow 阶段 → Kanban 状态 */
  static toKanbanStatus(phase: TaskFlowPhase): KanbanStatus {
    return PHASE_TO_KANBAN[phase] ?? 'todo';
  }

  /** 阶段顺序索引 */
  static phaseIndex(phase: TaskFlowPhase): number {
    const order: TaskFlowPhase[] = ['goal', 'plan', 'execute', 'self_verify', 'review'];
    return order.indexOf(phase);
  }

  /** 是否允许从 fromPhase 切换到 toPhase（只能向前或停留） */
  static canTransition(from: TaskFlowPhase, to: TaskFlowPhase): boolean {
    return PlanAdapter.phaseIndex(to) >= PlanAdapter.phaseIndex(from);
  }

  /** 获取阶段的显示标签 */
  static phaseLabel(phase: TaskFlowPhase): string {
    const labels: Record<TaskFlowPhase, string> = {
      goal: '目标',
      plan: '计划',
      execute: '执行',
      self_verify: '自验',
      review: '验收',
    };
    return labels[phase] ?? phase;
  }

  /** 获取 Kanban 列的显示标签 */
  static kanbanLabel(status: KanbanStatus): string {
    const labels: Record<KanbanStatus, string> = {
      todo: '待办',
      inprogress: '进行中',
      testing: '测试中',
      done: '已完成',
    };
    return labels[status] ?? status;
  }
}
