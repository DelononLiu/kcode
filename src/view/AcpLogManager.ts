import type { MessageRouter } from './MessageRouter';

export class AcpLogManager {
    enabled = false;
    private recvBuffer = '';
    private recvFlushTimer: any = null;

    constructor(private router: MessageRouter) {}

    send(taskId: string, direction: 'send' | 'recv', text: string) {
        if (!this.enabled) return;
        if (direction === 'recv') {
            this.recvBuffer += text;
            const lines = this.recvBuffer.split('\n');
            this.recvBuffer = lines.pop() || '';
            for (const line of lines) this.router.PostMessage({ type: 'acpLogEntry', direction, text: line, timestamp: Date.now(), taskId });
            clearTimeout(this.recvFlushTimer);
            this.recvFlushTimer = setTimeout(() => { if (this.recvBuffer.trim()) { this.router.PostMessage({ type: 'acpLogEntry', direction, text: this.recvBuffer, timestamp: Date.now(), taskId }); this.recvBuffer = ''; } }, 300);
        } else {
            this.router.PostMessage({ type: 'acpLogEntry', direction, text, timestamp: Date.now(), taskId });
        }
    }

    flush(taskId?: string) {
        clearTimeout(this.recvFlushTimer);
        if (this.recvBuffer.trim()) {
            this.router.PostMessage({ type: 'acpLogEntry', direction: 'recv', text: this.recvBuffer, timestamp: Date.now(), taskId });
            this.recvBuffer = '';
        }
    }

    dispose() {
        clearTimeout(this.recvFlushTimer);
    }
}
