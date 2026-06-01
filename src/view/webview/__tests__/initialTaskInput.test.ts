// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G } from '../state';

describe('tv4-init-input', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input type="text" id="tv4-init-input" placeholder="输入原始工程任务..." autofocus>
            <div id="tv4-task-name"></div>
            <div id="tv4-init"></div>
        `;
        (window as any).acquireVsCodeApi = () => ({
            postMessage: vi.fn(),
            getState: () => ({}),
            setState: () => {},
        });
        G.activeTaskId = null;
        G.vscode = { postMessage: vi.fn() } as any;
    });

    it('回车时应创建新任务 (newTaskWithText)', () => {
        G.activeTaskId = '__assistant__';
        const input = document.getElementById('tv4-init-input') as HTMLInputElement;
        input.value = '测试任务';

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                const taskText = input.value;
                G.vscode.postMessage({ type: 'newTaskWithText', text: taskText });
            }
        });

        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(G.vscode.postMessage).toHaveBeenCalledWith({ type: 'newTaskWithText', text: '测试任务' });
    });
});
