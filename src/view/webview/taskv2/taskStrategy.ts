import type { AppState, StreamResult, UserAction, ChatMessage } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { renderCardForMessage } from './cardRenderer';
import type { FileChange } from '../../../types';

declare function acquireVsCodeApi(): any;
const _vscode = acquireVsCodeApi();

const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];
const STAGE_LABELS: Record<string, string> = {
    demand: '需求提取', goal: '目标确定', plan: '计划确定',
    execute: '执行修改', self_verify: '自验结果', review: '确认验收',
};

// ──── Header ────

function renderHeader(state: AppState) {
    const ti = state.taskInfo;

    const nameEl = document.getElementById('tv4-task-name');
    if (nameEl) nameEl.textContent = ti.title || '任务';

    const catBadge = document.getElementById('tv4-category-badge');
    if (catBadge) {
        if (ti.category) {
            catBadge.textContent = ti.categoryLabel ? `${ti.categoryLabel}` : `🧩 ${ti.category}`;
            catBadge.style.display = '';
        } else {
            catBadge.style.display = 'none';
        }
    }

    const phaseBadge = document.getElementById('tv4-phase-count');
    if (phaseBadge) {
        const idx = STAGE_ORDER.indexOf(state.activeTaskPhase);
        phaseBadge.textContent = `${idx >= 0 ? idx + 1 : 0}/6`;
    }

    updatePipelineHeader(state);
}

function updatePipelineHeader(state: AppState) {
    const phase = state.activeTaskPhase;
    const idx = STAGE_ORDER.indexOf(phase);

    const currentEl = document.getElementById('h2-current-phase');
    const doneEl = document.getElementById('h2-done-pipeline');
    const pendingEl = document.getElementById('h2-pending-pipeline');

    if (currentEl) {
        currentEl.textContent = idx >= 0 ? `⚡ ${STAGE_LABELS[phase] || phase}` : '';
        if (idx >= 0) currentEl.style.color = 'var(--accent)';
    }

    if (doneEl) {
        const done = idx > 0 ? STAGE_ORDER.slice(0, idx) : [];
        doneEl.textContent = done.length > 0 ? '已完成: ' + done.map(s => STAGE_LABELS[s]).join('→') : '';
        doneEl.style.display = done.length > 0 ? '' : 'none';
    }

    if (pendingEl) {
        const pending = idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER.slice(idx + 1) : [];
        pendingEl.textContent = pending.length > 0 ? '待完成: ' + pending.map(s => STAGE_LABELS[s]).join('→') : '';
        pendingEl.style.display = pending.length > 0 ? '' : 'none';
    }
}

// ──── Stream finish handler ────

function onStreamDone(state: AppState, result: StreamResult) {
    // Store tool calls as messages first
    for (const tc of result.toolCalls) {
        // tool calls are already stored by extension side, just rendered
    }

    // Determine which card to show based on genResult flags
    if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify') {
        // self-verify card is handled via stream-done → renderMessages
        return;
    }
    if (result.executeFinished && state.activeTaskPhase === 'execute') {
        // execute card is handled via stream-done → renderMessages
        return;
    }
    if (result.planProposed && state.activeTaskPhase === 'plan') {
        // plan card is handled via stream-done → renderMessages
        return;
    }
}

// ──── Message render ────

function renderTaskMessages(messages: ChatMessage[]) {
    const st = stateManager.state;
    const reviewChanges = st.reviewState.changes;

    // Clear container before rendering
    const container = document.querySelector('#task-view #chat-messages');
    if (container) container.innerHTML = '';

    for (const msg of messages) {
        if (msg.role === 'user') {
            basePipeline.renderUserMessage(msg);
            continue;
        }

        if (msg.role === 'tool' && msg.type === 'tool_call') {
            basePipeline.renderToolMessage(msg);
            continue;
        }

        if (msg.role === 'agent') {
            const phase = msg.phase || st.activeTaskPhase;

            if (msg.type && ['goal_confirmation', 'goal_confirmed', 'plan_proposal', 'plan_confirmed',
                'execute_confirmation', 'self_verify_confirmation',
                'review_request', 'review_approved', 'review_rejected'].includes(msg.type)) {
                const needsReviewChanges = ['review_request', 'review_approved', 'review_rejected'].includes(msg.type || '');
                renderCardForMessage(msg, phase, needsReviewChanges ? reviewChanges : undefined);
            } else {
                basePipeline.renderAgentMessage(msg);
            }
            continue;
        }
    }
}

// ──── Phase folding ────

function foldPhases(state: AppState) {
    const currentIdx = STAGE_ORDER.indexOf(state.activeTaskPhase);
    if (currentIdx < 0) return;

    for (let i = 0; i < currentIdx; i++) {
        const phase = STAGE_ORDER[i];
        const groups = document.querySelectorAll(`.tv4-phase-group[data-phase="${phase}"]`);
        groups.forEach(g => g.classList.add('collapsed'));
    }
}

// ──── User action dispatch ────

function onUserAction(_state: AppState, action: UserAction) {
    // All user actions are forwarded to extension side
    _vscode.postMessage(action);
}

// ──── Strategy ────

function showPhasePanel(): boolean { return true; }
function shouldFoldPhases(): boolean { return true; }
function showOutputPanel(): boolean { return true; }

export const taskStrategy: ViewStrategy = {
    renderHeader,
    onStreamDone,
    onUserAction,
    showPhasePanel,
    shouldFoldPhases,
    showOutputPanel,
};

// Export additional functions for direct use by renderManager
export { renderTaskMessages, foldPhases };
