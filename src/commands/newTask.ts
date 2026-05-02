import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Task } from '../types';

export async function newTask(store: TaskStore): Promise<Task | undefined> {
    const workspaces = store.getWorkspaces();

    if (workspaces.length === 0) {
        vscode.window.showInformationMessage('请先打开一个工作区');
        return undefined;
    }

    let targetWorkspaceId: string;

    if (workspaces.length === 1) {
        targetWorkspaceId = workspaces[0].id;
    } else {
        const picked = await vscode.window.showQuickPick(
            workspaces.map(w => ({ label: w.name, id: w.id })),
            { placeHolder: '选择目标任务工作区' }
        );
        if (!picked) return undefined;
        targetWorkspaceId = picked.id;
    }

    const title = await vscode.window.showInputBox({
        placeHolder: '输入任务标题',
        prompt: '新建开发任务'
    });

    if (!title) return undefined;

    const task: Task = {
        id: `task_${Date.now()}`,
        workspaceId: targetWorkspaceId,
        title,
        status: 'pending',
        createdAt: Date.now()
    };

    store.addTask(task);
    return task;
}
