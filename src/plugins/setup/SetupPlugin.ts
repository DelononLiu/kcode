import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.setup',
    name: 'Environment Setup',
    version: '1.0.0',
    mode: 'assistant',
    dependencies: [],

    async activate(api: PluginAPI) {
        api.onMessage('checkEnv', async () => {
            const { detectEnv } = await import('../../view/SetupWizard');
            const env = await detectEnv(() => {});
            api.getRouter().PostMessage({ type: 'envStatus', env });
        });
    },

    async deactivate() {},
};

export default plugin;
