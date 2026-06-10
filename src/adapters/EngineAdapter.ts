/**
 * EngineAdapter — Bridge 命令 → kcode 后端服务
 *
 * Webview desktop-cc-gui 组件调用的 Tauri invoke 命令映射到 kcode 服务：
 *   engine/status          → AgentService.isConnected / agentName / modelName
 *   engine/sendMessage     → AgentService.sendPrompt()
 *   threads/list           → TaskStore.getTasks()
 *   knowledge/list         → TaskStore.getAllKnowledgeEntries()
 *   knowledge/save         → TaskStore.addKnowledgeEntry()
 */

import type { AgentService } from '../core/AgentService';
import type { TaskStore } from '../store/TaskStore';
import type { WebviewBridge } from './WebviewBridge';

const CHAT_TASK_ID = '__webview_chat__';

export class EngineAdapter {
  constructor(
    private _bridge: WebviewBridge,
    private _agentService: AgentService,
    private _taskStore: TaskStore,
  ) {}

  registerAll() {
    // ── Engine ──
    this._bridge.registerHandler('engine/status', () => ({
      connected: this._agentService.isConnected,
      agentName: this._agentService.agentName,
      modelName: this._agentService.modelName,
    }));

    this._bridge.registerHandler('engine/sendMessage', async (params: unknown) => {
      const { text } = (params || {}) as { text?: string };
      if (!text) throw new Error('text is required');

      await this._agentService.sendPrompt(CHAT_TASK_ID, text, {
        onText: (chunk: string) => this._bridge.emit('stream:chunk', { text: chunk, turnId: CHAT_TASK_ID }),
        onError: (error: string) => this._bridge.emit('stream:error', { error }),
        onDone: () => this._bridge.emit('stream:done', {}),
      });
    });

    this._bridge.registerHandler('engine/disconnect', async () => {
      await this._agentService.disconnect();
    });

    // ── Threads (Task → Thread mapping) ──
    this._bridge.registerHandler('threads/list', () => {
      return this._taskStore.getTasks().map((t: any) => ({
        id: t.id,
        title: t.title || 'Untitled',
        preview: (t.description || '').slice(0, 100),
        createdAt: t.createdAt ?? Date.now(),
        updatedAt: t.updatedAt ?? Date.now(),
      }));
    });

    this._bridge.registerHandler('threads/get', (params: unknown) => {
      const { id } = (params || {}) as { id?: string };
      return id ? this._taskStore.getTask(id) ?? null : null;
    });

    // ── TaskFlow / Kanban ──
    this._bridge.registerHandler('taskflow/list', () => {
      return this._taskStore.getTasks().map((t: any) => ({
        id: t.id,
        title: t.title || 'Untitled',
        description: t.description || '',
        phase: t.phase || 'goal',
        createdAt: t.createdAt ?? Date.now(),
      }));
    });

    this._bridge.registerHandler('taskflow/create', async (params: unknown) => {
      const { title } = (params || {}) as { title?: string };
      const task: any = {
        id: `task_${Date.now()}`,
        title: title || 'New Task',
        goal: '',
        type: 'task',
        status: 'pending' as const,
        phase: 'goal' as const,
        confirmedItems: [],
        pendingItems: [],
        planSteps: [],
        originalRequest: '',
        createdAt: Date.now(),
        workspace: '',
      };
      this._taskStore.addTask(task);
      const all = this._taskStore.getTasks().map((t: any) => ({
        id: t.id, title: t.title || 'Untitled', description: t.description || '',
        phase: t.phase || 'goal', createdAt: t.createdAt ?? Date.now(),
      }));
      this._bridge.emit('taskflow:updated', { tasks: all });
      return task;
    });

    this._bridge.registerHandler('taskflow/updatePhase', async (params: unknown) => {
      const { taskId, phase } = (params || {}) as { taskId?: string; phase?: string };
      if (!taskId || !phase) return;
      this._taskStore.updateTaskPhase(taskId, phase as any);
      const all = this._taskStore.getTasks().map((t: any) => ({
        id: t.id, title: t.title || 'Untitled', description: t.description || '',
        phase: (t as any).phase || 'goal', createdAt: t.createdAt ?? Date.now(),
      }));
      this._bridge.emit('taskflow:updated', { tasks: all });
    });

    // ── Knowledge ──
    this._bridge.registerHandler('knowledge/list', () => {
      return this._taskStore.getAllKnowledgeEntries().map((e: any) => ({
        id: e.id,
        title: e.title,
        content: e.content,
        tags: e.tags || [],
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
    });

    this._bridge.registerHandler('knowledge/save', async (params: unknown) => {
      const entry = params as any;
      const now = Date.now();
      if (!entry.id) {
        entry.id = `ke_${now}`;
        entry.createdAt = now;
      }
      entry.updatedAt = now;
      this._taskStore.addKnowledgeEntry(entry.taskId || CHAT_TASK_ID, entry);
      const entries = this._taskStore.getAllKnowledgeEntries();
      this._bridge.emit('knowledge:updated', { entries });
      return entry;
    });

    // ── Plugin opener stubs ──
    this._bridge.registerHandler('__openPath', async (params: unknown) => {
      const { path } = (params || {}) as { path?: string };
      if (path) {
        const vscode = await import('vscode');
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path));
      }
    });

    this._bridge.registerHandler('__openUrl', async (params: unknown) => {
      const { url } = (params || {}) as { url?: string };
      if (url) {
        const vscode = await import('vscode');
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
      }
    });
  }
}
