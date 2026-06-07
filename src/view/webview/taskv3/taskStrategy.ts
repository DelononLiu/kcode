import type { AppState, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { renderCardForMessage } from './cardRenderer';
import { STAGE_ORDER } from '../taskView';

function getVscode(): any {
    return (window as any).vscode || (window as any).__vscode || (window as any).acquireVsCodeApi?.();
}

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
            catBadge.textContent = `🧩 ${ti.category}`;
            catBadge.style.display = '';
        } else {
            catBadge.style.display = 'none';
        }
    }

    const idx = STAGE_ORDER.indexOf(state.activeTaskPhase);
    const curEl = document.getElementById('h2-current-phase');
    const doneEl = document.getElementById('h2-done-pipeline');
    const pendingEl = document.getElementById('h2-pending-pipeline');

    if (curEl) {
        curEl.textContent = idx >= 0 ? `⚡ ${STAGE_LABELS[state.activeTaskPhase] || state.activeTaskPhase}` : '';
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

// ──── Stream done ────

function onStreamDone(state: AppState, result: StreamResult) {
    if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify') return;
    if (result.executeFinished && state.activeTaskPhase === 'execute') return;
    if (result.planProposed && state.activeTaskPhase === 'plan') return;
}

// ──── User action ────

function onUserAction(_state: AppState, action: UserAction) {
    getVscode().postMessage(action);
}

// ──── Guards ────

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
