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

        const v3Types = ['state-delta', 'stream-chunk', 'stream-done', 'messages-sync', 'finalizeGoalMessage', 'thinking-chunk'];
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
        }
    });
}

// ────── 流式消息处理（数据优先：只改 messages[]，再触发渲染） ──────

/** 获取或创建 streaming 消息并更新 content */
function _updateStreamMsg(text: string) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];
    let last = msgs[msgs.length - 1];

    if (!last || !last.streaming) {
        const roundGroup = 'rg_' + Date.now();
        last = {
            id: 'msg_' + Date.now(),
            taskId: state.activeTaskId || '',
            role: 'agent',
            content: '',
            timestamp: Date.now(),
            streaming: true,
            roundGroup,
        };
        msgs.push(last);
    }

    last = { ...last, content: text };
    msgs[msgs.length - 1] = last;
    stateManager.patch({ messages: msgs });
    return last;
}

function handleStreamChunk(msg: { text: string }) {
    const last = _updateStreamMsg(msg.text);
    basePipeline.appendStreamChunk(msg.text);
}

function handleThinkingChunk(msg: { text: string; status: string }) {
    if (msg.status === 'completed') {
        basePipeline.finalizeThinkingCard(msg.text);
    } else {
        basePipeline.updateThinkingCard(msg.text);
    }
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
    stateManager.patch({ messages: [...state.messages, goalMsg] });
    _msgVersion++;
}

function handleStreamDone(result: StreamResult) {
    const state = stateManager.snapshot();
    const msgs = [...state.messages];

    // 终结最后一条 streaming 消息
    const lastIdx = msgs.length - 1;
    if (lastIdx >= 0 && msgs[lastIdx].streaming) {
        msgs[lastIdx] = { ...msgs[lastIdx], streaming: false, collapsed: true, content: result.cleanedText };
    }

    stateManager.patch({ messages: msgs });
    basePipeline.finalizeStream();

    // 工具卡片加入本轮容器
    basePipeline.getOrCreateRoundContainer();
    for (const tc of result.toolCalls) {
        if (tc.kind === 'thinking') continue;
        basePipeline.addToolCardToRound(tc);
    }

    // 折叠本轮容器
    basePipeline.finalizeRound();

    // 按阶段标志渲染操作按钮
    if (result.planProposed && state.activeTaskPhase === 'plan') {
        renderPlanActions(state.activeTaskId || '');
    } else if (result.executeFinished && state.activeTaskPhase === 'execute') {
        renderExecuteActions(state.activeTaskId || '');
    } else if (result.selfVerifyFinished && state.activeTaskPhase === 'self_verify') {
        renderSelfVerifyActions(state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'review') {
        renderReviewActions(state.activeTaskId || '');
    } else if (state.activeTaskPhase === 'goal') {
        // 检查 messages 中是否有刚插入的 goal card（from finalizeGoalMessage）
        const hasGoalCard = msgs.some(m => m.cardMeta?.type === 'goal' && m.cardMeta?.status === 'pending');
        if (hasGoalCard) renderGoalActions(state.activeTaskId || '');
    } else if (!['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'].includes(state.activeTaskPhase)) {
        basePipeline.appendFinalMessage(result.cleanedText);
    }

    _strategy.onStreamDone(state, result);
}

let _msgVersionCounter = 0;
/** 标记最近一次 msgVersion 是否由 messages-sync 触发（用于非流场景渲染按钮） */
let _lastSyncVersion = -1;

function _renderPhaseActionsFromSync(state: import('./types').AppState) {
    const tid = state.activeTaskId || '';
    // review 是唯一不通过 stream-done 触发的阶段（由 triggerReviewRequest 直接 sync）
    if (state.activeTaskPhase === 'review') {
        renderReviewActions(tid);
    }
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    const version = ++_msgVersionCounter;
    _lastSyncVersion = version;
    stateManager.update({ messages: msg.messages as any, msgVersion: version });
}
