import * as vscode from 'vscode';
import { Task, ChatMessage } from '../types';

export class TaskStore {
    private state: vscode.Memento;

    constructor(state: vscode.Memento) {
        this.state = state;
    }

    // ===== Task CRUD =====

    getTasks(): Task[] {
        return this.state.get<Task[]>('tasks', []);
    }

    addTask(task: Task): void {
        const tasks = this.getTasks();
        tasks.push(task);
        this.state.update('tasks', tasks);
    }

    updateTaskStatus(taskId: string, status: Task['status']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].status = status;
            this.state.update('tasks', tasks);
        }
    }

    getTask(taskId: string): Task | undefined {
        return this.getTasks().find(t => t.id === taskId);
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
}
