import * as cp from 'child_process';
import * as readline from 'readline';
import type { DeviceConfig, DeviceConnection, IDeviceClient } from '../types';

interface PendingReq {
    action: 'connect' | 'exec' | 'close';
    resolve: (v: any) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    buffer: string[];
}

const DISHCLI_PATH = '/home/long2015/tools/go/bin/dishcli';

export class DishCliDeviceClient implements IDeviceClient {
    private process: cp.ChildProcess | null = null;
    private rl: readline.Interface | null = null;
    private pendingReqs: Map<string, PendingReq> = new Map();
    private reqIdCounter = 0;
    private status: DeviceConnection['status'] = 'disconnected';
    private outputCallback: ((data: string) => void) | null = null;
    private errorCallback: ((error: string) => void) | null = null;
    private disconnectCallback: (() => void) | null = null;
    private closed = false;

    private nextReqId(): string {
        return `d_${++this.reqIdCounter}`;
    }

    private cleanupPending(reqId: string) {
        const p = this.pendingReqs.get(reqId);
        if (p) { clearTimeout(p.timer); this.pendingReqs.delete(reqId); }
    }

    private handleLine(line: string) {
        let msg: any;
        try { msg = JSON.parse(line.trim()); } catch { return; }
        const { reqId, type } = msg;
        if (!reqId || !type) return;
        const p = this.pendingReqs.get(reqId);
        if (!p) return;

        if (type === 'result') {
            clearTimeout(p.timer);
            this.pendingReqs.delete(reqId);
            p.resolve(msg);
        } else if (type === 'error') {
            clearTimeout(p.timer);
            this.pendingReqs.delete(reqId);
            const errMsg = msg.msg || '未知错误';
            this.errorCallback?.(errMsg);
            p.reject(new Error(errMsg));
        } else if (type === 'stdout') {
            const data = msg.data || '';
            p.buffer.push(data);
            this.outputCallback?.(data);
        } else if (type === 'exit') {
            clearTimeout(p.timer);
            this.pendingReqs.delete(reqId);
            p.resolve(p.buffer.join(''));
        }
    }

    async connect(config: DeviceConfig): Promise<DeviceConnection> {
        if (this.process) throw new Error('已连接');
        this.status = 'connecting';

        return new Promise((resolve, reject) => {
            try {
                this.process = cp.spawn(DISHCLI_PATH, ['--json'], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                });

                this.rl = readline.createInterface({ input: this.process.stdout! });
                this.rl.on('line', (line: string) => this.handleLine(line));

                this.process.stderr?.on('data', (data: Buffer) => {
                    this.errorCallback?.(data.toString().trim());
                });

                this.process.on('error', (err) => {
                    this.status = 'error';
                    this.cleanup();
                    reject(new Error(`启动 dishcli 失败: ${err.message}`));
                });

                this.process.on('exit', () => {
                    this.status = 'disconnected';
                    for (const [, p] of this.pendingReqs) {
                        clearTimeout(p.timer);
                        p.reject(new Error('dishcli 进程已退出'));
                    }
                    this.pendingReqs.clear();
                    if (!this.closed) this.disconnectCallback?.();
                    this.cleanup();
                });

                this.process.stdin!.on('error', () => {});

                const params: Record<string, any> = { protocol: config.type };
                if (config.host) params.host = config.host;
                if (config.port) params.port = config.port;
                if (config.username) params.user = config.username;
                if (config.password) params.password = config.password;

                const reqId = this.nextReqId();
                const timer = setTimeout(() => {
                    this.pendingReqs.delete(reqId);
                    this.kill();
                    reject(new Error('连接超时'));
                }, 30000);
                this.pendingReqs.set(reqId, { action: 'connect', resolve, reject, timer, buffer: [] });
                this.writeLine({ reqId, action: 'connect', params });
            } catch (err: any) {
                this.status = 'error';
                reject(new Error(`启动 dishcli 失败: ${err.message}`));
            }
        }).then(() => {
            this.status = 'connected';
            return {
                deviceId: `${config.type}://${config.host}:${config.port}`,
                config,
                status: 'connected' as const,
                connectedAt: Date.now(),
            };
        });
    }

    private writeLine(req: any) {
        if (this.process?.stdin) {
            this.process.stdin.write(JSON.stringify(req) + '\n');
        }
    }

    async exec(command: string): Promise<string> {
        if (this.status !== 'connected') throw new Error('设备未连接');
        return new Promise<string>((resolve, reject) => {
            const reqId = this.nextReqId();
            const timer = setTimeout(() => {
                this.pendingReqs.delete(reqId);
                reject(new Error('命令执行超时'));
            }, 60000);
            this.pendingReqs.set(reqId, { action: 'exec', resolve, reject, timer, buffer: [] });
            this.writeLine({ reqId, action: 'exec', params: { cmd: command } });
        });
    }

    async disconnect(): Promise<void> {
        this.closed = true;
        return new Promise<void>((resolve) => {
            const reqId = this.nextReqId();
            const timer = setTimeout(() => {
                this.pendingReqs.delete(reqId);
                this.kill();
                resolve();
            }, 5000);
            this.pendingReqs.set(reqId, {
                action: 'close',
                resolve: () => { clearTimeout(timer); resolve(); },
                reject: () => { clearTimeout(timer); resolve(); },
                timer,
                buffer: [],
            });
            this.writeLine({ reqId, action: 'close' });
        }).finally(() => {
            this.kill();
            this.status = 'disconnected';
            this.disconnectCallback?.();
        });
    }

    private kill() {
        if (this.process) { this.process.kill(); this.process = null; }
        this.cleanup();
    }

    private cleanup() {
        if (this.rl) { this.rl.close(); this.rl = null; }
    }

    onOutput(c: (data: string) => void): void { this.outputCallback = c; }
    onError(c: (error: string) => void): void { this.errorCallback = c; }
    onDisconnected(c: () => void): void { this.disconnectCallback = c; }
    getStatus(): DeviceConnection['status'] { return this.status; }
}
