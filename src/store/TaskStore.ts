import { Task, ChatMessage, FileChange, ContainerEntity, AssistantMessage } from '../types';

export interface StorageBackend {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    update(key: string, value: any): Thenable<void>;
    keys(): readonly string[];
}

export class TaskStore {
    private state: StorageBackend;
    private globalState: StorageBackend;
    private _tasksCache: Task[] | null = null;

    constructor(state: StorageBackend, globalState?: StorageBackend) {
        this.state = state;
        this.globalState = globalState || state;
    }

    private get _gs(): StorageBackend {
        return this.globalState;
    }

    // ===== Task CRUD =====

    private _invalidateCache(): void {
        this._tasksCache = null;
    }

    getTasks(): Task[] {
        if (this._tasksCache) return this._tasksCache;
        const tasks = this.state.get<Task[]>('tasks', []);
        this._tasksCache = tasks.map(t => ({
            ...t,
            phase: t.phase || ('demand' as const),
            confirmedItems: t.confirmedItems || [],
            pendingItems: t.pendingItems || [],
            planSteps: t.planSteps || [],
            hooks: t.hooks || {},
        }));
        return this._tasksCache;
    }

    addTask(task: Task): void {
        const tasks = this.state.get<Task[]>('tasks', []);
        tasks.unshift(task);
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    updateTaskPhase(taskId: string, phase: Task['phase']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].phase = phase;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateConfirmedItems(taskId: string, items: string[]): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].confirmedItems = items;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updatePendingItems(taskId: string, items: string[]): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].pendingItems = items;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updatePlanSteps(taskId: string, steps: Task['planSteps']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].planSteps = steps;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updatePlanStepStatus(taskId: string, index: number, status: Task['planSteps'][0]['status']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1 && tasks[idx].planSteps[index]) {
            tasks[idx].planSteps[index].status = status;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskStatus(taskId: string, status: Task['status']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].status = status;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskTitle(taskId: string, title: string): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].title = title;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskType(taskId: string, type: 'task'): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].type = type;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskGoal(taskId: string, goal: string): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].goal = goal;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskCategory(taskId: string, category: Task['category']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].category = category;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskSubType(taskId: string, subType: Task['subType']): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].subType = subType;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskPin(taskId: string, pinned: boolean): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].pinned = pinned;
            this.state.update('tasks', tasks);
        this._invalidateCache();
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

    nextMessageId(taskId: string): string {
        const key = `msgCounter_${taskId}`;
        const next = (this.state.get<number>(key, 0)) + 1;
        this.state.update(key, next);
        return `msg_${next}`;
    }

    deleteTask(taskId: string): void {
        const tasks = this.getTasks().filter(t => t.id !== taskId);
        this.state.update('tasks', tasks);
        this._invalidateCache();
        this.state.update(`messages_${taskId}`, []);
        this.state.update(`msgCounter_${taskId}`, undefined);
        this.state.update(`reviewChanges_${taskId}`, undefined);
    }

    deleteTasks(taskIds: string[]): void {
        const idSet = new Set(taskIds);
        const tasks = this.getTasks().filter(t => !idSet.has(t.id));
        this.state.update('tasks', tasks);
        this._invalidateCache();
        for (const id of taskIds) {
            this.state.update(`messages_${id}`, []);
            this.state.update(`msgCounter_${id}`, undefined);
            this.state.update(`reviewChanges_${id}`, undefined);
        }
    }

    updateTasksPin(taskIds: string[], pinned: boolean): void {
        const idSet = new Set(taskIds);
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (idSet.has(task.id)) {
                task.pinned = pinned;
            }
        }
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    updateMessageContent(taskId: string, messageId: string, content: string): void {
        const messages = this.getMessages(taskId);
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
            messages[idx].content = content;
            this.state.update(`messages_${taskId}`, messages);
        }
    }

    updateMessageType(taskId: string, messageId: string, type: ChatMessage['type']): void {
        const messages = this.getMessages(taskId);
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
            messages[idx].type = type;
            this.state.update(`messages_${taskId}`, messages);
        }
    }

    storeReviewChanges(taskId: string, changes: FileChange[]): void {
        this.state.update(`reviewChanges_${taskId}`, changes);
    }

    getReviewChanges(taskId: string): FileChange[] {
        return this.state.get<FileChange[]>(`reviewChanges_${taskId}`, []);
    }

    clearReviewChanges(taskId: string): void {
        this.state.update(`reviewChanges_${taskId}`, undefined);
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
        this._invalidateCache();
        }
    }

    deleteGroup(name: string): void {
        const groups = this.getGroups().filter(g => g !== name);
        this.state.update('groups', groups);
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (task.group === name) {
                task.group = undefined;
            }
        }
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    renameGroup(oldName: string, newName: string): void {
        const groups = this.getGroups();
        const idx = groups.indexOf(oldName);
        if (idx !== -1) {
            groups[idx] = newName;
            this.state.update('groups', groups);
        }
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (task.group === oldName) {
                task.group = newName;
            }
        }
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    moveGroup(groupName: string, direction: 'up' | 'down'): void {
        const groups = this.getGroups();
        const idx = groups.indexOf(groupName);
        if (idx === -1) return;
        if (direction === 'up' && idx > 0) {
            [groups[idx - 1], groups[idx]] = [groups[idx], groups[idx - 1]];
        } else if (direction === 'down' && idx < groups.length - 1) {
            [groups[idx], groups[idx + 1]] = [groups[idx + 1], groups[idx]];
        } else {
            return;
        }
        this.state.update('groups', groups);
    }

    updateTaskHooks(taskId: string, phase: string, commands: string[]): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            if (!tasks[idx].hooks) {
                tasks[idx].hooks = {};
            }
            (tasks[idx].hooks as Record<string, string[]>)[phase] = commands;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskNodeMessageId(taskId: string, nodeType: string, messageId: string): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            if (!tasks[idx].nodeMessageIds) {
                tasks[idx].nodeMessageIds = {};
            }
            (tasks[idx].nodeMessageIds as Record<string, string>)[nodeType] = messageId;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTaskArchive(taskId: string, archived: boolean): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].archived = archived;
            this.state.update('tasks', tasks);
        this._invalidateCache();
        }
    }

    updateTasksArchive(taskIds: string[], archived: boolean): void {
        const idSet = new Set(taskIds);
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (idSet.has(task.id)) {
                task.archived = archived;
            }
        }
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    reorderGroups(groupNames: string[]): void {
        this.state.update('groups', groupNames);
    }

    // ===== Assistant Messages =====

    getAssistantMessages(): AssistantMessage[] {
        return this.state.get<AssistantMessage[]>('assistant_messages', []);
    }

    addAssistantMessage(msg: AssistantMessage): void {
        const messages = this.getAssistantMessages();
        messages.push(msg);
        if (messages.length > 200) {
            messages.splice(0, messages.length - 200);
        }
        this.state.update('assistant_messages', messages);
    }

    nextAssistantMessageId(): string {
        const key = 'assistant_msgCounter';
        const next = (this.state.get<number>(key, 0)) + 1;
        this.state.update(key, next);
        return `amsg_${next}`;
    }

    // ===== Container CRUD (Group/Project tree) =====

    getContainers(): ContainerEntity[] {
        return this._gs.get<ContainerEntity[]>('containers', []);
    }

    getContainer(id: string): ContainerEntity | undefined {
        return this.getContainers().find(c => c.id === id);
    }

    getContainerByName(name: string): ContainerEntity | undefined {
        return this.getContainers().find(c => c.name === name);
    }

    addContainer(name: string, type: ContainerEntity['type'], parentId?: string): ContainerEntity | null {
        const containers = this.getContainers();
        if (containers.some(c => c.name === name)) return null;
        const container: ContainerEntity = {
            id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name,
            type,
            parentId,
            createdAt: Date.now(),
        };
        containers.push(container);
        this._gs.update('containers', containers);
        return container;
    }

    updateContainer(id: string, updates: Partial<Pick<ContainerEntity, 'name' | 'parentId'>>): boolean {
        const containers = this.getContainers();
        if (updates.name && containers.some(c => c.name === updates.name && c.id !== id)) return false;
        const updated = containers.map(c =>
            c.id === id ? { ...c, ...updates } : c
        );
        this._gs.update('containers', updated);
        return true;
    }

    deleteContainer(id: string): void {
        const containers = this.getContainers();
        const idsToRemove = new Set<string>();
        const collectChildren = (parentId: string) => {
            idsToRemove.add(parentId);
            for (const c of containers) {
                if (c.parentId === parentId) collectChildren(c.id);
            }
        };
        collectChildren(id);
        const remaining = containers.filter(c => !idsToRemove.has(c.id));
        this._gs.update('containers', remaining);
        const tasks = this.getTasks();
        for (const task of tasks) {
            if (task.containerId && idsToRemove.has(task.containerId)) {
                task.containerId = undefined;
            }
        }
        this.state.update('tasks', tasks);
        this._invalidateCache();
    }

    getChildren(parentId: string): ContainerEntity[] {
        return this.getContainers().filter(c => c.parentId === parentId);
    }

    getAncestors(id: string): ContainerEntity[] {
        const containers = this.getContainers();
        const result: ContainerEntity[] = [];
        let current = containers.find(c => c.id === id);
        while (current?.parentId) {
            const parent = containers.find(c => c.id === current!.parentId);
            if (parent) {
                result.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }
        return result;
    }

    getRootContainers(): ContainerEntity[] {
        return this.getContainers().filter(c => !c.parentId);
    }

    moveContainer(id: string, direction: 'up' | 'down'): void {
        const containers = this.getContainers();
        const idx = containers.findIndex(c => c.id === id);
        if (idx === -1) return;
        if (direction === 'up' && idx > 0) {
            [containers[idx - 1], containers[idx]] = [containers[idx], containers[idx - 1]];
        } else if (direction === 'down' && idx < containers.length - 1) {
            [containers[idx], containers[idx + 1]] = [containers[idx + 1], containers[idx]];
        } else {
            return;
        }
        this._gs.update('containers', containers);
    }

    getProjectContainers(): ContainerEntity[] {
        return this.getContainers().filter(c => c.type === 'project');
    }

    getProjectTasks(projectId: string): Task[] {
        const containers = this.getContainers();
        const containerIds = new Set<string>();
        const collectDescendants = (parentId: string) => {
            containerIds.add(parentId);
            for (const c of containers) {
                if (c.parentId === parentId) collectDescendants(c.id);
            }
        };
        collectDescendants(projectId);
        return this.getTasks().filter(t => t.containerId && containerIds.has(t.containerId));
    }

    getProjectProgress(projectId: string): { completed: number; total: number } {
        const tasks = this.getProjectTasks(projectId).filter(t => t.status !== 'cancelled');
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        return { completed, total };
    }

    getContainerTasks(containerId: string): Task[] {
        return this.getTasks().filter(t => t.containerId === containerId);
    }

    updateTaskContainer(taskId: string, containerId: string | undefined): void {
        const tasks = this.getTasks();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            tasks[idx].containerId = containerId;
            this.state.update('tasks', tasks);
        this._invalidateCache();
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
        this._invalidateCache();
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
