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
import { PluginManager } from '../core/plugin/PluginManager';
import type { KCodePanelContext, ToolCallState, PendingMessage } from './PanelContext';

export class Panel {
    readonly panel: vscode.WebviewPanel;
    readonly store: TaskStore;
    readonly taskFlow: TaskFlow;
    readonly agentService: AgentService;
    readonly router: MessageRouter;
    readonly sessionHandler: TaskSessionHandler;
    readonly flowHandler: TaskFlowHandler;
    readonly acpLogManager: AcpLogManager;
    readonly assistantHandler: AssistantHandler;
    readonly pluginManager: PluginManager;

    currentTaskId: string | null = null;
    activeToolCalls: Map<string, ToolCallState> = new Map();
    isGenerating: boolean = false;
    pendingMessages: PendingMessage[] = [];
    hasSetPlanMessage: boolean = false;
    hasSetExecuteMessage: boolean = false;
    refreshSidebarCallback?: () => void;

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
                vscode.Uri.joinPath(context.extensionUri, 'src', 'view', 'webview')
            ]
        });
        this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'kcode.png');
        this.router.PostMessage = (msg) => this.panel.webview.postMessage(msg);

        this.acpLogManager = new AcpLogManager(this.router);

        this.taskFlow = new TaskFlow(store, {
            onPhaseChanged: (taskId) => {
                this.flowHandler.sendTaskInfo(taskId);
                this.flowHandler.sendNodePanelUpdate(taskId);
                this.refreshSidebarCallback?.();
                this.pluginManager.dispatchPhaseChanged(taskId, '', store.getTask(taskId)?.phase || '');
            },
            onExecuteFinished: (taskId) => {
                this.flowHandler.sendTaskInfo(taskId);
            },
            onGoalFormatted: async (taskId, goalText, originalRequest) => {
                this.flowHandler.sendTaskInfo(taskId);
                this.flowHandler.sendNodePanelUpdate(taskId);
                this.router.PostMessage({ type: 'finalizeGoalMessage', taskId, goal: goalText, originalRequest });
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
        this.agentService.setLogCallback((dir, text) => {
            const t = this.currentTaskId || (this.assistantHandler ? '__assistant__' : '');
            if (t) this.acpLogManager.send(t, dir, text);
        });

        this.commandRegistry = new CommandRegistry();
        this.commandRegistry.load(workspacePath);
        this.taskFlow.setAvailableCommands(this.commandRegistry.getPromptInjection());
        this.commandRegistry.registerSlashCommand('/ai', '切换到小助手模式', () => this.loadAssistant());
        this.commandRegistry.registerSlashCommand('/guide', '新手引导', () => this.loadAssistantWithGuide());
        this.commandRegistry.registerSlashCommand('/totask', '将小助手对话转为任务', async () => { await this.assistantHandler.convertToTask(); });
        this.commandRegistry.registerSlashCommand('/go', '将小助手对话转为任务', async () => { await this.assistantHandler.convertToTask(); });
        this.commandRegistry.registerSlashCommand('/confirm', '确认当前阶段操作', async (_a, tid) => { if (tid) await this.handlePhaseConfirm(tid); });
        this.commandRegistry.registerSlashCommand('/reject', '驳回验收，可附原因', async (args, tid) => { if (tid) await this.flowHandler.handleRejectReview(tid, args || undefined); }, '/reject [原因]');
        this.commandRegistry.registerSlashCommand('/cancel', '取消当前任务', async (_a, tid) => { if (tid) this.flowHandler.handleCancelTask(tid); });
        this.commandRegistry.registerSlashCommand('/new', '新建任务', async () => { await vscode.commands.executeCommand('kcode.newTask'); });
        this.commandRegistry.registerSlashCommand('/tasks', '查看任务概览', (_a, tid) => this.sendTasksSummary(tid));
        this.commandRegistry.registerSlashCommand('/demo', '运行 demo 并在卡片中查看输出', (args) => {
            if (!args) { this.router.PostMessage({ type: 'addSystemMessage', content: '用法: /demo <命令>\n示例: /demo echo hello' }); return; }
            this.router.PostMessage({ type: 'demoRun', name: 'Demo', command: args, device: 'localhost', envMeta: { '触发方式': '斜杠命令' } });
        }, '/demo <命令>');
        this.commandRegistry.registerSlashCommand('/terminal', '打开任务终端日志重放', async (_args, tid) => {
            if (!tid) { this.router.PostMessage({ type: 'addSystemMessage', content: '请先选择一个任务再使用 /terminal' }); return; }
            const { TaskTerminalManager } = await import('../plugins/terminal/TaskTerminalManager');
            const mgr = new TaskTerminalManager();
            const task = this.store.getTask(tid);
            mgr.openReplay(tid, task?.title || '任务');
        });

        this.sendSlashCommandList();

        this.panel.webview.html = this.getWebviewContent();

        const ctx: KCodePanelContext = {
            store: this.store, taskFlow: this.taskFlow, agentService: this.agentService, router: this.router,
            currentTaskId: this.currentTaskId,
            activeToolCalls: this.activeToolCalls,
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

        this.pluginManager = new PluginManager(
            store, this.router, this.agentService,
            () => this.currentTaskId ? 'task' : 'assistant',
            this.configService,
        );

        this.assistantHandler = new AssistantHandler(
            this.store, this.agentService, this.router, this.sessionHandler,
            (b) => this.setGenerationState(b),
            () => this.isGenerating,
            (text, taskId) => this.pendingMessages.push({ text, taskId }),
            () => this.sendPendingQueueUpdate(),
            () => this.refreshSidebarCallback?.(),
            (taskId) => this.loadTask(taskId),
            vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
            (taskId, dir, text) => this.acpLogManager.send(taskId, dir, text),
            (taskId) => this.acpLogManager.flush(taskId),
        );

        this.setupMessageHandler();

        this.acpLogManager.enabled = this.configService.get<boolean>('log.acpLogEnabled', false);
        this.router.PostMessage({ type: 'acpLogState', enabled: this.acpLogManager.enabled, maxGlobal: this.configService.get<number>('log.acpLogMaxGlobal', 5000), maxTask: this.configService.get<number>('log.acpLogMaxTask', 2000) });
        this.router.PostMessage({ type: 'updateCategoryDefs', categories: getCategories() });

        this.sessionHandler.sendAgentList();

        this.loadWorkspaceHooks().then(hooks => this.taskFlow.setWorkspaceHooks(hooks));

        this.panel.onDidDispose(() => { this.onDisposeCallback?.(); });

        this.initPlugins();
    }

    private async initPlugins() {
        const plugins = [
            (await import('../plugins/device/DevicePlugin')).default,
            (await import('../plugins/demo/DemoPlugin')).default,
            (await import('../plugins/todo/TodoPlugin')).default,
            (await import('../plugins/knowledge/KnowledgePlugin')).default,
            (await import('../plugins/review/ReviewPlugin')).default,
            (await import('../plugins/diff/DiffPlugin')).default,
            (await import('../plugins/delegate/DelegationPlugin')).default,
            (await import('../plugins/setup/SetupPlugin')).default,
            (await import('../plugins/terminal/TerminalPlugin')).default,
        ];
        for (const plugin of plugins) {
            this.pluginManager.register(plugin);
        }
        await this.pluginManager.activateAll();
        const contribs = this.pluginManager.getPluginContributions();
        if (contribs.length > 0) {
            this.router.PostMessage({ type: 'pluginContributions', contributions: contribs });
        }
    }

    private setupMessageHandler() {
        this.router.on('sendMessage', async (msg) => this.sessionHandler.handleSendMessage(msg.text, msg.taskId, msg.category, msg.subType));
        this.router.on('confirmGoal', async (msg) => this.flowHandler.handleConfirmGoal(msg.taskId, msg.originalRequest));
        this.router.on('reviseGoal', (msg) => this.flowHandler.handleReviseGoal(msg.taskId));
        this.router.on('cancelTask', (msg) => this.flowHandler.handleCancelTask(msg.taskId));
        this.router.on('approveReview', (msg) => this.flowHandler.handleApproveReview(msg.taskId));
        this.router.on('rejectReview', (msg) => this.flowHandler.handleRejectReview(msg.taskId, msg.reason));
        this.router.on('showFileDiff', (msg) => this.showDiff(msg.original, msg.modified));
        this.router.on('stopGeneration', (msg) => {
            if (msg.taskId === '__assistant__') {
                this.assistantHandler.stopGeneration();
            } else {
                this.flowHandler.handleStopGeneration(msg.taskId);
            }
        });
        this.router.on('confirmGoalWithEdit', async (msg) => this.flowHandler.handleConfirmGoalWithEdit(msg.taskId, msg.goal, msg.originalRequest));
        this.router.on('confirmGoalFromHeader', async (msg) => this.flowHandler.handleConfirmGoalFromHeader(msg.taskId));
        this.router.on('confirmPlan', async (msg) => this.flowHandler.handleConfirmPlan(msg.taskId));
        this.router.on('confirmPlanWithEdit', async (msg) => this.flowHandler.handleConfirmPlanWithEdit(msg.taskId, msg.goal, msg.steps));
        this.router.on('rejectPlan', (msg) => this.flowHandler.handleRejectPlan(msg.taskId));
        this.router.on('confirmExecuteDone', async (msg) => this.flowHandler.handleConfirmExecuteDone(msg.taskId));
        this.router.on('confirmSelfVerifyDone', async (msg) => this.flowHandler.handleConfirmSelfVerifyDone(msg.taskId));
        this.router.on('partialApproveReview', (msg) => this.flowHandler.handlePartialApproveReview(msg.taskId, msg.passed, msg.failed));
        this.router.on('toggleAcpLog', (msg) => { this.acpLogManager.enabled = msg.enabled; this.configService.set('log.acpLogEnabled', msg.enabled); this.configService.save(); });
        this.router.on('newTask', () => vscode.commands.executeCommand('kcode.newTask'));
        this.router.on('newTaskWithText', async (msg) => {
            await vscode.commands.executeCommand('kcode.newTask');
            if (this.currentTaskId && msg.text) {
                this.store.updateTaskTitle(this.currentTaskId, msg.text);
                this.flowHandler.sendTaskInfo(this.currentTaskId);
                this.sessionHandler.handleSendMessage(msg.text, this.currentTaskId);
            }
        });
        this.router.on('stageInput', async (msg) => {
            if (msg.taskId && msg.text) {
                this.sessionHandler.handleSendMessage(msg.text, msg.taskId);
            }
        });
        this.router.on('confirmRequirement', (msg) => {
            if (msg.taskId && typeof msg.index === 'number') {
                const task = this.store.getTask(msg.taskId);
                if (task && task.pendingItems[msg.index]) {
                    const item = task.pendingItems[msg.index];
                    const confirmed = [...task.confirmedItems, item];
                    const pending = task.pendingItems.filter((_, i) => i !== msg.index);
                    this.store.updateConfirmedItems(msg.taskId, confirmed);
                    this.store.updatePendingItems(msg.taskId, pending);
                    this.flowHandler.sendTaskInfo(msg.taskId);
                    this.refreshSidebarCallback?.();
                }
            }
        });
        this.router.on('cancelQueuedMessage', (msg) => { if (msg.index >= 0 && msg.index < this.pendingMessages.length) { this.pendingMessages.splice(msg.index, 1); this.sendPendingQueueUpdate(); } });
        this.router.on('clearPendingQueue', () => { this.pendingMessages = []; this.sendPendingQueueUpdate(); });
        this.router.on('openTerminal', () => vscode.commands.executeCommand('workbench.action.terminal.new'));
        this.router.on('convertAssistantToTask', () => { this.assistantHandler.convertToTask(); });
        this.router.on('updateHooks', (msg) => { if (msg.phase && Array.isArray(msg.commands)) { this.store.updateTaskHooks(msg.taskId, msg.phase, msg.commands); this.flowHandler.sendTaskInfo(msg.taskId); } });
        this.router.on('selectTask', (msg) => { this.loadTask(msg.taskId); this.refreshSidebarCallback?.(); });
        this.router.on('sendAssistantMessage', async (msg) => { await this.assistantHandler.handleMessage(msg.text); });
        this.router.on('slashCommand', async (msg) => { await this.handleSlashCommand(msg.text, msg.taskId); });
        this.router.on('switchAgent', (msg) => { this.sessionHandler.handleSwitchAgent(msg.label); });
        this.router.on('openSettings', () => vscode.commands.executeCommand('kcode.openSettings'));
        this.router.on('openKnowledgeEntry', (msg) => vscode.commands.executeCommand('kcode.openKnowledgeWiki', msg.entryId));
        this.router.on('openTaskFromKnowledge', (msg) => vscode.commands.executeCommand('kcode.selectTask', msg.taskId));
        this.router.on('openTerminalReplay', async (msg) => {
            console.log('[openTerminalReplay] received, taskId=' + msg.taskId);
            const { TaskTerminalManager } = await import('../plugins/terminal/TaskTerminalManager');
            const mgr = new TaskTerminalManager();
            const task = msg.taskId ? this.store.getTask(msg.taskId) : null;
            mgr.openReplay(msg.taskId, task?.title || '任务');
        });

        this.router.on('enablePlugin', async (msg) => {
            await this.pluginManager.enablePlugin(msg.id);
            this.sendPluginList();
        });
        this.router.on('disablePlugin', async (msg) => {
            await this.pluginManager.disablePlugin(msg.id);
            this.sendPluginList();
        });
        this.router.on('getPluginList', () => {
            this.sendPluginList();
        });

        // Plugin message dispatch — after all inline handlers
        this.panel.webview.onDidReceiveMessage((message: any) => {
            this.router.dispatch(message.type, message);
            this.pluginManager.dispatchMessage(message.type, message);
        }, null, this.context.subscriptions);
    }

    storeMessage(taskId: string, role: 'user' | 'agent', content: string): string {
        const id = this.store.nextMessageId(taskId);
        const task = this.store.getTask(taskId);
        this.store.addMessage({ id, taskId, role, content, phase: task?.phase, timestamp: Date.now() });
        return id;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.pendingMessages = [];
        this.taskFlow.loadTask(taskId);
        const task = this.store.getTask(taskId);
        this.hasSetPlanMessage = !!task?.nodeMessageIds?.plan;
        this.hasSetExecuteMessage = !!task?.nodeMessageIds?.execute;
        this.sendCategoryDefs();
        this.sendSlashCommandList();
        this.flowHandler.sendTaskMessages(taskId);
        this.flowHandler.sendTaskInfo(taskId);
        this.flowHandler.sendNodePanelUpdate(taskId);
        this.sessionHandler.ensureSession(taskId).catch(err => {
            this.flowHandler.showAgentError(taskId, err?.message || 'ACP 会话未就绪');
        });
        this.loadWorkspaceHooks().then(hooks => this.taskFlow.setWorkspaceHooks(hooks));
    }

    async loadAssistant(isFirstLaunch: boolean = false) {
        this.currentTaskId = null;
        this.pendingMessages = [];
        this.sendSlashCommandList();

        await this.sessionHandler.ensureConnection();
        // 防止竞态：如果用户在此期间已通过 loadTask 加载了任务，不覆盖任务 UI
        if (this.currentTaskId !== null) return;
        if (this.agentService.isConnected) {
            this.assistantHandler.showLanding();
            this.assistantHandler.loadMessages();
            this.refreshSidebarCallback?.();
            if (isFirstLaunch) this.assistantHandler.startGuide();
        } else {
            const agentName = this.configService.get<string>('agentName', '');
            if (agentName) {
                this.assistantHandler.showLanding();
                this.assistantHandler.loadMessages();
                this.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: 'Agent 未连接', agentName: '' });
            } else {
                await this.assistantHandler.startEnvDetection(isFirstLaunch, () => this._runEnvSetup());
            }
        }
    }

    showNewTaskView() {
        this.currentTaskId = null;
        this.pendingMessages = [];
        this.sendSlashCommandList();
        this.router.PostMessage({ type: 'showNewTaskView' });
    }

    loadAssistantWithGuide() {
        this.loadAssistant(true);
    }

    async reconnectAgent() {
        await this.agentService.disconnect();
        this.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: '正在重连 Agent...', agentName: '' });
        await this.sessionHandler.ensureConnection();
        if (this.agentService.isConnected) {
            this.router.PostMessage({ type: 'agentStatus', status: 'connected', message: 'Agent 已连接', agentName: this.agentService.agentName, modelName: this.agentService.modelName });
        } else {
            this.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: this.agentService.lastError || 'Agent 未连接', agentName: '' });
        }
        if (this.assistantHandler) {
            this.assistantHandler.showLanding();
            this.assistantHandler.loadMessages();
        }
    }

    autoSendGoal(taskId: string, text: string) { this.sessionHandler.handleSendMessage(text, taskId); }

    private async _runEnvSetup() {
        let streamBuffer = '';
        const stream = (text: string) => {
            streamBuffer += text;
            this.router.PostMessage({ type: 'agentStreamUpdate', text });
        };

        stream('正在检查运行环境…\n');

        const { detectEnv } = await import('./SetupWizard');
        const env = await detectEnv(() => {});

        // 自动检测 Node.js，缺失或版本过低则自动下载 Node 24
        const { ensureNode, needsManagedNode } = await import('../env/NodeManager');
        const nodePath = await ensureNode(stream);

        if (!nodePath && await needsManagedNode()) {
            stream('\n\n❌ Node.js 不可用，请手动安装 Node.js https://nodejs.org');
            return;
        }

        if (!env.kiloInstalled && !env.opencodeInstalled && !env.claudeInstalled) {
            stream('\n\n⚠️ 未检测到 Agent CLI，将自动安装 Claude Code：\n```bash\nnpm install -g @anthropic-ai/claude-code\n```\n或手动安装其一：\n- Claude: `npm install -g @anthropic-ai/claude-code`\n- Kilo: `npm install -g @kilocode/cli`\n- OpenCode: `npm install -g opencode-ai@latest`');
            return;
        }

        const agentToUse = env.claudeInstalled ? 'claude' : env.kiloInstalled ? 'kilo' : env.opencodeInstalled ? 'opencode' : 'claude';
        const configWasMissing = !env.configReady;

        try {
            if (!env.configReady) {
                stream('\n\n正在配置 Agent…');
                this.configService.set('agentName', agentToUse);
                await this.configService.save();
                stream(`\n\n✅ 已自动配置 agentName = "${agentToUse}"`);
            }

            this._streamModelConfig(stream);

            stream('\n\n正在连接 Agent…');
            if (this.agentService.isConnected) {
                await this.agentService.disconnect();
            }
            const connected = await this.agentService.connectByLabel(agentToUse);
            if (connected) {
                stream('\n\n✅ **环境已就绪**');
            } else {
                const err = this.agentService.lastError;
                stream(`\n\n⚠️ 环境配置完成，但连接仍有问题\n${err ? `\n**错误**: ${err}` : ''}\n\n👉 请检查 Agent 配置是否正确`);
            }

            if (this.agentService.isConnected) {
                const labelMap: Record<string, string> = { kilo: 'Kilo', opencode: 'OpenCode', claude: 'Claude' };
                this.router.PostMessage({
                    type: 'agentStatus', status: 'connected',
                    message: labelMap[agentToUse] || agentToUse,
                    agentName: this.agentService.agentName,
                    modelName: this.agentService.modelName,
                });
                this.sessionHandler.sendAgentList();
            }
        } catch (err: any) {
            stream(`\n\n⚠️ 环境配置异常: ${err?.message || err}`);
        }

        // 先持久化流式内容再 transition，避免 transitionAfterSetup 清空消息时丢失
        this.assistantHandler.transitionAfterSetup(configWasMissing, streamBuffer);
    }

    private _streamModelConfig(stream: (text: string) => void) {
        const agentName = this.configService.get<string>('agentName', '');
        if (agentName === 'openai') {
            const apiKey = this.configService.get<string>('provider.openai.apiKey');
            const model = this.configService.get<string>('provider.openai.model');
            if (apiKey) {
                stream(`\n\n🤖 模型: ${model || '未设置'} | API Key: ✅`);
            } else {
                stream('\n\n⚠️ OpenAI API Key 未配置，请在设置中填写');
            }
        } else if (agentName === 'kilo') {
            stream('\n\n🤖 模型: 使用 Kilo 配置 (~/.config/kilo/kilo.jsonc)');
        } else if (agentName === 'opencode') {
            stream('\n\n🤖 模型: 使用 OpenCode 默认配置');
        } else if (agentName === 'claude') {
            const key = process.env.ANTHROPIC_API_KEY || this.configService.get<string>('provider.anthropic.apiKey', '');
            const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
            if (key) {
                stream(`\n\n🤖 模型: ${model} | API Key: ✅`);
            } else {
                stream(`\n\n🤖 模型: ${model}\n⚠️ ANTHROPIC_API_KEY 未设置，请在环境变量或设置中配置`);
            }
        }
    }

    private getSlashCommandList(): { name: string; description: string }[] {
        const isTask = this.currentTaskId !== null;
        const builtin = [
            { name: '/ai', description: '切换到小助手模式' },
            { name: '/new', description: '新建任务' },
            { name: '/demo', description: '运行 demo 并查看实时输出' },
        ];
        if (isTask) {
            builtin.push(
                { name: '/confirm', description: '确认当前阶段操作' },
                { name: '/reject', description: '驳回验收并附原因' },
                { name: '/cancel', description: '取消当前任务' },
                { name: '/tasks', description: '查看任务概览' },
                { name: '/terminal', description: '终端日志重放' },
            );
        } else {
            builtin.push(
                { name: '/totask', description: '将小助手对话转为任务' },
            );
        }
        const registeredSlash = this.commandRegistry.getSlashCommands();
        const projectCmds = this.commandRegistry.getKiloCommands().map(c => ({
            name: c.name,
            description: c.description,
        }));
        return [...builtin, ...registeredSlash, ...projectCmds];
    }

    private sendSlashCommandList(): void {
        this.router.PostMessage({ type: 'slashCommandList', commands: this.getSlashCommandList() });
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
        } else if (phase === 'self_verify') {
            await this.flowHandler.handleConfirmSelfVerifyDone(taskId);
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

    private sendPluginList() {
        const plugins = this.pluginManager.getRegisteredPlugins().map(p => ({
            id: p.id,
            name: p.name,
            version: p.version,
            enabled: this.pluginManager.isPluginEnabled(p.id),
            active: this.pluginManager.isActive(p.id),
        }));
        this.router.PostMessage({ type: 'pluginList', plugins });
    }

    reveal() { this.panel.reveal(); }
    focusInput() { this.router.PostMessage({ type: 'focusInput' }); }
    flashInput() { this.router.PostMessage({ type: 'flashInput' }); }
    toggleRightPanel() { this.router.PostMessage({ type: 'toggleRightPanel' }); }
    showDiff(o: string, m: string) { this.router.PostMessage({ type: 'showDiff', original: o, modified: m }); }
    showWebView(url: string) { this.router.PostMessage({ type: 'showWebView', url }); }
    getCurrentTaskId(): string | null { return this.currentTaskId; }
    setRefreshSidebarCallback(cb: () => void) { this.refreshSidebarCallback = cb; this.ctx.refreshSidebarCallback = cb; }
    onDidDispose(callback: () => void) { this.onDisposeCallback = callback; }

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
            const msg = `[System] Hook 阶段：仅执行以下 Hook 命令，不要处理任务内容。执行完毕后静默完成。\n\n${hooksStr}`;
            this.acpLogManager.send(tid, 'send', msg);
            await this.agentService.sendPrompt(tid, msg, { onText: () => {}, onReasoning: () => {}, onToolCall: () => {}, onToolCallUpdate: () => {}, onPlan: () => {}, onError: () => {}, onDone: () => {} });
        }
    }

    dispose() {
        this.acpLogManager.dispose();
        this.agentService.disconnect();
        this.pluginManager.deactivateAll();
    }
}
