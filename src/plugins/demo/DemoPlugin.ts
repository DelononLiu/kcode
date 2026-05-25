import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import { DemoRunner } from './DemoRunner';

let demoRunner: DemoRunner | null = null;

const plugin: KCodePlugin = {
    id: 'kcode.demo',
    name: 'Demo Runner',
    version: '1.0.0',
    mode: 'task',
    dependencies: ['kcode.device'],

    async activate(api: PluginAPI) {
        const router = api.getRouter();
        const deviceExports = api.getPlugin<{ deviceManager: { getClients: () => Map<string, any> } }>('kcode.device');
        const getDeviceClients = () => deviceExports?.deviceManager?.getClients?.() || new Map();

        demoRunner = new DemoRunner(
            getDeviceClients,
            (msg) => router.PostMessage(msg),
            () => null,
        );

        api.onMessage('demoRun', (msg: any) => demoRunner!.handleRun(msg));
        api.onMessage('demoStop', (msg: any) => demoRunner!.handleStop(msg.cardId, msg.taskId));
        api.onMessage('demoRerun', (msg: any) => demoRunner!.handleRun(msg));
    },

    async deactivate() {
        if (demoRunner) {
            demoRunner.dispose();
            demoRunner = null;
        }
    },
};

export default plugin;
