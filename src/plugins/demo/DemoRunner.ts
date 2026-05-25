export class DemoRunner {
    private activeAbort: AbortController | null = null;

    constructor(
        private getClients: () => Map<string, any>,
        private postMessage: (msg: any) => void,
        private getCurrentTaskId: () => string | null,
    ) {}

    async handleRun(config: any): Promise<void> {
        const cardId = config.cardId || `demo_${Date.now()}`;
        const deviceStr = config.device || `${config.host || 'localhost'}:${config.port || 22}`;

        this.postMessage({
            type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '',
            action: 'create', name: config.name || '未命名 Demo',
            command: config.command || '', device: deviceStr,
            envMeta: config.envMeta || {}, status: 'running', output: '',
        });

        if (!config.command) {
            this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'updateStatus', status: 'failed' });
            return;
        }

        const abort = new AbortController();
        this.activeAbort = abort;

        try {
            const commands = Array.isArray(config.command) ? config.command : [config.command];
            for (const cmd of commands) {
                if (abort.signal.aborted) break;
                this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'appendOutput', output: `$ ${cmd}\n` });

                const clients = Array.from(this.getClients().values());
                if (clients.length > 0) {
                    for (const client of clients) {
                        if (abort.signal.aborted) break;
                        try {
                            const result = await (client as any).exec(cmd);
                            if (result) {
                                this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'appendOutput', output: result });
                            }
                        } catch (err: any) {
                            this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'appendOutput', output: `\x1b[31m${err?.message || String(err)}\x1b[0m\n` });
                        }
                    }
                } else {
                    this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'appendOutput', output: '\x1b[33m未连接设备\x1b[0m\n' });
                }
            }

            if (!abort.signal.aborted) {
                this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'updateStatus', status: 'completed' });
            }
        } catch (err: any) {
            if (!abort.signal.aborted) {
                this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'appendOutput', output: `\x1b[31m${err?.message || String(err)}\x1b[0m\n` });
                this.postMessage({ type: 'demoCardUpdate', cardId, taskId: this.getCurrentTaskId() || '', action: 'updateStatus', status: 'failed' });
            }
        } finally {
            if (this.activeAbort === abort) {
                this.activeAbort = null;
            }
        }
    }

    handleStop(cardId: string, taskId?: string): void {
        this.activeAbort?.abort();
        this.activeAbort = null;
        this.postMessage({ type: 'demoCardUpdate', cardId, taskId: taskId || this.getCurrentTaskId() || '', action: 'updateStatus', status: 'failed' });
        this.postMessage({ type: 'demoCardUpdate', cardId, taskId: taskId || this.getCurrentTaskId() || '', action: 'appendOutput', output: '\n\x1b[33m[已终止]\x1b[0m\n' });
    }

    dispose(): void {
        this.activeAbort?.abort();
        this.activeAbort = null;
    }
}
