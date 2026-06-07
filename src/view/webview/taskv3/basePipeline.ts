import type { Message, ToolCallState } from './types';
import { renderMarkdown } from '../markdownRenderer';
import { createCard, createCardMessageElement } from '../cardBuilder';
import { appendToChatMessages } from '../chatStream';
import { renderCardForMessage } from './cardRenderer';

function getContainer(): HTMLElement | null {
    return document.querySelector('#task-view #chat-messages') || null;
}

function scrollToBottom() {
    const container = getContainer();
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ────── Round Container ──────
// 本轮所有流式内容（思考 + 工具 + AI回复文本）都放入此容器，
// 流结束时整体折叠，只显示最终消息和按钮

const ROUND_CONTAINER_ID = '__v3-round-container';

function getRoundContainer(): HTMLElement | null {
    return document.getElementById(ROUND_CONTAINER_ID);
}

function getOrCreateRoundContainer(): HTMLElement | null {
    const container = getContainer();
    if (!container) return null;
    let round = getRoundContainer();
    if (!round) {
        round = document.createElement('div');
        round.id = ROUND_CONTAINER_ID;
        round.className = 'v3-round';
        appendToChatMessages(round);
    }
    return round;
}

function appendToRound(el: Element) {
    const round = getOrCreateRoundContainer();
    if (round) {
        round.appendChild(el);
    } else {
        appendToChatMessages(el);
    }
}

// ────── Stream Engine ──────

const STREAM_CONTENT_ID = '__v3-stream-content';

function startStream() {
    if (document.getElementById(STREAM_CONTENT_ID)) return;
    if (!getOrCreateRoundContainer()) return;

    const msgDiv = createCardMessageElement();
    const bubble = msgDiv.querySelector('.msg-bubble') as HTMLElement;
    if (!bubble) return;

    const content = document.createElement('div');
    content.id = STREAM_CONTENT_ID;
    content.className = 'stream-markdown';
    bubble.appendChild(content);

    msgDiv.id = '__v3-stream-message';
    msgDiv.classList.add('chat-msg', 'agent');
    appendToRound(msgDiv);
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
    if (el) el.removeAttribute('id');
    const msg = document.getElementById('__v3-stream-message');
    if (msg) msg.removeAttribute('id');
}

// ────── Tool Card Engine ──────

function addToolCard(tc: { toolCallId: string; title: string; kind: string; status: string; output?: string; content?: string }) {
    finalizeStream();
    _createAndAppendToolCard(tc, true);
}

/** 插入工具卡片到本轮容器（时间顺序），不终结流 */
function addToolCardToRound(tc: { toolCallId: string; title: string; kind: string; status: string; output?: string; content?: string }) {
    _createAndAppendToolCard(tc, false);
}

function _createAndAppendToolCard(tc: { toolCallId: string; title: string; kind: string; status: string; output?: string; content?: string }, useAppendToChat: boolean) {
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

    if (useAppendToChat) {
        appendToChatMessages(msgDiv);
    } else {
        // 插入到 stream 消息前（时间顺序：思考→工具→AI回复）
        const streamMsg = document.getElementById('__v3-stream-message');
        const round = getRoundContainer();
        if (streamMsg && streamMsg.parentElement) {
            streamMsg.parentElement.insertBefore(msgDiv, streamMsg);
        } else if (round) {
            round.appendChild(msgDiv);
        } else {
            appendToChatMessages(msgDiv);
        }
    }
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

// ────── Thinking Card Engine (V3) ──────

const THINKING_MSG_ID = '__v3-thinking-message';
const THINKING_CARD_ID = '__v3-thinking-card';

function getThinkingMsgEl(): HTMLElement | null {
    return document.getElementById(THINKING_MSG_ID);
}

function startThinking() {
    if (getThinkingMsgEl()) return;
    if (!getOrCreateRoundContainer()) return;

    const msgDiv = createCardMessageElement();
    msgDiv.id = THINKING_MSG_ID;
    msgDiv.classList.add('chat-msg', 'agent');

    const bubble = msgDiv.querySelector('.msg-bubble') as HTMLElement;
    if (!bubble) return;

    const card = createCard({
        headerHtml: '💭 思考',
        bodyMarkdown: '',
        defaultCollapsed: false,
        borderColor: '#777',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });
    card.id = THINKING_CARD_ID;
    card.dataset.thinking = 'true';
    bubble.appendChild(card);

    appendToRound(msgDiv);
}

function updateThinkingCard(text: string) {
    const card = document.getElementById(THINKING_CARD_ID) as HTMLElement | null;
    if (!card) {
        startThinking();
        const retry = document.getElementById(THINKING_CARD_ID);
        if (!retry) return;
        const body = retry.querySelector('.msg-card-body') as HTMLElement;
        if (body) body.innerHTML = renderMarkdown(text);
        return;
    }
    const body = card.querySelector('.msg-card-body') as HTMLElement;
    if (body) body.innerHTML = renderMarkdown(text);
}

/** 最终确定本轮所有内容并折叠 */
function finalizeRound() {
    const round = getRoundContainer();
    if (!round) return;

    // 移除所有特殊 ID
    document.getElementById(THINKING_MSG_ID)?.removeAttribute('id');
    document.getElementById(THINKING_CARD_ID)?.removeAttribute('id');
    document.getElementById('__v3-stream-message')?.removeAttribute('id');
    document.getElementById(STREAM_CONTENT_ID)?.removeAttribute('id');

    // 不要继续从流式 API 更新
    round.removeAttribute('id');

    // 为当前内容添加折叠头 + 折叠体
    const header = document.createElement('div');
    header.className = 'v3-round-header';
    header.innerHTML = '<span class="v3-round-header-text">📋 本轮交互详情</span><span class="v3-round-toggle">▶</span>';

    const wrapper = document.createElement('div');
    wrapper.className = 'v3-round-content collapsed';

    // 把 round 里的子元素移到 wrapper 中
    while (round.firstChild) {
        wrapper.appendChild(round.firstChild);
    }

    round.appendChild(header);
    round.appendChild(wrapper);

    header.addEventListener('click', () => {
        const isOpen = wrapper.classList.toggle('collapsed');
        const toggleEl = header.querySelector('.v3-round-toggle') as HTMLElement;
        if (toggleEl) toggleEl.textContent = isOpen ? '▶' : '▼';
    });

    round.classList.add('v3-round-folded');
}

/** 在折叠 round 后追加最终 AI 回复消息（用于无阶段卡片时） */
function appendFinalMessage(text: string) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg agent v3-round-result';
    msgDiv.dataset.role = 'agent';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(text || '');
    msgDiv.appendChild(bubble);
    appendToChatMessages(msgDiv);
}

function finalizeThinkingCard(text: string) {
    const card = document.getElementById(THINKING_CARD_ID) as HTMLElement | null;
    if (!card) return;

    const body = card.querySelector('.msg-card-body') as HTMLElement;
    if (body && text) body.innerHTML = renderMarkdown(text);

    // Collapse the thinking card
    if (body) body.classList.add('collapsed');
    const toggle = card.querySelector('.msg-card-toggle') as HTMLElement;
    if (toggle) toggle.classList.add('collapsed');
    const header = card.querySelector('.msg-card-header') as HTMLElement;
    if (header) header.setAttribute('aria-expanded', 'false');

    card.removeAttribute('id');
    getThinkingMsgEl()?.removeAttribute('id');
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

function _appendMessage(msg: Message, _container: HTMLElement) {
    if (msg.type && ['goal_confirmation', 'goal_confirmed', 'plan_proposal', 'plan_confirmed',
        'execute_confirmation', 'self_verify_confirmation',
        'review_request', 'review_approved', 'review_rejected'].includes(msg.type)) {
        renderCardForMessage(msg, msg.phase || '');
        return;
    }
    if (msg.role === 'user') {
        _renderUserMessage(msg);
    } else if (msg.role === 'agent') {
        _renderAgentMessage(msg);
    } else if (msg.role === 'tool') {
        _renderToolMessage(msg);
    }
}

function _renderUserMessage(msg: Message) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'You';
    div.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    div.appendChild(bubble);

    appendToChatMessages(div);
}

function _renderAgentMessage(msg: Message) {
    const div = document.createElement('div');
    div.className = 'chat-msg agent';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(msg.content);
    div.appendChild(bubble);

    appendToChatMessages(div);
}

function _renderToolMessage(msg: Message) {
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
    appendToChatMessages(div);
}

export const basePipeline = {
    startStream,
    appendStreamChunk,
    finalizeStream,
    addToolCard,
    addToolCardToRound,
    updateToolCard,
    updateThinkingCard,
    finalizeThinkingCard,
    finalizeRound,
    appendFinalMessage,
    getOrCreateRoundContainer,
    renderMessageList,
    appendMessage,
    scrollToBottom,
};
