import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.template',
    name: 'Plugin Template',
    version: '1.0.0',
    mode: 'task',

    async activate(api: PluginAPI) {
        // Register message handler
        api.onMessage('customEvent', async (msg: any) => {
            console.log('[TemplatePlugin] customEvent:', msg);
        });

        // Register tool call handler
        api.onToolCall('customTool', (taskId: string, info: any) => {
            console.log('[TemplatePlugin] customTool:', taskId, info);
        });

        // Register output panel tab
        api.addOutputPanelTab('template', '📌 模板', (taskInfo: any) => {
            return `<div class="op-item">模板插件已激活</div>`;
        });
    },

    async deactivate() {
        console.log('[TemplatePlugin] deactivated');
    },
};

export default plugin;
