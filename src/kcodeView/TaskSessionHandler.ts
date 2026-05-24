import * as vscode from 'vscode';
import type { KCodePanelContext } from './PanelContext';
import type { AcpMessageHandler } from '../types';
import { ConfigService } from '../core/ConfigService';
import { classifyIntent } from '../acp/intentUtils';
import { getTemplate, getCategory } from '../taskflow/templates';
import { TaskStreamHandler } from './stream/TaskStreamHandler';

export class TaskSessionHandler {
    constructor(private ctx: KCodePanelContext) {}

    async ensureConnection(): Promise<void> {
        const { ctx } = this;
        if (ctx.agentService.isConnected) return;

        try {
            const cfg = ConfigService.getInstance();
            const agentName = cfg.get<string>('agentName', '');
            const agentArgs = cfg.get<string[]>('agentArgs', []);

            const connected = await ctx.agentService.connect(agentName, agentArgs);
            if (connected) {
                const displayName = ctx.agentService.agentName;
                const modelName = ctx.agentService.modelName;
                const msg = displayName === 'kilo'
                    ? `Kilo`
                    : displayName === 'opencode'
                        ? `OpenCode`
                        : displayName === 'openai'
                            ? `OpenAI (${modelName})`
                            : 'Agent 已连接';
                ctx.router.PostMessage({ type: 'agentStatus', status: 'connected', message: msg, agentName: displayName, modelName });
                this.sendAgentList();
            } else {
                ctx.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: ctx.agentService.lastError || 'Agent 未连接', agentName: '' });
            }
        } catch (err: any) {
            ctx.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: 'Agent 连接失败', agentName: '' });
        }
    }

    async ensureSession(taskId: string): Promise<void> {
        const { ctx } = this;
        if (!ctx.agentService.isConnected || ctx.agentService.hasSession(taskId)) return;
        const task = ctx.store.getTask(taskId);
        const existingSessionId = task?.sessionId;
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        const sessionId = await ctx.agentService.createSession(taskId, workspacePath, existingSessionId);
        if (!sessionId) {
            const lastErr = ctx.agentService.lastError || 'Agent 未就绪或已断开';
            throw new Error(`创建 ACP 会话失败：${lastErr}`);
        }
        if (existingSessionId !== sessionId) {
            ctx.store.updateTaskSessionId(taskId, sessionId);
        }
    }

    async doPrompt(tid: string, promptText: string, handler: AcpMessageHandler): Promise<void> {
        const { ctx } = this;
        if (!ctx.agentService.isConnected) { handler.onError('Agent 未就绪'); return; }
        try {
            if (!ctx.agentService.hasSession(tid)) {
                const task = ctx.store.getTask(tid);
                const existingSessionId = task?.sessionId;
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                const sessionId = await ctx.agentService.createSession(tid, workspacePath, existingSessionId);
                if (!sessionId) {
                    handler.onError(ctx.agentService.lastError || 'ACP 会话未就绪');
                    return;
                }
                if (existingSessionId !== sessionId) {
                    ctx.store.updateTaskSessionId(tid, sessionId);
                }
            }
        } catch (err: any) {
            handler.onError(err?.message || 'Agent 连接失败');
            return;
        }
        ctx.taskFlow.resetGeneration(tid);
        ctx.activeToolCalls.clear();
        ctx.setGenerationState(true);
        ctx.sendAcpLog(tid, 'send', promptText);
        await ctx.agentService.sendPrompt(tid, promptText, handler);
    }

    async handleSendMessage(text: string, taskId?: string, category?: string, subType?: string) {
        const { ctx } = this;
        const tid = taskId || ctx.currentTaskId;
        if (!tid) return;

        if (ctx.isGenerating) {
            ctx.pendingMessages.push({ text, taskId: tid, category, subType });
            ctx.sendPendingQueueUpdate();
            return;
        }

        const task = ctx.store.getTask(tid);
        if (!task) return;

        if (category) {
            ctx.store.updateTaskCategory(tid, category as any);
            if (subType) ctx.store.updateTaskSubType(tid, subType);
        }

        const isFirstMessage = ctx.store.getMessages(tid).length === 0;
        const intent = category ? 'task' : (isFirstMessage ? classifyIntent(text) : 'task');
        const hasGoal = !!task.goal;

        if (isFirstMessage && !hasGoal) {
            ctx.store.updateTaskType(tid, intent === 'chat' ? 'task' : intent);
        }

        const isGoalFormatting = isFirstMessage && task.status === 'pending' && intent === 'task' && !hasGoal;

        let promptUserText = text;
        if (!isFirstMessage && task.phase === 'plan') {
            promptUserText = `还需继续讨论计划，请根据理解重新以 TASK_UPDATE 格式输出任务计划。\n\n用户谈论计划：\n${text}`;
        }

        const promptText = isFirstMessage
            ? ctx.taskFlow.buildInitialPrompt(tid, text)
            : ctx.taskFlow.buildPhaseTransitionPrompt(tid, promptUserText);

        const userMsgId = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({
            id: userMsgId, taskId: tid, role: 'user', content: text, timestamp: Date.now()
        });

        if (isFirstMessage) {
            ctx.store.updateTaskNodeMessageId(tid, 'demand', userMsgId);
            if (task.title === 'New Task') {
                const rawTitle = text.replace(/[^\w\u4e00-\u9fff\s-]/g, '').trim();
                ctx.store.updateTaskTitle(tid, rawTitle.length > 20 ? rawTitle.substring(0, 20) : rawTitle || 'New Task');
            }
            ctx.refreshSidebarCallback?.();
            ctx.sendTaskInfo(tid);
            ctx.sendNodePanelUpdate(tid);
        }

        ctx.router.PostMessage({ type: 'addUserMessage', content: text });

        if (!ctx.agentService.isConnected) await this.ensureConnection();
        const handler = this.createAgentResponseHandler(tid, isGoalFormatting, text);

        if (ctx.agentService.isConnected) {
            await this.doPrompt(tid, promptText, handler);
        } else {
            const agentName = ConfigService.getInstance().get<string>('agentName', '');
            ctx.showAgentError(tid, ctx.agentService.lastError
                || (!agentName || agentName === 'npx'
                    ? 'Agent 未配置'
                    : `无法连接到 "${agentName}"`));
        }
    }

    async handleSwitchAgent(label: string): Promise<void> {
        const { ctx } = this;
        if (ctx.isGenerating) {
            await ctx.stopGeneration(ctx.currentTaskId || '');
        }
        await ctx.agentService.disconnect();
        ctx.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: '正在切换 Agent...', agentName: '' });
        const connected = await ctx.agentService.connectByLabel(label);
        if (connected) {
            const displayName = ctx.agentService.agentName;
            const modelName = ctx.agentService.modelName;
            ctx.router.PostMessage({ type: 'agentStatus', status: 'connected', message: `已切换到 ${label}`, agentName: displayName, modelName });
        } else {
            ctx.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: ctx.agentService.lastError || 'Agent 切换失败', agentName: '' });
        }
    }

    sendAgentList(): void {
        const modelName = this.ctx.agentService.modelName;
        this.ctx.router.PostMessage({
            type: 'agentList',
            agents: [
                { label: 'Kilo', type: 'kilo', model: modelName || '' },
                { label: 'OpenCode', type: 'opencode', model: modelName || '' },
            ],
        });
        this.ctx.router.PostMessage({
            type: 'modelList',
            models: this.ctx.agentService.getAvailableModels(),
        });
    }

    async startAutoGeneration(tid: string) {
        const { ctx } = this;
        if (!tid || ctx.isGenerating) return;
        if (!ctx.store.getTask(tid)) return;

        const sysMsgId = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({
            id: sysMsgId, taskId: tid, role: 'agent', type: 'stop_message',
            content: '🔍 AI 开始自验执行结果...', timestamp: Date.now()
        });
        ctx.store.updateTaskNodeMessageId(tid, 'self_verify', sysMsgId);
        ctx.router.PostMessage({ type: 'addSystemMessage', content: '🔍 AI 开始自验执行结果...', taskId: tid });

        const handler = this.createAgentResponseHandler(tid, false, '');
        await this.doPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, '请自验执行结果'), handler);
    }

    createAgentResponseHandler(tid: string, isGoalFormatting: boolean, originalText: string, parseTables = false): AcpMessageHandler {
        const handler = new TaskStreamHandler(tid, this.ctx, isGoalFormatting, originalText, parseTables);
        return handler.create();
    }
}
