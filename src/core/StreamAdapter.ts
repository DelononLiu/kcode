/**
 * StreamAdapter: 将 LangGraph streamEvents 事件映射为 ACP 兼容的
 * onText/onToolCall 回调。遵循原则 5：LangGraph 从零构建，
 * 但 postMessage 协议与 ACP 一致，WebView 端无感知。
 */
import type { AcpMessageHandler } from '../types';

export type LangGraphEvent =
    | { event: 'on_chat_model_stream'; chunk?: { content?: string } }
    | { event: 'on_tool_start'; name?: string; toolCallId?: string }
    | { event: 'on_tool_end'; toolCallId?: string; output?: string }
    | { event: 'on_llm_end' }
    | { event: 'on_chain_end' };

export class StreamAdapter {
    private handler: AcpMessageHandler;

    constructor(handler: AcpMessageHandler) {
        this.handler = handler;
    }

    push(event: LangGraphEvent): void {
        switch (event.event) {
            case 'on_chat_model_stream':
                if (event.chunk?.content) {
                    this.handler.onText(event.chunk.content);
                }
                break;
            case 'on_tool_start':
                if (event.toolCallId && event.name) {
                    this.handler.onToolCall?.(
                        event.toolCallId,
                        event.name,
                        event.name,
                        'running'
                    );
                }
                break;
            case 'on_tool_end':
                if (event.toolCallId) {
                    this.handler.onToolCallUpdate?.(
                        event.toolCallId,
                        'completed',
                        event.output || ''
                    );
                }
                break;
        }
    }

    complete(stopReason?: string): void {
        this.handler.onDone(stopReason);
    }

    error(err: string): void {
        this.handler.onError(err);
    }
}
