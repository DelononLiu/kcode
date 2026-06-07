import type { Message, ToolCallState } from './types';
import { renderMarkdown, escapeHtml } from '../markdownRenderer';
import { createCard, createCardMessageElement } from '../cardBuilder';
import { appendToChatMessages } from '../chatStream';
import { renderCardForMessage, renderCardActions, renderCardStatus, postAction } from './cardRenderer';
import { createTimelineEntry } from '../timelineRenderer';

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
    const entry = createTimelineEntry(tc);
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
    msgDiv.dataset.toolCallId = tc.toolCallId;
    msgDiv.appendChild(entry);

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

const THINKING_ENTRY_ID = '__v3-thinking-entry';

function getThinkingEntry(): HTMLElement | null {
    return document.getElementById(THINKING_ENTRY_ID);
}

function startThinking() {
    if (getThinkingEntry()) return;
    if (!getOrCreateRoundContainer()) return;

    const entry = createTimelineEntry({ kind: 'thinking', title: '思考', content: '', status: 'running' });
    entry.id = THINKING_ENTRY_ID;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
    appendToRound(msgDiv);
    msgDiv.appendChild(entry);
}

function updateThinkingCard(text: string) {
    let entry = getThinkingEntry();
    if (!entry) {
        startThinking();
        entry = getThinkingEntry();
        if (!entry) return;
    }
    const pre = entry.querySelector('.tl-entry-body pre') as HTMLElement;
    if (pre) pre.textContent = text;
}

/** 完成思考：折叠 timeline body */
function finalizeThinkingCard(text: string) {
    const entry = getThinkingEntry();
    if (!entry) return;

    const pre = entry.querySelector('.tl-entry-body pre') as HTMLElement;
    if (pre && text) pre.textContent = text;

    // 折叠 body
    const body = entry.querySelector('.tl-entry-body') as HTMLElement;
    if (body) body.classList.remove('open');

    entry.removeAttribute('id');
}

/** 最终确定本轮所有内容并折叠 */
function finalizeRound() {
    const round = getRoundContainer();
    if (!round) return;

    // 移除所有特殊 ID
    document.getElementById(THINKING_ENTRY_ID)?.removeAttribute('id');
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
    // cardMeta 优先（新结构）
    if (msg.cardMeta) {
        _appendCardMetaMessage(msg, _container);
        return;
    }
    // 老路径（type 字段判断，兼容 messages-sync 来的旧消息）
    if (msg.type && ['goal_confirmation', 'goal_confirmed', 'plan_proposal', 'plan_confirmed',
        'execute_confirmation', 'self_verify_confirmation',
        'review_request', 'review_approved', 'review_rejected'].includes(msg.type)) {
        renderCardForMessage(msg, msg.phase || '');
        return;
    }
    if (msg.role === 'user') {
        _renderUserMessage(msg);
    } else if (msg.role === 'agent') {
        _renderAgentMessage(msg, msg.streaming);
    } else if (msg.role === 'tool') {
        _renderToolMessage(msg);
    }
}

// ── cardMeta 消息渲染 ──

function _appendCardMetaMessage(msg: Message, _container: HTMLElement) {
    const phase = msg.phase || msg.cardMeta?.type || '';
    const isPending = msg.cardMeta?.status === 'pending';
    const type = msg.cardMeta?.type;

    const headerMap: Record<string, string> = {
        goal: '🎯 任务目标', plan: '📋 计划方案', execute: '⚡ 执行完成',
        self_verify: '🔍 自验完成', review: '✅ 验收',
    };
    const colorMap: Record<string, string> = {
        goal: '#3c3c3c', plan: '#4a8bb5', execute: '#d4a84b',
        self_verify: '#6b9e6b', review: '#2a5a2a',
    };

    const msgDiv = buildBasicMessage(msg, phase);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: headerMap[type || ''] || '📋 阶段',
        bodyMarkdown: isPending ? '' : msg.content,
        rawData: msg,
        defaultCollapsed: !isPending,
        borderColor: colorMap[type || ''] || '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    if (isPending) {
        _appendCardActions(card, msg);
    } else {
        renderCardStatus(card, _cardStatusText(msg));
    }

    bubble.appendChild(card);
    _container.appendChild(msgDiv);
}

function _appendCardActions(card: HTMLElement, msg: Message) {
    const tid = msg.taskId;
    const type = msg.cardMeta?.type;
    const actions: { text: string; className: string; onClick: () => void }[] = [];

    switch (type) {
        case 'goal':
            actions.push(
                { text: '确认目标 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmGoal', taskId: tid }) },
                { text: '修改需求 ↩', className: 'secondary', onClick: () => postAction({ type: 'reviseGoal', taskId: tid }) },
                { text: '取消 ✕', className: 'cancel', onClick: () => postAction({ type: 'cancelTask', taskId: tid }) },
            );
            break;
        case 'plan':
            actions.push(
                { text: '确认计划 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmPlan', taskId: tid }) },
                { text: '驳回 ↩', className: 'cancel', onClick: () => postAction({ type: 'rejectPlan', taskId: tid }) },
            );
            break;
        case 'execute':
            actions.push(
                { text: '确认完成并进入自验 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmExecuteDone', taskId: tid }) },
            );
            break;
        case 'self_verify':
            actions.push(
                { text: '确认自验并进入验收 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmSelfVerifyDone', taskId: tid }) },
            );
            break;
        case 'review':
            actions.push(
                { text: '验收通过 ✓', className: 'primary', onClick: () => postAction({ type: 'approveReview', taskId: tid }) },
                { text: '驳回 ↩', className: 'secondary', onClick: () => postAction({ type: 'rejectReview', taskId: tid }) },
            );
            break;
    }
    if (actions.length > 0) renderCardActions(card, actions);
}

function _cardStatusText(msg: Message): string {
    const type = msg.cardMeta?.type;
    const status = msg.cardMeta?.status;
    if (status === 'confirmed') return '✅ 已确认';
    if (status === 'rejected') return '↩️ 已驳回';
    return '⏳ 已完成';
}

function buildBasicMessage(msg: Message, phase: string): HTMLElement {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg agent';
    msgDiv.dataset.msgId = msg.id;
    if (phase) msgDiv.dataset.phase = phase;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    msgDiv.appendChild(bubble);
    return msgDiv;
}

// ── 按 role 渲染 ──

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

function _renderAgentMessage(msg: Message, _streaming?: boolean) {
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

    const entry = createTimelineEntry(info);
    const div = document.createElement('div');
    div.className = 'chat-msg tool';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;
    div.appendChild(entry);
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
