import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { postAction, renderCardActions } from './cardRenderer';
import { createCard } from '../cardBuilder';
import { showTaskView } from '../taskView';
import { appendToChatMessages } from '../chatStream';
import { renderMarkdown } from '../markdownRenderer';
import { formatTimestamp } from '../messageRenderer';
import { createTimelineEntry } from '../timelineRenderer';
import { G } from '../state';

let _strategy: ViewStrategy = taskStrategy;

export function setStrategy(s: ViewStrategy) {
    _strategy = s;
}

export function getStrategy(): ViewStrategy {
    return _strategy;
}

function foldPhases(currentPhase: string) {
    const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];
    const idx = STAGE_ORDER.indexOf(currentPhase);
    if (idx < 0 || !_strategy.shouldFoldPhases()) return;
    for (let i = 0; i < idx; i++) {
        const groups = document.querySelectorAll(`.tv4-phase-group[data-phase="${STAGE_ORDER[i]}"]`);
        groups.forEach(g => (g as HTMLElement).style.display = 'none');
    }
}

let _initialized = false;

export function initTaskV3() {
    if (_initialized) return;
    _initialized = true;

    let _lastMsgVersion = -1;
    stateManager.subscribe((state) => {
        showTaskView(true);
        _strategy.renderHeader(state);

        if (state.msgVersion !== _lastMsgVersion) {
            _renderedMsgIds.clear();
            basePipeline.renderMessageList(state.messages);
            // 将所有消息标记为已渲染（包括 cardMeta），
            // 确保 _syncMessages 增量同步时能找到正确的 DOM 插入锚点
            for (const msg of state.messages) {
                _renderedMsgIds.add(msg.id);
            }
            _lastMsgVersion = state.msgVersion;

            if (state.msgVersion === _lastSyncVersion && !state.isGenerating) {
                _renderPhaseActionsFromSync(state);
            }
        }
    });

    stateManager.onPatch(() => {
        _syncMessages();
        // 智能滚动锁定：用户未往上翻时才自动滚到底部
        if (!G._userScrolledUp) {
            G._programmaticScroll = true;
            basePipeline.scrollToBottom();
            requestAnimationFrame(() => { G._programmaticScroll = false; });
        }
    });

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || !message.type) return;

        const v3Types = ['state-delta', 'stream-chunk', 'stream-done', 'messages-sync', 'finalizeGoalMessage', 'thinking-chunk', 'tool-chunk'];
        if (!v3Types.includes(message.type)) return;

        // 过滤非当前任务的流式消息 — 只对 streaming 相关消息做检查，
        // state-delta / messages-sync 是切换任务/同步状态的入口，不能过滤。
        if (message.taskId && message.taskId !== stateManager.state.activeTaskId) {
            const streamingTypes = ['stream-chunk', 'stream-done', 'thinking-chunk', 'tool-chunk'];
            if (streamingTypes.includes(message.type)) return;
        }

        switch (message.type) {
            case 'state-delta': {
                const delta = message as unknown as StateDelta & { type: string };
                stateManager.update(delta);
                if (delta.activeTaskPhase) foldPhases(delta.activeTaskPhase);
                break;
            }
            case 'stream-chunk':
                handleStreamChunk(message as unknown as { text: string; type: string });
                break;
            case 'stream-done':
                handleStreamDone(message as unknown as StreamResult & { type: string });
                break;
            case 'messages-sync':
                handleMessagesSync(message as unknown as { messages: import('../../../types').ChatMessage[]; type: string });
                break;
            case 'finalizeGoalMessage':
                handleFinalizeGoalMessage(message as unknown as { taskId: string; goal: string; type: string });
                break;
            case 'thinking-chunk':
                handleThinkingChunk(message as unknown as { text: string; status: string; type: string });
                break;
            case 'tool-chunk':
                handleToolChunk(message as unknown as { toolCallId: string; title: string; kind: string; status: string; content: string; type: string });
                break;
        }
    });

    // 为 Task 视图滚动容器 (#tv4-scroll) 挂载用户滚动检测
    // 注意：initChat() 在 DOMContentLoaded 时挂载了 Assistant 视图的检测，
    // 但当时 #task-view 是 display:none, getActiveView() 返回 'assistant'，
    // 所以 #tv4-scroll 没有获取到滚动事件监听，这里补上。
    const taskScroller = document.querySelector('#tv4-scroll') as HTMLElement | null;
    if (taskScroller) {
        taskScroller.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) G._userScrolledUp = true;
        });
        taskScroller.addEventListener('scroll', () => {
            if (G._programmaticScroll) return;
            const atBottom = taskScroller.scrollTop + taskScroller.clientHeight >= taskScroller.scrollHeight - 16;
            G._userScrolledUp = !atBottom;
        });
    }
}

function _updateStreamMsg(text: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    let streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx < 0) {
        // 新流开始：重置用户滚动状态，允许自动滚动
        G._userScrolledUp = false;

        const roundGroup = 'rg_' + Date.now();
        const newMsg: import('./types').Message = {
            id: 'msg_' + Date.now(),
            taskId: state.activeTaskId || '',
            role: 'agent',
            content: '',
            timestamp: Date.now(),
            streaming: true,
            roundGroup,
        };
        msgs.push(newMsg);
        streamIdx = msgs.length - 1;
    }

    msgs[streamIdx] = { ...msgs[streamIdx], content: text };
    stateManager.patch({ messages: msgs });
    return msgs[streamIdx];
}

function handleStreamChunk(msg: { text: string }) {
    _updateStreamMsg(msg.text);
}

function handleThinkingChunk(msg: { text: string; status: string }) {
    console.log('[webview thinking-chunk]', msg.status, msg.text ? msg.text.substring(0, 100) : '(empty)');
    const state = stateManager.snapshot();
    const msgs = [...state.messages];
    const now = Date.now();
    const existingIdx = msgs.findIndex(m => m.type === 'thinking' && m.streaming);
    if (existingIdx >= 0) {
        msgs[existingIdx] = { ...msgs[existingIdx], content: msg.text, streaming: msg.status !== 'completed' };
    } else {
        msgs.push({
            id: 'thinking_' + now,
            taskId: state.activeTaskId || '',
            role: 'agent',
            type: 'thinking',
            content: msg.text,
            timestamp: now,
            streaming: msg.status !== 'completed',
        });
    }
    stateManager.patch({ messages: msgs });

    if (msg.status === 'completed') {
        basePipeline.finalizeThinkingCard(msg.text);
    }
}

function handleToolChunk(msg: { toolCallId: string; title: string; kind: string; status: string; content: string }) {
    console.log('[webview tool-chunk]', JSON.stringify({
        toolCallId: msg.toolCallId,
        kind: msg.kind,
        title: msg.title,
        status: msg.status,
        contentLength: (msg.content || '').length,
        contentPreview: msg.content ? msg.content.substring(0, 200) : '(empty)',
    }));
    const state = stateManager.snapshot();
    const msgs = [...state.messages];
    const toolContent = JSON.stringify({
        toolCallId: msg.toolCallId,
        title: msg.title,
        kind: msg.kind,
        status: msg.status,
        output: msg.content,
    });
    const existingIdx = msgs.findIndex(m => m.type === 'tool_call' && m.content && m.content.includes(msg.toolCallId));
    if (existingIdx >= 0) {
        msgs[existingIdx] = { ...msgs[existingIdx], content: toolContent };
    } else {
        msgs.push({
            id: 'tool_' + msg.toolCallId,
            taskId: state.activeTaskId || '',
            role: 'tool',
            type: 'tool_call',
            content: toolContent,
            timestamp: Date.now(),
        });
    }
    stateManager.patch({ messages: msgs });
}

function handleFinalizeGoalMessage(msg: { taskId: string; goal: string }) {
}

function handleStreamDone(result: StreamResult) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    const streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx >= 0) {
        msgs[streamIdx] = { ...msgs[streamIdx], streaming: false, collapsed: true };
    }

    const seenToolIds = new Set(
        msgs.filter(m => m.type === 'tool_call').map(m => { try { return JSON.parse(m.content).toolCallId; } catch { return null; } }).filter(Boolean)
    );
    for (const tc of result.toolCalls) {
        if (tc.kind === 'thinking') continue;
        if (seenToolIds.has(tc.toolCallId)) continue;
        msgs.push({
            id: 'tool_' + tc.toolCallId,
            taskId: state.activeTaskId || '',
            role: 'tool',
            type: 'tool_call',
            content: JSON.stringify({ toolCallId: tc.toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
            timestamp: Date.now(),
        });
    }

    // 非阶段消息：把最终回复也加入 messages 数组，走数据驱动渲染
    if (!['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'].includes(state.activeTaskPhase) && result.cleanedText) {
        msgs.push({
            id: 'agent_final_' + Date.now(),
            taskId: state.activeTaskId || '',
            role: 'agent',
            content: result.cleanedText,
            timestamp: Date.now(),
        });
    }

    const roundGroup = 'rg_' + Date.now();
    const finalMsgs = msgs.map(m => m.roundGroup ? m : { ...m, roundGroup });
    // 先 patch（触发 auto-sync），再清理 round
    stateManager.patch({ messages: finalMsgs });
    basePipeline.finalizeStream();
    basePipeline.closeRound();

    if (result.planProposed && state.activeTaskPhase === 'plan') {
        _ensurePhaseActionCard('plan', state.activeTaskId || '');
    } else if (result.executeFinished && state.activeTaskPhase === 'execute') {
        _ensurePhaseActionCard('execute', state.activeTaskId || '');
    } else if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify') {
        _ensurePhaseActionCard('self_verify', state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'review') {
        _ensurePhaseActionCard('review', state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'goal') {
        _ensurePhaseActionCard('goal', state.activeTaskId || '');
    }

    _strategy.onStreamDone(state, result);
}

// ────── 数据驱动 DOM 同步 ──────

let _renderedMsgIds = new Set<string>();

/** 为 cardMeta 阶段卡片添加操作按钮 */
function _appendPhaseActionsToCard(card: HTMLElement, msg: import('./types').Message) {
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

function _createMsgElement(msg: import('./types').Message): HTMLElement | null {
    // ── cardMeta 消息：创建可交互的阶段卡片 ──
    if (msg.cardMeta) {
        const type = msg.cardMeta.type || '';
        const isPending = msg.cardMeta.status === 'pending';
        const headerMap: Record<string, string> = {
            goal: '🎯 任务目标', plan: '📋 计划方案', execute: '⚡ 执行完成',
            self_verify: '🔍 自验完成', review: '✅ 验收',
        };
        const colorMap: Record<string, string> = {
            goal: '#3c3c3c', plan: '#4a8bb5', execute: '#d4a84b',
            self_verify: '#6b9e6b', review: '#2a5a2a',
        };
        const headerBgMap: Record<string, string> = {
            goal: '#2d2d2d', plan: '#1e2d3d', execute: '#2d2d2d',
            self_verify: '#2d2d2d', review: '#1a3a1a',
        };

        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
        if (type) div.dataset.phase = type;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const card = createCard({
            headerHtml: headerMap[type] || '📋 阶段',
            bodyMarkdown: isPending ? '' : msg.content,
            rawData: msg,
            defaultCollapsed: !isPending,
            borderColor: colorMap[type] || '#3c3c3c',
            headerBg: headerBgMap[type] || '#2d2d2d',
            headerColor: '#e0e0e0',
        });

        if (isPending) {
            _appendPhaseActionsToCard(card, msg);
        } else {
            const statusEl = document.createElement('div');
            statusEl.className = 'msg-card-status';
            statusEl.textContent = msg.cardMeta?.status === 'confirmed' ? '✅ 已确认'
                : msg.cardMeta?.status === 'rejected' ? '↩️ 已驳回'
                : '⏳ 已完成';
            card.appendChild(statusEl);
        }

        bubble.appendChild(card);
        div.appendChild(bubble);
        return div;
    }

    if (msg.type === 'thinking') {
        const entry = createTimelineEntry({ kind: 'thinking', title: '思考', content: msg.content, status: msg.streaming ? 'running' : 'completed' });
        const body = entry.querySelector('.tl-entry-body');
        if (body) body.classList.add('open');
        const div = document.createElement('div');
        div.className = 'chat-msg tool';
        div.dataset.msgId = msg.id;
        if (msg.phase) div.dataset.phase = msg.phase;
        div.appendChild(entry);
        return div;
    }

    if (msg.type === 'tool_call') {
        let info: any;
        try { info = JSON.parse(msg.content); } catch { return null; }
        const entry = createTimelineEntry(info);
        const body = entry.querySelector('.tl-entry-body');
        if (body) body.classList.add('open');
        const div = document.createElement('div');
        div.className = 'chat-msg tool';
        div.dataset.msgId = msg.id;
        if (msg.phase) div.dataset.phase = msg.phase;
        div.appendChild(entry);
        return div;
    }

    if (msg.role === 'user') {
        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.dataset.msgId = msg.id;
        if (msg.phase) div.dataset.phase = msg.phase;
        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        const ts = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        sender.innerHTML = 'You' + (ts ? ' <span class="msg-timestamp">' + ts + '</span>' : '');
        div.appendChild(sender);
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = renderMarkdown(msg.content);
        div.appendChild(bubble);
        return div;
    }

    if (msg.role === 'agent' && !msg.cardMeta) {
        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
        if (msg.phase) div.dataset.phase = msg.phase;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        if (msg.streaming) {
            const content = document.createElement('div');
            content.id = '__v3-stream-content';
            content.className = 'stream-markdown';
            content.innerHTML = renderMarkdown(msg.content);
            bubble.appendChild(content);
        } else {
            bubble.innerHTML = renderMarkdown(msg.content);
        }
        div.appendChild(bubble);
        return div;
    }

    return null;
}

function _updateMsgElement(el: HTMLElement, msg: import('./types').Message) {
    if (msg.role === 'agent' && msg.streaming) {
        const contentEl = el.querySelector('#__v3-stream-content') as HTMLElement;
        if (contentEl) contentEl.innerHTML = renderMarkdown(msg.content);
    }
    if (msg.type === 'thinking') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) pre.textContent = msg.content;
        if (!msg.streaming) {
            const entry = el.querySelector('.tl-entry') as HTMLElement;
            if (entry) entry.removeAttribute('id');
        }
    }
    if (msg.type === 'tool_call') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) {
            try {
                const info = JSON.parse(msg.content);
                if (info.output) pre.textContent = info.output;
            } catch {}
        }
    }
}

/**
 * 在 DOM 中为当前消息找到正确的插入位置。
 * 优先向前查找已渲染的前一条消息，插到它后面；
 * 如果没有，则向后查找已渲染的后一条消息，插到它前面。
 * 如果都没有，返回 false，调用方按回退逻辑追加。
 */
function _insertAtCorrectPosition(
    container: Element,
    el: Element,
    msgs: import('./types').Message[],
    currentIndex: number
): boolean {
    // 1) 向前查找最近的已渲染消息，插到它后面
    for (let j = currentIndex - 1; j >= 0; j--) {
        const prevMsg = msgs[j];
        if (_renderedMsgIds.has(prevMsg.id)) {
            const prevEl = container.querySelector(`[data-msg-id="${prevMsg.id}"]`);
            if (prevEl) {
                // prevEl 可能在 round 容器内部，需要找到 container 的直接子节点
                let insertAfter: Element = prevEl;
                while (insertAfter.parentElement && insertAfter.parentElement !== container) {
                    insertAfter = insertAfter.parentElement;
                }
                insertAfter.insertAdjacentElement('afterend', el);
                return true;
            }
        }
    }

    // 2) 向后查找最近的已渲染消息，插到它前面
    for (let j = currentIndex + 1; j < msgs.length; j++) {
        const nextMsg = msgs[j];
        if (_renderedMsgIds.has(nextMsg.id)) {
            const nextEl = container.querySelector(`[data-msg-id="${nextMsg.id}"]`);
            if (nextEl) {
                let insertBefore: Node = nextEl;
                while (insertBefore.parentElement && insertBefore.parentElement !== container) {
                    insertBefore = insertBefore.parentElement;
                }
                container.insertBefore(el, insertBefore);
                return true;
            }
        }
    }

    return false;
}

/**
 * 确保阶段操作卡片存在于 messages 数组中。
 * 这是 phase action 卡片的唯一入口 —— 所有调用方必须通过此函数，
 * 而非直接操作 DOM（renderGoalActions 等）。
 */
function _ensurePhaseActionCard(phase: string, taskId: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    // 避免重复：同阶段已有 pending 卡片则跳过
    const alreadyPending = msgs.some(m =>
        m.cardMeta?.type === phase && m.cardMeta?.status === 'pending'
    );
    if (alreadyPending) return;

    // 避免重复：同阶段已有确认过的消息则跳过
    const actionLabels: Record<string, string> = {
        goal: '确认目标', plan: '确认计划', execute: '确认执行',
        self_verify: '确认自验', review: '验收通过',
    };
    const label = actionLabels[phase];
    if (label) {
        const alreadyConfirmed = msgs.some(m =>
            m.role === 'user' && m.content.includes(label)
        );
        if (alreadyConfirmed) return;
    }

    msgs.push({
        id: 'phase_' + phase + '_' + Date.now(),
        taskId,
        role: 'agent',
        content: '',
        phase,
        timestamp: Date.now(),
        cardMeta: {
            type: phase as 'goal' | 'plan' | 'execute' | 'self_verify' | 'review',
            status: 'pending',
        },
    });
    stateManager.patch({ messages: msgs });
}

function _syncMessages() {
    const msgs = stateManager.state.messages;
    const container = document.querySelector('#task-view #chat-messages');
    if (!container) return;

    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        if (_renderedMsgIds.has(msg.id)) {
            const el = container.querySelector(`[data-msg-id="${msg.id}"]`) as HTMLElement;
            if (el) _updateMsgElement(el, msg);
            continue;
        }
        const el = _createMsgElement(msg);
        if (!el) {
            // cardMeta 等无法创建独立 DOM 元素的消息：
            // 如果 DOM 中已存在对应元素（由 renderMessageList 全量渲染），标记为已渲染
            if (container.querySelector(`[data-msg-id="${msg.id}"]`)) {
                _renderedMsgIds.add(msg.id);
            }
            continue;
        }

        const msgEl: HTMLElement = el;
        _renderedMsgIds.add(msg.id);

        // 尝试按数组顺序插入到正确位置
        if (_insertAtCorrectPosition(container, msgEl, msgs, i)) {
            continue;
        }

        // 回退：后面没有已渲染的锚点消息，按原有规则追加
        if (msg.role === 'user') {
            appendToChatMessages(msgEl);
        } else if (msg.role === 'agent' && !msg.streaming && !msg.cardMeta) {
            // Completed agent: append to round if active, else direct
            const round = basePipeline.getOrCreateRoundContainer();
            if (round) round.appendChild(msgEl);
            else appendToChatMessages(msgEl);
        } else {
            // Streaming agent, thinking, tool → round container
            const round = basePipeline.getOrCreateRoundContainer();
            if (round) round.appendChild(msgEl);
            else appendToChatMessages(msgEl);
        }
    }
}

let _msgVersionCounter = 0;
let _lastSyncVersion = -1;

function _renderPhaseActionsFromSync(state: import('./types').AppState) {
    const tid = state.activeTaskId || '';
    if (!tid) return;

    switch (state.activeTaskPhase) {
        case 'goal': {
            const hasConfirmedGoal = state.messages.some(m =>
                m.type === 'goal_confirmed'
                || m.type === 'plan_proposal'
                || m.type === 'plan_confirmed'
                || (m.role === 'user' && m.content.includes('确认目标'))
            );
            if (hasConfirmedGoal) return;
            _ensurePhaseActionCard('goal', tid);
            break;
        }
        case 'plan': {
            const hasConfirmedPlan = state.messages.some(m =>
                m.type === 'plan_confirmed'
                || (m.role === 'user' && (m.content.includes('确认计划') || m.content.includes('驳回计划')))
            );
            if (hasConfirmedPlan) return;
            _ensurePhaseActionCard('plan', tid);
            break;
        }
        case 'execute': {
            const hasConfirmedExecute = state.messages.some(m =>
                (m.role === 'user' && (m.content.includes('确认执行') || m.content.includes('确认完成')))
            );
            if (hasConfirmedExecute) return;
            _ensurePhaseActionCard('execute', tid);
            break;
        }
        case 'self_verify': {
            const hasConfirmedVerify = state.messages.some(m =>
                (m.role === 'user' && (m.content.includes('确认自验') || m.content.includes('进入验收')))
            );
            if (hasConfirmedVerify) return;
            _ensurePhaseActionCard('self_verify', tid);
            break;
        }
        case 'review': {
            const hasResult = state.messages.some(m =>
                m.type === 'review_approved' || m.type === 'review_rejected'
                || (m.role === 'user' && (m.content.includes('验收通过') || m.content.includes('驳回')))
            );
            if (hasResult) return;
            _ensurePhaseActionCard('review', tid);
            break;
        }
        default:
            break;
    }
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    const version = ++_msgVersionCounter;
    _lastSyncVersion = version;
    stateManager.update({ messages: msg.messages as any, msgVersion: version });
}
