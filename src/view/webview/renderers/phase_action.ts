import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/rendererShared';
import { registerRenderer, MessageRenderer } from './registry';
import { createCard } from '../cardBuilder';
import { renderCardActions } from '../taskv3/cardRenderer';
import { getPostAction } from '../taskv3/rendererShared';

export function renderPhaseAction(msg: Message, _sm: MsgStateAccess): HTMLElement | null {
    if (!msg.phaseAction) return null;
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
        appendPhaseActionsToCard(card, msg);
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

// ── phase_action 操作按钮 ──

export function appendPhaseActionsToCard(card: HTMLElement, msg: Message) {
    const tid = msg.taskId;
    const type = msg.phaseAction?.phase;
    const actions: { text: string; className: string; onClick: () => void }[] = [];
    const postAction = getPostAction();
    switch (type) {
        case 'goal':
            actions.push(
                { text: '确认目标 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmGoal', taskId: tid }) },
                { text: '修改需求 ↩', className: 'secondary', onClick: () => postAction({ type: 'reviseGoal', taskId: tid }) },
                { text: '取消 ✕', className: 'cancel', onClick: () => postAction({ type: 'cancelTask', taskId: tid }) },
            );
            break;
        case 'plan':
            actions.push(
                { text: '确认计划 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmPlan', taskId: tid }) },
                { text: '驳回 ↩', className: 'cancel', onClick: () => postAction({ type: 'rejectPlan', taskId: tid }) },
            );
            break;
        case 'execute':
            actions.push(
                { text: '确认完成并进入自验 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmExecuteDone', taskId: tid }) },
            );
            break;
        case 'self_verify':
            actions.push(
                { text: '确认自验并进入验收 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmSelfVerifyDone', taskId: tid }) },
            );
            break;
        case 'review':
            actions.push(
                { text: '验收通过 ✓', className: 'primary', onClick: () => postAction({ type: 'approveReview', taskId: tid }) },
                { text: '驳回 ↩', className: 'secondary', onClick: () => postAction({ type: 'rejectReview', taskId: tid }) },
            );
            break;
    }
    if (actions.length > 0) renderCardActions(card, actions);
}

const phaseActionRenderer: MessageRenderer = {
    type: 'phase_action',
    render: renderPhaseAction,
};
registerRenderer(phaseActionRenderer);
