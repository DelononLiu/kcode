import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStore } from '../TaskStore';
import type { Task, ChatMessage } from '../../types';

class MockMemento {
    private data = new Map<string, any>();

    get<T>(key: string, defaultValue: T): T {
        return this.data.has(key) ? this.data.get(key) : defaultValue;
    }

    update(key: string, value: any): void {
        this.data.set(key, value);
    }
}

describe('TaskStore', () => {
    let store: TaskStore;
    let memento: MockMemento;

    beforeEach(() => {
        memento = new MockMemento();
        store = new TaskStore(memento as any);
    });

    it('starts with empty tasks', () => {
        expect(store.getTasks()).toEqual([]);
    });

    it('addTask and getTasks round-trip', () => {
        const task: Task = {
            id: 't1', title: 'Test', goal: '', type: 'task', status: 'pending',
            phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [],
            createdAt: Date.now(),
        };
        store.addTask(task);
        expect(store.getTasks()).toHaveLength(1);
        expect(store.getTasks()[0].id).toBe('t1');
    });

    it('getTask returns single task', () => {
        const task: Task = {
            id: 't2', title: 'Two', goal: '', type: 'task', status: 'pending',
            phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [],
            createdAt: Date.now(),
        };
        store.addTask(task);
        expect(store.getTask('t2')?.title).toBe('Two');
        expect(store.getTask('nonexistent')).toBeUndefined();
    });

    it('deleteTask removes task and messages', () => {
        const task: Task = {
            id: 't3', title: 'Three', goal: '', type: 'task', status: 'pending',
            phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [],
            createdAt: Date.now(),
        };
        store.addTask(task);

        const msg: any = { id: 'm1', taskId: 't3', role: 'user', content: 'hi', timestamp: Date.now() };
        store.addMessage(msg);
        expect(store.getMessages('t3')).toHaveLength(1);

        store.deleteTask('t3');
        expect(store.getTask('t3')).toBeUndefined();
        expect(store.getMessages('t3')).toEqual([]);
    });

    it('getMessages / addMessage round-trip', () => {
        const task: Task = {
            id: 't4', title: 'Four', goal: '', type: 'task', status: 'pending',
            phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [],
            createdAt: Date.now(),
        };
        store.addTask(task);

        const m1: any = { id: 'm1', taskId: 't4', role: 'user', content: 'hello', timestamp: 1 };
        const m2: any = { id: 'm2', taskId: 't4', role: 'assistant', content: 'world', timestamp: 2 };
        store.addMessage(m1);
        store.addMessage(m2);

        const msgs = store.getMessages('t4');
        expect(msgs).toHaveLength(2);
        expect(msgs[0].content).toBe('hello');
        expect(msgs[1].content).toBe('world');

        expect(store.getMessages('nonexistent')).toEqual([]);
    });
});
