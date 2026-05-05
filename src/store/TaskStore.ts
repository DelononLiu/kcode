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
        tasks.unshift(task);
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

    updateTaskTitle(taskId: string, title: string): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].title = title;
            this.state.update('tasks', tasks);
        }
    }

    updateTaskGoal(taskId: string, goal: string): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].goal = goal;
            this.state.update('tasks', tasks);
        }
    }

    updateTaskPin(taskId: string, pinned: boolean): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].pinned = pinned;
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

    deleteTask(taskId: string): void {
        const tasks = this.getTasks().filter(t => t.id !== taskId);
        this.state.update('tasks', tasks);
        this.state.update(`messages_${taskId}`, []);
    }

    clearMessages(taskId: string): void {
        this.state.update(`messages_${taskId}`, []);
    }

    // ===== Group CRUD =====

    getGroups(): string[] {
        return this.state.get<string[]>('groups', []);
    }

    addGroup(name: string): void {
        const groups = this.getGroups();
        if (!groups.includes(name)) {
            groups.push(name);
            this.state.update('groups', groups);
        }
    }

    updateTaskGroup(taskId: string, group: string | null): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].group = group ?? undefined;
            this.state.update('tasks', tasks);
        }
    }

    moveTask(taskId: string, targetTaskId: string | null, position: 'before' | 'after' | null, group: string | null): void {
        const tasks = this.getTasks();
        const fromIdx = tasks.findIndex(t => t.id === taskId);
        if (fromIdx === -1) return;

        const [task] = tasks.splice(fromIdx, 1);
        task.group = group ?? undefined;

        if (targetTaskId) {
            const toIdx = tasks.findIndex(t => t.id === targetTaskId);
            if (toIdx !== -1) {
                tasks.splice(toIdx + (position === 'after' ? 1 : 0), 0, task);
            } else {
                tasks.unshift(task);
            }
        } else {
            let insertIdx = tasks.length;
            for (let i = tasks.length - 1; i >= 0; i--) {
                if (tasks[i].group === task.group) {
                    insertIdx = i + 1;
                    break;
                }
            }
            tasks.splice(insertIdx, 0, task);
        }

        this.state.update('tasks', tasks);
    }

    findEmptyTask(): Task | undefined {
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (!task.goal && task.status === 'pending' && this.getMessages(task.id).length === 0) {
                return task;
            }
        }
        return undefined;
    }
}
