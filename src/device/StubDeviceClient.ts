import type { DeviceConfig, DeviceConnection, DeviceType, IDeviceClient } from '../types';

export class StubDeviceClient implements IDeviceClient {
    private deviceType: DeviceType;
    private status: DeviceConnection['status'] = 'disconnected';
    private outputCallback: ((data: string) => void) | null = null;
    private errorCallback: ((error: string) => void) | null = null;
    private disconnectCallback: (() => void) | null = null;

    constructor(type: DeviceType) {
        this.deviceType = type;
    }

    async connect(config: DeviceConfig): Promise<DeviceConnection> {
        this.status = 'connecting';
        await new Promise(resolve => setTimeout(resolve, 500));
        this.status = 'connected';
        this.outputCallback?.(`[${this.deviceType.toUpperCase()}] 已连接到 ${config.host}:${config.port}\n`);
        const conn: DeviceConnection = {
            deviceId: `${this.deviceType}://${config.host}:${config.port}`,
            config,
            status: 'connected',
            connectedAt: Date.now(),
        };
        return conn;
    }

    async disconnect(): Promise<void> {
        this.status = 'disconnected';
        this.outputCallback?.(`[${this.deviceType.toUpperCase()}] 连接已关闭\n`);
        this.disconnectCallback?.();
    }

    async exec(command: string): Promise<string> {
        const output = `[${this.deviceType.toUpperCase()}] 命令 '${command}' 已发送 (${this.deviceType} 协议将在后续版本实现)\n`;
        this.outputCallback?.(output);
        return output;
    }

    onOutput(callback: (data: string) => void): void { this.outputCallback = callback; }
    onError(callback: (error: string) => void): void { this.errorCallback = callback; }
    onDisconnected(callback: () => void): void { this.disconnectCallback = callback; }
    getStatus(): DeviceConnection['status'] { return this.status; }
}
