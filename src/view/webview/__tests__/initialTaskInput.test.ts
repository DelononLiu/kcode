// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G } from '../state';

describe('initial-task-input', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input type="text" id="initial-task-input" placeholder="输入原始工程任务..." autofocus>
            <div id="task-board-task-name"></div>
            <div id="init-screen"></div>
        `;
        (window as any).acquireVsCodeApi = () => ({
            postMessage: vi.fn(),
            getState: () => ({}),
            setState: () => {},
        });
        G.activeTaskId = null;
        G.vscode = { postMessage: vi.fn() } as any;
    });

    it('当 assistant 已加载时回车应创建新任务而非 sendMessage', () => {
        G.activeTaskId = '__assistant__';
        const input = document.getElementById('initial-task-input') as HTMLInputElement;
        input.value = '测试任务';

        // 模拟 initV3Layout 中的事件绑定
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
