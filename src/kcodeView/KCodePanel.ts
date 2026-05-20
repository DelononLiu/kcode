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
import { CommandRegistry } from '../commands/CommandRegistry';
import type { KCodePanelContext, ToolCallState, PendingMessage } from './PanelContext';
import type { DeviceConfig, IDeviceClient } from '../types';
import type { SavedDevice } from '../types/config';

const deviceLog = vscode.window.createOutputChannel('KCode Device', { log: true });

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
    deviceClients: Map<string, IDeviceClient> = new Map();

    private context: vscode.ExtensionContext;
    private onDisposeCallback?: () => void;
    private ctx: KCodePanelContext;
    readonly configService: ConfigService;
    readonly commandRegistry: CommandRegistry;

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
            onGoalFormatted: async (taskId, goalText, originalRequest) => {
                this.ctx.taskFlow.confirmGoal(taskId);
                this.ctx.router.PostMessage({ type: 'addSystemMessage', content: '🎯 目标已自动确认，进入计划阶段...', taskId });
                await this.ctx.sendHooksAsMessage(taskId, 'plan');
                await this.ctx.sendAgentPrompt(taskId, this.ctx.taskFlow.buildPhaseTransitionPrompt(taskId, originalRequest), false, originalRequest);
            },
            onError: (taskId, error) => { this.flowHandler.showAgentError(taskId, error); },
            onSelfVerifyNeeded: (taskId) => { setTimeout(() => this.sessionHandler.startAutoGeneration(taskId), 100); },
            onSelfVerifyFinished: (taskId) => { this.flowHandler.sendTaskInfo(taskId); },
            onPlanStepUpdate: (taskId) => { this.flowHandler.sendTaskInfo(taskId); },
            onTaskDelegated: (taskId, payload) => { this.flowHandler.handleTaskDelegated(taskId, payload); },
            onTodoUpdate: (taskId, items, action) => { this.flowHandler.handleTodoUpdate(taskId, items, action); },
            onKnowledgeEntry: (taskId, entries) => { this.flowHandler.handleKnowledgeEntry(taskId, entries); },
        });

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        this.agentService = new AgentService(workspacePath);
        this.agentService.setLogCallback((dir, text) => { const t = this.currentTaskId || ''; if (t) this.acpLogManager.send(t, dir, text); });

        this.commandRegistry = new CommandRegistry();
        this.commandRegistry.load(workspacePath);
        this.taskFlow.setAvailableCommands(this.commandRegistry.getPromptInjection());
        this.commandRegistry.registerSlashCommand('/ai', '切换到小助手模式', () => this.loadAssistant());
        this.commandRegistry.registerSlashCommand('/totask', '将小助手对话转为任务', async () => { await this.assistantHandler.convertToTask(); });
        this.commandRegistry.registerSlashCommand('/go', '将小助手对话转为任务', async () => { await this.assistantHandler.convertToTask(); });
        this.commandRegistry.registerSlashCommand('/confirm', '确认当前阶段操作', async (_a, tid) => { if (tid) await this.handlePhaseConfirm(tid); });
        this.commandRegistry.registerSlashCommand('/reject', '驳回验收，可附原因', async (args, tid) => { if (tid) await this.flowHandler.handleRejectReview(tid, args || undefined); }, '/reject [原因]');
        this.commandRegistry.registerSlashCommand('/cancel', '取消当前任务', async (_a, tid) => { if (tid) this.flowHandler.handleCancelTask(tid); });
        this.commandRegistry.registerSlashCommand('/new', '新建任务', async () => { await vscode.commands.executeCommand('kcode.newTask'); });
        this.commandRegistry.registerSlashCommand('/tasks', '查看任务概览', (_a, tid) => this.sendTasksSummary(tid));
        this.commandRegistry.registerSlashCommand('/demo', '运行 demo 并在卡片中查看输出', (args) => {
            if (!args) { this.router.PostMessage({ type: 'addSystemMessage', content: '用法: /demo <命令>\n示例: /demo echo hello' }); return; }
            this.handleDemoRun({ name: 'Demo', command: args, device: 'localhost', envMeta: { '触发方式': '斜杠命令' } });
        }, '/demo <命令>');

        this.router.PostMessage({ type: 'slashCommandList', commands: this.getSlashCommandList() });

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
        this.ctx = ctx;

        this.sessionHandler = new TaskSessionHandler(ctx);
        this.flowHandler = new TaskFlowHandler(ctx);

        this.assistantHandler = new AssistantHandler(
            this.store, this.agentService, this.router, this.sessionHandler,
            (b) => this.setGenerationState(b),
            () => this.isGenerating,
            (text, taskId) => this.pendingMessages.push({ text, taskId }),
            () => this.sendPendingQueueUpdate(),
            () => this.refreshSidebarCallback?.(),
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
        this.router.on('confirmPlanWithEdit', async (msg) => this.flowHandler.handleConfirmPlanWithEdit(msg.taskId, msg.goal, msg.steps));
        this.router.on('rejectPlan', (msg) => this.flowHandler.handleRejectPlan(msg.taskId));
        this.router.on('confirmExecuteDone', async (msg) => this.flowHandler.handleConfirmExecuteDone(msg.taskId));
        this.router.on('partialApproveReview', (msg) => this.flowHandler.handlePartialApproveReview(msg.taskId, msg.passed, msg.failed));
        this.router.on('toggleAcpLog', (msg) => { this.acpLogManager.enabled = msg.enabled; this.configService.set('log.acpLogEnabled', msg.enabled); this.configService.save(); });
        this.router.on('newTask', () => vscode.commands.executeCommand('kcode.newTask'));
        this.router.on('cancelQueuedMessage', (msg) => { if (msg.index >= 0 && msg.index < this.pendingMessages.length) { this.pendingMessages.splice(msg.index, 1); this.sendPendingQueueUpdate(); } });
        this.router.on('clearPendingQueue', () => { this.pendingMessages = []; this.sendPendingQueueUpdate(); });
        this.router.on('openTerminal', () => vscode.commands.executeCommand('workbench.action.terminal.new'));
        this.router.on('convertToTask', (msg) => this.flowHandler.handleConvertToTask(msg.taskId));
        this.router.on('convertAssistantToTask', () => { this.assistantHandler.convertToTask(); });
        this.router.on('updateHooks', (msg) => { if (msg.phase && Array.isArray(msg.commands)) { this.store.updateTaskHooks(msg.taskId, msg.phase, msg.commands); this.flowHandler.sendTaskInfo(msg.taskId); } });
        this.router.on('selectTask', (msg) => { this.loadTask(msg.taskId); this.refreshSidebarCallback?.(); });
        this.router.on('sendAssistantMessage', async (msg) => { await this.assistantHandler.handleMessage(msg.text); });
        this.router.on('slashCommand', async (msg) => { await this.handleSlashCommand(msg.text, msg.taskId); });
        this.router.on('updateTodoItem', (msg) => { this.flowHandler.handleUpdateTodoItem(msg.taskId, msg.msgId, msg.itemId, msg.checked); });
        this.router.on('switchAgent', (msg) => { this.sessionHandler.handleSwitchAgent(msg.label); });
        this.router.on('openSettings', () => vscode.commands.executeCommand('kcode.openSettings'));
        this.router.on('openKnowledgeEntry', (msg) => vscode.commands.executeCommand('kcode.openKnowledgeWiki', msg.entryId));
        this.router.on('openTaskFromKnowledge', (msg) => vscode.commands.executeCommand('kcode.selectTask', msg.taskId));
        this.router.on('extractKnowledge', async (msg) => {
            const tid = msg.taskId;
            if (!tid || this.isGenerating) return;
            const messages = this.store.getMessages(tid);
            if (messages.length === 0) return;
            const extractPrompt = '请分析以上对话内容，提炼本次任务中可复用的核心经验与关键决策（2-4 条为宜，每条聚焦一个具体问题或场景）。先输出标题行「📚 萃取知识表格」，然后在其下方用 markdown 表格输出（列：类型、标题、简介、标签）。标题请简短（15 字以内），不含特殊字符（如 * # / \\ : 等），适合作为文件名。表格数据会被系统自动解析存储，不需要额外输出 JSON。如果没有可提炼的知识，请直接说明。';
            const handler = this.sessionHandler.createAgentResponseHandler(tid, false, '', true);
            this.setGenerationState(true);
            this.router.PostMessage({ type: 'addSystemMessage', content: '🔍 AI 正在分析对话萃取知识...', taskId: tid });
            await this.sessionHandler.doPrompt(tid, extractPrompt, handler);
        });
        this.router.on('deviceConnect', (msg) => this.handleDeviceConnect(msg.config));
        this.router.on('deviceDisconnect', () => this.handleDeviceDisconnect());
        this.router.on('deviceCommand', (msg) => this.handleDeviceCommand(msg.command));
        this.router.on('demoRun', (msg) => this.handleDemoRun(msg));
        this.router.on('demoStop', (msg) => this.handleDemoStop(msg.cardId, msg.taskId));
        this.router.on('demoRerun', (msg) => this.handleDemoRun(msg));
        this.router.on('getSavedDevices', () => {
            const devices: SavedDevice[] = this.configService.get<SavedDevice[]>('devices', []);
            this.router.PostMessage({ type: 'savedDevices', devices });
        });
        this.router.on('deviceDebugLog', (msg) => {
            deviceLog.info(`[webview] ${msg.text}`);
        });
        this.router.on('exportToWiki', async (msg) => {
            const tid = msg.taskId;
            if (!tid) return;
            try {
                const { WikiExporter } = await import('../export/WikiExporter');
                const exporter = new WikiExporter(this.store);
                const result = exporter.writeToWiki(tid);
                this.router.PostMessage({
                    type: 'wikiExported',
                    filePath: result.filePath,
                    fileName: result.fileName,
                });
                vscode.window.showInformationMessage(`✅ 已导出到 .kcode/wiki/${result.fileName}`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`导出失败: ${err?.message || String(err)}`);
            }
        });

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
        this.router.PostMessage({ type: 'slashCommandList', commands: this.getSlashCommandList() });
    }

    autoSendGoal(taskId: string, text: string) { this.sessionHandler.handleSendMessage(text, taskId); }

    private getSlashCommandList(): { name: string; description: string }[] {
        const builtin = [
            { name: '/ai', description: '切换到小助手模式' },
            { name: '/totask', description: '将小助手对话转为任务' },
            { name: '/confirm', description: '确认当前阶段操作' },
            { name: '/reject', description: '驳回验收并附原因' },
            { name: '/cancel', description: '取消当前任务' },
            { name: '/new', description: '新建任务' },
            { name: '/tasks', description: '查看任务概览' },
            { name: '/demo', description: '运行 demo 并查看实时输出' },
        ];
        const projectCmds = this.commandRegistry.getKiloCommands().map(c => ({
            name: c.name,
            description: c.description,
        }));
        return [...builtin, ...projectCmds];
    }

    private async handleSlashCommand(text: string, taskId?: string) {
        const handled = await this.commandRegistry.handleSlash(text, taskId || this.currentTaskId || undefined);
        if (!handled) {
            this.router.PostMessage({
                type: 'addSystemMessage',
                content: `未知命令，输入 / 查看可用命令`,
            });
        }
    }

    private async handlePhaseConfirm(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        const phase = task.phase;
        if (phase === 'goal') {
            await this.flowHandler.handleConfirmGoalFromHeader(taskId);
        } else if (phase === 'plan') {
            await this.flowHandler.handleConfirmPlan(taskId);
        } else if (phase === 'execute') {
            await this.flowHandler.handleConfirmExecuteDone(taskId);
        } else {
            this.router.PostMessage({ type: 'addSystemMessage', content: `当前阶段 "${phase}" 不支持 /confirm 操作` });
        }
    }

    private sendTasksSummary(taskId?: string) {
        const tasks = this.store.getTasks();
        const total = tasks.length;
        const review = tasks.filter(t => t.status === 'in_review').length;
        const active = tasks.filter(t => t.status === 'active').length;
        const pending = tasks.filter(t => t.status === 'pending').length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const cancelled = tasks.filter(t => t.status === 'cancelled').length;
        this.router.PostMessage({
            type: 'addSystemMessage',
            content: `📊 **任务概览**\n\n总任务: ${total}\n- ⏳ 待确认: ${pending}\n- ⚡ 进行中: ${active}\n- ✅ 待验收: ${review}\n- 🏁 已完成: ${completed}\n- ❌ 已取消: ${cancelled}`,
        });
    }

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
    setRefreshSidebarCallback(cb: () => void) { this.refreshSidebarCallback = cb; this.ctx.refreshSidebarCallback = cb; }
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

    private async handleDeviceConnect(config: DeviceConfig) {
        const deviceId = `${config.type}://${config.host}:${config.port}`;
        deviceLog.info(`[connect] 开始连接 ${deviceId}`, { config: { type: config.type, host: config.host, port: config.port, username: config.username } });
        if (this.deviceClients.has(deviceId)) {
            this.router.PostMessage({ type: 'deviceStatus', status: 'error', message: '设备已连接' });
            return;
        }
        this.router.PostMessage({ type: 'deviceStatus', status: 'connecting', message: `正在连接 ${config.host}:${config.port}...` });
        try {
            const { createDeviceClient } = await import('../device/DeviceClientFactory');
            const client = createDeviceClient(config.type);
            deviceLog.info(`[connect] 创建 client, type=${config.type}`);
            client.onOutput((data) => {
                deviceLog.append(`[stdout] ${data}`);
                this.router.PostMessage({ type: 'deviceOutput', data });
            });
            client.onError((error) => {
                deviceLog.error(`[stderr] ${error}`);
                this.router.PostMessage({ type: 'deviceOutput', data: `\x1b[31m${error}\x1b[0m` });
            });
            client.onDisconnected(() => {
                deviceLog.info(`[disconnect] ${deviceId} 连接已断开`);
                this.deviceClients.delete(deviceId);
                this.router.PostMessage({ type: 'deviceStatus', status: 'disconnected', message: '设备已断开' });
            });
            const conn = await client.connect(config);
            deviceLog.info(`[connect] ${deviceId} 连接成功`);
            this.deviceClients.set(deviceId, client);
            this.router.PostMessage({ type: 'deviceConnected', deviceId, config });
        } catch (err: any) {
            const msg = err?.message || String(err);
            deviceLog.error(`[connect] 连接失败: ${msg}`);
            this.router.PostMessage({ type: 'deviceStatus', status: 'error', message: `连接失败: ${msg}` });
        }
    }

    private async handleDeviceDisconnect() {
        deviceLog.info('[disconnect] 断开所有设备');
        for (const [id, client] of this.deviceClients) {
            try { await client.disconnect(); } catch (e: any) { deviceLog.warn(`[disconnect] ${id} 断开异常: ${e?.message}`); }
            this.deviceClients.delete(id);
        }
        this.router.PostMessage({ type: 'deviceStatus', status: 'disconnected', message: '已断开所有设备' });
    }

    private async handleDeviceCommand(command: string) {
        deviceLog.info(`[exec] ${command}`);
        const clients = Array.from(this.deviceClients.values());
        if (clients.length === 0) {
            deviceLog.warn('[exec] 未连接设备');
            this.router.PostMessage({ type: 'deviceOutput', data: '\x1b[33m未连接设备，请先连接\x1b[0m' });
            return;
        }
        for (const client of clients) {
            try {
                const result = await client.exec(command);
                deviceLog.append(`[exec stdout] ${result}`);
                this.router.PostMessage({ type: 'deviceOutput', data: result });
            } catch (err: any) {
                deviceLog.error(`[exec 失败] ${err?.message || String(err)}`);
                this.router.PostMessage({ type: 'deviceOutput', data: `\x1b[31m${err?.message || String(err)}\x1b[0m` });
            }
        }
    }

    private _activeDemoAbort: AbortController | null = null;

    private async handleDemoRun(config: any) {
        const cardId = config.cardId || `demo_${Date.now()}`;
        const deviceStr = config.device || `${config.host || 'localhost'}:${config.port || 22}`;

        this.router.PostMessage({
            type: 'demoCardUpdate',
            cardId,
            taskId: this.currentTaskId || '',
            action: 'create',
            name: config.name || '未命名 Demo',
            command: config.command || '',
            device: deviceStr,
            envMeta: config.envMeta || {},
            status: 'running',
            output: '',
        });

        if (!config.command) {
            this.router.PostMessage({ type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '', action: 'updateStatus', status: 'failed' });
            return;
        }

        const abort = new AbortController();
        this._activeDemoAbort = abort;

        try {
            const commands = Array.isArray(config.command) ? config.command : [config.command];
            for (const cmd of commands) {
                if (abort.signal.aborted) break;
                this.router.PostMessage({
                    type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                    action: 'appendOutput', output: `$ ${cmd}\n`,
                });
                const clients = Array.from(this.deviceClients.values());
                if (clients.length > 0) {
                    for (const client of clients) {
                        if (abort.signal.aborted) break;
                        try {
                            const result = await client.exec(cmd);
                            if (result) {
                                this.router.PostMessage({
                                    type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                                    action: 'appendOutput', output: result,
                                });
                            }
                        } catch (err: any) {
                            this.router.PostMessage({
                                type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                                action: 'appendOutput', output: `\x1b[31m${err?.message || String(err)}\x1b[0m\n`,
                            });
                        }
                    }
                } else {
                    this.router.PostMessage({
                        type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                        action: 'appendOutput', output: '\x1b[33m未连接设备\x1b[0m\n',
                    });
                }
            }

            if (!abort.signal.aborted) {
                this.router.PostMessage({
                    type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                    action: 'updateStatus', status: 'completed',
                });
            }
        } catch (err: any) {
            if (!abort.signal.aborted) {
                this.router.PostMessage({
                    type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                    action: 'appendOutput', output: `\x1b[31m${err?.message || String(err)}\x1b[0m\n`,
                });
                this.router.PostMessage({
                    type: 'demoCardUpdate', cardId, taskId: this.currentTaskId || '',
                    action: 'updateStatus', status: 'failed',
                });
            }
        } finally {
            if (this._activeDemoAbort === abort) {
                this._activeDemoAbort = null;
            }
        }
    }

    private handleDemoStop(cardId: string, taskId?: string) {
        this._activeDemoAbort?.abort();
        this._activeDemoAbort = null;
        this.router.PostMessage({
            type: 'demoCardUpdate', cardId, taskId: taskId || this.currentTaskId || '',
            action: 'updateStatus', status: 'failed',
        });
        this.router.PostMessage({
            type: 'demoCardUpdate', cardId, taskId: taskId || this.currentTaskId || '',
            action: 'appendOutput', output: '\n\x1b[33m[已终止]\x1b[0m\n',
        });
    }

    dispose() {
        this.acpLogManager.dispose();
        this.agentService.disconnect();
        for (const client of this.deviceClients.values()) {
            client.disconnect().catch(() => {});
        }
        this.deviceClients.clear();
    }
}
