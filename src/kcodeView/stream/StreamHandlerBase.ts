import type { AcpMessageHandler } from '../../types';
import type { MessageRouter } from '../MessageRouter';
import type { ToolCallState } from '../PanelContext';

export abstract class StreamHandlerBase {
    protected buffer = '';
    protected reasoningText = '';
    protected reasoningActive = false;
    protected currentReasoningId = '';
    protected activeToolCalls = new Map<string, ToolCallState>();

    constructor(
        protected tid: string,
        protected router: MessageRouter,
        protected setGenState: (generating: boolean) => void,
        protected sendAcpLog?: (dir: 'send' | 'recv', text: string) => void,
        protected flushAcpRecvBuffer?: () => void,
    ) {}

    protected abstract onText(chunk: string): void;
    protected abstract onDone(stopReason?: string): void;
    protected abstract sendDisplayUpdate(text: string): void;

    protected shouldSuppressToolCallDisplay(): boolean {
        return false;
    }

    protected onPlan(entries: { content: string; priority: string; status: string }[]): void {}

    protected onError(error: string): void {
        this.setGenState(false);
        this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${error}]` });
    }

    protected completeReasoning(): void {
        if (!this.reasoningActive) return;
        this.reasoningActive = false;
        const full = this.reasoningText;
        this.reasoningText = '';
        this.flushAcpRecvBuffer?.();
        if (full) this.sendAcpLog?.('recv', full);
        this.flushAcpRecvBuffer?.();
        const rc = this.activeToolCalls.get(this.currentReasoningId);
        if (rc) rc.status = 'completed';
        this._emitToolCall(this.currentReasoningId, '推理过程', 'thinking', 'completed', full);
    }

    protected _emitToolCall(toolCallId: string, title: string, kind: string, status: string, content?: string): void {
        if (this.shouldSuppressToolCallDisplay()) return;
        this.router.PostMessage({ type: 'toolCallUpdate', toolCallId, title, kind, status, content });
    }

    create(): AcpMessageHandler {
        return {
            onText: (chunk: string) => {
                this.completeReasoning();
                this.onText(chunk);
            },
            onReasoning: (text: string) => {
                if (!this.reasoningActive) {
                    this.currentReasoningId = 'reasoning_' + Date.now();
                    this.reasoningActive = true;
                    this.activeToolCalls.set(this.currentReasoningId, { title: '推理', kind: 'thinking', status: 'running' });
                    this._emitToolCall(this.currentReasoningId, '推理', 'thinking', 'running', '');
                }
                this.reasoningText += text;
                const tc = this.activeToolCalls.get(this.currentReasoningId);
                if (tc) tc.output = this.reasoningText;
                this._emitToolCall(this.currentReasoningId, '推理', 'thinking', 'running', this.reasoningText);
            },
            onToolCall: (toolCallId: string, title: string, kind: string, status: string) => {
                this.completeReasoning();
                this.activeToolCalls.set(toolCallId, { title, kind, status });
                this._emitToolCall(toolCallId, title, kind, status);
            },
            onToolCallUpdate: (toolCallId: string, status: string, content?: string, title?: string, kind?: string) => {
                const tc = this.activeToolCalls.get(toolCallId);
                if (tc) {
                    tc.status = status;
                    if (content) tc.output = content;
                    if (title) tc.title = title;
                    if (kind) tc.kind = kind;
                }
                this._emitToolCall(toolCallId, tc?.title || '', tc?.kind || '', status, content);
            },
            onPlan: (entries) => this.onPlan(entries),
            onError: (error) => this.onError(error),
            onDone: (stopReason) => this.onDone(stopReason),
        };
    }
}
