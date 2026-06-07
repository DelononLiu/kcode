import type { StateDelta, StreamResult, UserAction } from './types';
import type { ViewStrategy } from './viewStrategy';
import { stateManager } from './state';
import { basePipeline } from './basePipeline';
import { taskStrategy } from './taskStrategy';
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

        const v3Types = ['state-delta', 'stream-chunk', 'stream-done', 'messages-sync'];
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

function handleStreamDone(result: StreamResult) {
    const ss = stateManager.snapshot().streamState;
    stateManager.patch({ streamState: { ...ss, buffer: '', active: false } });

    basePipeline.finalizeStream();
    for (const tc of result.toolCalls) {
        basePipeline.addToolCard(tc);
    }

    _strategy.onStreamDone(stateManager.state, result);
}

function handleMessagesSync(msg: { messages: import('../../../types').ChatMessage[] }) {
    stateManager.update({ messages: msg.messages as any });
    const state = stateManager.state;
    basePipeline.renderMessageList(state.messages as any);
}
