import type { Message, UserAction } from './types';
import { createCard, createCardMessageElement } from '../cardBuilder';
import { renderMarkdown } from '../markdownRenderer';
import { appendToChatMessages } from '../chatStream';
import { getChatScroll } from '../domContainers';
import { stateManager } from './state';

function getVscode(): any {
    return (window as any).vscode || (window as any).__vscode || (window as any).acquireVsCodeApi?.();
}

const CONFIRM_LABELS: Record<string, string> = {
    confirmGoal: '✅ 确认目标',
    confirmPlan: '✅ 确认计划',
    confirmExecuteDone: '✅ 确认执行完成，进入自验',
    confirmSelfVerifyDone: '✅ 确认自验完成，进入验收',
    approveReview: '✅ 验收通过',
    rejectPlan: '↩️ 驳回计划',
    rejectReview: '↩️ 驳回',
    cancelTask: '✕ 取消任务',
};

export function postAction(action: UserAction): void {
    // 用户操作 → 记录到 state.messages[]
    const label = CONFIRM_LABELS[action.type];
    if (label) {
        const state = stateManager.snapshot();
        const userMsg: Message = {
            id: 'action_' + Date.now(),
            taskId: action.taskId || state.activeTaskId || '',
            role: 'user',
            content: label,
            timestamp: Date.now(),
        };
        stateManager.patch({ messages: [...state.messages, userMsg] });
    }
    getVscode().postMessage(action);
}

function scrollToBottom() {
    const sc = getChatScroll();
    if (sc) sc.scrollTop = sc.scrollHeight;
}

export function renderCardActions(container: HTMLElement, actions: { text: string; className: string; onClick: () => void }[]) {
    const div = document.createElement('div');
    div.className = 'msg-card-actions';
    for (const a of actions) {
        const btn = document.createElement('button');
        btn.className = `msg-card-btn ${a.className}`;
        btn.textContent = a.text;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            a.onClick();
        });
        div.appendChild(btn);
    }
    container.appendChild(div);
}

export function renderCardStatus(container: HTMLElement, text: string) {
    const el = document.createElement('div');
    el.className = 'msg-card-status';
    el.textContent = text;
    container.appendChild(el);
}

export function renderGoalCard(msg: Message, phase: string) {
    const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;
    const bodyText = msg.content.replace(/^📋 任务目标确认\n\n/, '');
    const needsAction = phase === 'goal' && msg.type !== 'goal_confirmed';

    const card = createCard({
        headerHtml: '🎯 任务目标',
        bodyMarkdown: bodyText,
        rawData: msg,
        defaultCollapsed: !!msg.collapsed,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    if (needsAction) {
        renderCardActions(card, [
            { text: '确认目标 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmGoal', taskId: msg.taskId }) },
            { text: '修改需求 ↩', className: 'secondary', onClick: () => postAction({ type: 'reviseGoal', taskId: msg.taskId }) },
            { text: '取消 ✕', className: 'cancel', onClick: () => postAction({ type: 'cancelTask', taskId: msg.taskId }) },
        ]);
    } else {
        renderCardStatus(card, msg.type === 'goal_confirmed' ? '✅ 已确认' : '⏳ 已完成');
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

/** 折叠后仅渲染目标操作按钮（无卡片内容，避免和 fold 内重复） */
export function renderGoalActions(taskId: string) {
    _renderPhaseActions(taskId, 'goal', '🎯 任务目标', [
        { text: '确认目标 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmGoal', taskId }) },
        { text: '修改需求 ↩', className: 'secondary', onClick: () => postAction({ type: 'reviseGoal', taskId }) },
        { text: '取消 ✕', className: 'cancel', onClick: () => postAction({ type: 'cancelTask', taskId }) },
    ]);
}

/** 折叠后仅渲染计划操作按钮 */
export function renderPlanActions(taskId: string) {
    _renderPhaseActions(taskId, 'plan', '📋 计划方案', [
        { text: '确认计划 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmPlan', taskId }) },
        { text: '驳回 ↩', className: 'cancel', onClick: () => postAction({ type: 'rejectPlan', taskId }) },
    ]);
}

/** 折叠后仅渲染执行操作按钮 */
export function renderExecuteActions(taskId: string) {
    _renderPhaseActions(taskId, 'execute', '⚡ 执行完成', [
        { text: '确认完成并进入自验 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmExecuteDone', taskId }) },
    ]);
}

/** 折叠后仅渲染自验操作按钮 */
export function renderSelfVerifyActions(taskId: string) {
    _renderPhaseActions(taskId, 'self_verify', '🔍 自验完成', [
        { text: '确认自验并进入验收 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmSelfVerifyDone', taskId }) },
    ]);
}

/** 折叠后仅渲染验收操作按钮 */
export function renderReviewActions(taskId: string) {
    _renderPhaseActions(taskId, 'review', '✅ 验收', [
        { text: '验收通过 ✓', className: 'primary', onClick: () => postAction({ type: 'approveReview', taskId }) },
        { text: '驳回 ↩', className: 'secondary', onClick: () => postAction({ type: 'rejectReview', taskId }) },
    ]);
}

/** 通用阶段按钮渲染（空 body，不重复 fold 内容） */
function _renderPhaseActions(taskId: string, phase: string, headerText: string, actions: { text: string; className: string; onClick: () => void }[]) {
    const msgDiv = createCardMessageElement(taskId, phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: headerText,
        bodyMarkdown: '',
        defaultCollapsed: true,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    renderCardActions(card, actions);
    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

export function renderPlanCard(msg: Message, phase: string) {
    const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;
    const bodyText = msg.content.replace(/^📋 计划方案\n\n/, '');
    const needsAction = phase === 'plan' && msg.type === 'plan_proposal';

    const card = createCard({
        headerHtml: '📋 计划方案',
        bodyHtml: bodyText
            ? bodyText.split('\n').map(line => `<div class="plan-step-line">${line}</div>`).join('')
            : '',
        rawData: msg,
        defaultCollapsed: !!msg.collapsed,
        borderColor: '#4a8bb5',
        headerBg: '#1e2d3d',
        headerColor: '#e0e0e0',
    });

    if (needsAction) {
        renderCardActions(card, [
            { text: '确认计划 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmPlan', taskId: msg.taskId }) },
        ]);
    } else {
        renderCardStatus(card, msg.type === 'plan_confirmed' ? '✅ 已确认' : '⏳ 已完成');
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

export function renderExecuteCard(msg: Message, phase: string) {
    const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;
    const needsAction = phase === 'execute';

    const card = createCard({
        headerHtml: '⚡ 执行完成',
        bodyMarkdown: msg.content,
        rawData: msg,
        defaultCollapsed: !!msg.collapsed,
        borderColor: '#d4a84b',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    if (needsAction) {
        renderCardActions(card, [
            { text: '确认完成，进入自验 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmExecuteDone', taskId: msg.taskId }) },
        ]);
    } else {
        renderCardStatus(card, '✅ 已完成');
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

export function renderSelfVerifyCard(msg: Message, phase: string) {
    const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;
    const needsAction = phase === 'self_verify';

    const card = createCard({
        headerHtml: '🔍 自验完成',
        bodyMarkdown: msg.content,
        rawData: msg,
        defaultCollapsed: !!msg.collapsed,
        borderColor: '#6b9e6b',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    if (needsAction) {
        renderCardActions(card, [
            { text: '确认自验，进入验收 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmSelfVerifyDone', taskId: msg.taskId }) },
        ]);
    } else {
        renderCardStatus(card, '✅ 已完成');
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

export function renderReviewCard(msg: Message, phase: string, changes?: Array<{ filePath: string; original: string; modified: string }>) {
    const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: '✅ 验收',
        bodyMarkdown: msg.content,
        rawData: msg,
        defaultCollapsed: !!msg.collapsed,
        borderColor: '#2a5a2a',
        headerBg: '#1a3a1a',
        headerColor: '#e0e0e0',
    });

    if (changes && changes.length > 0) {
        const list = document.createElement('div');
        list.className = 'review-changes';
        const label = document.createElement('div');
        label.className = 'review-changes-label';
        label.textContent = `📄 变更文件 (${changes.length})`;
        list.appendChild(label);

        for (const ch of changes) {
            const item = document.createElement('div');
            item.className = 'review-changes-item';
            const icon = ch.original ? '📝' : '📄';
            item.innerHTML = `<span class="review-changes-icon">${icon}</span><span class="review-changes-name">${ch.filePath}</span>`;
            item.addEventListener('click', () => {
                getVscode().postMessage({ type: 'openNativeDiff', original: ch.original, modified: ch.modified, filePath: ch.filePath });
            });
            list.appendChild(item);
        }

        const body = card.querySelector('.msg-card-body');
        if (body) body.appendChild(list);
    }

    const isPending = msg.type === 'review_request';
    if (isPending) {
        renderCardActions(card, [
            { text: '验收通过 ✓', className: 'primary', onClick: () => postAction({ type: 'approveReview', taskId: msg.taskId }) },
            { text: '驳回 ↩', className: 'secondary', onClick: () => postAction({ type: 'rejectReview', taskId: msg.taskId }) },
        ]);
    } else {
        renderCardStatus(card,
            msg.type === 'review_approved' ? '✅ 已验收通过'
            : msg.type === 'review_rejected' ? '↩️ 已驳回'
            : '✅ 已完成'
        );
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollToBottom();
}

export function renderCardForMessage(msg: Message, phase: string, reviewChanges?: Array<{ filePath: string; original: string; modified: string }>) {
    switch (msg.type) {
        case 'goal_confirmation':
        case 'goal_confirmed':
            renderGoalCard(msg, phase);
            break;
        case 'plan_proposal':
        case 'plan_confirmed':
            renderPlanCard(msg, phase);
            break;
        case 'execute_confirmation':
            renderExecuteCard(msg, phase);
            break;
        case 'self_verify_confirmation':
            renderSelfVerifyCard(msg, phase);
            break;
        case 'review_request':
        case 'review_approved':
        case 'review_rejected':
            renderReviewCard(msg, phase, reviewChanges);
            break;
        default:
            break;
    }
}
