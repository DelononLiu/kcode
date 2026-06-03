import type { TaskStore } from '../../store/TaskStore';
import { StreamHandlerBase } from './StreamHandlerBase';
import type { MessageRouter } from '../MessageRouter';

export class AssistantStreamHandler extends StreamHandlerBase {
    constructor(
        tid: string,
        router: MessageRouter,
        setGenState: (generating: boolean) => void,
        private store: TaskStore,
        private loadMessagesFn: () => void,
        sendAcpLog?: (dir: 'send' | 'recv', text: string) => void,
        flushAcpRecvBuffer?: () => void,
    ) {
        super(tid, router, setGenState, sendAcpLog, flushAcpRecvBuffer);
    }

    protected sendDisplayUpdate(text: string): void {
        this.router.PostMessage({ type: 'agentStreamUpdate', text });
    }

    protected onText(chunk: string): void {
        this.buffer += chunk;
        this.sendDisplayUpdate(this.buffer);
    }

    protected onDone(stopReason?: string): void {
        this.completeReasoning();
        this.setGenState(false);

        if (stopReason === 'cancelled') {
            this.activeToolCalls.clear();
            this.buffer = '';
            return;
        }

        for (const [toolCallId, tc] of this.activeToolCalls) {
            const msgId = this.store.nextAssistantMessageId();
            this.store.addAssistantMessage({
                id: msgId, role: 'tool', type: 'tool_call',
                content: JSON.stringify({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
                timestamp: Date.now(),
            });
        }

        if (this.buffer.trim()) {
            const id = this.store.nextAssistantMessageId();
            this.store.addAssistantMessage({ id, role: 'agent', content: this.buffer, timestamp: Date.now() });
        }

        this.loadMessagesFn();
        this.activeToolCalls.clear();
        this.buffer = '';
    }
}
