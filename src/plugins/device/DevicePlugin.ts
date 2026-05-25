import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import { DeviceManager } from './DeviceManager';
import type { DeviceConfig } from '../../types';

let _deviceManager: DeviceManager | null = null;
let _exports: Record<string, any> = {};

const plugin: KCodePlugin = {
    id: 'kcode.device',
    name: 'Device Manager',
    version: '1.0.0',
    mode: 'task',
    dependencies: [],

    async activate(api: PluginAPI) {
        const router = api.getRouter();
        _deviceManager = new DeviceManager(
            (msg, ...args) => console.log('[DevicePlugin]', msg, ...args),
            (msg, ...args) => console.error('[DevicePlugin]', msg, ...args),
            (msg) => router.PostMessage(msg),
        );
        _exports = { deviceManager: _deviceManager };

        api.onMessage('deviceConnect', (msg: any) => _deviceManager!.handleConnect(msg.config as DeviceConfig));
        api.onMessage('deviceDisconnect', () => _deviceManager!.handleDisconnect());
        api.onMessage('deviceCommand', (msg: any) => _deviceManager!.handleCommand(msg.command));
        api.onMessage('getSavedDevices', () => {
            const store = api.getStore();
            const configService = (store as any).configService;
            const devices: any[] = configService?.get?.('devices', []) || [];
            router.PostMessage({ type: 'savedDevices', devices });
        });
        api.onMessage('deviceDebugLog', (msg: any) => {
            console.log('[DevicePlugin webview]', msg.text);
        });
    },

    async deactivate() {
        if (_deviceManager) {
            _deviceManager.dispose();
            _deviceManager = null;
        }
        _exports = {};
    },
};

export default plugin;
export function getDevicePluginExports(): Record<string, any> {
    return _exports;
}
