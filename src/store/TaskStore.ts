import * as vscode from 'vscode';
import { Workspace, Task, ChatMessage, WorkspaceData } from '../types';

export class TaskStore {
    private state: vscode.Memento;

    constructor(state: vscode.Memento) {
        this.state = state;
    }

    // ===== Workspace CRUD =====

    getWorkspaces(): Workspace[] {
        return this.state.get<Workspace[]>('workspaces', []);
    }

    addWorkspace(ws: Workspace): void {
        const workspaces = this.getWorkspaces();
        workspaces.push(ws);
        this.state.update('workspaces', workspaces);
    }

    // ===== Task CRUD =====

    getTasks(workspaceId: string): Task[] {
        const key = `tasks_${workspaceId}`;
        return this.state.get<Task[]>(key, []);
    }

    addTask(task: Task): void {
        const tasks = this.getTasks(task.workspaceId);
        tasks.push(task);
        this.state.update(`tasks_${task.workspaceId}`, tasks);
    }

    updateTaskStatus(taskId: string, workspaceId: string, status: Task['status']): void {
        const tasks = this.getTasks(workspaceId);
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].status = status;
            this.state.update(`tasks_${workspaceId}`, tasks);
        }
    }

    getTask(workspaceId: string, taskId: string): Task | undefined {
        return this.getTasks(workspaceId).find(t => t.id === taskId);
    }

    // ===== Chat Messages =====

    getMessages(taskId: string): ChatMessage[] {
        const key = `messages_${taskId}`;
        return this.state.get<ChatMessage[]>(key, []);
    }

    addMessage(msg: ChatMessage): void {
        const messages = this.getMessages(msg.taskId);
        messages.push(msg);
        this.state.update(`messages_${msg.taskId}`, messages);
    }

    clearMessages(taskId: string): void {
        this.state.update(`messages_${taskId}`, []);
    }

    // ===== Helpers =====

    getWorkspaceData(workspaceId: string): WorkspaceData {
        const workspaces = this.getWorkspaces();
        const workspace = workspaces.find(w => w.id === workspaceId)!;
        const tasks = this.getTasks(workspaceId);
        return { workspace, tasks };
    }
}
