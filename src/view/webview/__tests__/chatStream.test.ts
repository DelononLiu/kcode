// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { G } from '../state';
import { showAgentThinking, updateWorkingIndicator, appendToChatMessages, updateLastMsgConvertBtn, handleAgentStreamUpdate } from '../chatStream';

function setupDom() {
    document.body.innerHTML = `
        <div id="assistant-view">
            <div id="chat-messages">
                <div class="chat-placeholder">placeholder</div>
            </div>
            <div id="chat-scroll"></div>
            <div id="working-indicator" class="hidden">
                <span class="working-text">思考中</span>
            </div>
            <div id="chat-header"></div>
            <div id="chat-body"></div>
        </div>
    `;
    (window as any).acquireVsCodeApi = () => ({
        postMessage: vi.fn(),
        getState: () => ({}),
        setState: () => {},
    });
    G.vscode = { postMessage: vi.fn() } as any;
}

describe('showAgentThinking', () => {
    beforeEach(setupDom);

    it('shows working indicator and removes placeholder', () => {
        showAgentThinking();
        const indicator = document.getElementById('working-indicator')!;
        expect(indicator.className).not.toContain('hidden');
        const placeholder = document.querySelector('.chat-placeholder');
        expect(placeholder).toBeFalsy();
    });
});

describe('updateWorkingIndicator', () => {
    beforeEach(setupDom);

    it('updates text for running status with title', () => {
        const indicator = document.getElementById('working-indicator')!;
        indicator.classList.remove('hidden');
        updateWorkingIndicator({ status: 'running', title: '分析中...' });
        const textEl = indicator.querySelector('.working-text') as HTMLElement;
        expect(textEl.textContent).toBe('分析中...');
    });

    it('resets text for non-running status', () => {
        const indicator = document.getElementById('working-indicator')!;
        indicator.classList.remove('hidden');
        updateWorkingIndicator({ status: 'completed', title: '完成' });
        const textEl = indicator.querySelector('.working-text') as HTMLElement;
        expect(textEl.textContent).toBe('思考中');
    });

    it('does nothing when indicator is hidden', () => {
        const indicator = document.getElementById('working-indicator')!;
        indicator.classList.add('hidden');
        updateWorkingIndicator({ status: 'running', title: '运行中' });
        const textEl = indicator.querySelector('.working-text') as HTMLElement;
        expect(textEl.textContent).toBe('思考中');
    });
});

describe('appendToChatMessages', () => {
    beforeEach(setupDom);

    it('appends element to chat-messages', () => {
        const el = document.createElement('div');
        el.textContent = 'test message';
        appendToChatMessages(el);
        const container = document.getElementById('chat-messages')!;
        expect(container.textContent).toContain('test message');
    });

    it('inserts before working indicator when indicator is present', () => {
        const container = document.getElementById('chat-messages')!;
        const indicator = document.getElementById('working-indicator')!;
        container.appendChild(indicator);

        const el = document.createElement('div');
        el.textContent = 'before indicator';
        appendToChatMessages(el);

        const children = container.children;
        expect(children[children.length - 2].textContent).toBe('before indicator');
        expect(children[children.length - 1].id).toBe('working-indicator');
    });
});

describe('updateLastMsgConvertBtn', () => {
    beforeEach(setupDom);

    it('adds convert button to last agent message', () => {
        G.activeTaskType = 'assistant';
        const container = document.getElementById('chat-messages')!;
        const agentMsg = document.createElement('div');
        agentMsg.className = 'chat-msg agent';
        const row = document.createElement('div');
        row.className = 'msg-row';
        agentMsg.appendChild(row);
        container.appendChild(agentMsg);

        updateLastMsgConvertBtn();

        const btn = row.querySelector('.convert-task-btn')!;
        expect(btn).toBeTruthy();
        expect(btn.textContent).toBe('🌿 转为任务');
    });

    it('does not add button for non-assistant task type', () => {
        G.activeTaskType = 'task';
        const container = document.getElementById('chat-messages')!;
        const agentMsg = document.createElement('div');
        agentMsg.className = 'chat-msg agent';
        const row = document.createElement('div');
        row.className = 'msg-row';
        agentMsg.appendChild(row);
        container.appendChild(agentMsg);

        updateLastMsgConvertBtn();

        expect(row.querySelector('.convert-task-btn')).toBeFalsy();
    });
});

describe('handleAgentStreamUpdate', () => {
    beforeEach(() => {
        setupDom();
        G.activeTaskType = 'assistant';
    });

    afterEach(() => {
        G.streamMessageEl = null;
        G._agentHeaderShown = false;
    });

    it('创建 stream 消息元素并渲染文本', async () => {
        handleAgentStreamUpdate('Hello');
        // 等待 rAF 执行
        await new Promise(resolve => requestAnimationFrame(resolve));

        const bubble = G.streamMessageEl;
        expect(bubble).toBeTruthy();
        expect(bubble!.innerHTML).toContain('Hello');
    });

    it('后续调用复用已有 streamMessageEl', async () => {
        handleAgentStreamUpdate('Hello');
        await new Promise(resolve => requestAnimationFrame(resolve));
        const firstEl = G.streamMessageEl;

        handleAgentStreamUpdate('Hello World');
        await new Promise(resolve => requestAnimationFrame(resolve));
        const secondEl = G.streamMessageEl;

        expect(secondEl).toBe(firstEl);
        expect(secondEl!.innerHTML).toContain('Hello World');
    });

    it('只渲染最新的文本（rAF 合并）', async () => {
        // 在同一个 rAF 帧内多次调用
        handleAgentStreamUpdate('First');
        handleAgentStreamUpdate('Second');
        handleAgentStreamUpdate('Third');

        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(G.streamMessageEl!.innerHTML).toContain('Third');
    });

    it('移除 placeholder', async () => {
        const container = document.getElementById('chat-messages')!;
        const placeholder = container.querySelector('.chat-placeholder');
        expect(placeholder).toBeTruthy();

        handleAgentStreamUpdate('test');
        await new Promise(resolve => requestAnimationFrame(resolve));

        expect(container.querySelector('.chat-placeholder')).toBeFalsy();
    });

    it('第一次调用时创建 agent header', async () => {
        expect(G._agentHeaderShown).toBe(false);

        handleAgentStreamUpdate('test');
        await new Promise(resolve => requestAnimationFrame(resolve));

        const header = document.querySelector('.chat-msg.agent-header');
        expect(header).toBeTruthy();
        expect(G._agentHeaderShown).toBe(true);
    });
});
