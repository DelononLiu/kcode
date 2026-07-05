/**
 * 消息渲染内核（纯函数，共享于任务管线和助理管线）
 *
 * 不持有任何状态。需要操作状态时通过参数传入 StateManager 接口。
 */

import type { Message } from './types';
import { createCard } from '../cardBuilder';
import { renderMarkdown, escapeHtml } from '../markdownRenderer';
import { createTimelineEntry } from '../timelineRenderer';
import { formatTimestamp } from '../messageRenderer';
import { renderCardActions } from './cardRenderer';
import { appendToChatMessages } from '../chatStream';
import { basePipeline } from './basePipeline';
import { G } from '../state';

// ── 轻量状态接口（避免依赖具体 StateManager 实现）──
export interface MsgStateAccess {
    snapshot(): { messages: Message[]; activeTaskId?: string | null };
    patch(delta: { messages: Message[] }): void;
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

// ── 导出给 basePipeline 共用 ──

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

// ── DOM 创建 ──

/** postAction 接口：phase_action 操作回调 */
let _postAction: (action: any) => void = () => {};
export function setMsgPostAction(fn: (action: any) => void) { _postAction = fn; }

export function createMsgElement(msg: Message, sm: MsgStateAccess): HTMLElement | null {
    // ── round summary ──
    if (msg.type === 'round_summary') {
        let counts: { thinking: number; tools: Record<string, number> };
        try { counts = JSON.parse(msg.content); } catch { return null; }
        const div = document.createElement('div');
        div.className = 'chat-msg agent round-summary';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        div.innerHTML = `<span class="round-summary-chip">${buildSummaryHtml(counts)}</span>`;
        div.addEventListener('click', () => {
            const st = sm.snapshot();
            const cur = st.messages.find(m => m.id === msg.id);
            const targetCollapsed = !(cur?.collapsed);
            const toggled = st.messages.map(m => {
                if (m.id === msg.id) return { ...m, collapsed: targetCollapsed };
                if (m.roundGroup === (msg as any).roundGroup && m.type !== 'round_summary' && !_isNonCollapsible(m) && 'collapsed' in (m as any)) {
                    return { ...m, collapsed: targetCollapsed };
                }
                return m;
            });
            sm.patch({ messages: toggled });
        });
        return div;
    }

    // ── phase_action ──
    if (msg.type === 'phase_action' && msg.phaseAction) {
        const type = msg.phaseAction.phase || '';
        const isPending = msg.phaseAction.status === 'pending';
        const headerMap: Record<string, string> = {
            goal: '🎯 任务目标', plan: '📋 计划方案', execute: '⚡ 执行完成',
            self_verify: '🔍 自验完成', review: '✅ 验收',
        };
        const colorMap: Record<string, string> = {
            goal: '#3c3c3c', plan: '#4a8bb5', execute: '#d4a84b',
            self_verify: '#6b9e6b', review: '#2a5a2a',
        };
        const headerBgMap: Record<string, string> = {
            goal: '#2d2d2d', plan: '#1e2d3d', execute: '#2d2d2d',
            self_verify: '#2d2d2d', review: '#1a3a1a',
        };
        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
        if (type) div.dataset.phase = type;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        const card = createCard({
            headerHtml: headerMap[type] || '📋 阶段',
            bodyMarkdown: isPending ? '' : msg.content,
            rawData: msg,
            defaultCollapsed: !isPending,
            borderColor: colorMap[type] || '#3c3c3c',
            headerBg: headerBgMap[type] || '#2d2d2d',
            headerColor: '#e0e0e0',
        });
        if (isPending) {
            _appendPhaseActionsToCard(card, msg);
        } else {
            const statusEl = document.createElement('div');
            statusEl.className = 'msg-card-status';
            statusEl.textContent = msg.phaseAction.status === 'confirmed' ? '✅ 已确认'
                : msg.phaseAction.status === 'rejected' ? '↩️ 已驳回' : '⏳ 已完成';
            card.appendChild(statusEl);
        }
        bubble.appendChild(card);
        div.appendChild(bubble);
        return div;
    }

    // ── thinking ──
    if (msg.type === 'thinking') {
        const entry = createTimelineEntry({ kind: 'thinking', title: '思考', content: msg.content, status: msg.streaming ? 'running' : 'completed' });
        const body = entry.querySelector('.tl-entry-body');
        if (body && !msg.collapsed) body.classList.add('open');
        const div = document.createElement('div');
        div.className = 'chat-msg tool';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        div.appendChild(entry);
        if (msg.collapsed) div.style.display = 'none';
        return div;
    }

    // ── tool_call ──
    if (msg.type === 'tool_call') {
        if (!msg.toolCall) return null;
        const info = msg.toolCall;
        const entry = createTimelineEntry(info);
        const body = entry.querySelector('.tl-entry-body');
        if (body && !msg.collapsed) body.classList.add('open');
        const div = document.createElement('div');
        div.className = 'chat-msg tool';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        div.appendChild(entry);
        if (msg.collapsed) div.style.display = 'none';
        return div;
    }

    // ── user ──
    if (msg.role === 'user') {
        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        const ts = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        sender.innerHTML = 'You' + (ts ? ' <span class="msg-timestamp">' + ts + '</span>' : '');
        div.appendChild(sender);
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = renderMarkdown(msg.content);
        div.appendChild(bubble);
        return div;
    }

    // ── agent ──
    if (msg.role === 'agent') {
        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if (msg.streaming) {
            const content = document.createElement('div');
            content.id = '__v3-stream-content';
            content.className = 'stream-markdown';
            content.innerHTML = renderMarkdown(msg.content);
            bubble.appendChild(content);
        } else {
            bubble.innerHTML = renderMarkdown(msg.content);
        }
        div.appendChild(bubble);
        if (msg.collapsed) div.style.display = 'none';
        return div;
    }

    return null;
}

export function updateMsgElement(el: HTMLElement, msg: Message, sm: MsgStateAccess) {
    if (msg.type !== 'round_summary') {
        (el as HTMLElement).style.display = msg.collapsed ? 'none' : '';
    }
    if (msg.role === 'agent' && msg.streaming) {
        const contentEl = el.querySelector('#__v3-stream-content') as HTMLElement;
        if (contentEl && !_streamRafPending) {
            _streamRafPending = true;
            requestAnimationFrame(() => {
                _streamRafPending = false;
                const current = sm.snapshot().messages.find(m => m.role === 'agent' && m.streaming);
                if (current && contentEl) {
                    contentEl.innerHTML = renderMarkdown(current.content);
                }
            });
        }
    }
    if (msg.type === 'thinking') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) pre.textContent = msg.content;
        if (!msg.streaming) {
            const entry = el.querySelector('.tl-entry') as HTMLElement;
            if (entry) entry.removeAttribute('id');
        }
        const body = el.querySelector('.tl-entry-body');
        if (body) body.classList.toggle('open', !msg.collapsed);
    }
    if (msg.type === 'tool_call') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) {
            if (msg.toolResult?.output) pre.textContent = msg.toolResult.output;
        }
        const body = el.querySelector('.tl-entry-body');
        if (body) body.classList.toggle('open', !msg.collapsed);
    }
    if (msg.type === 'round_summary') {
        const chip = el.querySelector('.round-summary-chip') as HTMLElement;
        if (chip) el.classList.toggle('expanded', !msg.collapsed);
    }
}

let _streamRafPending = false;

// ── phase_action 操作按钮 ──

function _appendPhaseActionsToCard(card: HTMLElement, msg: Message) {
    const tid = msg.taskId;
    const type = msg.phaseAction?.phase;
    const actions: { text: string; className: string; onClick: () => void }[] = [];
    switch (type) {
        case 'goal':
            actions.push(
                { text: '确认目标 ✓', className: 'primary', onClick: () => _postAction({ type: 'confirmGoal', taskId: tid }) },
                { text: '修改需求 ↩', className: 'secondary', onClick: () => _postAction({ type: 'reviseGoal', taskId: tid }) },
                { text: '取消 ✕', className: 'cancel', onClick: () => _postAction({ type: 'cancelTask', taskId: tid }) },
            );
            break;
        case 'plan':
            actions.push(
                { text: '确认计划 ✓', className: 'primary', onClick: () => _postAction({ type: 'confirmPlan', taskId: tid }) },
                { text: '驳回 ↩', className: 'cancel', onClick: () => _postAction({ type: 'rejectPlan', taskId: tid }) },
            );
            break;
        case 'execute':
            actions.push(
                { text: '确认完成并进入自验 ✓', className: 'primary', onClick: () => _postAction({ type: 'confirmExecuteDone', taskId: tid }) },
            );
            break;
        case 'self_verify':
            actions.push(
                { text: '确认自验并进入验收 ✓', className: 'primary', onClick: () => _postAction({ type: 'confirmSelfVerifyDone', taskId: tid }) },
            );
            break;
        case 'review':
            actions.push(
                { text: '验收通过 ✓', className: 'primary', onClick: () => _postAction({ type: 'approveReview', taskId: tid }) },
                { text: '驳回 ↩', className: 'secondary', onClick: () => _postAction({ type: 'rejectReview', taskId: tid }) },
            );
            break;
    }
    if (actions.length > 0) renderCardActions(card, actions);
}
