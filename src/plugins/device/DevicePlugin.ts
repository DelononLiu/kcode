import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import { DeviceManager } from './DeviceManager';
import type { DeviceConfig } from '../../types';

let deviceManager: DeviceManager | null = null;

const plugin: KCodePlugin = {
    id: 'kcode.device',
    name: 'Device Manager',
    version: '1.0.0',
    mode: 'task',
    dependencies: [],

    async activate(api: PluginAPI) {
        const router = api.getRouter();
        deviceManager = new DeviceManager(
            (msg, ...args) => console.log('[DevicePlugin]', msg, ...args),
            (msg, ...args) => console.error('[DevicePlugin]', msg, ...args),
            (msg) => router.PostMessage(msg),
        );
        api.setPluginExport('kcode.device', { deviceManager });

        api.onMessage('deviceConnect', (msg: any) => deviceManager!.handleConnect(msg.config as DeviceConfig));
        api.onMessage('deviceDisconnect', () => deviceManager!.handleDisconnect());
        api.onMessage('deviceCommand', (msg: any) => deviceManager!.handleCommand(msg.command));
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
        if (deviceManager) {
            deviceManager.dispose();
            deviceManager = null;
        }
    },
};

export default plugin;
