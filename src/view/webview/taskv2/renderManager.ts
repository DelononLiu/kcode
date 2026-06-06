import type { AppState, StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy, renderTaskMessages, foldPhases } from './taskStrategy';
import { showTaskView } from '../taskView';

let _strategy: ViewStrategy = taskStrategy;
let _vscode: any;

function getVscode(): any {
    if (!_vscode) {
        _vscode = (window as any).vscode || (window as any).__vscode || (window as any).acquireVsCodeApi?.();
    }
    return _vscode;
}

function postAction(action: UserAction): void {
    getVscode().postMessage(action);
}

export function setStrategy(s: ViewStrategy) {
    _strategy = s;
}

export function getStrategy(): ViewStrategy {
    return _strategy;
}

function appendPhaseButtons() {
    const st = stateManager.state;
    const phase = st.activeTaskPhase;
    const actions: { text: string; className: string; onClick: () => void }[] = [];

    if (phase === 'goal' && st.activeTaskStatus !== 'completed' && st.activeTaskStatus !== 'cancelled') {
        actions.push(
            { text: '确认目标 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmGoal', taskId: st.activeTaskId! }) },
            { text: '修改需求 ↩', className: 'secondary', onClick: () => postAction({ type: 'reviseGoal', taskId: st.activeTaskId! }) },
            { text: '取消 ✕', className: 'cancel', onClick: () => postAction({ type: 'cancelTask', taskId: st.activeTaskId! }) },
        );
    } else if (phase === 'plan') {
        actions.push(
            { text: '确认计划 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmPlan', taskId: st.activeTaskId! }) },
        );
    } else if (phase === 'execute') {
        actions.push(
            { text: '确认完成，进入自验 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmExecuteDone', taskId: st.activeTaskId! }) },
        );
    } else if (phase === 'self_verify') {
        actions.push(
            { text: '确认自验，进入验收 ✓', className: 'primary', onClick: () => postAction({ type: 'confirmSelfVerifyDone', taskId: st.activeTaskId! }) },
        );
    } else if (phase === 'review' && st.activeTaskStatus === 'in_review') {
        actions.push(
            { text: '验收通过 ✓', className: 'primary', onClick: () => postAction({ type: 'approveReview', taskId: st.activeTaskId! }) },
            { text: '驳回 ↩', className: 'secondary', onClick: () => postAction({ type: 'rejectReview', taskId: st.activeTaskId! }) },
        );
    }

    basePipeline.appendStreamActions(actions);
}

// ──── Message handler for V2 protocol ────

export function handleV2Message(message: Record<string, unknown>) {
    const type = message.type as string;

    switch (type) {
        case 'state-delta':
            return handleStateDelta(message as unknown as StateDelta & { type: string });

        case 'stream-chunk':
            return handleStreamChunk(message as unknown as { text: string; type: string });

        case 'stream-done':
            return handleStreamDone(message as unknown as StreamResult & { type: string });

        case 'messages-sync':
            return handleMessagesSync(message as unknown as { messages: import('../../../types').ChatMessage[]; type: string });

        case 'user-action': {
            const action = message as unknown as UserAction;
            _strategy.onUserAction(stateManager.state, action);
            return;
        }

        default:
            break;
    }
}

function handleStateDelta(delta: StateDelta) {
    const prevPhase = stateManager.state.activeTaskPhase;
    stateManager.update(delta);
    const st = stateManager.state;

    if (st.activeTaskPhase !== prevPhase) {
        basePipeline.removeStreamActions();
    }

    showTaskView(true);
    _strategy.renderHeader(st);

    if (st.viewMode !== 'task') return;

    if (_strategy.shouldFoldPhases()) {
        setTimeout(() => foldPhases(st), 0);
    }
}

function handleStreamChunk(msg: { text: string }) {
    stateManager.setStreamActive(true);
    stateManager.update({ streamState: { ...stateManager.state.streamState, buffer: msg.text, active: true } });
    basePipeline.appendStreamChunk(msg.text);
}

function handleStreamDone(result: StreamResult) {
    stateManager.setStreamActive(false);
    basePipeline.finalizeStream();

    for (const tc of result.toolCalls) {
        stateManager.addToolCall(tc);
    }

    _strategy.onStreamDone(stateManager.state, result);
    appendPhaseButtons();
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    stateManager.setMessages(msg.messages);

    const st = stateManager.state;
    showTaskView(true);
    _strategy.renderHeader(st);

    renderTaskMessages(msg.messages);
    appendPhaseButtons();

    if (_strategy.shouldFoldPhases()) {
        setTimeout(() => foldPhases(st), 0);
    }

    basePipeline.scrollToBottom();
}

// ──── Init ────

let _initialized = false;

export function initTaskV2() {
    if (_initialized) return;
    _initialized = true;

    window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || !message.type) return;

        const v2Types = ['state-delta', 'stream-chunk', 'stream-done', 'messages-sync'];
        if (v2Types.includes(message.type)) {
            handleV2Message(message);
        }
    });
}
