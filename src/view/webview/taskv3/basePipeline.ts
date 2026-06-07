import type { Message } from './types';
import { stateManager } from './state';
import { renderMarkdown } from '../markdownRenderer';
import { createCard, createCardMessageElement } from '../cardBuilder';
import { appendToChatMessages } from '../chatStream';

function getContainer(): HTMLElement | null {
    return document.querySelector('#task-view #chat-messages') || null;
}

function scrollToBottom() {
    const container = getContainer();
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ────── Stream Engine ──────

const STREAM_CONTENT_ID = '__v3-stream-content';

function startStream() {
    const container = getContainer();
    if (!container) return;

    let existing = document.getElementById(STREAM_CONTENT_ID);
    if (existing) return;

    const msgDiv = createCardMessageElement();
    const bubble = msgDiv.querySelector('.msg-bubble') as HTMLElement;
    if (!bubble) return;

    const content = document.createElement('div');
    content.id = STREAM_CONTENT_ID;
    content.className = 'stream-markdown';
    bubble.appendChild(content);

    msgDiv.id = '__v3-stream-message';
    msgDiv.classList.add('chat-msg', 'agent');
    appendToChatMessages(msgDiv);
}

function appendStreamChunk(text: string) {
    const content = document.getElementById(STREAM_CONTENT_ID);
    if (!content) {
        startStream();
        const retry = document.getElementById(STREAM_CONTENT_ID);
        if (!retry) return;
        retry.innerHTML = renderMarkdown(text);
        scrollToBottom();
        return;
    }
    content.innerHTML = renderMarkdown(text);
    scrollToBottom();
}

function finalizeStream() {
    const el = document.getElementById(STREAM_CONTENT_ID);
    if (el) {
        el.removeAttribute('id');
    }
    const msg = document.getElementById('__v3-stream-message');
    if (msg) {
        msg.removeAttribute('id');
    }
}

// ────── Tool Card Engine ──────

function addToolCard(tc: { toolCallId: string; title: string; kind: string; status: string; output?: string; content?: string }) {
    finalizeStream();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
    msgDiv.dataset.toolCallId = tc.toolCallId;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble tool-bubble';
    msgDiv.appendChild(bubble);

    const card = createCard({
        headerHtml: `${_kindIcon(tc.kind)} ${tc.title}`,
        bodyMarkdown: tc.output || tc.content || '',
        defaultCollapsed: tc.status === 'completed',
        borderColor: _kindColor(tc.kind),
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });
    card.dataset.toolCallId = tc.toolCallId;

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
}

function updateToolCard(toolCallId: string, changes: { output?: string; content?: string; status?: string }) {
    const card = document.querySelector(`.msg-card[data-tool-call-id="${toolCallId}"]`) as HTMLElement | null;
    if (!card) return;

    if (changes.output !== undefined || changes.content !== undefined) {
        const body = card.querySelector('.msg-card-body') as HTMLElement | null;
        if (body) {
            body.innerHTML = renderMarkdown(changes.output || changes.content || '');
        }
    }

    if (changes.status === 'completed' || changes.status === 'failed') {
        const header = card.querySelector('.msg-card-header') as HTMLElement | null;
        if (header) header.setAttribute('aria-expanded', 'true');
    }
}

function _kindIcon(kind: string): string {
    const map: Record<string, string> = {
        bash: '💻', command: '💻', terminal: '💻', shell: '💻',
        read: '📖', write: '✏️', edit: '✏️',
        grep: '🔍', glob: '🔍', search: '🔍',
        thinking: '💭',
    };
    return map[kind] || '🔧';
}

function _kindColor(kind: string): string {
    const map: Record<string, string> = {
        bash: '#d4a84b', command: '#d4a84b', terminal: '#d4a84b',
        read: '#4a8bb5', write: '#4a8bb5', edit: '#4a8bb5',
        grep: '#6b9e6b', glob: '#6b9e6b', search: '#6b9e6b',
        thinking: '#777',
    };
    return map[kind] || '#3c3c3c';
}

// ────── Message Engine ──────

function renderMessageList(messages: Message[]) {
    const container = getContainer();
    if (!container) return;

    container.replaceChildren();
    for (const msg of messages) {
        _appendMessage(msg, container);
    }
    scrollToBottom();
}

function appendMessage(msg: Message) {
    const container = getContainer();
    if (!container) return;
    _appendMessage(msg, container);
    scrollToBottom();
}

function _appendMessage(msg: Message, container: HTMLElement) {
    if (msg.role === 'user') {
        _renderUserMessage(msg, container);
    } else if (msg.role === 'agent') {
        _renderAgentMessage(msg, container);
    } else if (msg.role === 'tool') {
        _renderToolMessage(msg, container);
    }
}

function _renderUserMessage(msg: Message, container: HTMLElement) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.dataset.msgId = msg.id;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'You';
    div.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    div.appendChild(bubble);

    container.appendChild(div);
}

function _renderAgentMessage(msg: Message, container: HTMLElement) {
    const div = document.createElement('div');
    div.className = 'chat-msg agent';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    div.appendChild(bubble);

    container.appendChild(div);
}

function _renderToolMessage(msg: Message, container: HTMLElement) {
    if (msg.type !== 'tool_call') return;

    let info: any;
    try { info = JSON.parse(msg.content); } catch { return; }

    const div = document.createElement('div');
    div.className = 'chat-msg tool';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble tool-bubble';
    div.appendChild(bubble);

    const card = createCard({
        headerHtml: `${_kindIcon(info.kind)} ${info.title || info.kind}`,
        bodyMarkdown: info.output || '',
        defaultCollapsed: info.status === 'completed',
        borderColor: _kindColor(info.kind),
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });
    card.dataset.toolCallId = info.toolCallId;

    bubble.appendChild(card);
    container.appendChild(div);
}

export const basePipeline = {
    startStream,
    appendStreamChunk,
    finalizeStream,
    addToolCard,
    updateToolCard,
    renderMessageList,
    appendMessage,
    scrollToBottom,
};
