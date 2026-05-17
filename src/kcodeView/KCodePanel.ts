import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { TaskFlow } from '../taskflow/TaskFlow';
import { AgentService } from '../core/AgentService';
import { ConfigService } from '../core/ConfigService';
import { getCategories } from '../taskflow/templates';
import { parseWorkspaceHooks } from '../taskflow/workspaceHooks';
import { getWebviewContent as getTemplateHtml } from './templates/chatPanelHtml';
import { MessageRouter } from './MessageRouter';
import { TaskSessionHandler } from './TaskSessionHandler';
import { TaskFlowHandler } from './TaskFlowHandler';
import { AcpLogManager } from './AcpLogManager';
import { AssistantHandler } from './AssistantHandler';
import type { KCodePanelContext, ToolCallState, PendingMessage } from './PanelContext';

export class KCodePanel {
    readonly panel: vscode.WebviewPanel;
    readonly store: TaskStore;
    readonly taskFlow: TaskFlow;
    readonly agentService: AgentService;
    readonly router: MessageRouter;
    readonly sessionHandler: TaskSessionHandler;
    readonly flowHandler: TaskFlowHandler;
    readonly acpLogManager: AcpLogManager;
    readonly assistantHandler: AssistantHandler;

    currentTaskId: string | null = null;
    activeToolCalls: Map<string, ToolCallState> = new Map();
    isGenerating: boolean = false;
    pendingMessages: PendingMessage[] = [];
    hasSetPlanMessage: boolean = false;
    hasSetExecuteMessage: boolean = false;
    refreshSidebarCallback?: () => void;

    private context: vscode.ExtensionContext;
    private onDisposeCallback?: () => void;
    readonly configService: ConfigService;

    constructor(context: vscode.ExtensionContext, store: TaskStore, configService?: ConfigService) {
        this.context = context;
        this.store = store;
        this.configService = configService || new ConfigService();
        this.router = new MessageRouter();

        this.panel = vscode.window.createWebviewPanel('kcode', 'KCode', vscode.ViewColumn.One, {
            enableScripts: true, retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'out'),
                vscode.Uri.joinPath(context.extensionUri, 'src', 'kcodeView', 'webview')
            ]
        });
        this.router.PostMessage = (msg) => this.panel.webview.postMessage(msg);

        this.acpLogManager = new AcpLogManager(this.router);

        this.taskFlow = new TaskFlow(store, {
            onPhaseChanged: (taskId) => { this.flowHandler.sendTaskInfo(taskId); this.flowHandler.sendNodePanelUpdate(taskId); this.refreshSidebarCallback?.(); },
            onExecuteFinished: (taskId) => { this.flowHandler.sendTaskInfo(taskId); },
            onGoalFormatted: (taskId, goalText, originalRequest) => { this.router.PostMessage({ type: 'showGoalConfirmation', goal: goalText, originalRequest, taskId }); },
            onError: (taskId, error) => { this.flowHandler.showAgentError(taskId, error); },
            onSelfVerifyNeeded: (taskId) => { setTimeout(() => this.sessionHandler.startAutoGeneration(taskId), 100); },
            onSelfVerifyFinished: (taskId) => { this.flowHandler.sendTaskInfo(taskId); },
            onPlanStepUpdate: (taskId) => { this.flowHandler.sendTaskInfo(taskId); },
            onTaskDelegated: (taskId, payload) => { this.flowHandler.handleTaskDelegated(taskId, payload); },
            onTodoUpdate: (taskId, items, action) => { this.flowHandler.handleTodoUpdate(taskId, items, action); },
        });

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        this.agentService = new AgentService(workspacePath);
        this.agentService.setLogCallback((dir, text) => { const t = this.currentTaskId || ''; if (t) this.acpLogManager.send(t, dir, text); });

        this.panel.webview.html = this.getWebviewContent();

        const ctx: KCodePanelContext = {
            store: this.store, taskFlow: this.taskFlow, agentService: this.agentService, router: this.router,
            currentTaskId: this.currentTaskId, activeToolCalls: this.activeToolCalls,
            isGenerating: this.isGenerating, pendingMessages: this.pendingMessages,
            hasSetPlanMessage: this.hasSetPlanMessage, hasSetExecuteMessage: this.hasSetExecuteMessage,
            refreshSidebarCallback: this.refreshSidebarCallback,
            setGenerationState: (b) => this.setGenerationState(b),
            sendPendingQueueUpdate: () => this.sendPendingQueueUpdate(),
            sendAcpLog: (t, d, tx) => this.acpLogManager.send(t, d, tx),
            flushAcpRecvBuffer: (tid) => this.acpLogManager.flush(tid),
            storeMessage: (t, r, c) => this.storeMessage(t, r, c),
            sendTaskInfo: (t) => this.flowHandler.sendTaskInfo(t),
            sendNodePanelUpdate: (t) => this.flowHandler.sendNodePanelUpdate(t),
            sendHooksAsMessage: (t, p) => this.sendHooksAsMessage(t, p),
            triggerReviewRequest: (t, c) => this.flowHandler.triggerReviewRequest(t, c),
            showPlanConfirmation: (t) => this.flowHandler.showPlanConfirmation(t),
            showAgentError: (t, e) => this.flowHandler.showAgentError(t, e),
            sendAgentPrompt: async (tid, promptText, isGoalFormatting, originalText) => {
                const handler = this.sessionHandler.createAgentResponseHandler(tid, isGoalFormatting, originalText);
                await this.sessionHandler.doPrompt(tid, promptText, handler);
            },
            startAutoGeneration: (tid) => this.sessionHandler.startAutoGeneration(tid),
            stopGeneration: (tid) => this.flowHandler.handleStopGeneration(tid),
            loadTask: (tid) => this.loadTask(tid),
            loadAssistant: () => this.loadAssistant(),
        };

        this.sessionHandler = new TaskSessionHandler(ctx);
        this.flowHandler = new TaskFlowHandler(ctx);

        this.assistantHandler = new AssistantHandler(
            this.store, this.agentService, this.router, this.sessionHandler,
            (b) => this.setGenerationState(b),
            () => this.isGenerating,
            (text, taskId) => this.pendingMessages.push({ text, taskId }),
            () => this.sendPendingQueueUpdate(),
            this.refreshSidebarCallback,
            (taskId) => this.loadTask(taskId),
            vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        );

        this.setupMessageHandler();

        this.acpLogManager.enabled = this.configService.get<boolean>('log.acpLogEnabled', false);
        this.router.PostMessage({ type: 'acpLogState', enabled: this.acpLogManager.enabled, maxGlobal: this.configService.get<number>('log.acpLogMaxGlobal', 5000), maxTask: this.configService.get<number>('log.acpLogMaxTask', 2000) });
        this.router.PostMessage({ type: 'updateCategoryDefs', categories: getCategories() });

        this.sessionHandler.sendAgentList();

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
        this.router.on('showFileDiff', (msg) => this.showDiff(msg.original, msg.modified));
        this.router.on('stopGeneration', (msg) => this.flowHandler.handleStopGeneration(msg.taskId));
        this.router.on('openNativeDiff', (msg) => this.flowHandler.handleOpenNativeDiff(msg.original, msg.modified, msg.filePath));
        this.router.on('confirmGoalWithEdit', async (msg) => this.flowHandler.handleConfirmGoalWithEdit(msg.taskId, msg.goal, msg.originalRequest));
        this.router.on('confirmGoalFromHeader', async (msg) => this.flowHandler.handleConfirmGoalFromHeader(msg.taskId));
        this.router.on('confirmPlan', async (msg) => this.flowHandler.handleConfirmPlan(msg.taskId));
        this.router.on('rejectPlan', (msg) => this.flowHandler.handleRejectPlan(msg.taskId));
        this.router.on('confirmExecuteDone', async (msg) => this.flowHandler.handleConfirmExecuteDone(msg.taskId));
        this.router.on('partialApproveReview', (msg) => this.flowHandler.handlePartialApproveReview(msg.taskId, msg.passed, msg.failed));
        this.router.on('toggleAcpLog', (msg) => { this.acpLogManager.enabled = msg.enabled; this.configService.set('log.acpLogEnabled', msg.enabled); this.configService.save(); });
        this.router.on('newTask', () => vscode.commands.executeCommand('kcode.newTask'));
        this.router.on('cancelQueuedMessage', (msg) => { if (msg.index >= 0 && msg.index < this.pendingMessages.length) { this.pendingMessages.splice(msg.index, 1); this.sendPendingQueueUpdate(); } });
        this.router.on('clearPendingQueue', () => { this.pendingMessages = []; this.sendPendingQueueUpdate(); });
        this.router.on('openTerminal', () => vscode.commands.executeCommand('workbench.action.terminal.new'));
        this.router.on('convertToTask', (msg) => this.flowHandler.handleConvertToTask(msg.taskId));
        this.router.on('updateHooks', (msg) => { if (msg.phase && Array.isArray(msg.commands)) { this.store.updateTaskHooks(msg.taskId, msg.phase, msg.commands); this.flowHandler.sendTaskInfo(msg.taskId); } });
        this.router.on('selectTask', (msg) => { this.loadTask(msg.taskId); this.refreshSidebarCallback?.(); });
        this.router.on('sendAssistantMessage', async (msg) => { await this.assistantHandler.handleMessage(msg.text); });
        this.router.on('updateTodoItem', (msg) => { this.flowHandler.handleUpdateTodoItem(msg.taskId, msg.msgId, msg.itemId, msg.checked); });
        this.router.on('switchAgent', (msg) => { this.sessionHandler.handleSwitchAgent(msg.label); });
        this.router.on('openSettings', () => vscode.commands.executeCommand('kcode.openSettings'));

        this.panel.webview.onDidReceiveMessage((message: any) => { this.router.dispatch(message.type, message); }, null, this.context.subscriptions);
    }

    storeMessage(taskId: string, role: 'user' | 'agent', content: string): string {
        const id = this.store.nextMessageId(taskId);
        this.store.addMessage({ id, taskId, role, content, timestamp: Date.now() });
        return id;
    }

    // === Task loading ===

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.pendingMessages = [];
        this.taskFlow.loadTask(taskId);
        const task = this.store.getTask(taskId);
        this.hasSetPlanMessage = !!task?.nodeMessageIds?.plan;
        this.hasSetExecuteMessage = !!task?.nodeMessageIds?.execute;
        this.sendCategoryDefs();
        this.flowHandler.sendTaskMessages(taskId);
        this.flowHandler.sendTaskInfo(taskId);
        this.flowHandler.sendNodePanelUpdate(taskId);
        this.sessionHandler.ensureSession(taskId).catch(err => {
            this.flowHandler.showAgentError(taskId, err?.message || 'ACP 会话未就绪');
        });
        this.loadWorkspaceHooks().then(hooks => this.taskFlow.setWorkspaceHooks(hooks));
    }

    loadAssistant() {
        this.currentTaskId = null;
        this.pendingMessages = [];
        this.assistantHandler.showLanding();
        this.assistantHandler.loadMessages();
        this.refreshSidebarCallback?.();
        this.sessionHandler.ensureConnection();
    }

    autoSendGoal(taskId: string, text: string) { this.sessionHandler.handleSendMessage(text, taskId); }

    startTemplateFlow(taskId: string) {
        this.loadTask(taskId);
        this.router.PostMessage({ type: 'startTemplateFlow', taskId });
    }

    // === Generation state ===

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

    // === Public UI methods ===

    reveal() { this.panel.reveal(); }
    focusInput() { this.router.PostMessage({ type: 'focusInput' }); }
    flashInput() { this.router.PostMessage({ type: 'flashInput' }); }
    toggleRightPanel() { this.router.PostMessage({ type: 'toggleRightPanel' }); }
    showDiff(o: string, m: string) { this.router.PostMessage({ type: 'showDiff', original: o, modified: m }); }
    showWebView(url: string) { this.router.PostMessage({ type: 'showWebView', url }); }
    getCurrentTaskId(): string | null { return this.currentTaskId; }
    setRefreshSidebarCallback(cb: () => void) { this.refreshSidebarCallback = cb; }
    onDidDispose(callback: () => void) { this.onDisposeCallback = callback; }

    // === Private helpers ===

    private sendCategoryDefs() {
        this.router.PostMessage({ type: 'updateCategoryDefs', categories: getCategories() });
    }

    private getWebviewContent(): string {
        const agents = [
            { label: 'Kilo', type: 'kilo' },
            { label: 'OpenCode', type: 'opencode' },
        ];
        return getTemplateHtml(this.panel.webview, this.context.extensionUri, agents);
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
            this.acpLogManager.send(tid, 'send', hooksStr);
            await this.agentService.sendPrompt(tid, hooksStr, { onText: () => {}, onReasoning: () => {}, onToolCall: () => {}, onToolCallUpdate: () => {}, onPlan: () => {}, onError: () => {}, onDone: () => {} });
        }
    }

    dispose() {
        this.acpLogManager.dispose();
        this.agentService.disconnect();
    }
}
