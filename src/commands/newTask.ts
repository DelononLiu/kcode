import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Task } from '../types';

export async function newTask(store: TaskStore): Promise<Task | undefined> {
    const title = await vscode.window.showInputBox({
        placeHolder: '输入任务标题',
        prompt: '新建开发任务'
    });

    if (!title) return undefined;

    const task: Task = {
        id: `task_${Date.now()}`,
        title,
        status: 'pending',
        createdAt: Date.now()
    };

    store.addTask(task);
    return task;
}