import type { ChatMessage, ToolCallState, StreamResult } from './types';
import { stateManager } from './state';
import { createCard, createCardMessageElement } from '../cardBuilder';
import { renderMarkdown, escapeHtml } from '../markdownRenderer';
import { getChatMessages, getChatScroll, getWorkingIndicator } from '../domContainers';
import { hideWorkingIndicator, appendToChatMessages, resetStreamParser, __resetStream } from '../chatStream';
import { showAgentThinking } from '../chatStream';

const AUTO_SCROLL_THRESHOLD = 80;

// ──── DOM helpers ────

function scrollToBottom() {
    const sc = getChatScroll();
    if (sc) {
        sc.scrollTop = sc.scrollHeight;
        sc.dispatchEvent(new Event('scroll'));
    }
}

function ensureChatReady() {
    const container = getChatMessages()!;
    const sc = getChatScroll()!;
    sc.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) (placeholder as HTMLElement).style.display = '';
}

function showMessagePlaceholder() {
    const container = getChatMessages()!;
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();
}

// ──── Stream engine ────

let _streamBubble: HTMLElement | null = null;
let _streamMarkdown: HTMLElement | null = null;
let _agentHeaderShown = false;

function _ensureAgentHeader() {
    if (_agentHeaderShown) return;
    const header = document.createElement('div');
    header.className = 'chat-msg agent-header';
    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'Agent';
    header.appendChild(sender);
    appendToChatMessages(header);
    _agentHeaderShown = false;
    // set to true after append
    setTimeout(() => { _agentHeaderShown = true; }, 0);
}

function startStream() {
    const container = getChatMessages()!;
    if (_streamBubble && _streamBubble.parentElement) {
        return; // already streaming
    }

    ensureChatReady();
    showMessagePlaceholder();

    const msgDiv = createCardMessageElement();
    const bubble = msgDiv.querySelector('.msg-bubble') as HTMLElement;
    _streamBubble = bubble;

    appendToChatMessages(msgDiv);

    _streamMarkdown = document.createElement('div');
    _streamMarkdown.className = 'stream-markdown';
    bubble.appendChild(_streamMarkdown);
    scrollToBottom();
}

function appendStreamChunk(text: string) {
    if (!_streamBubble || !_streamMarkdown) {
        startStream();
    }
    if (!_streamMarkdown) return;

    _streamMarkdown.innerHTML = renderMarkdown(text);
    scrollToBottom();
}

function finalizeStream() {
    _streamBubble = null;
    _streamMarkdown = null;
    _agentHeaderShown = false;
}

// ──── Tool card engine ────

let _lastToolCard: HTMLElement | null = null;

function addToolCard(tc: ToolCallState) {
    ensureChatReady();
    showMessagePlaceholder();
    finalizeStream(); // close any pending stream

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
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
        rawData: { toolCallId: tc.toolCallId, kind: tc.kind, title: tc.title },
    });

    if (tc.toolCallId) card.dataset.toolCallId = tc.toolCallId;
    if (tc.kind) card.dataset.toolKind = tc.kind;

    if (tc.status === 'running') {
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '⏳ 执行中...';
        card.appendChild(statusEl);
    }

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    _lastToolCard = card;
    scrollToBottom();
}

function updateToolCard(toolCallId: string, changes: Partial<ToolCallState>) {
    const card = document.querySelector(`[data-tool-call-id="${toolCallId}"]`) as HTMLElement | null;
    if (!card) {
        // tool card not yet rendered, create it
        const tc = stateManager.snapshot().streamState.toolCalls.find(t => t.toolCallId === toolCallId);
        if (tc) {
            const updated = { ...tc, ...changes };
            addToolCard(updated);
        }
        return;
    }

    if (changes.output !== undefined || changes.content !== undefined) {
        const body = card.querySelector('.msg-card-body') as HTMLElement | null;
        if (body) {
            body.innerHTML = renderMarkdown(changes.output || changes.content || '');
            body.scrollTop = body.scrollHeight;
        }
    }

    if (changes.status === 'completed' || changes.status === 'failed') {
        const statusEl = card.querySelector('.msg-card-status') as HTMLElement | null;
        if (statusEl) {
            statusEl.textContent = changes.status === 'completed' ? '✅ 完成' : '❌ 失败';
        }
        const header = card.querySelector('.msg-card-header') as HTMLElement | null;
        if (header) header.setAttribute('aria-expanded', 'true');
        const body = card.querySelector('.msg-card-body') as HTMLElement | null;
        if (body) body.classList.remove('collapsed');
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

// ──── Message engine ────

function renderMessages(messages: ChatMessage[]) {
    const container = getChatMessages()!;
    const sc = getChatScroll()!;
    const indicator = getWorkingIndicator();

    container.innerHTML = '';
    if (indicator) container.appendChild(indicator);

    if (!messages || messages.length === 0) {
        sc.classList.remove('chat-empty');
        return;
    }

    ensureChatReady();
    showMessagePlaceholder();

    for (const msg of messages) {
        if (msg.role === 'user') {
            renderUserMessage(msg);
        } else if (msg.role === 'tool') {
            renderToolMessage(msg);
        } else {
            renderAgentMessage(msg);
        }
    }

    scrollToBottom();
}

function renderUserMessage(msg: ChatMessage) {
    _agentHeaderShown = false;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';
    msgDiv.dataset.msgId = msg.id;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'You';
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    msgDiv.appendChild(bubble);

    if (msg.timestamp) msgDiv.dataset.ts = String(msg.timestamp);
    appendToChatMessages(msgDiv);
}

function renderToolMessage(msg: ChatMessage) {
    if (msg.type !== 'tool_call') return;

    let info: any;
    try { info = JSON.parse(msg.content); } catch { return; }

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
    msgDiv.dataset.msgId = msg.id;
    if (msg.phase) msgDiv.dataset.phase = msg.phase;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble tool-bubble';
    msgDiv.appendChild(bubble);

    const card = createCard({
        headerHtml: `${_kindIcon(info.kind)} ${info.title || info.kind}`,
        bodyMarkdown: info.output || '',
        defaultCollapsed: info.status === 'completed',
        borderColor: _kindColor(info.kind),
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
        rawData: { toolCallId: info.toolCallId, kind: info.kind, title: info.title },
    });

    if (info.toolCallId) card.dataset.toolCallId = info.toolCallId;
    if (info.kind) card.dataset.toolKind = info.kind;

    bubble.appendChild(card);
    if (msg.timestamp) msgDiv.dataset.ts = String(msg.timestamp);
    appendToChatMessages(msgDiv);
}

function renderAgentMessage(msg: ChatMessage) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg agent';
    msgDiv.dataset.msgId = msg.id;
    if (msg.phase) msgDiv.dataset.phase = msg.phase;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    msgDiv.appendChild(bubble);

    if (msg.timestamp) msgDiv.dataset.ts = String(msg.timestamp);
    appendToChatMessages(msgDiv);
}

// ──── Public API ────

export const basePipeline = {
    // Stream
    startStream,
    appendStreamChunk,
    finalizeStream,

    // Tool cards
    addToolCard,
    updateToolCard,

    // Messages
    renderMessages,
    renderUserMessage,
    renderAgentMessage,
    renderToolMessage,

    // Helpers
    scrollToBottom,
    ensureChatReady,
    showMessagePlaceholder,
};
