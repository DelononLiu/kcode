import type { DeviceConfig, IDeviceClient, DeviceConnection } from '../../types';

export class DeviceManager {
    private clients = new Map<string, IDeviceClient>();
    private outputLog: (data: string) => void;
    private errorLog: (data: string) => void;

    constructor(
        private logInfo: (msg: string, ...args: any[]) => void,
        private logError: (msg: string, ...args: any[]) => void,
        private postMessage: (msg: any) => void,
    ) {
        this.outputLog = (data) => this.postMessage({ type: 'deviceOutput', data });
        this.errorLog = (data) => this.postMessage({ type: 'deviceOutput', data: `\x1b[31m${data}\x1b[0m` });
    }

    getClients(): Map<string, IDeviceClient> {
        return this.clients;
    }

    async handleConnect(config: DeviceConfig): Promise<void> {
        const deviceId = `${config.type}://${config.host}:${config.port}`;
        this.logInfo(`[connect] 开始连接 ${deviceId}`, { config: { type: config.type, host: config.host, port: config.port, username: config.username } });

        if (this.clients.has(deviceId)) {
            this.postMessage({ type: 'deviceStatus', status: 'error', message: '设备已连接' });
            return;
        }

        this.postMessage({ type: 'deviceStatus', status: 'connecting', message: `正在连接 ${config.host}:${config.port}...` });

        try {
            const { createDeviceClient } = await import('../../device/DeviceClientFactory');
            const client = createDeviceClient(config.type);
            this.logInfo(`[connect] 创建 client, type=${config.type}`);

            client.onOutput((data) => {
                this.logInfo(`[stdout] ${data}`);
                this.outputLog(data);
            });
            client.onError((error) => {
                this.logError(`[stderr] ${error}`);
                this.errorLog(error);
            });
            client.onDisconnected(() => {
                this.logInfo(`[disconnect] ${deviceId} 连接已断开`);
                this.clients.delete(deviceId);
                this.postMessage({ type: 'deviceStatus', status: 'disconnected', message: '设备已断开' });
            });

            const conn = await client.connect(config);
            this.logInfo(`[connect] ${deviceId} 连接成功`);
            this.clients.set(deviceId, client);
            this.postMessage({ type: 'deviceConnected', deviceId, config });
        } catch (err: any) {
            const msg = err?.message || String(err);
            this.logError(`[connect] 连接失败: ${msg}`);
            this.postMessage({ type: 'deviceStatus', status: 'error', message: `连接失败: ${msg}` });
        }
    }

    async handleDisconnect(): Promise<void> {
        this.logInfo('[disconnect] 断开所有设备');
        for (const [id, client] of this.clients) {
            try { await client.disconnect(); } catch (e: any) { this.logError(`[disconnect] ${id} 断开异常: ${e?.message}`); }
            this.clients.delete(id);
        }
        this.postMessage({ type: 'deviceStatus', status: 'disconnected', message: '已断开所有设备' });
    }

    async handleCommand(command: string): Promise<void> {
        this.logInfo(`[exec] ${command}`);
        const clients = Array.from(this.clients.values());
        if (clients.length === 0) {
            this.logError('[exec] 未连接设备');
            this.postMessage({ type: 'deviceOutput', data: '\x1b[33m未连接设备，请先连接\x1b[0m' });
            return;
        }
        for (const client of clients) {
            try {
                const result = await client.exec(command);
                this.logInfo(`[exec stdout] ${result}`);
                this.postMessage({ type: 'deviceOutput', data: result });
            } catch (err: any) {
                this.logError(`[exec 失败] ${err?.message || String(err)}`);
                this.postMessage({ type: 'deviceOutput', data: `\x1b[31m${err?.message || String(err)}\x1b[0m` });
            }
        }
    }

    dispose(): void {
        for (const client of this.clients.values()) {
            client.disconnect().catch(() => {});
        }
        this.clients.clear();
    }
}
