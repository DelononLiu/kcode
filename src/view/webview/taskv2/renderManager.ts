import type { AppState, StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy, renderTaskMessages, foldPhases } from './taskStrategy';
import { showTaskView } from '../taskView';

let _strategy: ViewStrategy = taskStrategy;

export function setStrategy(s: ViewStrategy) {
    _strategy = s;
}

export function getStrategy(): ViewStrategy {
    return _strategy;
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
    stateManager.update(delta);

    const st = stateManager.state;
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

    // Update tool calls in state
    for (const tc of result.toolCalls) {
        stateManager.addToolCall(tc);
    }

    _strategy.onStreamDone(stateManager.state, result);
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    stateManager.setMessages(msg.messages);

    const st = stateManager.state;
    showTaskView(true);
    _strategy.renderHeader(st);

    renderTaskMessages(msg.messages);

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
