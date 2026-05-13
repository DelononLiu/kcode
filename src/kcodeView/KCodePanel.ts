import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { TaskFlow } from '../taskflow/TaskFlow';
import { AgentService } from '../core/AgentService';
import { getCategories, getTemplate, getCategory } from '../taskflow/templates';
import { parseWorkspaceHooks } from '../taskflow/workspaceHooks';
import { getWebviewContent as getTemplateHtml } from './templates/chatPanelHtml';
import { MessageRouter } from './MessageRouter';
import { TaskSessionHandler } from './TaskSessionHandler';
import { TaskFlowHandler } from './TaskFlowHandler';
import type { KCodePanelContext, ToolCallState, PendingMessage } from './PanelContext';
import type { AcpMessageHandler, Task } from '../types';

export class KCodePanel {
    readonly panel: vscode.WebviewPanel;
    readonly store: TaskStore;
    readonly taskFlow: TaskFlow;
    readonly agentService: AgentService;
    readonly router: MessageRouter;
    readonly sessionHandler: TaskSessionHandler;
    readonly flowHandler: TaskFlowHandler;

    currentTaskId: string | null = null;
    activeToolCalls: Map<string, ToolCallState> = new Map();
    isGenerating: boolean = false;
    pendingMessages: PendingMessage[] = [];
    hasSetPlanMessage: boolean = false;
    hasSetExecuteMessage: boolean = false;
    refreshSidebarCallback?: () => void;

    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;
    private acpLogEnabled = false;
    private acpRecvBuffer = '';
    private recvFlushTimer: any = null;

    constructor(context: vscode.ExtensionContext, store: TaskStore) {
        this.context = context;
        this.store = store;

        this.taskFlow = new TaskFlow(store, {
            onPhaseChanged: (taskId) => { this.sendTaskInfo(taskId); this.sendNodePanelUpdate(taskId); this.refreshSidebarCallback?.(); },
            onExecuteFinished: (taskId) => { this.sendTaskInfo(taskId); },
            onGoalFormatted: (taskId, goalText, originalRequest) => { this.router.PostMessage({ type: 'showGoalConfirmation', goal: goalText, originalRequest, taskId }); },
            onError: (taskId, error) => { this.flowHandler.showAgentError(taskId, error); },
            onSelfVerifyNeeded: (taskId) => { setTimeout(() => this.sessionHandler.startAutoGeneration(taskId), 100); },
            onSelfVerifyFinished: (taskId) => { this.sendTaskInfo(taskId); },
            onPlanStepUpdate: (taskId) => { this.sendTaskInfo(taskId); },
            onTaskDelegated: (taskId, payload) => { this.handleTaskDelegated(taskId, payload); },
        });

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        this.agentService = new AgentService(workspacePath);
        this.agentService.setLogCallback((dir, text) => { const t = this.currentTaskId || ''; if (t) this.sendAcpLog(t, dir, text); });

        this.panel = vscode.window.createWebviewPanel('kcode', 'KCode', vscode.ViewColumn.One, {
            enableScripts: true, retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'out'),
                vscode.Uri.joinPath(context.extensionUri, 'src', 'kcodeView', 'webview')
            ]
        });

        this.panel.webview.html = this.getWebviewContent();
        this.router = new MessageRouter();
        this.router.PostMessage = (msg) => this.panel.webview.postMessage(msg);

        const ctx: KCodePanelContext = {
            store: this.store, taskFlow: this.taskFlow, agentService: this.agentService, router: this.router,
            currentTaskId: this.currentTaskId, activeToolCalls: this.activeToolCalls,
            isGenerating: this.isGenerating, pendingMessages: this.pendingMessages,
            hasSetPlanMessage: this.hasSetPlanMessage, hasSetExecuteMessage: this.hasSetExecuteMessage,
            refreshSidebarCallback: this.refreshSidebarCallback,
            setGenerationState: (b) => this.setGenerationState(b),
            sendPendingQueueUpdate: () => this.sendPendingQueueUpdate(),
            sendAcpLog: (t, d, tx) => this.sendAcpLog(t, d, tx),
            flushAcpRecvBuffer: () => this.flushAcpRecvBuffer(),
            storeMessage: (t, r, c) => this.storeMessage(t, r, c),
            sendTaskInfo: (t) => this.sendTaskInfo(t),
            sendNodePanelUpdate: (t) => this.sendNodePanelUpdate(t),
            sendHooksAsMessage: (t, p) => this.sendHooksAsMessage(t, p),
            triggerReviewRequest: (t, c) => this.flowHandler.triggerReviewRequest(t, c),
            showPlanConfirmation: (t) => this.flowHandler.showPlanConfirmation(t),
            showAgentError: (t, e) => this.flowHandler.showAgentError(t, e),
            sendAgentPrompt: async (tid, promptText, isGoalFormatting, originalText) => {
                const handler = this.sessionHandler.createAgentResponseHandler(tid, isGoalFormatting, originalText);
                await this.sessionHandler.doPrompt(tid, promptText, handler);
            },
            startAutoGeneration: (tid) => this.sessionHandler.startAutoGeneration(tid),
        };

        this.sessionHandler = new TaskSessionHandler(ctx);
        this.flowHandler = new TaskFlowHandler(ctx);

        this.setupMessageHandler();

        const config = vscode.workspace.getConfiguration('kcode');
        this.acpLogEnabled = config.get<boolean>('acpLogEnabled', false);
        this.router.PostMessage({ type: 'acpLogState', enabled: this.acpLogEnabled, maxGlobal: config.get<number>('acpLogMaxGlobal', 5000), maxTask: config.get<number>('acpLogMaxTask', 2000) });
        this.router.PostMessage({ type: 'updateCategoryDefs', categories: getCategories() });

        this.sessionHandler.ensureConnection();

        this.loadWorkspaceHooks().then(hooks => this.taskFlow.setWorkspaceHooks(hooks));

        this.panel.onDidDispose(() => { this.onDisposeCallback?.(); });
    }

    private setupMessageHandler() {
        this.router.on('sendMessage', async (msg) => this.sessionHandler.handleSendMessage(msg.text, msg.taskId, msg.category, msg.subType));
        this.router.on('confirmGoal', async (msg) => this.flowHandler.handleConfirmGoal(msg.taskId, msg.originalRequest));
        this.router.on('reviseGoal', (msg) => this.flowHandler.handleReviseGoal(msg.taskId));
        this.router.on('cancelTask', (msg) => this.flowHandler.handleCancelTask(msg.taskId));
        this.router.on('approveReview', (msg) => this.flowHandler.handleApproveReview(msg.taskId));
        this.router.on('rejectReview', (msg) => this.flowHandler.handleRejectReview(msg.taskId, msg.reason));
        this.router.on('showFileDiff', (msg) => this.handleShowFileDiff(msg.original, msg.modified));
        this.router.on('stopGeneration', (msg) => this.flowHandler.handleStopGeneration(msg.taskId));
        this.router.on('openNativeDiff', (msg) => this.flowHandler.handleOpenNativeDiff(msg.original, msg.modified, msg.filePath));
        this.router.on('confirmGoalWithEdit', async (msg) => this.flowHandler.handleConfirmGoalWithEdit(msg.taskId, msg.goal, msg.originalRequest));
        this.router.on('confirmGoalFromHeader', async (msg) => this.flowHandler.handleConfirmGoalFromHeader(msg.taskId));
        this.router.on('confirmPlan', async (msg) => this.flowHandler.handleConfirmPlan(msg.taskId));
        this.router.on('rejectPlan', (msg) => this.flowHandler.handleRejectPlan(msg.taskId));
        this.router.on('confirmExecuteDone', async (msg) => this.flowHandler.handleConfirmExecuteDone(msg.taskId));
        this.router.on('partialApproveReview', (msg) => this.flowHandler.handlePartialApproveReview(msg.taskId, msg.passed, msg.failed));
        this.router.on('toggleAcpLog', (msg) => { this.acpLogEnabled = msg.enabled; vscode.workspace.getConfiguration('kcode').update('acpLogEnabled', msg.enabled, true); });
        this.router.on('newTask', () => vscode.commands.executeCommand('kcode.newTask'));
        this.router.on('openDashboard', () => this.router.PostMessage({ type: 'showDashboard', allTasks: this.store.getTasks().filter(t => !t.archived) }));
        this.router.on('cancelQueuedMessage', (msg) => { if (msg.index >= 0 && msg.index < this.pendingMessages.length) { this.pendingMessages.splice(msg.index, 1); this.sendPendingQueueUpdate(); } });
        this.router.on('clearPendingQueue', () => { this.pendingMessages = []; this.sendPendingQueueUpdate(); });
        this.router.on('openTerminal', () => vscode.commands.executeCommand('workbench.action.terminal.new'));
        this.router.on('convertToTask', (msg) => this.handleConvertToTask(msg.taskId));
        this.router.on('updateHooks', (msg) => { if (msg.phase && Array.isArray(msg.commands)) { this.store.updateTaskHooks(msg.taskId, msg.phase, msg.commands); this.sendTaskInfo(msg.taskId); } });
        this.router.on('selectTask', (msg) => { this.loadTask(msg.taskId); this.refreshSidebarCallback?.(); });

        this.panel.webview.onDidReceiveMessage((message: any) => { this.router.dispatch(message.type, message); }, null, this.context.subscriptions);
    }

    // === Task CRUD helpers ===

    private handleConvertToTask(taskId: string) {
        const chatTask = this.store.getTask(taskId);
        if (!chatTask || chatTask.type !== 'chat') return;
        const messages = this.store.getMessages(taskId);
        const firstUserMsg = messages.find(m => m.role === 'user');
        const newTask: Task = {
            id: `task_${Date.now()}`, title: firstUserMsg ? firstUserMsg.content.substring(0, 50).replace(/\n/g, ' ') : '从对话创建的任务',
            goal: '', type: 'task', status: 'pending', phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [], createdAt: Date.now(), pinned: false
        };
        this.store.addTask(newTask);
        const newId = newTask.id;
        for (const msg of messages) {
            this.store.addMessage({ id: this.store.nextMessageId(newId), taskId: newId, role: msg.role, content: msg.content, type: msg.type, timestamp: msg.timestamp });
        }
        this.loadTask(newId);
        this.refreshSidebarCallback?.();
    }

    private handleTaskDelegated(parentTaskId: string, payload: any) {
        const parentTask = this.store.getTask(parentTaskId);
        if (!parentTask) return;
        const fullGoal = payload.relevantSnippets ? `${payload.goal}\n\n技术上下文：${payload.relevantSnippets}` : payload.goal;
        const newTask: Task = {
            id: `task_${Date.now()}`, title: payload.title, goal: fullGoal, type: 'task', status: 'pending', phase: 'demand',
            confirmedItems: payload.confirmedItems || [], pendingItems: [], planSteps: [], createdAt: Date.now(),
            pinned: false, source: parentTask.source, containerId: parentTask.containerId, group: parentTask.group,
        };
        this.store.addTask(newTask);
        this.store.addMessage({ id: this.store.nextMessageId(parentTaskId), taskId: parentTaskId, role: 'agent', type: 'stop_message', content: `📤 已委派新任务「${payload.title}」`, timestamp: Date.now() });
        this.router.PostMessage({ type: 'addSystemMessage', content: `📤 已委派新任务「${payload.title}」`, taskId: parentTaskId });
        this.refreshSidebarCallback?.();
    }

    // === Task info display ===

    private sendTaskInfo(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.router.PostMessage({
            type: 'updateTaskInfo', title: task.title, goal: task.goal, goalHint: task.goal ? '🎯 ' + task.goal : '',
            status: task.status, phase: task.phase, phaseLabel: ({ demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收' } as Record<string, string>)[task.phase] || task.phase,
            taskType: task.type, createdAt: task.createdAt, pendingReviewFiles: 0,
            confirmedItems: task.confirmedItems, pendingItems: task.pendingItems, planSteps: task.planSteps,
            hooks: task.hooks || {}, workspaceHooks: this.taskFlow['workspaceHooks'] || {},
            messageCount: this.store.getMessages(taskId).length, executeFinished: this.taskFlow.isExecuteFinished(taskId)
        });
    }

    private sendNodePanelUpdate(taskId: string) {
        this.router.PostMessage({ type: 'updateNodePanel', nodes: this.flowHandler.deriveNodes(taskId), taskType: this.store.getTask(taskId)?.type || 'task' });
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.pendingMessages = [];
        this.taskFlow.loadTask(taskId);
        const task = this.store.getTask(taskId);
        this.hasSetPlanMessage = !!task?.nodeMessageIds?.plan;
        this.hasSetExecuteMessage = !!task?.nodeMessageIds?.execute;
        this.sendCategoryDefs();
        this.sendTaskMessages(taskId);
        this.sendTaskInfo(taskId);
        this.sendNodePanelUpdate(taskId);
        this.sessionHandler.ensureSession(taskId);
        this.loadWorkspaceHooks().then(hooks => this.taskFlow.setWorkspaceHooks(hooks));
    }

    private sendTaskMessages(taskId: string) {
        const messages = this.store.getMessages(taskId);
        const task = this.store.getTask(taskId);
        const reviewChanges = this.store.getReviewChanges(taskId);
        let acceptanceCriteria: string[] | undefined;
        if (task?.category && task?.subType && task?.status === 'in_review') {
            acceptanceCriteria = getTemplate(task.category, task.subType)?.acceptanceCriteria;
        } else if (task?.category && task?.status === 'in_review') {
            acceptanceCriteria = getCategory(task.category)?.acceptanceCriteria;
        }
        this.router.PostMessage({ type: 'loadMessages', messages, taskId, taskType: task?.type, taskStatus: task?.status, reviewChanges: reviewChanges.length > 0 ? reviewChanges : undefined, acceptanceCriteria });
    }

    autoSendGoal(taskId: string, text: string) { this.sessionHandler.handleSendMessage(text, taskId); }

    startTemplateFlow(taskId: string) {
        this.loadTask(taskId);
        this.router.PostMessage({ type: 'startTemplateFlow', taskId });
    }

    // === ACP logging + generation state ===

    private sendAcpLog(taskId: string, direction: 'send' | 'recv', text: string) {
        if (!this.acpLogEnabled) return;
        if (direction === 'recv') {
            this.acpRecvBuffer += text;
            const lines = this.acpRecvBuffer.split('\n');
            this.acpRecvBuffer = lines.pop() || '';
            for (const line of lines) this.router.PostMessage({ type: 'acpLogEntry', direction, text: line, timestamp: Date.now(), taskId });
            clearTimeout(this.recvFlushTimer);
            this.recvFlushTimer = setTimeout(() => { if (this.acpRecvBuffer.trim()) { this.router.PostMessage({ type: 'acpLogEntry', direction, text: this.acpRecvBuffer, timestamp: Date.now(), taskId }); this.acpRecvBuffer = ''; } }, 300);
        } else {
            this.router.PostMessage({ type: 'acpLogEntry', direction, text, timestamp: Date.now(), taskId });
        }
    }

    private flushAcpRecvBuffer() {
        clearTimeout(this.recvFlushTimer);
        if (this.acpRecvBuffer.trim()) { this.router.PostMessage({ type: 'acpLogEntry', direction: 'recv', text: this.acpRecvBuffer, timestamp: Date.now() }); this.acpRecvBuffer = ''; }
    }

    setGenerationState(generating: boolean) {
        this.isGenerating = generating;
        this.router.PostMessage({ type: 'generationState', isGenerating: generating });
        if (!generating) this.flushPendingMessages();
    }

    private flushPendingMessages() {
        if (this.pendingMessages.length === 0) return;
        const next = this.pendingMessages.shift()!;
        this.sendPendingQueueUpdate();
        this.sessionHandler.handleSendMessage(next.text, next.taskId, next.category, next.subType);
    }

    private sendPendingQueueUpdate() {
        this.router.PostMessage({ type: 'pendingQueueUpdate', count: this.pendingMessages.length, items: this.pendingMessages.map(p => ({ text: p.text.substring(0, 60) })) });
    }

    storeMessage(taskId: string, role: 'user' | 'agent', content: string): string {
        const id = this.store.nextMessageId(taskId);
        this.store.addMessage({ id, taskId, role, content, timestamp: Date.now() });
        return id;
    }

    // === Public UI methods ===

    reveal() { this.panel.reveal(); }
    focusInput() { this.router.PostMessage({ type: 'focusInput' }); }
    flashInput() { this.router.PostMessage({ type: 'flashInput' }); }
    toggleRightPanel() { this.router.PostMessage({ type: 'toggleRightPanel' }); }
    showFilePreview(fp: string, c: string) { this.router.PostMessage({ type: 'showFilePreview', filePath: fp, content: c }); }
    showDiff(o: string, m: string) { this.router.PostMessage({ type: 'showDiff', original: o, modified: m }); }
    showWebView(url: string) { this.router.PostMessage({ type: 'showWebView', url }); }
    deviceConnect(h: string, p: number, t: 'ssh' | 'telnet') { this.router.PostMessage({ type: 'deviceConnect', host: h, port: p, connectionType: t }); }
    private handleShowFileDiff(original: string, modified: string) { this.showDiff(original, modified); }
    getCurrentTaskId(): string | null { return this.currentTaskId; }
    setRefreshSidebarCallback(cb: () => void) { this.refreshSidebarCallback = cb; }
    onDidDispose(callback: () => void) { this.onDisposeCallback = callback; }

    private sendCategoryDefs() {
        this.router.PostMessage({ type: 'updateCategoryDefs', categories: getCategories() });
    }

    private getWebviewContent(): string {
        return getTemplateHtml(this.panel.webview, this.context.extensionUri);
    }

    private async loadWorkspaceHooks(): Promise<Record<string, string[]>> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) return {};
        try {
            return parseWorkspaceHooks((await vscode.workspace.fs.readFile(vscode.Uri.joinPath(workspaceRoot, 'AGENTS.md'))).toString());
        } catch { return {}; }
    }

    private async sendHooksAsMessage(tid: string, phase: string): Promise<void> {
        if (!tid) return;
        const task = this.store.getTask(tid);
        if (!task) return;
        const hooksStr = this.taskFlow.getPhaseHooksString(phase, task);
        if (!hooksStr) return;
        if (this.agentService.isConnected) {
            this.sendAcpLog(tid, 'send', hooksStr);
            await this.agentService.sendPrompt(tid, hooksStr, { onText: () => {}, onReasoning: () => {}, onToolCall: () => {}, onToolCallUpdate: () => {}, onPlan: () => {}, onError: () => {}, onDone: () => {} });
        }
    }

    dispose() {
        this.agentService.disconnect();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
