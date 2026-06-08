import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { renderGoalActions, renderPlanActions, renderExecuteActions, renderSelfVerifyActions, renderReviewActions } from './cardRenderer';
import { showTaskView } from '../taskView';
import { appendToChatMessages } from '../chatStream';
import { renderMarkdown } from '../markdownRenderer';
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

    const roundGroup = 'rg_' + Date.now();
    const finalMsgs = msgs.map(m => m.roundGroup ? m : { ...m, roundGroup });
    // 先 patch（触发 auto-sync，在 round 关闭前追加遗漏的工具卡片），再清理 round
    stateManager.patch({ messages: finalMsgs });
    basePipeline.finalizeStream();
    basePipeline.closeRound();

    if (result.planProposed && state.activeTaskPhase === 'plan') {
        renderPlanActions(state.activeTaskId || '');
    } else if (result.executeFinished && state.activeTaskPhase === 'execute') {
        renderExecuteActions(state.activeTaskId || '');
    } else if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify') {
        renderSelfVerifyActions(state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'review') {
        renderReviewActions(state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'goal') {
        renderGoalActions(state.activeTaskId || '');
    } else if (!['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'].includes(state.activeTaskPhase)) {
        basePipeline.appendFinalMessage(result.cleanedText);
    }

    _strategy.onStreamDone(state, result);
}

// ────── 数据驱动 DOM 同步 ──────

let _renderedMsgIds = new Set<string>();

function _createMsgElement(msg: import('./types').Message): HTMLElement | null {
    if (msg.cardMeta) return null;

    if (msg.type === 'thinking') {
        const entry = createTimelineEntry({ kind: 'thinking', title: '思考', content: msg.content, status: msg.streaming ? 'running' : 'completed' });
        const body = entry.querySelector('.tl-entry-body');
        if (body) body.classList.add('open');
        const div = document.createElement('div');
        div.className = 'chat-msg tool';
        div.dataset.msgId = msg.id;
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
        div.appendChild(entry);
        return div;
    }

    if (msg.role === 'user') {
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
        return div;
    }

    if (msg.role === 'agent' && !msg.cardMeta) {
        const div = document.createElement('div');
        div.className = 'chat-msg agent';
        div.dataset.msgId = msg.id;
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

function _syncMessages() {
    const msgs = stateManager.state.messages;
    const container = document.querySelector('#task-view #chat-messages');
    if (!container) return;

    for (const msg of msgs) {
        if (_renderedMsgIds.has(msg.id)) {
            const el = container.querySelector(`[data-msg-id="${msg.id}"]`) as HTMLElement;
            if (el) _updateMsgElement(el, msg);
            continue;
        }
        const el = _createMsgElement(msg);
        if (!el) continue;

        _renderedMsgIds.add(msg.id);

        // User messages go directly; streaming content (agent/thinking/tool) goes in round container
        if (msg.role === 'user') {
            appendToChatMessages(el);
        } else if (msg.role === 'agent' && !msg.streaming && !msg.cardMeta) {
            // Completed agent: append to round if active, else direct
            const round = basePipeline.getOrCreateRoundContainer();
            if (round) round.appendChild(el);
            else appendToChatMessages(el);
        } else {
            // Streaming agent, thinking, tool → round container
            const round = basePipeline.getOrCreateRoundContainer();
            if (round) round.appendChild(el);
            else appendToChatMessages(el);
        }
    }
}

let _msgVersionCounter = 0;
let _lastSyncVersion = -1;

function _renderPhaseActionsFromSync(state: import('./types').AppState) {
    const tid = state.activeTaskId || '';
    if (state.activeTaskPhase !== 'review') return;
    const hasResult = state.messages.some(m =>
        m.type === 'review_approved' || m.type === 'review_rejected'
        || (m.role === 'user' && m.content.includes('验收通过'))
        || (m.role === 'user' && m.content.includes('驳回'))
    );
    if (hasResult) return;
    renderReviewActions(tid);
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    const version = ++_msgVersionCounter;
    _lastSyncVersion = version;
    stateManager.update({ messages: msg.messages as any, msgVersion: version });
}
