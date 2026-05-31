// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';

function setupDom() {
    document.body.innerHTML = `
        <div id="assistant-view">
            <div id="chat-messages"></div>
            <div id="chat-scroll"></div>
            <div id="working-indicator" class="hidden"></div>
        </div>
    `;
    (window as any).acquireVsCodeApi = () => ({
        postMessage: vi.fn(),
        getState: () => ({}),
        setState: () => {},
    });
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
(window as any).escapeHtml = escapeHtml;

function appendToChatMessages(el: Element) {
    const container = document.getElementById('chat-messages')!;
    container.appendChild(el);
}
(window as any).__appendToChatMessages = appendToChatMessages;

let appLoaded = false;

describe('Demo Card', () => {
    beforeAll(async () => {
        setupDom();
        if (!appLoaded) {
            await import('../app');
            appLoaded = true;
        }
    });

    it('create renders card with all sections', () => {
        const msg = {
            cardId: 'demo_test_1',
            taskId: 'task_1',
            action: 'create',
            name: '单元测试',
            command: './demo/unittest --gtest_filter=Algo*',
            device: '192.168.1.100 (SSH)',
            envMeta: { '本地时间': '2026-05-20T23:50', '远端目录': '/home/work' },
            status: 'running',
            output: '',
        };

        (window as any).handleDemoCardUpdate(msg);

        const messages = document.getElementById('chat-messages')!;
        expect(messages.children.length).toBe(1);
        const msgDiv = messages.children[0] as HTMLElement;
        expect(msgDiv.className).toContain('chat-msg tool');
        expect(msgDiv.dataset.demoCardId).toBe('demo_test_1');

        const card = msgDiv.querySelector('.msg-card') as HTMLElement;
        expect(card).toBeTruthy();

        // Info section
        expect(card.textContent).toContain('单元测试');
        expect(card.textContent).toContain('./demo/unittest --gtest_filter=Algo*');
        expect(card.textContent).toContain('192.168.1.100 (SSH)');

        // Env meta
        const envHeader = card.querySelector('.demo-card-env-header') as HTMLElement;
        expect(envHeader).toBeTruthy();
        expect(envHeader.textContent).toContain('环境信息');
        const envBody = card.querySelector('.demo-card-env-body') as HTMLElement;
        expect(envBody).toBeTruthy();
        expect(envBody.className).toContain('collapsed');
        expect(envBody.textContent).toContain('本地时间');
        expect(envBody.textContent).toContain('2026-05-20T23:50');

        // Status badge
        const badge = card.querySelector('.demo-card-status-badge') as HTMLElement;
        expect(badge).toBeTruthy();
        expect(badge.className).toContain('running');
        expect(badge.textContent).toContain('运行中');

        // Output area
        const output = card.querySelector('.demo-card-output') as HTMLElement;
        expect(output).toBeTruthy();

        // Footer buttons
        const footer = card.querySelector('.demo-card-footer') as HTMLElement;
        expect(footer).toBeTruthy();
        expect(footer.textContent).toContain('查看日志');
        expect(footer.textContent).toContain('重新运行');
        expect(footer.textContent).toContain('终止');
    });

    it('appendOutput adds lines to output area', () => {
        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_1',
            action: 'appendOutput',
            output: '[INFO] Starting...\n[PASS] test_1 passed\n',
        });

        const card = document.querySelector('[data-demo-card-id="demo_test_1"]') as HTMLElement;
        const outputLines = card.querySelectorAll('.demo-card-output-line');
        expect(outputLines.length).toBe(2);
        expect(outputLines[0].textContent).toBe('[INFO] Starting...');
        expect(outputLines[0].className).toContain('stdout');
        expect(outputLines[1].textContent).toBe('[PASS] test_1 passed');
    });

    it('appendOutput with stderr marks lines as stderr', () => {
        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_1',
            action: 'appendOutput',
            output: '\x1b[31m[ERROR] something went wrong\x1b[0m\n',
        });

        const card = document.querySelector('[data-demo-card-id="demo_test_1"]') as HTMLElement;
        const outputLines = card.querySelectorAll('.demo-card-output-line');
        const lastLine = outputLines[outputLines.length - 1];
        expect(lastLine.textContent).toBe('[ERROR] something went wrong');
        expect(lastLine.className).toContain('stderr');
    });

    it('updateStatus changes badge to completed', () => {
        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_1',
            action: 'updateStatus',
            status: 'completed',
        });

        const card = document.querySelector('[data-demo-card-id="demo_test_1"]') as HTMLElement;
        const badge = card.querySelector('.demo-card-status-badge') as HTMLElement;
        expect(badge.className).toContain('completed');
        expect(badge.className).not.toContain('running');
        expect(badge.textContent).toContain('已完成');

        // Stop button should be hidden, rerun should be enabled
        const rerunBtn = card.querySelector('.demo-card-btn.primary') as HTMLButtonElement;
        expect(rerunBtn.disabled).toBe(false);
        const stopBtn = card.querySelector('.demo-card-btn.danger') as HTMLElement;
        expect(stopBtn.style.display).toBe('none');
    });

    it('updateStatus changes badge to failed', () => {
        // Create a new card with running status
        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_2',
            taskId: 'task_2',
            action: 'create',
            name: '失败测试',
            command: 'false',
            device: 'localhost',
            status: 'running',
            output: '',
        });

        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_2',
            action: 'updateStatus',
            status: 'failed',
        });

        const card = document.querySelector('[data-demo-card-id="demo_test_2"]') as HTMLElement;
        const badge = card.querySelector('.demo-card-status-badge') as HTMLElement;
        expect(badge.className).toContain('failed');
        expect(badge.textContent).toContain('失败');
    });

    it('env meta toggle collapses and expands', () => {
        const card = document.querySelector('[data-demo-card-id="demo_test_1"]') as HTMLElement;
        const envHeader = card.querySelector('.demo-card-env-header') as HTMLElement;
        const envBody = card.querySelector('.demo-card-env-body') as HTMLElement;

        // Initial: body collapsed (hidden), header has no collapsed class
        expect(envBody.className).toContain('collapsed');
        expect(envHeader.className).not.toContain('collapsed');

        // Click to expand: body visible, header gets collapsed for arrow rotation
        envHeader.click();
        expect(envBody.className).not.toContain('collapsed');

        // Click to collapse again: body hidden, header loses collapsed
        envHeader.click();
        expect(envBody.className).toContain('collapsed');
        expect(envHeader.className).not.toContain('collapsed');
    });

    it('setEnvMeta fills env body dynamically', () => {
        (window as any).handleDemoCardUpdate({
            cardId: 'demo_test_1',
            action: 'setEnvMeta',
            envMeta: { '新增字段': 'new_value', 'OS': 'Linux' },
        });

        const card = document.querySelector('[data-demo-card-id="demo_test_1"]') as HTMLElement;
        const envBody = card.querySelector('.demo-card-env-body') as HTMLElement;
        expect(envBody.textContent).toContain('新增字段');
        expect(envBody.textContent).toContain('new_value');
        expect(envBody.textContent).toContain('OS');
        expect(envBody.textContent).toContain('Linux');
    });
});
