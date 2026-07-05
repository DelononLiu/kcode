import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { postAction } from './cardRenderer';
import { createMsgElement, updateMsgElement, setMsgPostAction, isNonCollapsible } from './msgRenderer';
import { showTaskView } from '../taskView';
import { G } from '../state';

let _strategy: ViewStrategy = taskStrategy;

export function setStrategy(s: ViewStrategy) {
    _strategy = s;
}

export function getStrategy(): ViewStrategy {
    return _strategy;
}

function foldPhases(currentPhase: string) {
    const STAGE_ORDER = ['goal', 'plan', 'execute', 'self_verify', 'review'];
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

    setMsgPostAction(postAction);

    let _lastMsgVersion = -1;
    stateManager.subscribe((state) => {
        showTaskView(true);
        _strategy.renderHeader(state);

        if (state.msgVersion !== _lastMsgVersion) {
            _renderedMsgIds.clear();
            basePipeline.renderMessageList(state.messages);
            // 将所有消息标记为已渲染，
            // 确保 _syncMessages 增量同步时能找到正确的 DOM 插入锚点
            for (const msg of state.messages) {
                _renderedMsgIds.add(msg.id);
            }
            _lastMsgVersion = state.msgVersion;

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

        // task view 隐藏时，只处理 state-delta / messages-sync，跳过流式消息
        const taskView = document.querySelector('#task-view') as HTMLElement;
        const taskHidden = !taskView || taskView.style.display === 'none';
        if (taskHidden && !['state-delta', 'messages-sync'].includes(message.type)) return;

        // 过滤非当前任务的流式消息
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

export type _Message = import('./types').Message;

/** 折叠一个 round（user 消息之后、下一条 user 消息之前的所有消息） */
function _collapseRound(msgs: _Message[], startIdx: number, endIdx: number, expandedRounds: Record<string, boolean> = {}): { msgs: _Message[]; summary: _Message | null } {
    if (startIdx > endIdx) return { msgs, summary: null };

    const rg = 'rg_' + msgs[startIdx].id;
    // 如果该 round 是展开状态，跳过折叠
    if (expandedRounds[rg] === true) {
        return { msgs, summary: null };
    }
    const result = [...msgs];
    let finalAgentIdx = -1;
    let thinking = 0;
    const tools: Record<string, number> = {};

    // 第一遍：分配 roundGroup、找最终 agent 回复、统计
    for (let i = startIdx; i <= endIdx; i++) {
        result[i] = { ...result[i], roundGroup: rg };
        if (result[i].role === 'agent' && !isNonCollapsible(result[i]) && result[i].type !== 'thinking') {
            finalAgentIdx = i;
        }
        if (result[i].type === 'thinking') { thinking++; }
        if (result[i].type === 'tool_call') {
            const tc = result[i].toolCall; if (tc) { if (tc.kind === 'thinking') { thinking++; } else { const k = tc.kind || 'other'; tools[k] = (tools[k] || 0) + 1; } }
        }
    }

    // 第二遍：折叠除最终回复和不可折叠消息外的所有消息
    for (let i = startIdx; i <= endIdx; i++) {
        if (i === finalAgentIdx) {
            const { collapsed: _, ...rest } = result[i] as any;
            result[i] = rest;
        } else if (!isNonCollapsible(result[i])) {
            result[i] = { ...result[i], collapsed: true };
        }
    }

    // 生成 summary
    const hasCards = thinking > 0 || Object.keys(tools).length > 0;
    if (!hasCards) return { msgs: result, summary: null };

    const summary: _Message = {
        id: 'round_summary_' + rg,
        taskId: result[startIdx]?.taskId || '',
        role: 'agent',
        type: 'round_summary',
        content: JSON.stringify({ thinking, tools }),
        timestamp: Date.now(),
        roundGroup: rg,
        collapsed: true,
        streaming: false,
    };
    return { msgs: result, summary };
}

export function _collapseAllRounds(msgs: _Message[], expandedRounds: Record<string, boolean> = {}): _Message[] {
    // 剥离已有的 round_summary（上次 collapse 的产物），重新计算
    const cleaned = msgs.filter(m => m.type !== 'round_summary');

    const userIdx: number[] = [];
    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i].role === 'user') userIdx.push(i);
    }
    if (userIdx.length === 0) return msgs;

    const result = [...cleaned];
    const insertions: { idx: number; msg: _Message }[] = [];

    for (let ri = 0; ri < userIdx.length; ri++) {
        const start = userIdx[ri] + 1;
        const end = ri + 1 < userIdx.length ? userIdx[ri + 1] - 1 : result.length - 1;
        if (start > end) continue;

        const collapsed = _collapseRound(result, start, end, expandedRounds);
        for (let j = start; j <= end; j++) {
            result[j] = collapsed.msgs[j];
        }
        if (collapsed.summary) {
            insertions.push({ idx: start, msg: collapsed.summary });
        }
    }

    for (const ins of insertions.sort((a, b) => b.idx - a.idx)) {
        result.splice(ins.idx, 0, ins.msg);
    }
    return result;
}

function _updateStreamMsg(text: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    let streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx < 0) {
        G._userScrolledUp = false;

        const newMsg: import('./types').Message = {
            id: 'msg_' + Date.now(),
            taskId: state.activeTaskId || '',
            role: 'agent',
            type: 'text',
            content: '',
            timestamp: Date.now(),
            streaming: true,
            collapsed: false,
            roundGroup: null,
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
            collapsed: false,
            roundGroup: null,
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
            streaming: false,
            collapsed: false,
            roundGroup: null,
        });
    }
    stateManager.patch({ messages: msgs });
}

function handleFinalizeGoalMessage(msg: { taskId: string; goal: string }) {
    if (msg.taskId) {
        _ensurePhaseActionCard('goal', msg.taskId);
    }
}

function handleStreamDone(result: StreamResult) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    // 停止流式标记
    const streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx >= 0) {
        msgs[streamIdx] = { ...msgs[streamIdx], streaming: false };
    }

    // 补充未在流式中出现的 tool call
    const seenToolIds = new Set(
        msgs.filter(m => m.type === 'tool_call').map(m => m.toolCall?.toolCallId).filter(Boolean)
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
            streaming: false,
            collapsed: false,
            roundGroup: null,
        });
    }

    const collapsedMsgs = _collapseAllRounds(msgs, state.expandedRounds);

    stateManager.patch({ messages: collapsedMsgs });
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

/** 在正确位置插入消息 DOM 元素 */
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
        m.phaseAction?.phase === phase && m.phaseAction?.status === 'pending'
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

    const phaseTypeMap: Record<string, string> = {
        goal: 'goal_confirmation', plan: 'plan_proposal', execute: 'execute_confirmation',
        self_verify: 'self_verify_confirmation', review: 'review_request',
    };
    msgs.push({
        id: 'phase_' + phase + '_' + Date.now(),
        taskId,
        role: 'agent',
        type: phaseTypeMap[phase] || 'text',
        content: '',
        timestamp: Date.now(),
        streaming: false,
        collapsed: false,
        roundGroup: null,
        phaseAction: {
            phase: phase as 'goal' | 'plan' | 'execute' | 'self_verify' | 'review',
            status: 'pending',
        },
    });
    stateManager.patch({ messages: msgs });
}

function _syncMessages() {
    // 非 task 视图时不渲染（用户切到小助手等）
    const taskView = document.querySelector('#task-view') as HTMLElement;
    if (!taskView || taskView.style.display === 'none') return;
    const msgs = stateManager.state.messages;
    const container = taskView.querySelector('#chat-messages');
    if (!container) return;

    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        if (_renderedMsgIds.has(msg.id)) {
            const el = container.querySelector(`[data-msg-id="${msg.id}"]`) as HTMLElement;
            if (el) updateMsgElement(el, msg, stateManager);
            continue;
        }
        const el = createMsgElement(msg, stateManager);
        if (!el) {
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

        // 回退：直接追加到 container（避免用 V2 的 appendToChatMessages，它从 getActiveView 取容器可能错误）
        container.appendChild(msgEl);
    }
}

let _msgVersionCounter = 0;
let _lastSyncVersion = -1;


function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    // 当前 webview 中有 streaming 消息 → 任务还在流式，保留 webview 状态
    if (stateManager.state.messages.some((m: any) => m.streaming)) return;
    const version = ++_msgVersionCounter;
    _lastSyncVersion = version;
    const collapsed = _collapseAllRounds(msg.messages as any[], stateManager.state.expandedRounds);

    stateManager.update({ messages: collapsed, msgVersion: version });
}
