import { G } from './state';

export const STAGE_ORDER = ['goal', 'plan', 'execute', 'self_verify', 'review'];

export function groupPhases(): void { /* disabled */ }
export function foldPhase(_phase: string): void { /* disabled */ }

export function showTaskView(asControlPanel: boolean = false): void {
    const assistantView = document.getElementById('assistant-view');
    const taskView = document.getElementById('task-view');
    if (assistantView) assistantView.style.display = 'none';
    if (taskView) taskView.style.display = 'block';

    const initEl = document.getElementById('tv4-init');
    const panelEl = document.getElementById('tv4-panel');
    if (asControlPanel) {
        if (initEl) initEl.style.display = 'none';
        if (panelEl) panelEl.style.display = '';
    } else {
        if (initEl) initEl.style.display = '';
        if (panelEl) panelEl.style.display = 'none';
        G.vscode.postMessage({ type: 'requestEditorContext' });
    }
}
