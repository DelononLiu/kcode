import * as cp from 'child_process';
import type { DeviceConfig, DeviceConnection, IDeviceClient } from '../types';

export class LocalDeviceClient implements IDeviceClient {
    private status: DeviceConnection['status'] = 'disconnected';
    private outputCallback: ((data: string) => void) | null = null;
    private errorCallback: ((error: string) => void) | null = null;
    private disconnectCallback: (() => void) | null = null;

    async connect(config: DeviceConfig): Promise<DeviceConnection> {
        this.status = 'connected';
        const conn: DeviceConnection = {
            deviceId: 'local',
            config,
            status: 'connected',
            connectedAt: Date.now(),
        };
        return conn;
    }

    async disconnect(): Promise<void> {
        this.status = 'disconnected';
        this.disconnectCallback?.();
    }

    async exec(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.exec(command, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) {
                    const msg = stderr || err.message;
                    this.errorCallback?.(msg);
                    reject(new Error(msg));
                    return;
                }
                this.outputCallback?.(stdout);
                resolve(stdout);
            });
        });
    }

    onOutput(callback: (data: string) => void): void { this.outputCallback = callback; }
    onError(callback: (error: string) => void): void { this.errorCallback = callback; }
    onDisconnected(callback: () => void): void { this.disconnectCallback = callback; }
    getStatus(): DeviceConnection['status'] { return this.status; }
}
