import type { AcpMessageHandler } from '../types';

export class FakeAgent {
    private handlers: Map<string, AcpMessageHandler> = new Map();

    setHandler(sessionId: string, handler: AcpMessageHandler) {
        this.handlers.set(sessionId, handler);
    }

    removeHandler(sessionId: string) {
        this.handlers.delete(sessionId);
    }

    async prompt(sessionId: string, text: string): Promise<void> {
        console.log('[FakeAgent] prompt called, sessionId:', sessionId, 'text:', text);
        const handler = this.handlers.get(sessionId);
        if (!handler) {
            console.warn('[FakeAgent] No handler for session:', sessionId);
            console.warn('[FakeAgent] Available handlers:', Array.from(this.handlers.keys()));
            return;
        }

        console.log('[FakeAgent] Handler found, starting response simulation');

        const fakeResponses = [
            `Received: "${text}"`,
            '',
            'Analyzing your request...',
            '',
            'I understand your requirements. I will help you complete the related tasks.',
            '',
            '---',
            '',
            '[FakeAgent Mode - Debugging]',
            '',
            'This is a simulated response for debugging purposes.',
            '',
            'To use a real AI Agent, configure `kcode.agentName` in VS Code settings.'
        ];

        for (let i = 0; i < fakeResponses.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const chunk = fakeResponses[i];
            if (chunk) {
                console.log('[FakeAgent] Sending chunk', i + 1, ':', chunk.substring(0, 30));
                handler.onText(chunk);
            }
        }

        console.log('[FakeAgent] All chunks sent, calling onDone');
        handler.onDone();
    }

    hasSession(sessionId: string): boolean {
        return this.handlers.has(sessionId);
    }

    createSession(taskId: string): string {
        return `fake-session-${taskId}`;
    }
}