/**
 * 消息渲染器共享类型与工具函数
 *
 * 从 msgRenderer.ts 拆分至此，避免 renderers/*.ts 与 msgRenderer.ts 之间的循环依赖。
 */

import type { Message } from './types';

// ── 轻量状态接口（避免依赖具体 StateManager 实现）──
export interface MsgStateAccess {
    snapshot(): { messages: Message[]; activeTaskId?: string | null; expandedRounds?: Record<string, boolean> };
    patch(delta: { messages: Message[]; expandedRounds?: Record<string, boolean> }): void;
}

// ── 不可折叠消息类型 ──
const NON_COLLAPSIBLE = new Set([
    'goal_confirmation', 'goal_confirmed', 'goal_updated',
    'plan_proposal', 'plan_confirmed',
    'execute_confirmation',
    'self_verify_confirmation',
    'review_request', 'review_approved', 'review_rejected',
    'stop_message',
    'round_summary',
    'todo',
]);

function _isNonCollapsible(m: { type?: string; phaseAction?: any }): boolean {
    return !!((m.type === 'phase_action' && m.phaseAction) || (m.type && NON_COLLAPSIBLE.has(m.type)));
}
export { _isNonCollapsible as isNonCollapsible };

// ── 摘要 HTML ──

export function buildSummaryHtml(counts: { thinking: number; tools: Record<string, number> }): string {
    const ICONS: Record<string, string> = { read: '📖', write: '✏️', edit: '✏️', bash: '💻', command: '💻', terminal: '💻', grep: '🔍', search: '🔍', glob: '🔍' };
    const parts: string[] = [];
    if (counts.thinking > 0) parts.push('💭 思考');
    for (const [kind, cnt] of Object.entries(counts.tools)) {
        const icon = ICONS[kind] || '🔧';
        parts.push(`${icon} ${kind}${cnt > 1 ? ` (${cnt})` : ''}`);
    }
    return parts.join(' · ');
}

// ── postAction 全局回调（phase_action 操作）──

let _postAction: (action: any) => void = () => {};
export function setMsgPostAction(fn: (action: any) => void) { _postAction = fn; }
export function getPostAction(): (action: any) => void { return _postAction; }
