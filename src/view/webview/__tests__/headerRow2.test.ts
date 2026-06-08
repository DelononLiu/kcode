// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateHeaderRow2 } from '../messageRenderer';
import { G } from '../state';

function setDom(phase: string, msgCount: number) {
    document.body.innerHTML = `
        <div id="task-view">
            <div id="tv4-header-row2">
                <span id="h2-current-phase"></span>
                <span class="tv4-h2-sep"></span>
                <span id="h2-done-pipeline"></span>
                <span id="h2-pending-pipeline"></span>
                <span id="h2-msg-count"></span>
            </div>
            <div id="chat-messages">
                ${Array(msgCount).fill('<div class="chat-msg"></div>').join('')}
            </div>
        </div>
    `;
}

describe('updateHeaderRow2', () => {
    beforeEach(() => {
        G.activeTaskPhase = '';
        G.activeTaskStatus = '';
    });

    it('should show current phase with accent color', () => {
        setDom('execute', 0);
        G.activeTaskPhase = 'execute';
        updateHeaderRow2();
        const el = document.getElementById('h2-current-phase')!;
        expect(el.textContent).toContain('执行修改');
        expect(el.style.color).toBe('var(--accent)');
    });

    it('should show completed pipeline for phase=execute', () => {
        setDom('execute', 0);
        G.activeTaskPhase = 'execute';
        updateHeaderRow2();
        const doneEl = document.getElementById('h2-done-pipeline')!;
        expect(doneEl.textContent).toBe('已完成: 目标确定→计划确定');
    });

    it('should show pending pipeline for phase=execute', () => {
        setDom('execute', 0);
        G.activeTaskPhase = 'execute';
        updateHeaderRow2();
        const pendingEl = document.getElementById('h2-pending-pipeline')!;
        expect(pendingEl.textContent).toBe('待完成: 自验结果→确认验收');
    });

    it('should show no done pipeline for phase=goal', () => {
        setDom('goal', 0);
        G.activeTaskPhase = 'goal';
        updateHeaderRow2();
        const doneEl = document.getElementById('h2-done-pipeline')!;
        expect(doneEl.textContent).toBe('');
        expect(doneEl.style.display).toBe('none');
    });

    it('should show no pending pipeline for phase=review', () => {
        setDom('review', 0);
        G.activeTaskPhase = 'review';
        updateHeaderRow2();
        const pendingEl = document.getElementById('h2-pending-pipeline')!;
        expect(pendingEl.textContent).toBe('');
        expect(pendingEl.style.display).toBe('none');
    });

    it('should show message count from DOM', () => {
        setDom('goal', 5);
        G.activeTaskPhase = 'goal';
        updateHeaderRow2();
        const el = document.getElementById('h2-msg-count')!;
        expect(el.textContent).toBe('💬 5');
    });

    it('should show empty phase when phase is unknown', () => {
        setDom('', 0);
        G.activeTaskPhase = '';
        updateHeaderRow2();
        const el = document.getElementById('h2-current-phase')!;
        expect(el.textContent).toBe('');
    });

    it('should use info param if provided', () => {
        setDom('plan', 3);
        updateHeaderRow2({ phase: 'plan' });
        const el = document.getElementById('h2-current-phase')!;
        expect(el.textContent).toContain('计划确定');
    });
});
