import * as vscode from 'vscode';
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.knowledge',
    name: 'Knowledge Manager',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.onMessage('exportToWiki', async (msg: any) => {
            const tid = msg.taskId;
            if (!tid) return;
            try {
                const store = api.getStore();
                const { WikiExporter } = await import('../../export/WikiExporter');
                const exporter = new WikiExporter(store);
                const result = exporter.writeToWiki(tid);
                api.getRouter().PostMessage({ type: 'wikiExported', filePath: result.filePath, fileName: result.fileName });
                vscode.window.showInformationMessage(`✅ 已导出到 .kcode/wiki/${result.fileName}`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`导出失败: ${err?.message || String(err)}`);
            }
        });

        api.onMessage('extractKnowledge', async (msg: any) => {
            const tid = msg.taskId;
            if (!tid) return;
            const store = api.getStore();
            const router = api.getRouter();
            const agentService = api.getAgentService();
            const messages = store.getMessages(tid);
            if (messages.length === 0) return;
            router.PostMessage({ type: 'generationState', isGenerating: true });
            const extractPrompt = '请分析以上对话内容，提炼本次任务中可复用的核心经验与关键决策（2-4 条为宜，每条聚焦一个具体问题或场景）。先输出标题行「📚 萃取知识表格」，然后在其下方用 markdown 表格输出（列：类型、标题、简介、标签）。标题请简短（15 字以内），不含特殊字符（如 * # / \\ : 等），适合作为文件名。表格数据会被系统自动解析存储，不需要额外输出 JSON。如果没有可提炼的知识，请直接说明。';
            router.PostMessage({ type: 'addSystemMessage', content: '🔍 AI 正在分析对话萃取知识...', taskId: tid });
            let collectedText = '';
            await agentService.sendPrompt(tid, extractPrompt, {
                onText: (text: string) => {
                    collectedText += text;
                    router.PostMessage({ type: 'agentStreamUpdate', text, taskId: tid });
                },
                onReasoning: () => {},
                onToolCall: () => {},
                onToolCallUpdate: () => {},
                onPlan: () => {},
                onError: (err: string) => {
                    router.PostMessage({ type: 'addSystemMessage', content: `萃取失败: ${err}`, taskId: tid });
                    router.PostMessage({ type: 'generationState', isGenerating: false });
                },
                onDone: () => {
                    if (collectedText) {
                        const id = store.nextMessageId(tid);
                        store.addMessage({ id, taskId: tid, role: 'agent', content: collectedText, timestamp: Date.now() });
                    }
                    router.PostMessage({ type: 'generationState', isGenerating: false });
                    router.PostMessage({ type: 'loadMessages', messages: store.getMessages(tid), taskId: tid, taskStatus: store.getTask(tid)?.status });
                },
            });
        });
    },

    deactivate() {},
};

export default plugin;
