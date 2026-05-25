import * as vscode from 'vscode';
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import type { KnowledgeEntry } from '../../types';

const plugin: KCodePlugin = {
    id: 'kcode.knowledge',
    name: 'Knowledge Manager',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.addStreamProcessor((text: string) => {
            const entryRegex = /<KNOWLEDGE_ENTRY>([\s\S]*?)<\/KNOWLEDGE_ENTRY>/g;
            let match;
            while ((match = entryRegex.exec(text)) !== null) {
                try {
                    const parsed = JSON.parse(match[1]);
                    const store = api.getStore();
                    const router = api.getRouter();
                    const entries: KnowledgeEntry[] = (Array.isArray(parsed) ? parsed : [parsed]).map((e: any) => ({
                        id: `ke_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                        taskId: '',
                        type: e.type || 'decision',
                        title: e.title || '',
                        content: e.content || '',
                        tags: e.tags || [],
                        createdAt: Date.now(),
                    }));
                    for (const entry of entries) {
                        store.addKnowledgeEntry('', entry);
                    }
                    router.PostMessage({ type: 'knowledgeExtract', entries, taskId: '' });
                    vscode.commands.executeCommand('kcode.refreshKnowledgePanel');
                } catch {}
            }
            return text;
        });

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
            const extractPrompt = '请分析以上对话内容，提炼本次任务中可复用的核心经验与关键决策（2-4 条为宜，每条聚焦一个具体问题或场景）。先输出标题行「📚 萃取知识表格」，然后在其下方用 markdown 表格输出（列：类型、标题、简介、标签）。标题请简短（15 字以内），不含特殊字符（如 * # / \\ : 等），适合作为文件名。表格数据会被系统自动解析存储，不需要额外输出 JSON。如果没有可提炼的知识，请直接说明。';
            router.PostMessage({ type: 'addSystemMessage', content: '🔍 AI 正在分析对话萃取知识...', taskId: tid });
            await agentService.sendPrompt(tid, extractPrompt, {
                onText: () => {},
                onReasoning: () => {},
                onToolCall: () => {},
                onToolCallUpdate: () => {},
                onPlan: () => {},
                onError: (err: string) => router.PostMessage({ type: 'addSystemMessage', content: `萃取失败: ${err}`, taskId: tid }),
                onDone: () => {},
            });
        });
    },

    deactivate() {},
};

export default plugin;
