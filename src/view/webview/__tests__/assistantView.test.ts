// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('showAssistantView', () => {
    beforeEach(async () => {
        document.body.innerHTML = `
            <div id="assistant-view" style="display:none">
                <span class="task-info-title">选择任务开始对话</span>
                <div id="chat-body"></div>
            </div>
            <div id="task-view"></div>
            <div id="chat-scroll"></div>
        `;
        (window as any).acquireVsCodeApi = () => ({ postMessage: vi.fn(), getState: () => ({}), setState: () => {} });
        const mod = await import('../assistantView');
        (window as any).__assistantView = mod;
    });

    it('shows assistant view and hides task view', () => {
        (window as any).__assistantView.showAssistantView();
        const taskView = document.getElementById('task-view')!;
        const assistantView = document.getElementById('assistant-view')!;
        expect(taskView.style.display).toBe('none');
        expect(assistantView.style.display).toBe('block');
    });

    it('moves chat-scroll into chat-body', () => {
        (window as any).__assistantView.showAssistantView();
        const chatBody = document.getElementById('chat-body')!;
        expect(chatBody.querySelector('#chat-scroll')).not.toBeNull();
    });

    it('sets task-info-title to 🤖 小助手', () => {
        (window as any).__assistantView.showAssistantView();
        const titleEl = document.querySelector('.task-info-title')!;
        expect(titleEl.textContent).toBe('🤖 小助手');
    });
});
