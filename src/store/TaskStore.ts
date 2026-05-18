import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Task, ChatMessage, FileChange, ContainerEntity, AssistantMessage, ToolGroup, ToolItem, KnowledgeEntry, TimelineEntry } from '../types';
import { ProjectFs } from './ProjectFs';

export interface StorageBackend {
    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    update(key: string, value: any): Thenable<void>;
    keys(): readonly string[];
}

function kcodeRoot(): string {
    return path.join(os.homedir(), '.local', 'share', 'kcode');
}

export class TaskStore {
    private fs: ProjectFs;
    private _msgCounterCache: Map<string, number> = new Map();

    constructor(fs: ProjectFs) {
        this.fs = fs;
    }

    // ===== Task CRUD =====

    getTasks(): Task[] {
        const tasks = this.fs.getAllTasks();
        return tasks.map(t => ({
            ...t,
            phase: t.phase || ('demand' as const),
            confirmedItems: t.confirmedItems || [],
            pendingItems: t.pendingItems || [],
            planSteps: t.planSteps || [],
            hooks: t.hooks || {},
        }));
    }

    addTask(task: Task): void {
        this.fs.addTask(task);
    }

    updateTaskPhase(taskId: string, phase: Task['phase']): void {
        this.fs.updateTask(taskId, { phase });
    }

    updateConfirmedItems(taskId: string, items: string[]): void {
        this.fs.updateTask(taskId, { confirmedItems: items });
    }

    updatePendingItems(taskId: string, items: string[]): void {
        this.fs.updateTask(taskId, { pendingItems: items });
    }

    updatePlanSteps(taskId: string, steps: Task['planSteps']): void {
        this.fs.updateTask(taskId, { planSteps: steps });
    }

    updatePlanStepStatus(taskId: string, index: number, status: Task['planSteps'][0]['status']): void {
        const task = this.fs.getTask(taskId);
        if (task && task.planSteps[index]) {
            const steps = [...task.planSteps];
            steps[index] = { ...steps[index], status };
            this.fs.updateTask(taskId, { planSteps: steps });
        }
    }

    updateTaskStatus(taskId: string, status: Task['status']): void {
        this.fs.updateTask(taskId, { status });
    }

    updateTaskTitle(taskId: string, title: string): void {
        this.fs.updateTask(taskId, { title });
    }

    updateTaskType(taskId: string, type: 'task'): void {
        this.fs.updateTask(taskId, { type });
    }

    updateTaskGoal(taskId: string, goal: string): void {
        this.fs.updateTask(taskId, { goal });
    }

    updateTaskCategory(taskId: string, category: Task['category']): void {
        this.fs.updateTask(taskId, { category } as any);
    }

    updateTaskSubType(taskId: string, subType: Task['subType']): void {
        this.fs.updateTask(taskId, { subType } as any);
    }

    updateTaskPin(taskId: string, pinned: boolean): void {
        this.fs.updateTask(taskId, { pinned });
    }

    getTask(taskId: string): Task | undefined {
        return this.fs.getTask(taskId);
    }

    // ===== Chat Messages =====

    getMessages(taskId: string): ChatMessage[] {
        return this.fs.getMessages(taskId);
    }

    addMessage(msg: ChatMessage): void {
        this.fs.addMessage(msg);
    }

    nextMessageId(taskId: string): string {
        if (!this._msgCounterCache.has(taskId)) {
            this._msgCounterCache.set(taskId, this.fs.getNextMessageId(taskId));
        }
        const next = this._msgCounterCache.get(taskId)! + 1;
        this._msgCounterCache.set(taskId, next);
        return `msg_${next}`;
    }

    deleteTask(taskId: string): void {
        this.fs.setMessages(taskId, []);
        this.fs.deleteTask(taskId);
        this._msgCounterCache.delete(taskId);
    }

    deleteTasks(taskIds: string[]): void {
        for (const id of taskIds) {
            this.fs.setMessages(id, []);
            this.fs.deleteTask(id);
            this._msgCounterCache.delete(id);
        }
    }

    updateTasksPin(taskIds: string[], pinned: boolean): void {
        for (const id of taskIds) {
            this.fs.updateTask(id, { pinned });
        }
    }

    updateMessageContent(taskId: string, messageId: string, content: string): void {
        const messages = this.fs.getMessages(taskId);
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
            messages[idx].content = content;
            this.fs.setMessages(taskId, messages);
        }
    }

    updateMessageType(taskId: string, messageId: string, type: ChatMessage['type']): void {
        const messages = this.fs.getMessages(taskId);
        const idx = messages.findIndex(m => m.id === messageId);
        if (idx !== -1) {
            messages[idx].type = type;
            this.fs.setMessages(taskId, messages);
        }
    }

    storeReviewChanges(taskId: string, changes: FileChange[]): void {
        this.fs.storeReviewChanges(taskId, changes);
    }

    getReviewChanges(taskId: string): FileChange[] {
        return this.fs.getReviewChanges(taskId);
    }

    clearReviewChanges(taskId: string): void {
        this.fs.clearReviewChanges(taskId);
    }

    clearMessages(taskId: string): void {
        this.fs.setMessages(taskId, []);
        this._msgCounterCache.delete(taskId);
    }

    // ===== Group CRUD (legacy, using containers) =====

    getGroups(): string[] {
        const containers = this.fs.getAllContainers();
        return containers.filter(c => c.type === 'group').map(c => c.name);
    }

    addGroup(name: string): void {
        if (!this.getGroups().includes(name)) {
            const containers = this.fs.getAllContainers();
            const inboxProject = containers.find(c => c.type === 'project' && c.name === '未分类');
            if (inboxProject) {
                this.fs.addGroup(inboxProject.id, name);
            }
        }
    }

    updateTaskGroup(taskId: string, group: string | null): void {
        // legacy: group was a string name; now we use containerId
        if (group) {
            const containers = this.fs.getAllContainers();
            const g = containers.find(c => c.type === 'group' && c.name === group);
            if (g) {
                this.fs.moveTaskToContainer(taskId, g.id);
            }
        } else {
            this.fs.moveTaskToContainer(taskId, undefined);
        }
    }

    deleteGroup(name: string): void {
        const containers = this.fs.getAllContainers();
        const g = containers.find(c => c.type === 'group' && c.name === name);
        if (g && g.parentId) {
            const tasks = this.fs.getProjectTasks(g.parentId).filter(t => t.containerId === g.id);
            for (const task of tasks) {
                this.fs.moveTaskToContainer(task.id, g.parentId);
            }
            this.fs.deleteGroup(g.parentId, g.id);
        }
    }

    renameGroup(oldName: string, newName: string): void {
        const containers = this.fs.getAllContainers();
        const g = containers.find(c => c.type === 'group' && c.name === oldName);
        if (g && g.parentId) {
            this.fs.updateGroup(g.parentId, g.id, { name: newName });
        }
    }

    moveGroup(groupName: string, direction: 'up' | 'down'): void {
        // groups don't have ordering in the new system
        const containers = this.fs.getAllContainers();
        const g = containers.find(c => c.type === 'group' && c.name === groupName);
        if (g) {
            this.fs.moveContainer(g.id, direction);
        }
    }

    reorderGroups(groupNames: string[]): void {
        // no-op in new system
    }

    updateTaskHooks(taskId: string, phase: string, commands: string[]): void {
        const task = this.fs.getTask(taskId);
        if (task) {
            const hooks = task.hooks ? { ...task.hooks } : {} as Record<string, string[]>;
            hooks[phase] = commands;
            this.fs.updateTask(taskId, { hooks } as any);
        }
    }

    updateTaskNodeMessageId(taskId: string, nodeType: string, messageId: string): void {
        const task = this.fs.getTask(taskId);
        if (task) {
            const nodeMessageIds = task.nodeMessageIds ? { ...task.nodeMessageIds } : {} as Record<string, string>;
            nodeMessageIds[nodeType] = messageId;
            this.fs.updateTask(taskId, { nodeMessageIds } as any);
        }
    }

    updateTaskSessionId(taskId: string, sessionId: string): void {
        this.fs.updateTask(taskId, { sessionId } as any);
    }

    updateTaskArchive(taskId: string, archived: boolean): void {
        this.fs.updateTask(taskId, { archived });
    }

    updateTasksArchive(taskIds: string[], archived: boolean): void {
        for (const id of taskIds) {
            this.fs.updateTask(id, { archived });
        }
    }

    // ===== Assistant Session =====

    getAssistantSessionId(): string | undefined {
        return this.fs.getAssistantSessionId();
    }

    setAssistantSessionId(sessionId: string): void {
        this.fs.setAssistantSessionId(sessionId);
    }

    // ===== Assistant Messages =====

    getAssistantMessages(): AssistantMessage[] {
        return this.fs.getAssistantMessages();
    }

    addAssistantMessage(msg: AssistantMessage): void {
        this.fs.addAssistantMessage(msg);
    }

    nextAssistantMessageId(): string {
        const msgs = this.fs.getAssistantMessages();
        const max = msgs.reduce((m, msg) => {
            const num = parseInt(msg.id.replace('amsg_', ''), 10);
            return num > m ? num : m;
        }, 0);
        return `amsg_${max + 1}`;
    }

    // ===== Container CRUD (Group/Project tree) =====

    getContainers(): ContainerEntity[] {
        return this.fs.getAllContainers();
    }

    getContainer(id: string): ContainerEntity | undefined {
        return this.fs.getContainer(id);
    }

    getContainerByName(name: string): ContainerEntity | undefined {
        return this.fs.getContainerByName(name);
    }

    addContainer(name: string, type: ContainerEntity['type'], parentId?: string): ContainerEntity | null {
        if (type === 'project') {
            return this.fs.addProject(name);
        } else if (type === 'group' && parentId) {
            return this.fs.addGroup(parentId, name);
        }
        return null;
    }

    updateContainer(id: string, updates: Partial<Pick<ContainerEntity, 'name' | 'parentId'>>): boolean {
        const c = this.fs.getContainer(id);
        if (!c) return false;
        if (c.type === 'project') {
            return this.fs.updateProject(id, updates);
        } else if (c.type === 'group' && c.parentId) {
            return this.fs.updateGroup(c.parentId, id, updates);
        }
        return false;
    }

    deleteContainer(id: string): void {
        const c = this.fs.getContainer(id);
        if (!c) return;
        if (c.type === 'project') {
            this.fs.deleteProject(id);
        } else if (c.type === 'group' && c.parentId) {
            this.fs.deleteGroup(c.parentId, id);
        }
    }

    getChildren(parentId: string): ContainerEntity[] {
        const c = this.fs.getContainer(parentId);
        if (!c) return [];
        if (c.type === 'project') {
            return this.fs.getGroups(parentId);
        }
        return [];
    }

    getAncestors(id: string): ContainerEntity[] {
        const result: ContainerEntity[] = [];
        let current = this.fs.getContainer(id);
        while (current?.parentId) {
            const parent = this.fs.getContainer(current.parentId);
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
        return this.fs.getProjects();
    }

    moveContainer(id: string, direction: 'up' | 'down'): void {
        this.fs.moveContainer(id, direction);
    }

    getProjectContainers(): ContainerEntity[] {
        return this.fs.getProjects();
    }

    getProjectTasks(projectId: string): Task[] {
        return this.fs.getProjectTasks(projectId);
    }

    getProjectProgress(projectId: string): { completed: number; total: number } {
        const tasks = this.fs.getProjectTasks(projectId).filter(t => t.status !== 'cancelled');
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        return { completed, total };
    }

    getContainerTasks(containerId: string): Task[] {
        const c = this.fs.getContainer(containerId);
        if (!c) return [];
        if (c.type === 'project') {
            return this.fs.getProjectTasks(containerId);
        }
        return this.getTasks().filter(t => t.containerId === containerId);
    }

    updateTaskContainer(taskId: string, containerId: string | undefined): void {
        this.fs.moveTaskToContainer(taskId, containerId);
    }

    moveTask(taskId: string, targetTaskId: string | null, position: 'before' | 'after' | null, group: string | null): void {
        const task = this.fs.getTask(taskId);
        if (!task) return;

        if (group !== null && group !== undefined) {
            const containers = this.fs.getAllContainers();
            const g = containers.find(c => c.type === 'group' && c.name === group);
            if (g) {
                this.fs.moveTaskToContainer(taskId, g.id);
            }
        }

        if (targetTaskId && position) {
            this._reorderWithinContainer(task, targetTaskId, position);
        }
    }

    private _reorderWithinContainer(task: Task, targetTaskId: string, position: 'before' | 'after'): void {
        const containerId = task.containerId || undefined;
        const orderFile = this._taskOrderPath(containerId);
        let order: string[] = [];
        try { order = JSON.parse(fs.readFileSync(orderFile, 'utf-8')); } catch {}
        order = order.filter((id: string) => id !== task.id);
        const insertAt = order.indexOf(targetTaskId) + (position === 'after' ? 1 : 0);
        order.splice(insertAt < 0 ? order.length : insertAt, 0, task.id);
        const dir = path.dirname(orderFile);
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
        fs.writeFileSync(orderFile, JSON.stringify(order, null, 2), 'utf-8');
    }

    private _taskOrderPath(containerId: string | undefined): string {
        const root = kcodeRoot();
        if (!containerId) {
            return path.join(root, 'inbox', '_order.json');
        }
        const c = this.fs.getContainer(containerId);
        if (!c) return path.join(root, 'inbox', '_order.json');
        if (c.type === 'project') {
            return path.join(root, 'projects', containerId, 'tasks', '_order.json');
        }
        if (c.parentId) {
            return path.join(root, 'projects', c.parentId, 'task-groups', containerId, 'tasks', '_order.json');
        }
        return path.join(root, 'inbox', '_order.json');
    }

    // ===== Tool Groups =====

    getTaskToolGroups(taskId: string): ToolGroup[] {
        return this.fs.getTaskToolGroups(taskId);
    }

    addToolGroup(taskId: string, groupId: string, items: ToolItem[]): void {
        this.fs.addToolGroup(taskId, { id: groupId, taskId, items, createdAt: Date.now() });
    }

    addToolItem(taskId: string, groupId: string, item: ToolItem): void {
        this.fs.updateToolGroup(taskId, groupId, item);
    }

    // ===== Knowledge Entries =====

    addKnowledgeEntry(taskId: string, entry: KnowledgeEntry): void {
        this.fs.addKnowledgeEntry(taskId, entry);
    }

    getTaskKnowledgeEntries(taskId: string): KnowledgeEntry[] {
        return this.fs.getTaskKnowledgeEntries(taskId);
    }

    getAllKnowledgeEntries(): KnowledgeEntry[] {
        return this.fs.getAllKnowledgeEntries();
    }

    searchKnowledgeEntries(query: string): KnowledgeEntry[] {
        const all = this.fs.getAllKnowledgeEntries();
        const q = query.toLowerCase();
        return all.filter(e =>
            e.title.toLowerCase().includes(q) ||
            e.content.toLowerCase().includes(q) ||
            e.tags.some(t => t.toLowerCase().includes(q))
        );
    }

    // ===== Timeline =====

    getTaskTimeline(taskId: string): TimelineEntry[] {
        return this.fs.getTaskTimeline(taskId);
    }

    addTimelineEntry(taskId: string, entry: TimelineEntry): void {
        this.fs.addTimelineEntry(taskId, entry);
    }

    // ===== Wiki Export =====

    getWikiDir(): string {
        return this.fs.getWikiDir();
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
