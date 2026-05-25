import * as vscode from 'vscode';
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import type { Task } from '../../types';

const plugin: KCodePlugin = {
    id: 'kcode.delegate',
    name: 'Task Delegation',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.addStreamProcessor((text: string) => {
            const delegateRegex = /<TASK_DELEGATE>([\s\S]*?)<\/TASK_DELEGATE>/g;
            let match;
            while ((match = delegateRegex.exec(text)) !== null) {
                try {
                    const payload = JSON.parse(match[1]);
                    const store = api.getStore();
                    const router = api.getRouter();
                    const parentTaskId = (router as any).currentTaskId || '';
                    const parentTask = store.getTask(parentTaskId);
                    const fullGoal = payload.relevantSnippets ? `${payload.goal}\n\n技术上下文：${payload.relevantSnippets}` : payload.goal;
                    const newTask: Task = {
                        id: `task_${Date.now()}`, title: payload.title, goal: fullGoal, type: 'task',
                        status: 'pending', phase: 'demand',
                        confirmedItems: payload.confirmedItems || [], pendingItems: [], planSteps: [],
                        createdAt: Date.now(), pinned: false,
                        source: parentTask?.source, containerId: parentTask?.containerId, group: parentTask?.group,
                        workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
                    };
                    store.addTask(newTask);
                    store.addMessage({
                        id: store.nextMessageId(parentTaskId), taskId: parentTaskId,
                        role: 'agent', type: 'stop_message',
                        content: `📤 已委派新任务「${payload.title}」`, timestamp: Date.now(),
                    });
                    router.PostMessage({ type: 'addSystemMessage', content: `📤 已委派新任务「${payload.title}」`, taskId: parentTaskId });
                    vscode.commands.executeCommand('kcode.refreshSidebar');
                } catch {}
            }
            return text;
        });

        api.onMessage('convertToTask', (msg: any) => {
            const store = api.getStore();
            const router = api.getRouter();
            const chatTask = store.getTask(msg.taskId);
            if (!chatTask) return;
            const messages = store.getMessages(msg.taskId);
            const firstUserMsg = messages.find((m: any) => m.role === 'user');
            const newTask: Task = {
                id: `task_${Date.now()}`, title: firstUserMsg ? firstUserMsg.content.substring(0, 50).replace(/\n/g, ' ') : '从对话创建的任务',
                goal: '', type: 'task', status: 'pending', phase: 'demand',
                confirmedItems: [], pendingItems: [], planSteps: [], createdAt: Date.now(), pinned: false,
                workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
            };
            store.addTask(newTask);
            const newId = newTask.id;
            for (const msg2 of messages) {
                store.addMessage({ id: store.nextMessageId(newId), taskId: newId, role: msg2.role, content: msg2.content, type: msg2.type, timestamp: msg2.timestamp });
            }
            router.PostMessage({ type: 'selectTask', taskId: newId });
            vscode.commands.executeCommand('kcode.selectTask', newId);
        });
    },

    deactivate() {},
};

export default plugin;
