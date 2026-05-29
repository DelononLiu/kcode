import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Task, ChatMessage, ContainerEntity, FileChange, AssistantMessage, ToolGroup, ToolItem, KnowledgeEntry, TimelineEntry } from '../types';
import { taskLogStore } from './TaskLogStore';

function defaultRoot(): string {
	return path.join(os.homedir(), '.kcode');
}

function workspaceSafeId(workspaceRoot?: string): string {
	if (!workspaceRoot) return '';
	const basename = path.basename(workspaceRoot);
	let hash = 0;
	for (let i = 0; i < workspaceRoot.length; i++) {
		const char = workspaceRoot.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	const shortHash = Math.abs(hash).toString(36).slice(0, 6);
	return `${basename}_${shortHash}`;
}

interface MetaFile {
	title?: string;
	goal?: string;
	type?: 'task';
	status?: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
	phase?: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
	createdAt?: number;
	workspace?: string;
	pinned?: boolean;
	archived?: boolean;
	containerId?: string;
	category?: string;
	subType?: string;
	confirmedItems?: string[];
	pendingItems?: string[];
	planSteps?: { content: string; status: string }[];
	nodeMessageIds?: Record<string, string>;
    hooks?: Record<string, string[]>;
    source?: { type: string; url: string; owner: string; repo: string; issueNumber: number };
    sessionId?: string;
}

export class ProjectFs {
	private _taskCache: Task[] | null = null;
	private _containerCache: ContainerEntity[] | null = null;
	private _root: string;
	private _workspaceId: string;

	constructor(rootDir?: string, workspaceRoot?: string) {
		this._root = rootDir || defaultRoot();
		this._workspaceId = workspaceSafeId(workspaceRoot);
		fs.mkdirSync(path.join(this._root, 'projects'), { recursive: true });
		fs.mkdirSync(path.join(this._root, 'inbox'), { recursive: true });
	}

	private get _projectsDir() { return path.join(this._root, 'projects'); }
	private get _inboxDir() { return path.join(this._root, 'inbox'); }

	// ===== Project operations =====

	getProjects(): ContainerEntity[] {
		if (!fs.existsSync(this._projectsDir)) return [];
		const entries = fs.readdirSync(this._projectsDir, { withFileTypes: true });
		const order = this._readProjectOrder();
		const projects: ContainerEntity[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const metaPath = path.join(this._projectsDir, entry.name, 'project.meta.yml');
			if (!fs.existsSync(metaPath)) continue;
			const meta = readYaml(metaPath);
			projects.push({
				id: entry.name,
				name: (meta.name as string) || entry.name,
				type: 'project',
				createdAt: (meta.createdAt as number) || 0,
			});
		}
		projects.sort((a, b) => {
			const ai = order.indexOf(a.id);
			const bi = order.indexOf(b.id);
			if (ai !== -1 && bi !== -1) return ai - bi;
			if (ai !== -1) return -1;
			if (bi !== -1) return 1;
			return (b.createdAt || 0) - (a.createdAt || 0);
		});
		return projects;
	}

	getProject(projectId: string): ContainerEntity | undefined {
		const metaPath = path.join(this._projectsDir, projectId, 'project.meta.yml');
		if (!fs.existsSync(metaPath)) return undefined;
		const meta = readYaml(metaPath);
		return { id: projectId, name: (meta.name as string) || projectId, type: 'project', createdAt: (meta.createdAt as number) || 0 };
	}

	addProject(name: string): ContainerEntity | null {
		const projects = this.getProjects();
		if (projects.some(p => p.name === name)) return null;
		const id = `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		const projectDir = path.join(this._projectsDir, id);
		fs.mkdirSync(projectDir, { recursive: true });
		fs.mkdirSync(path.join(projectDir, 'tasks'), { recursive: true });
		fs.mkdirSync(path.join(projectDir, 'task-groups'), { recursive: true });
		writeYaml(path.join(projectDir, 'project.meta.yml'), { name, createdAt: Date.now() });
		this._invalidateCaches();
		return { id, name, type: 'project', createdAt: Date.now() };
	}

	updateProject(projectId: string, updates: Partial<Pick<ContainerEntity, 'name'>>): boolean {
		const metaPath = path.join(this._projectsDir, projectId, 'project.meta.yml');
		if (!fs.existsSync(metaPath)) return false;
		if (updates.name) {
			const projects = this.getProjects();
			if (projects.some(p => p.name === updates.name && p.id !== projectId)) return false;
		}
		const meta = readYaml(metaPath);
		if (updates.name) (meta as any).name = updates.name;
		writeYaml(metaPath, meta);
		this._invalidateCaches();
		return true;
	}

	deleteProject(projectId: string): void {
		const projectDir = path.join(this._projectsDir, projectId);
		if (fs.existsSync(projectDir)) {
			fs.rmSync(projectDir, { recursive: true, force: true });
		}
		this._removeFromProjectOrder(projectId);
		this._invalidateCaches();
	}

	// ===== Group operations =====

	getGroups(projectId: string): ContainerEntity[] {
		const groupsDir = path.join(this._projectsDir, projectId, 'task-groups');
		if (!fs.existsSync(groupsDir)) return [];
		const entries = fs.readdirSync(groupsDir, { withFileTypes: true });
		const result: ContainerEntity[] = [];
		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			const metaPath = path.join(groupsDir, entry.name, 'group.meta.yml');
			if (!fs.existsSync(metaPath)) continue;
			const meta = readYaml(metaPath);
			result.push({
				id: entry.name,
				name: (meta.name as string) || entry.name,
				type: 'group',
				parentId: projectId,
				createdAt: (meta.createdAt as number) || 0,
			});
		}
		return result;
	}

	addGroup(projectId: string, name: string): ContainerEntity | null {
		const existing = this.getGroups(projectId);
		if (existing.some(g => g.name === name)) return null;
		const id = `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		const groupDir = path.join(this._projectsDir, projectId, 'task-groups', id);
		fs.mkdirSync(groupDir, { recursive: true });
		fs.mkdirSync(path.join(groupDir, 'tasks'), { recursive: true });
		writeYaml(path.join(groupDir, 'group.meta.yml'), { name, createdAt: Date.now() });
		this._invalidateCaches();
		return { id, name, type: 'group', parentId: projectId, createdAt: Date.now() };
	}

	updateGroup(projectId: string, groupId: string, updates: Partial<Pick<ContainerEntity, 'name'>>): boolean {
		const metaPath = path.join(this._projectsDir, projectId, 'task-groups', groupId, 'group.meta.yml');
		if (!fs.existsSync(metaPath)) return false;
		if (updates.name) {
			const groups = this.getGroups(projectId);
			if (groups.some(g => g.name === updates.name && g.id !== groupId)) return false;
		}
		const meta = readYaml(metaPath);
		if (updates.name) (meta as any).name = updates.name;
		writeYaml(metaPath, meta);
		this._invalidateCaches();
		return true;
	}

	deleteGroup(projectId: string, groupId: string): void {
		const groupDir = path.join(this._projectsDir, projectId, 'task-groups', groupId);
		if (fs.existsSync(groupDir)) {
			fs.rmSync(groupDir, { recursive: true, force: true });
		}
		this._invalidateCaches();
	}

	// ===== Task operations =====

	getAllTasks(): Task[] {
		if (this._taskCache) return this._taskCache;
		const tasks: Task[] = [];

		// inbox tasks
		if (fs.existsSync(this._inboxDir)) {
			const inboxOrder = this._readInboxOrder();
			const inboxMap = new Map<string, Task>();
			for (const entry of fs.readdirSync(this._inboxDir, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const task = this._readTask(entry.name, this._inboxDir);
				if (task) inboxMap.set(entry.name, task);
			}
			// apply order file; any task not in order goes to the end
			const ordered: Task[] = [];
			const seen = new Set<string>();
			for (const id of inboxOrder) {
				const t = inboxMap.get(id);
				if (t) { ordered.push(t); seen.add(id); }
			}
			for (const [id, t] of inboxMap) {
				if (!seen.has(id)) ordered.push(t);
			}
			tasks.push(...ordered);
		}

		// project tasks
		if (fs.existsSync(this._projectsDir)) {
			for (const projEntry of fs.readdirSync(this._projectsDir, { withFileTypes: true })) {
				if (!projEntry.isDirectory()) continue;
				const projectId = projEntry.name;
				// direct tasks
				const directTasksDir = path.join(this._projectsDir, projectId, 'tasks');
				if (fs.existsSync(directTasksDir)) {
					for (const tEntry of fs.readdirSync(directTasksDir, { withFileTypes: true })) {
						if (!tEntry.isDirectory()) continue;
						const task = this._readTask(tEntry.name, directTasksDir);
						if (task) { task.containerId = projectId; tasks.push(task); }
					}
				}
				// grouped tasks
				const groupsDir = path.join(this._projectsDir, projectId, 'task-groups');
				if (fs.existsSync(groupsDir)) {
					for (const gEntry of fs.readdirSync(groupsDir, { withFileTypes: true })) {
						if (!gEntry.isDirectory()) continue;
						const groupId = gEntry.name;
						const groupTasksDir = path.join(groupsDir, groupId, 'tasks');
						if (fs.existsSync(groupTasksDir)) {
							for (const tEntry of fs.readdirSync(groupTasksDir, { withFileTypes: true })) {
								if (!tEntry.isDirectory()) continue;
								const task = this._readTask(tEntry.name, groupTasksDir);
								if (task) { task.containerId = groupId; tasks.push(task); }
							}
						}
					}
				}
			}
		}

		this._taskCache = tasks;
		return tasks;
	}

	getTask(taskId: string): Task | undefined {
		return this.getAllTasks().find(t => t.id === taskId);
	}

	getProjectTasks(projectId: string): Task[] {
		const tasks: Task[] = [];
		const directTasksDir = path.join(this._projectsDir, projectId, 'tasks');
		if (fs.existsSync(directTasksDir)) {
			for (const entry of fs.readdirSync(directTasksDir, { withFileTypes: true })) {
				if (!entry.isDirectory()) continue;
				const task = this._readTask(entry.name, directTasksDir);
				if (task) { task.containerId = projectId; tasks.push(task); }
			}
		}
		const groupsDir = path.join(this._projectsDir, projectId, 'task-groups');
		if (fs.existsSync(groupsDir)) {
			for (const gEntry of fs.readdirSync(groupsDir, { withFileTypes: true })) {
				if (!gEntry.isDirectory()) continue;
				const groupId = gEntry.name;
				const groupTasksDir = path.join(groupsDir, groupId, 'tasks');
				if (fs.existsSync(groupTasksDir)) {
					for (const tEntry of fs.readdirSync(groupTasksDir, { withFileTypes: true })) {
						if (!tEntry.isDirectory()) continue;
						const task = this._readTask(tEntry.name, groupTasksDir);
						if (task) { task.containerId = groupId; tasks.push(task); }
					}
				}
			}
		}
		return tasks;
	}

	addTask(task: Task): void {
		const taskDir = this._taskDir(task);
		fs.mkdirSync(taskDir, { recursive: true });
		this._writeTaskMeta(task);
		if (!task.containerId) {
			this._prependToOrder(task.id);
		}
		this._taskCache = null;
	}

	updateTask(taskId: string, updates: Partial<Task>): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const merged = { ...task, ...updates };
		this._writeTaskMeta(merged);
		this._taskCache = null;
	}

	deleteTask(taskId: string): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const taskDir = this._taskDir(task);
		if (fs.existsSync(taskDir)) {
			fs.rmSync(taskDir, { recursive: true, force: true });
		}
		this._taskCache = null;
	}

	moveTaskToContainer(taskId: string, containerId: string | undefined): void {
		const task = this.getTask(taskId);
		if (!task || task.containerId === containerId) return;
		const oldDir = this._taskDir(task);
		const newTask = { ...task, containerId };
		const newDir = this._taskDir(newTask);

		fs.mkdirSync(path.dirname(newDir), { recursive: true });
		if (fs.existsSync(oldDir)) {
			this._copyDir(oldDir, newDir);
			fs.rmSync(oldDir, { recursive: true, force: true });
		} else {
			fs.mkdirSync(newDir, { recursive: true });
			this._writeTaskMeta(newTask);
		}
		this._taskCache = null;
	}

	// ===== Message operations =====

	getMessages(taskId: string): ChatMessage[] {
		const task = this.getTask(taskId);
		if (!task) return [];
		const contentPath = path.join(this._taskDir(task), 'content.json');
		if (!fs.existsSync(contentPath)) return [];
		try {
			return JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
		} catch {
			return [];
		}
	}

	addMessage(msg: ChatMessage): void {
		const task = this.getTask(msg.taskId);
		if (!task) return;
		const contentPath = path.join(this._taskDir(task), 'content.json');
		const messages = this.getMessages(msg.taskId);
		messages.push(msg);
		fs.writeFileSync(contentPath, JSON.stringify(messages, null, 2), 'utf-8');
		taskLogStore.appendMessage(msg.taskId, {
			id: msg.id,
			role: msg.role,
			type: msg.type,
			content: msg.content,
			timestamp: msg.timestamp,
		});
	}

	setMessages(taskId: string, messages: ChatMessage[]): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const contentPath = path.join(this._taskDir(task), 'content.json');
		fs.writeFileSync(contentPath, JSON.stringify(messages, null, 2), 'utf-8');
	}

	// ===== Review changes =====

	getReviewChanges(taskId: string): FileChange[] {
		const task = this.getTask(taskId);
		if (!task) return [];
		const reviewPath = path.join(this._taskDir(task), 'review_changes.json');
		if (!fs.existsSync(reviewPath)) return [];
		try { return JSON.parse(fs.readFileSync(reviewPath, 'utf-8')); } catch { return []; }
	}

	storeReviewChanges(taskId: string, changes: FileChange[]): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const reviewPath = path.join(this._taskDir(task), 'review_changes.json');
		fs.writeFileSync(reviewPath, JSON.stringify(changes, null, 2), 'utf-8');
		const now = Date.now();
		for (const change of changes) {
			const operation = !change.original ? 'added' : !change.modified ? 'deleted' : 'modified' as const;
			taskLogStore.appendFile(taskId, {
				id: `fl_${taskId}_${now}_${Math.random().toString(36).slice(2, 6)}`,
				filePath: change.filePath,
				operation,
				original: change.original,
				modified: change.modified,
				timestamp: now,
			});
		}
	}

	clearReviewChanges(taskId: string): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const reviewPath = path.join(this._taskDir(task), 'review_changes.json');
		try { fs.unlinkSync(reviewPath); } catch { /* ignore */ }
	}

	// ===== Timeline =====

	getTaskTimeline(taskId: string): TimelineEntry[] {
		const task = this.getTask(taskId);
		if (!task) return [];
		const path_ = path.join(this._taskDir(task), 'timeline.json');
		if (!fs.existsSync(path_)) return [];
		try { return JSON.parse(fs.readFileSync(path_, 'utf-8')); } catch { return []; }
	}

	addTimelineEntry(taskId: string, entry: TimelineEntry): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const path_ = path.join(this._taskDir(task), 'timeline.json');
		const entries = this.getTaskTimeline(taskId);
		entries.push(entry);
		fs.writeFileSync(path_, JSON.stringify(entries, null, 2), 'utf-8');
	}

	// ===== Wiki / Export =====

	getWikiDir(): string {
		const workspaceRoot = process.env['VSCODE_CWD'] || process.cwd();
		return path.join(workspaceRoot, '.kcode', 'wiki');
	}

	// ===== Tool Groups =====

	getTaskToolGroups(taskId: string): ToolGroup[] {
		const task = this.getTask(taskId);
		if (!task) return [];
		const path_ = path.join(this._taskDir(task), 'tool_groups.json');
		if (!fs.existsSync(path_)) return [];
		try { return JSON.parse(fs.readFileSync(path_, 'utf-8')); } catch { return []; }
	}

	addToolGroup(taskId: string, group: ToolGroup): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const path_ = path.join(this._taskDir(task), 'tool_groups.json');
		const groups = this.getTaskToolGroups(taskId);
		groups.push(group);
		fs.writeFileSync(path_, JSON.stringify(groups, null, 2), 'utf-8');
	}

	updateToolGroup(taskId: string, groupId: string, item: ToolItem): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const path_ = path.join(this._taskDir(task), 'tool_groups.json');
		const groups = this.getTaskToolGroups(taskId);
		const group = groups.find(g => g.id === groupId);
		if (group) {
			const existing = group.items.find(i => i.id === item.id);
			if (existing) Object.assign(existing, item);
			else group.items.push(item);
			fs.writeFileSync(path_, JSON.stringify(groups, null, 2), 'utf-8');
		}
	}

	// ===== Knowledge Entries =====

	getTaskKnowledgeEntries(taskId: string): KnowledgeEntry[] {
		const task = this.getTask(taskId);
		if (!task) return [];
		const path_ = path.join(this._taskDir(task), 'knowledge.json');
		if (!fs.existsSync(path_)) return [];
		try { return JSON.parse(fs.readFileSync(path_, 'utf-8')); } catch { return []; }
	}

	addKnowledgeEntry(taskId: string, entry: KnowledgeEntry): void {
		const task = this.getTask(taskId);
		if (!task) return;
		const path_ = path.join(this._taskDir(task), 'knowledge.json');
		const entries = this.getTaskKnowledgeEntries(taskId);
		entries.push(entry);
		fs.writeFileSync(path_, JSON.stringify(entries, null, 2), 'utf-8');
	}

	getAllKnowledgeEntries(): KnowledgeEntry[] {
		const all: KnowledgeEntry[] = [];
		const tasks = this.getAllTasks();
		for (const task of tasks) {
			const entries = this.getTaskKnowledgeEntries(task.id);
			all.push(...entries);
		}
		all.sort((a, b) => b.createdAt - a.createdAt);
		return all;
	}

	// ===== Assistant messages =====

	private get _assistantMessagesPath(): string {
		const name = this._workspaceId
			? `assistant_messages_${this._workspaceId}.json`
			: 'assistant_messages.json';
		return path.join(this._root, name);
	}

	getAssistantMessages(): AssistantMessage[] {
		const amsgPath = this._assistantMessagesPath;
		if (!fs.existsSync(amsgPath)) return [];
		try { return JSON.parse(fs.readFileSync(amsgPath, 'utf-8')); } catch { return []; }
	}

	addAssistantMessage(msg: AssistantMessage): void {
		const amsgPath = this._assistantMessagesPath;
		const messages = this.getAssistantMessages();
		messages.push(msg);
		if (messages.length > 200) messages.splice(0, messages.length - 200);
		fs.writeFileSync(amsgPath, JSON.stringify(messages, null, 2), 'utf-8');
	}

	setAssistantMessages(msgs: AssistantMessage[]): void {
		fs.writeFileSync(this._assistantMessagesPath, JSON.stringify(msgs, null, 2), 'utf-8');
	}

	// ===== Assistant session =====

	private get _assistantSessionPath(): string {
		const name = this._workspaceId
			? `assistant_session_${this._workspaceId}.json`
			: 'assistant_session.json';
		return path.join(this._root, name);
	}

	getAssistantSessionId(): string | undefined {
		const p = this._assistantSessionPath;
		if (!fs.existsSync(p)) return undefined;
		try { return JSON.parse(fs.readFileSync(p, 'utf-8')).sessionId; } catch { return undefined; }
	}

	setAssistantSessionId(sessionId: string): void {
		fs.writeFileSync(this._assistantSessionPath, JSON.stringify({ sessionId }, null, 2), 'utf-8');
	}

	// ===== Container operations (aggregate) =====

	getAllContainers(): ContainerEntity[] {
		if (this._containerCache) return this._containerCache;
		const containers: ContainerEntity[] = [];
		const projects = this.getProjects();
		for (const p of projects) {
			containers.push(p);
			const groups = this.getGroups(p.id);
			containers.push(...groups);
		}
		this._containerCache = containers;
		return containers;
	}

	getContainer(id: string): ContainerEntity | undefined {
		return this.getAllContainers().find(c => c.id === id);
	}

	getContainerByName(name: string): ContainerEntity | undefined {
		return this.getAllContainers().find(c => c.name === name);
	}

	// ===== Project ordering =====

	moveContainer(id: string, direction: 'up' | 'down'): void {
		const order = this._readProjectOrder();
		// only projects have order
		const idx = order.indexOf(id);
		if (idx === -1) return;
		if (direction === 'up' && idx > 0) {
			[order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
		} else if (direction === 'down' && idx < order.length - 1) {
			[order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
		} else {
			return;
		}
		this._writeProjectOrder(order);
	}

	getOrderedProjectIds(): string[] {
		return this._readProjectOrder();
	}

	ensureInOrder(projectId: string): void {
		const order = this._readProjectOrder();
		if (!order.includes(projectId)) {
			order.push(projectId);
			this._writeProjectOrder(order);
		}
	}

	// ===== Message counter =====

	getNextMessageId(taskId: string): number {
		const messages = this.getMessages(taskId);
		const count = messages.length;
		const task = this.getTask(taskId);
		if (!task) return count + 1;
		const counterPath = path.join(this._taskDir(task), '_counter');
		let stored = count;
		if (fs.existsSync(counterPath)) {
			stored = Math.max(stored, parseInt(fs.readFileSync(counterPath, 'utf-8'), 10) || 0);
		}
		const next = stored + 1;
		fs.writeFileSync(counterPath, String(next), 'utf-8');
		return next;
	}

	// ===== Internal helpers =====

	private _taskDir(task: Pick<Task, 'id' | 'containerId'>): string {
		if (!task.containerId) {
			return path.join(this._inboxDir, task.id);
		}
		const project = this.getProject(task.containerId);
		if (project) {
			return path.join(this._projectsDir, task.containerId, 'tasks', task.id);
		}
		const group = this.getContainer(task.containerId);
		if (group && group.parentId) {
			return path.join(this._projectsDir, group.parentId, 'task-groups', group.id, 'tasks', task.id);
		}
		return path.join(this._inboxDir, task.id);
	}

	private _readTask(taskId: string, parentDir: string): Task | undefined {
		const taskDir = path.join(parentDir, taskId);
		const metaPath = path.join(taskDir, 'meta.yml');
		if (!fs.existsSync(metaPath)) return undefined;
		const meta = readYaml(metaPath);
		return {
			id: taskId,
			title: (meta.title as string) || '',
			goal: (meta.goal as string) || '',
			type: (meta.type as 'task') || 'task',
			status: (meta.status as Task['status']) || 'pending',
			phase: (meta.phase as Task['phase']) || 'demand',
			confirmedItems: (meta.confirmedItems as string[]) || [],
			pendingItems: (meta.pendingItems as string[]) || [],
			planSteps: (meta.planSteps as Task['planSteps']) || [],
			createdAt: (meta.createdAt as number) || 0,
			workspace: (meta.workspace as string) || undefined,
			pinned: (meta.pinned as boolean) || false,
			archived: (meta.archived as boolean) || false,
			category: (meta.category as Task['category']) || undefined,
			subType: (meta.subType as string) || undefined,
			nodeMessageIds: (meta.nodeMessageIds as Record<string, string>) || undefined,
			hooks: (meta.hooks as Record<string, string[]>) || undefined,
            source: (meta.source as Task['source']) || undefined,
            sessionId: (meta.sessionId as string) || undefined,
        };
	}

	private _writeTaskMeta(task: Task): void {
		const taskDir = this._taskDir(task);
		fs.mkdirSync(taskDir, { recursive: true });
		const meta: Record<string, unknown> = {
			title: task.title,
			goal: task.goal,
			type: task.type,
			status: task.status,
			phase: task.phase,
			createdAt: task.createdAt,
			pinned: task.pinned || false,
			archived: task.archived || false,
		};
		if (task.workspace) meta.workspace = task.workspace;
		if (task.category) meta.category = task.category;
		if (task.subType) meta.subType = task.subType;
		if (task.confirmedItems.length) meta.confirmedItems = task.confirmedItems;
		if (task.pendingItems.length) meta.pendingItems = task.pendingItems;
		if (task.planSteps.length) meta.planSteps = task.planSteps;
		if (task.nodeMessageIds && Object.keys(task.nodeMessageIds).length) meta.nodeMessageIds = task.nodeMessageIds;
		if (task.hooks && Object.keys(task.hooks).length) meta.hooks = task.hooks;
		if (task.source) meta.source = task.source;
        if (task.containerId) meta.containerId = task.containerId;
        if (task.sessionId) meta.sessionId = task.sessionId;
		writeYaml(path.join(taskDir, 'meta.yml'), meta);
	}

	private _readProjectOrder(): string[] {
		const orderPath = path.join(this._root, 'projects_order.json');
		try { return JSON.parse(fs.readFileSync(orderPath, 'utf-8')); } catch { return []; }
	}

	private _writeProjectOrder(order: string[]): void {
		fs.writeFileSync(path.join(this._root, 'projects_order.json'), JSON.stringify(order, null, 2), 'utf-8');
	}

	private _removeFromProjectOrder(projectId: string): void {
		const order = this._readProjectOrder().filter(id => id !== projectId);
		this._writeProjectOrder(order);
	}

	private _inboxOrderPath(): string {
		return path.join(this._inboxDir, '_order.json');
	}

	private _readInboxOrder(): string[] {
		try { return JSON.parse(fs.readFileSync(this._inboxOrderPath(), 'utf-8')); } catch { return []; }
	}

	private _writeInboxOrder(order: string[]): void {
		fs.writeFileSync(this._inboxOrderPath(), JSON.stringify(order, null, 2), 'utf-8');
	}

	private _prependToOrder(taskId: string): void {
		const order = this._readInboxOrder();
		const filtered = order.filter(id => id !== taskId);
		filtered.unshift(taskId);
		this._writeInboxOrder(filtered);
	}

	reorderTasks(taskId: string, targetTaskId: string, position: 'before' | 'after'): void {
		const order = this._readInboxOrder();
		const filtered = order.filter((id: string) => id !== taskId);
		const insertAt = filtered.indexOf(targetTaskId) + (position === 'after' ? 1 : 0);
		filtered.splice(insertAt < 0 ? filtered.length : insertAt, 0, taskId);
		this._writeInboxOrder(filtered);
		this._invalidateCaches();
	}

	private _copyDir(src: string, dest: string): void {
		fs.mkdirSync(dest, { recursive: true });
		for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);
			if (entry.isDirectory()) {
				this._copyDir(srcPath, destPath);
			} else {
				fs.copyFileSync(srcPath, destPath);
			}
		}
	}

	private _invalidateCaches(): void {
		this._taskCache = null;
		this._containerCache = null;
	}
}

// ---- YAML helpers ----

function readYaml(filePath: string): Record<string, unknown> {
	if (!fs.existsSync(filePath)) return {};
	const content = fs.readFileSync(filePath, 'utf-8');
	const result: Record<string, unknown> = {};
	for (const line of content.split('\n')) {
		const idx = line.indexOf(': ');
		if (idx === -1) continue;
		const key = line.slice(0, idx).trim();
		const value = line.slice(idx + 2).trim();
		if (value === 'true') { result[key] = true; }
		else if (value === 'false') { result[key] = false; }
		else if (value === 'null' || value === '') { result[key] = null; }
		else if (/^-?\d+$/.test(value)) { result[key] = parseInt(value, 10); }
		else if (/^-?\d+(\.\d+)?$/.test(value)) { result[key] = parseFloat(value); }
		else if ((value.startsWith('[') || value.startsWith('{')) && (value.endsWith(']') || value.endsWith('}'))) {
			try { result[key] = JSON.parse(value); } catch { result[key] = value; }
		}
		else { result[key] = value; }
	}
	return result;
}

function writeYaml(filePath: string, data: Record<string, unknown>): void {
	const lines: string[] = [];
	for (const [key, value] of Object.entries(data)) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'object') {
			lines.push(`${key}: ${JSON.stringify(value)}`);
		} else if (typeof value === 'boolean') {
			lines.push(`${key}: ${value}`);
		} else {
			lines.push(`${key}: ${value}`);
		}
	}
	fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
}
