import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
import { renderGoalCard, renderGoalActions, renderPlanActions, renderExecuteActions, renderSelfVerifyActions, renderReviewActions } from './cardRenderer';
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

    stateManager.subscribe((state) => {
        showTaskView(true);
        _strategy.renderHeader(state);
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

// stream-chunk/done 走 patch() 静默更新数据 + 直接调 basePipeline 渲染。
// 不走 subscriber 是因为 stream chunk 触发全量 subscriber 浪费性能，
// 且 stream 渲染是增量追加，不需要 header 重渲染。

function handleStreamChunk(msg: { text: string }) {
    const ss = stateManager.snapshot().streamState;
    stateManager.patch({ streamState: { ...ss, buffer: ss.buffer + msg.text, active: true } });
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
    // 暂存到 stateManager，等 stream-done 后在 round 之后渲染
    stateManager.patch({ pendingGoal: { taskId: msg.taskId, goal: msg.goal } });
}

function _renderPendingGoal() {
    const state = stateManager.snapshot();
    if (!state.pendingGoal) return;
    // 仅渲染按钮，不重复折叠内的 AI 回复内容
    renderGoalActions(state.pendingGoal.taskId);
    stateManager.patch({ pendingGoal: null });
}

function handleStreamDone(result: StreamResult) {
    const ss = stateManager.snapshot().streamState;
    stateManager.patch({ streamState: { ...ss, buffer: '', active: false } });

    // 确保容器存在，把工具卡片加入本轮容器（时间顺序）
    basePipeline.getOrCreateRoundContainer();
    for (const tc of result.toolCalls) {
        if (tc.kind === 'thinking') continue;
        basePipeline.addToolCardToRound(tc);
    }

    // 终结流样式 + 折叠本轮容器（不追加消息，避免重复）
    basePipeline.finalizeStream();
    basePipeline.finalizeRound();

    // 按阶段标志渲染操作按钮（无 body，不重复 fold 内容）
    if (stateManager.snapshot().pendingGoal) {
        _renderPendingGoal();
    } else if (result.planProposed && stateManager.state.activeTaskPhase === 'plan') {
        renderPlanActions(stateManager.state.activeTaskId || '');
    } else if (result.executeFinished && stateManager.state.activeTaskPhase === 'execute') {
        renderExecuteActions(stateManager.state.activeTaskId || '');
    } else if (result.selfVerifyFinished && stateManager.state.activeTaskPhase === 'self_verify') {
        renderSelfVerifyActions(stateManager.state.activeTaskId || '');
    } else if (stateManager.state.activeTaskPhase === 'review') {
        renderReviewActions(stateManager.state.activeTaskId || '');
    } else if (!['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'].includes(stateManager.state.activeTaskPhase)) {
        // 非任务阶段（澄清、追问等）才显示最终消息
        basePipeline.appendFinalMessage(result.cleanedText);
    }

    _strategy.onStreamDone(stateManager.state, result);
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    stateManager.update({ messages: msg.messages as any });
    const state = stateManager.state;
    basePipeline.renderMessageList(state.messages as any);
}
