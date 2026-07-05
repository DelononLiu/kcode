/**
 * 共享流处理器 — 提取自 assistantPipeline.ts 的流处理逻辑
 *
 * 接收 StreamStateAccess 接口代替直接引用 StateManager 实例，
 * 可同时被 assistantPipeline.ts 和 renderManager.ts 调用。
 */

import type { Message } from './taskv3/types';

export interface StreamStateAccess {
    state: { messages: Message[] };
    patch(delta: { messages: Message[] }): void;
}

/** 流式更新当前 agent 消息（累积追加文本） */
export function handleStreamChunk(text: string, sm: StreamStateAccess) {
    const msgs = [...sm.state.messages];
    let streamIdx = msgs.findIndex(m => m.role === 'agent' && m.streaming);
    if (streamIdx < 0) {
        msgs.push({
            id: 'msg_' + Date.now(),
            taskId: '',
            role: 'agent',
            type: 'text',
            content: '',
            timestamp: Date.now(),
            streaming: true,
            collapsed: false,
            roundGroup: null,
        });
        streamIdx = msgs.length - 1;
    }
    msgs[streamIdx] = { ...msgs[streamIdx], content: text };
    sm.patch({ messages: msgs });
}

/** 流式结束，取消 streaming 标记 */
export function handleStreamDone(sm: StreamStateAccess) {
    const msgs = sm.state.messages.map(m =>
        m.streaming ? { ...m, streaming: false } : m
    );
    sm.patch({ messages: msgs });
}

/** 处理 thinking 块 */
export function handleThinkingChunk(
    msg: { text: string; status: string },
    sm: StreamStateAccess,
) {
    const msgs = [...sm.state.messages];
    const now = Date.now();
    const existingIdx = msgs.findIndex(m => m.type === 'thinking' && m.streaming);
    if (existingIdx >= 0) {
        msgs[existingIdx] = {
            ...msgs[existingIdx],
            content: msg.text,
            streaming: msg.status !== 'completed',
        };
    } else {
        msgs.push({
            id: 'thinking_' + now,
            taskId: '',
            role: 'agent',
            type: 'thinking',
            content: msg.text,
            timestamp: now,
            streaming: msg.status !== 'completed',
            collapsed: false,
            roundGroup: null,
        });
    }
    sm.patch({ messages: msgs });
}

/** 处理 tool_call 块（改用 toolCall 结构化字段） */
export function handleToolChunk(
    msg: { toolCallId: string; title: string; kind: string; status: string; content: string },
    sm: StreamStateAccess,
) {
    const msgs = [...sm.state.messages];
    const existingIdx = msgs.findIndex(
        m => m.type === 'tool_call' && m.toolCall?.toolCallId === msg.toolCallId,
    );
    if (existingIdx >= 0) {
        msgs[existingIdx] = {
            ...msgs[existingIdx],
            content: msg.content,
            toolCall: {
                toolCallId: msg.toolCallId,
                title: msg.title,
                kind: msg.kind,
                status: msg.status as 'running' | 'completed' | 'failed',
            },
        };
    } else {
        msgs.push({
            id: 'tool_' + msg.toolCallId,
            taskId: '',
            role: 'tool',
            type: 'tool_call',
            content: msg.content,
            toolCall: {
                toolCallId: msg.toolCallId,
                title: msg.title,
                kind: msg.kind,
                status: msg.status as 'running' | 'completed' | 'failed',
            },
            timestamp: Date.now(),
            streaming: false,
            collapsed: false,
            roundGroup: null,
        });
    }
    sm.patch({ messages: msgs });
}
