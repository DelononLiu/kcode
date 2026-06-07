import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { renderGoalActions, renderPlanActions, renderExecuteActions, renderSelfVerifyActions, renderReviewActions } from './cardRenderer';
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

let _initialized = false;

export function initTaskV3() {
    if (_initialized) return;
    _initialized = true;

    let _lastMsgVersion = -1;
    stateManager.subscribe((state) => {
        showTaskView(true);
        _strategy.renderHeader(state);

        if (state.msgVersion !== _lastMsgVersion) {
            basePipeline.renderMessageList(state.messages);
            _lastMsgVersion = state.msgVersion;

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

function _updateStreamMsg(text: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

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

    basePipeline.updateToolEntryInRound(msg.toolCallId, { title: msg.title, kind: msg.kind, status: msg.status, output: msg.content });
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
    basePipeline.finalizeStream();
    stateManager.patch({ messages: finalMsgs, msgVersion: (state.msgVersion || 0) + 1 });

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
