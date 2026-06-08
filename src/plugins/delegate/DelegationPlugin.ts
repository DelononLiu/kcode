import * as vscode from 'vscode';
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import type { Task } from '../../types';

const plugin: KCodePlugin = {
    id: 'kcode.delegate',
    name: 'Task Delegation',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.onMessage('convertToTask', (msg: any) => {
            const store = api.getStore();
            const chatTask = store.getTask(msg.taskId);
            if (!chatTask) return;
            const messages = store.getMessages(msg.taskId);
            const firstUserMsg = messages.find((m: any) => m.role === 'user');
            const newTask: Task = {
                id: `task_${Date.now()}`, title: firstUserMsg ? firstUserMsg.content.substring(0, 50).replace(/\n/g, ' ') : '从对话创建的任务',
                goal: '', type: 'task', status: 'pending', phase: 'goal',
                confirmedItems: [], pendingItems: [], planSteps: [], originalRequest: '', createdAt: Date.now(), pinned: false,
                workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
            };
            store.addTask(newTask);
            const newId = newTask.id;
            for (const msg2 of messages) {
                store.addMessage({ id: store.nextMessageId(newId), taskId: newId, role: msg2.role, content: msg2.content, type: msg2.type, timestamp: msg2.timestamp });
            }
            vscode.commands.executeCommand('kcode.selectTask', newId);
        });
    },

    deactivate() {},
};

export default plugin;
