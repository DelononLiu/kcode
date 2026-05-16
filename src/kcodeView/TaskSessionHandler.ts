import * as vscode from 'vscode';
import type { KCodePanelContext } from './PanelContext';
import type { AcpMessageHandler } from '../types';
import { classifyIntent } from '../acp/intentUtils';
import { getTemplate, getCategory } from '../taskflow/templates';

export class TaskSessionHandler {
    constructor(private ctx: KCodePanelContext) {}

    async ensureConnection(): Promise<void> {
        const { ctx } = this;
        if (ctx.agentService.isConnected) return;

        try {
            const config = vscode.workspace.getConfiguration('kcode');
            const agentName = config.get<string>('agentName') || '';
            const agentArgs = config.get<string[]>('agentArgs') || [];

            const connected = await ctx.agentService.connect(agentName, agentArgs);
            if (connected) {
                const displayName = ctx.agentService.agentName;
                const msg = displayName === 'kilo'
                    ? `Kilo (${config.get<string>('agentPath') || 'kilo'})`
                    : displayName === 'opencode'
                        ? `OpenCode (${config.get<string>('agentPath') || 'opencode'})`
                        : displayName === 'openai'
                            ? `OpenAI Agent (${config.get<string>('openaiModel') || ''})`
                            : 'Agent 已连接';
                ctx.router.PostMessage({ type: 'agentStatus', status: 'connected', message: msg, agentName: displayName });
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
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        await ctx.agentService.createSession(taskId, workspacePath);
    }

    async doPrompt(tid: string, promptText: string, handler: AcpMessageHandler): Promise<void> {
        const { ctx } = this;
        if (!ctx.agentService.isConnected) { handler.onError('Agent 未就绪'); return; }
        try {
            if (!ctx.agentService.hasSession(tid)) {
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                await ctx.agentService.createSession(tid, workspacePath);
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
        const promptText = isFirstMessage
            ? ctx.taskFlow.buildInitialPrompt(tid, text)
            : ctx.taskFlow.buildPhaseTransitionPrompt(tid, text);

        const userMsgId = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({
            id: userMsgId, taskId: tid, role: 'user', content: text, timestamp: Date.now()
        });

        if (isFirstMessage) {
            ctx.store.updateTaskNodeMessageId(tid, 'demand', userMsgId);
            if (task.title === 'New Task') {
                if (category && subType) {
                    const template = getTemplate(category as any, subType);
                    const label = template?.label || subType;
                    const rawTitle = text.length > 27 ? text.substring(0, 27) + '...' : text;
                    ctx.store.updateTaskTitle(tid, `${label}: ${rawTitle}`);
                } else if (category) {
                    const cat = getCategory(category as any);
                    const label = cat?.label || category;
                    const rawTitle = text.length > 27 ? text.substring(0, 27) + '...' : text;
                    ctx.store.updateTaskTitle(tid, `${label}: ${rawTitle}`);
                } else {
                    const prefix = 'Task: ';
                    const rawTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    ctx.store.updateTaskTitle(tid, prefix + rawTitle);
                }
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
            const config = vscode.workspace.getConfiguration('kcode');
            const agentName = config.get<string>('agentName') || '';
            ctx.showAgentError(tid, ctx.agentService.lastError
                || (!agentName || agentName === 'npx'
                    ? '请配置 Agent：在 VS Code 设置中设置 `kcode.agentName`'
                    : `Agent 连接失败：无法连接到 "${agentName}"`));
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
            ctx.router.PostMessage({ type: 'agentStatus', status: 'connected', message: `已切换到 ${label}`, agentName: displayName });
        } else {
            ctx.router.PostMessage({ type: 'agentStatus', status: 'disconnected', message: ctx.agentService.lastError || 'Agent 切换失败', agentName: '' });
        }
    }

    sendAgentList(): void {
        this.ctx.router.PostMessage({
            type: 'agentList',
            agents: [
                { label: 'Kilo', type: 'kilo' },
                { label: 'OpenCode', type: 'opencode' },
            ],
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

    createAgentResponseHandler(tid: string, isGoalFormatting: boolean, originalText: string): AcpMessageHandler {
        const { ctx } = this;
        let reasoningText = '';
        let reasoningActive = false;
        let currentReasoningId = '';

        const completeReasoning = () => {
            if (!reasoningActive) return;
            reasoningActive = false;
            const full = reasoningText;
            reasoningText = '';
            ctx.flushAcpRecvBuffer();
            if (full) { ctx.sendAcpLog(tid, 'recv', full); ctx.flushAcpRecvBuffer(); }
            const rc = ctx.activeToolCalls.get(currentReasoningId);
            if (rc) rc.status = 'completed';
            sendToolCallUpdate(currentReasoningId, '推理过程', 'thinking', 'completed', full);
        };

        const onError = (error: string) => {
            ctx.setGenerationState(false);
            ctx.taskFlow.getCleanText(tid);
            if (!isGoalFormatting) ctx.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${error}]` });
            ctx.storeMessage(tid, 'agent', `错误: ${error}`);
        };

        const sendDisplayUpdate = () => {
            if (isGoalFormatting) return;
            ctx.router.PostMessage({ type: 'agentStreamUpdate', text: ctx.taskFlow.getCleanText(tid) + ctx.taskFlow.buildPlanSection(tid) });
        };

        const sendToolCallUpdate = (toolCallId: string, title: string, kind: string, status: string, content?: string) => {
            if (isGoalFormatting) return;
            ctx.router.PostMessage({ type: 'toolCallUpdate', toolCallId, title, kind, status, content });
        };

        return {
            onText: (chunk: string) => {
                completeReasoning();
                ctx.sendAcpLog(tid, 'recv', chunk);
                ctx.taskFlow.processChunk(tid, chunk);
                sendDisplayUpdate();
            },
            onReasoning: (text: string) => {
                if (!reasoningActive) {
                    currentReasoningId = 'reasoning_' + ctx.store.nextMessageId(tid);
                    reasoningActive = true;
                    ctx.activeToolCalls.set(currentReasoningId, { title: '推理', kind: 'thinking', status: 'running' });
                    sendToolCallUpdate(currentReasoningId, '推理', 'thinking', 'running', '');
                }
                reasoningText += text;
                const tc = ctx.activeToolCalls.get(currentReasoningId);
                if (tc) tc.output = reasoningText;
                sendToolCallUpdate(currentReasoningId, '推理', 'thinking', 'running', reasoningText);
            },
            onToolCall: (toolCallId, title, kind, status) => {
                completeReasoning();
                ctx.activeToolCalls.set(toolCallId, { title, kind, status });
                sendToolCallUpdate(toolCallId, title, kind, status);
            },
            onToolCallUpdate: (toolCallId, status, content?, title?, kind?) => {
                const tc = ctx.activeToolCalls.get(toolCallId);
                if (tc) { tc.status = status; if (content) tc.output = content; if (title) tc.title = title; if (kind) tc.kind = kind; }
                sendToolCallUpdate(toolCallId, tc?.title || '', tc?.kind || '', status, content);
            },
            onPlan: (entries) => {
                ctx.taskFlow.setPlanEntries(tid, entries);
                sendDisplayUpdate();
                ctx.sendNodePanelUpdate(tid);
            },
            onError,
            onDone: (stopReason?: string) => {
                completeReasoning();
                ctx.setGenerationState(false);
                ctx.flushAcpRecvBuffer();
                const cleanedText = ctx.taskFlow.getCleanText(tid);

                if (stopReason === 'cancelled') {
                    ctx.activeToolCalls.clear();
                    if (cleanedText && !isGoalFormatting) ctx.storeMessage(tid, 'agent', cleanedText);
                    ctx.taskFlow.resetGeneration(tid);
                    const task = ctx.store.getTask(tid);
                    ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: task?.status });
                    return;
                }

                if (!isGoalFormatting) {
                    let firstToolMsgId: string | null = null;
                    for (const [toolCallId, tc] of ctx.activeToolCalls) {
                        const msgId = ctx.store.nextMessageId(tid);
                        if (!firstToolMsgId) firstToolMsgId = msgId;
                        ctx.store.addMessage({
                            id: msgId, taskId: tid, role: 'tool', type: 'tool_call',
                            content: JSON.stringify({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
                            timestamp: Date.now()
                        });
                    }
                    if (firstToolMsgId && !ctx.hasSetExecuteMessage) {
                        ctx.store.updateTaskNodeMessageId(tid, 'execute', firstToolMsgId);
                    }
                }

                // 工具调用输出中也可能包含 [TASK_UPDATE] 协议标记
                if (!isGoalFormatting) {
                    for (const [, tc] of ctx.activeToolCalls) {
                        if (tc.output && /\[TASK_UPDATE\]/i.test(tc.output)) {
                            ctx.taskFlow.processChunk(tid, tc.output);
                        }
                    }
                }

                if (isGoalFormatting) {
                    ctx.taskFlow.processGoalProposal(tid, ctx.taskFlow.getCleanText(tid), originalText, originalText);
                } else {
                    const task = ctx.store.getTask(tid);
                    const genResult = ctx.taskFlow.getGenResult(tid);

                    if (task?.type === 'task' && ctx.taskFlow.isGoalProposed(tid) && task.phase === 'demand') {
                        ctx.taskFlow.processGoalProposal(tid, cleanedText, '', '');
                    } else if (task?.type === 'task' && task?.phase === 'review') {
                        ctx.triggerReviewRequest(tid, cleanedText);
                    } else if (genResult.planProposed && task?.type === 'task' && task?.phase === 'plan') {
                        const cardShown = ctx.showPlanConfirmation(tid);
                        if (cleanedText) {
                            const agentMsgId = ctx.storeMessage(tid, 'agent', cleanedText);
                            if (agentMsgId && !ctx.hasSetPlanMessage) { ctx.store.updateTaskNodeMessageId(tid, 'plan', agentMsgId); }
                        }
                        ctx.sendNodePanelUpdate(tid);
                        if (!cardShown) ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: ctx.store.getTask(tid)?.status });
                    } else if (genResult.executeFinished && task?.type === 'task' && task?.phase === 'execute') {
                        if (cleanedText) ctx.storeMessage(tid, 'agent', cleanedText);
                        ctx.taskFlow.confirmExecuteDone(tid);
                        ctx.sendTaskInfo(tid);
                        ctx.sendNodePanelUpdate(tid);
                        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: ctx.store.getTask(tid)?.status });
                        setTimeout(() => this.startAutoGeneration(tid), 100);
                    } else if (genResult.selfVerifyFinished && task?.type === 'task' && task?.phase === 'self_verify') {
                        ctx.taskFlow.confirmSelfVerifyDone(tid);
                        ctx.sendHooksAsMessage(tid, 'review');
                        ctx.triggerReviewRequest(tid, cleanedText || '自验完成，请验收变更');
                    } else {
                        const agentMsgId = ctx.storeMessage(tid, 'agent', cleanedText);
                        if (agentMsgId && !ctx.hasSetPlanMessage) { ctx.store.updateTaskNodeMessageId(tid, 'plan', agentMsgId); }
                        ctx.sendNodePanelUpdate(tid);
                        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: ctx.store.getTask(tid)?.status });
                    }
                }
                ctx.activeToolCalls.clear();
                ctx.taskFlow.resetGeneration(tid);
            }
        };
    }
}
