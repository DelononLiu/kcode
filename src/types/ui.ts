/**
 * UI 状态类型（渲染层专属，不序列化，不混入 Domain Model）
 *
 * 遵循原则 2：UI 状态不混入 Domain Model
 */

// ── 消息级 UI 状态 ──
export interface MessageUIState {
    streaming: boolean;
    collapsed: boolean;
    roundGroup: string | null;
}

// ── 应用级 UI 状态 ──
export interface AppUIState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    expandedRounds: Record<string, boolean>;
    isGenerating: boolean;
    scrollLocked: boolean;
}
