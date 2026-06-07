import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { renderReviewActions } from './cardRenderer';
import { showTaskView } from '../taskView';

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

let _msgVersion = 0;
let _initialized = false;

export function initTaskV3() {
    if (_initialized) return;
    _initialized = true;

    let _lastMsgVersion = -1;
    stateManager.subscribe((state) => {
        showTaskView(true);
        _strategy.renderHeader(state);

        // 消息版本变化 → subscriber 驱动重渲染（messages-sync 触发）
        if (state.msgVersion !== _lastMsgVersion) {
            basePipeline.renderMessageList(state.messages);
            _lastMsgVersion = state.msgVersion;

            // 非流阶段同步后渲染操作按钮（如 review 无对应 stream-done）
            if (state.msgVersion === _lastSyncVersion && !state.isGenerating) {
                _renderPhaseActionsFromSync(state);
            }
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
}

// ────── 流式消息处理（数据优先：只改 messages[]，再触发渲染） ──────

/** 获取或创建 streaming 消息并更新 content */
function _updateStreamMsg(text: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    // 用 streaming 标记找当前流式消息，避免被 thinking/tool 干扰
    let streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx < 0) {
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
    const last = _updateStreamMsg(msg.text);
    basePipeline.appendStreamChunk(msg.text);
}

function handleThinkingChunk(msg: { text: string; status: string }) {
    console.log('[webview thinking-chunk]', msg.status, msg.text ? msg.text.substring(0, 100) : '(empty)');
    // 写入 state.messages[]（不改变 msgVersion，不触发全量重渲染）
    const state = stateManager.snapshot();
    const msgs = [...state.messages];
    const now = Date.now();
    const existingIdx = msgs.findIndex(m => m.type === 'thinking' && m.streaming);
    if (existingIdx >= 0) {
        msgs[existingIdx] = { ...msgs[existingIdx], content: msg.text, streaming: msg.status !== 'completed' };
    } else {
        // 新的 thinking 开始 → 终结前面的 streaming AI reply，切分消息
        const streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
        if (streamIdx >= 0) {
            msgs[streamIdx] = { ...msgs[streamIdx], streaming: false };
        }
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

    // 同时实时更新 DOM（保证流式响应速度）
    if (msg.status === 'completed') {
        basePipeline.finalizeThinkingCard(msg.text);
    } else {
        basePipeline.updateThinkingCard(msg.text);
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
    // 写入 state.messages[]（不改变 msgVersion）
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
        // 新工具开始 → 终结前面的 streaming AI reply，切分消息
        const streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
        if (streamIdx >= 0) {
            msgs[streamIdx] = { ...msgs[streamIdx], streaming: false };
        }
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

    // 同时实时更新 DOM
    basePipeline.updateToolEntryInRound(msg.toolCallId, { title: msg.title, kind: msg.kind, status: msg.status, output: msg.content });
}

function handleFinalizeGoalMessage(msg: { taskId: string; goal: string }) {
    // 作为带 cardMeta 的消息存入 messages[]
    const state = stateManager.snapshot();
    const goalMsg: import('./types').Message = {
        id: 'goal_' + Date.now(),
        taskId: msg.taskId,
        role: 'agent',
        type: 'goal_confirmation',
        content: msg.goal || '',
        phase: 'goal',
        timestamp: Date.now(),
        collapsed: false,
        cardMeta: { type: 'goal', status: 'pending' },
    };
    _msgVersion++;
    stateManager.patch({ messages: [...state.messages, goalMsg], msgVersion: _msgVersion });
}

function handleStreamDone(result: StreamResult) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    // 终结最后一条 streaming 消息（不替换 content，各消息已通过 chunk 积累了自己的内容）
    const streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx >= 0) {
        msgs[streamIdx] = { ...msgs[streamIdx], streaming: false, collapsed: true };
    }

    // 收集本轮所有 tool_calls 中尚未存入 state 的
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

    // 建立阶段卡片（在 patch 之前一次性加好，避免多次重渲染）
    const now = Date.now();
    if (result.planProposed && state.activeTaskPhase === 'plan' && !msgs.some(m => m.cardMeta?.type === 'plan')) {
        const agentReply = [...msgs].reverse().find(m => m.role === 'agent' && !m.type && !m.streaming);
        if (agentReply) {
            msgs.push({ id: 'plan_card_' + now, taskId: state.activeTaskId || '', role: 'agent', type: 'plan_proposal', content: agentReply.content, phase: 'plan', timestamp: now, collapsed: true, cardMeta: { type: 'plan', status: 'pending' } });
        }
    } else if (result.executeFinished && state.activeTaskPhase === 'execute' && !msgs.some(m => m.cardMeta?.type === 'execute')) {
        msgs.push({ id: 'exec_card_' + now, taskId: state.activeTaskId || '', role: 'agent', type: 'execute_confirmation', content: '', phase: 'execute', timestamp: now, collapsed: true, cardMeta: { type: 'execute', status: 'pending' } });
    } else if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify' && !msgs.some(m => m.cardMeta?.type === 'self_verify')) {
        msgs.push({ id: 'sv_card_' + now, taskId: state.activeTaskId || '', role: 'agent', type: 'self_verify_confirmation', content: '', phase: 'self_verify', timestamp: now, collapsed: true, cardMeta: { type: 'self_verify', status: 'pending' } });
    } else if (state.activeTaskPhase === 'review' && !msgs.some(m => m.cardMeta?.type === 'review')) {
        const agentReply = [...msgs].reverse().find(m => m.role === 'agent' && !m.type && !m.streaming);
        msgs.push({ id: 'review_card_' + now, taskId: state.activeTaskId || '', role: 'agent', type: 'review_request', content: agentReply?.content || '', phase: 'review', timestamp: now, collapsed: true, cardMeta: { type: 'review', status: 'pending' } });
    }

    // 批量赋 roundGroup + 一次触发重渲染
    const roundGroup = 'rg_' + now;
    const finalMsgs = msgs.map(m => m.roundGroup ? m : { ...m, roundGroup });
    _msgVersion++;
    stateManager.patch({ messages: finalMsgs, msgVersion: _msgVersion });
    basePipeline.finalizeStream();

    // 非阶段模式：追加一条最终 AI 回复
    if (!['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'].includes(state.activeTaskPhase)) {
        basePipeline.appendFinalMessage(result.cleanedText);
    }

    _strategy.onStreamDone(state, result);
}

let _msgVersionCounter = 0;
/** 标记最近一次 msgVersion 是否由 messages-sync 触发（用于非流场景渲染按钮） */
let _lastSyncVersion = -1;

function _renderPhaseActionsFromSync(state: import('./types').AppState) {
    const tid = state.activeTaskId || '';
    if (state.activeTaskPhase !== 'review') return;
    // review_approved 可能不存在于 store 中，改用用户"验收通过"消息判断
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
