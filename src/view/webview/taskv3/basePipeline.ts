import type { Message, ToolCallState } from './types';
import { renderMarkdown } from '../markdownRenderer';
import { createCard } from '../cardBuilder';
import { appendToChatMessages } from '../chatStream';
import { renderCardForMessage, renderCardActions, renderCardStatus, postAction } from './cardRenderer';
import { stateManager } from './state';
import { createTimelineEntry } from '../timelineRenderer';
import { getChatScroll } from '../domContainers';
import { buildSummaryHtml, isNonCollapsible } from './msgRenderer';

function getContainer(): HTMLElement | null {
    return document.querySelector('#task-view #chat-messages') || null;
}

/** 滚动到聊天底部（始终执行，不检查用户滚动锁定） */
function scrollToBottom() {
    const sc = getChatScroll();
    if (sc) {
        sc.scrollTop = sc.scrollHeight;
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

function finalizeStream() {
    const el = document.getElementById(STREAM_CONTENT_ID);
    if (el) el.removeAttribute('id');
    const msg = document.getElementById('__v3-stream-message');
    if (msg) msg.removeAttribute('id');
}

// ────── Tool Card Engine ──────

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
    // 追加到本轮末尾（AI 回复文本在先，思考在后）
    appendToRound(msgDiv);
    msgDiv.appendChild(entry);
}

/** 完成思考：不再折叠 body，保持内容可见 */
function finalizeThinkingCard(text: string) {
    const entry = getThinkingEntry();
    if (!entry) return;

    const pre = entry.querySelector('.tl-entry-body pre') as HTMLElement;
    if (pre && text) pre.textContent = text;

    // 保持 body 展开，让用户看到思考内容
    const body = entry.querySelector('.tl-entry-body') as HTMLElement;
    if (body) body.classList.add('open');

    entry.removeAttribute('id');
}

/** 关闭本轮容器（不折叠），下次流式会开新 round */
function closeRound() {
    const round = getRoundContainer();
    if (round) round.removeAttribute('id');
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
    // round summary：可点击的折叠摘要条
    if (msg.type === 'round_summary') {
        _renderRoundSummary(msg);
        return;
    }
    // 思考消息（timeline 样式渲染）
    if (msg.type === 'thinking') {
        _renderThinkingMessage(msg);
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

/** 渲染思考消息为 timeline 条目 */
function _renderThinkingMessage(msg: Message) {
    const entry = createTimelineEntry({
        kind: 'thinking',
        title: '思考',
        content: msg.content,
        status: msg.streaming ? 'running' : 'completed',
    });
    const body = entry.querySelector('.tl-entry-body');
    if (body && !msg.collapsed) body.classList.add('open');
    const div = document.createElement('div');
    div.className = 'chat-msg tool';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;
    div.appendChild(entry);
    if (msg.collapsed) div.style.display = 'none';
    appendToChatMessages(div);
}

/** 渲染 round summary 为可点击折叠条 */
function _renderRoundSummary(msg: Message) {
    let counts: { thinking: number; tools: Record<string, number> };
    try { counts = JSON.parse(msg.content); } catch { return; }
    const div = document.createElement('div');
    div.className = 'chat-msg agent round-summary';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;
    div.innerHTML = `<span class="round-summary-chip">${buildSummaryHtml(counts)}</span>`;
    div.addEventListener('click', () => {
        const st = stateManager.snapshot();
        const cur = st.messages.find(m => m.id === msg.id);
        const targetCollapsed = !(cur?.collapsed);
        const toggled = st.messages.map(m => {
            if (m.id === msg.id) return { ...m, collapsed: targetCollapsed };
            if (m.roundGroup === msg.roundGroup && m.type !== 'round_summary' && !m.cardMeta && 'collapsed' in (m as any)) {
                return { ...m, collapsed: targetCollapsed };
            }
            return m;
        });
        stateManager.patch({ messages: toggled });
    });
    appendToChatMessages(div);
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

    if (msg.collapsed) div.style.display = 'none';
    appendToChatMessages(div);
}

function _renderToolMessage(msg: Message) {
    if (msg.type !== 'tool_call') return;

    let info: any;
    try { info = JSON.parse(msg.content); } catch { return; }

    const entry = createTimelineEntry(info);
    const body = entry.querySelector('.tl-entry-body');
    if (body && !msg.collapsed) body.classList.add('open');
    const div = document.createElement('div');
    div.className = 'chat-msg tool';
    div.dataset.msgId = msg.id;
    if (msg.phase) div.dataset.phase = msg.phase;
    div.appendChild(entry);
    if (msg.collapsed) div.style.display = 'none';
    appendToChatMessages(div);
}

export const basePipeline = {
    finalizeStream,
    closeRound,
    finalizeThinkingCard,
    getOrCreateRoundContainer,
    renderMessageList,
    scrollToBottom,
    getRoundContainer,
};
