// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G } from '../state';
import { formatTimestamp, activateTab, addUserMessage, addSystemMessage, addMessage, addMessageElement, renderMessages } from '../messageRenderer';

function setupDom() {
    document.body.innerHTML = `
        <div id="assistant-view">
            <div id="chat-messages">
                <div class="chat-placeholder">placeholder</div>
            </div>
            <div id="chat-scroll" class="chat-empty"></div>
            <div id="working-indicator" class="hidden">
                <span class="working-text">思考中</span>
            </div>
            <div id="chat-header"></div>
            <div id="chat-body"></div>
            <div id="chat-input" class="input-wrapper">
                <textarea id="chat-input"></textarea>
            </div>
        </div>
    `;
    (window as any).acquireVsCodeApi = () => ({
        postMessage: vi.fn(),
        getState: () => ({}),
        setState: () => {},
    });
    G.vscode = { postMessage: vi.fn() } as any;
    G.activeTaskType = '';
}

describe('formatTimestamp', () => {
    it('returns time-only for today', () => {
        const now = Date.now();
        const result = formatTimestamp(now);
        expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns date+time for other day', () => {
        const yesterday = Date.now() - 86400000;
        const result = formatTimestamp(yesterday);
        expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/);
    });
});

describe('activateTab', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button class="tab active" data-tab="chat">聊天</button>
            <button class="tab" data-tab="preview">预览</button>
            <div id="tab-chat" class="tab-content active"></div>
            <div id="tab-preview" class="tab-content"></div>
        `;
    });

    it('activates specified tab and deactivates others', () => {
        activateTab('preview');
        const tabs = document.querySelectorAll('.tab');
        expect(tabs[0].className).not.toContain('active');
        expect(tabs[1].className).toContain('active');

        const contents = document.querySelectorAll('.tab-content');
        expect(contents[0].className).not.toContain('active');
        expect(contents[1].className).toContain('active');
    });
});

describe('addUserMessage', () => {
    beforeEach(setupDom);

    it('creates user message with content', () => {
        addUserMessage('hello world');
        const container = document.getElementById('chat-messages')!;
        const msgDiv = container.querySelector('.chat-msg.user')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-sender')?.textContent).toContain('You');
        expect(msgDiv.querySelector('.msg-bubble')?.textContent).toContain('hello world');
    });

    it('has copy button', () => {
        addUserMessage('test');
        const msgDiv = document.querySelector('.chat-msg.user')!;
        expect(msgDiv.querySelector('.copy-msg-btn')).toBeTruthy();
    });
});

describe('addSystemMessage', () => {
    beforeEach(setupDom);

    it('adds system message', () => {
        addSystemMessage('system info');
        const msgDiv = document.querySelector('.chat-msg.system')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-bubble')?.textContent).toBe('system info');
    });
});

describe('addMessage', () => {
    beforeEach(setupDom);

    it('dispatches to addUserMessage for user role', () => {
        addMessage('user', 'user text');
        const msgDiv = document.querySelector('.chat-msg.user')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-bubble')?.innerHTML).toContain('user text');
    });

    it('renders markdown for agent role', () => {
        addMessage('agent', '**bold**');
        const msgDiv = document.querySelector('.chat-msg.agent')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-bubble')?.innerHTML).toContain('<strong>bold</strong>');
    });
});

describe('addMessageElement', () => {
    beforeEach(setupDom);

    it('renders user message element', () => {
        addMessageElement({ role: 'user', content: 'hello', id: 'm1' });
        const msgDiv = document.querySelector('.chat-msg.user')!;
        expect(msgDiv).toBeTruthy();
        expect((msgDiv as HTMLElement).dataset.msgId).toBe('m1');
    });

    it('renders agent message element', () => {
        addMessageElement({ role: 'agent', content: '**bold**', id: 'm2' });
        const msgDiv = document.querySelector('.chat-msg.agent')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-sender')?.textContent).toContain('Agent');
    });

    it('renders stop_message type', () => {
        addMessageElement({ role: 'agent', type: 'stop_message', content: 'stop', id: 'm3' });
        const msgDiv = document.querySelector('.chat-msg.stop-message')!;
        expect(msgDiv).toBeTruthy();
        expect(msgDiv.querySelector('.msg-bubble')?.textContent).toBe('stop');
    });

    it('renders todo type', () => {
        const todoContent = JSON.stringify([{ content: '任务1', status: 'pending' }]);
        addMessageElement({ role: 'agent', type: 'todo', content: todoContent, id: 'm4', taskId: 't1' });
        const card = document.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        expect(card.querySelector('.todo-checkbox')).toBeTruthy();
    });

    it('renders plan_proposal type', () => {
        addMessageElement({ role: 'agent', type: 'plan_proposal', content: '📋 计划方案\n\nstep1\nstep2', id: 'm5', taskId: 't1' });
        const card = document.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        const headerText = card.querySelector('.msg-card-header-text')?.textContent;
        expect(headerText).toContain('计划方案');
    });

    it('renders tool message type', () => {
        const toolContent = JSON.stringify({ kind: 'bash', title: 'ls', output: 'file1' });
        addMessageElement({ role: 'tool', content: toolContent, id: 'm6' });
        const card = document.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        expect((card as HTMLElement).dataset.toolKind).toBe('bash');
    });
});

describe('renderMessages', () => {
    beforeEach(setupDom);

    it('removes chat-empty on empty messages', () => {
        renderMessages([]);
        const scroll = document.getElementById('chat-scroll')!;
        expect(scroll.className).not.toContain('chat-empty');
    });

    it('renders user and agent messages', () => {
        const messages = [
            { role: 'user', content: 'hello', id: '1' },
            { role: 'agent', content: 'world', id: '2' },
        ];
        renderMessages(messages);
        const container = document.getElementById('chat-messages')!;
        expect(container.querySelector('.chat-msg.user')).toBeTruthy();
        expect(container.querySelector('.chat-msg.agent')).toBeTruthy();
    });

    it('replaces placeholder', () => {
        renderMessages([{ role: 'user', content: 'hi', id: '1' }]);
        const placeholder = document.querySelector('.chat-placeholder');
        expect(placeholder).toBeFalsy();
    });
});
