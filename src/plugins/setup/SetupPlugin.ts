import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import { EnvDetector } from './EnvDetector';

let envDetector: EnvDetector | null = null;

const plugin: KCodePlugin = {
    id: 'kcode.setup',
    name: 'Environment Setup',
    version: '1.0.0',
    mode: 'assistant',
    dependencies: [],

    async activate(api: PluginAPI) {
        api.onMessage('runEnvSetup', async (msg: any) => {
            if (envDetector) {
                const router = api.getRouter();
                const agentService = api.getAgentService();
                const assistantHandler = (router as any).assistantHandler;
                const stream = (text: string) => router.PostMessage({ type: 'agentStreamUpdate', text });
                envDetector = new EnvDetector(
                    { get: (k: string) => undefined, set: (k: string, v: any) => {}, save: async () => {} } as any,
                    stream,
                );
                await envDetector.runSetup(agentService, router, assistantHandler);
            }
        });

        api.onMessage('checkEnv', async (msg: any) => {
            const { detectEnv } = await import('../../kcodeView/SetupWizard');
            const env = await detectEnv(() => {});
            api.getRouter().PostMessage({ type: 'envStatus', env });
        });
    },

    async deactivate() {
        envDetector = null;
    },
};

export default plugin;
