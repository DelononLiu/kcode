import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from '../store/TaskStore';
import { TaskFlow } from '../taskflow/TaskFlow';
import { AcpClient } from '../acp/AcpClient';
import { FakeAgent } from '../acp/FakeAgent';
import { OpenAIAgent } from '../acp/OpenAIAgent';
import { classifyIntent } from '../acp/intentUtils';
import type { Task, FileChange, ProgressNode } from '../types';

export class KCodePanel {
    private panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private store: TaskStore;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;
    private currentTaskId: string | null = null;
    private acpClient: AcpClient | null = null;
    private fakeAgent: FakeAgent | null = null;
    private openaiAgent: OpenAIAgent | null = null;
    private agentReady: boolean = false;
    private activeToolCalls: Map<string, { title: string; kind: string; status: string; output?: string }> = new Map();
    private refreshSidebarCallback?: () => void;
    private isGenerating: boolean = false;
    private lastConnectError: string = '';
    private hasSetPlanMessage: boolean = false;
    private hasSetExecuteMessage: boolean = false;
    private taskFlow: TaskFlow;

    constructor(context: vscode.ExtensionContext, store: TaskStore) {
        this.context = context;
        this.store = store;

        this.taskFlow = new TaskFlow(store, {
            onPhaseChanged: (taskId: string) => {
                this.sendTaskInfo(taskId);
                this.sendNodePanelUpdate(taskId);
                this.refreshSidebarCallback?.();
            },
            onExecuteFinished: (taskId: string) => {
                this.sendTaskInfo(taskId);
            },
            onGoalFormatted: (taskId: string, goalText: string, originalRequest: string) => {
                this.panel.webview.postMessage({
                    type: 'showGoalConfirmation',
                    goal: goalText,
                    originalRequest,
                    taskId
                });
            },
            onError: (taskId: string, error: string) => {
                this.showAgentError(taskId, error);
            },
            onSelfVerifyNeeded: (taskId: string) => {
                setTimeout(() => this.startAutoGeneration(taskId), 100);
            },
            onSelfVerifyFinished: (taskId: string) => {
                this.sendTaskInfo(taskId);
            }
        });

        this.panel = vscode.window.createWebviewPanel(
            'kcode',
            'KCode',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'kcodeView', 'webview')
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupMessageHandler();

        this.ensureConnection();

        this.panel.onDidDispose(() => {
            this.onDisposeCallback?.();
        });
    }

    private setupMessageHandler() {
        this.panel.webview.onDidReceiveMessage(async (message: any) => {
            switch (message.type) {
                case 'sendMessage':
                    await this.handleSendMessage(message.text, message.taskId);
                    break;
                case 'confirmGoal':
                    await this.handleConfirmGoal(message.taskId, message.originalRequest);
                    break;
                case 'reviseGoal':
                    this.handleReviseGoal(message.taskId);
                    break;
                case 'cancelTask':
                    this.handleCancelTask(message.taskId);
                    break;
                case 'approveReview':
                    this.handleApproveReview(message.taskId);
                    break;
                case 'rejectReview':
                    this.handleRejectReview(message.taskId, message.reason);
                    break;
                case 'showFileDiff':
                    this.handleShowFileDiff(message.original, message.modified);
                    break;
                case 'stopGeneration':
                    this.handleStopGeneration(message.taskId);
                    break;
                case 'openNativeDiff':
                    this.handleOpenNativeDiff(message.original, message.modified, message.filePath);
                    break;
                case 'confirmGoalWithEdit':
                    await this.handleConfirmGoalWithEdit(message.taskId, message.goal, message.originalRequest);
                    break;
                case 'confirmGoalFromHeader':
                    await this.handleConfirmGoalFromHeader(message.taskId);
                    break;
                case 'confirmPlan':
                    await this.handleConfirmPlan(message.taskId);
                    break;
                case 'rejectPlan':
                    this.handleRejectPlan(message.taskId);
                    break;
                case 'confirmExecuteDone':
                    await this.handleConfirmExecuteDone(message.taskId);
                    break;
                case 'toggleAcpLog':
                    this.acpLogEnabled = message.enabled;
                    break;
            }
        }, null, this.context.subscriptions);
    }

    private async handleSendMessage(text: string, taskId?: string) {
        const tid = taskId || this.currentTaskId;
        console.log('[KCode] handleSendMessage called, text:', text, 'tid:', tid, 'agentReady:', this.agentReady, 'acpClient:', !!this.acpClient, 'fakeAgent:', !!this.fakeAgent);
        if (!tid) return;
        if (this.isGenerating) return;

        const task = this.store.getTask(tid);
        if (!task) return;

        const isFirstMessage = this.store.getMessages(tid).length === 0;
        const intent = isFirstMessage ? classifyIntent(text) : 'task';

        // Set task type early so buildPrompt can route by type
        if (isFirstMessage) {
            this.store.updateTaskType(tid, intent);
            if (intent === 'chat') {
                this.store.updateTaskStatus(tid, 'active');
            }
        }

        const isGoalFormatting = isFirstMessage && task.status === 'pending' && intent === 'task';
        const promptText = isFirstMessage
            ? this.taskFlow.buildInitialPrompt(tid, text)
            : this.taskFlow.buildPhaseTransitionPrompt(tid, text);

        // Store user message
        const userMsgId = this.store.nextMessageId(tid);
        this.store.addMessage({
            id: userMsgId,
            taskId: tid,
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        if (isFirstMessage) {
            this.store.updateTaskNodeMessageId(tid, 'demand', userMsgId);
            const prefix = intent === 'task' ? 'Task: ' : 'Chat: ';
            const rawTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
            this.store.updateTaskTitle(tid, prefix + rawTitle);
            this.refreshSidebarCallback?.();
            this.sendTaskInfo(tid);
            this.sendNodePanelUpdate(tid);
        }

        // Send user message to webview for immediate rendering
        this.panel.webview.postMessage({ type: 'addUserMessage', content: text });

        if (!this.agentReady) {
            await this.ensureConnection();
        }

        const handler = this.createAgentResponseHandler(tid, isGoalFormatting, text);

        if (this.agentReady && this.acpClient) {
            try {
                if (!this.acpClient.hasSession(tid)) {
                    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                    await this.acpClient.createSession(tid, workspacePath);
                }
            } catch (err: any) {
                const errorMsg = err?.message || 'Agent 连接失败';
                this.showAgentError(tid, errorMsg);
                return;
            }

            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        } else {
            const config = vscode.workspace.getConfiguration('kcode');
            const agentName = config.get<string>('agentName') || '';
            const errorMsg = this.lastConnectError
                || (!agentName || agentName === 'npx'
                    ? '请配置 Agent：在 VS Code 设置中设置 `kcode.agentName`，指向 Agent 可执行文件路径'
                    : `Agent 连接失败：无法连接到 "${agentName}"，请检查路径是否正确并确保 Agent 已启动`);
            this.showAgentError(tid, errorMsg);
        }
    }

    private async startAutoGeneration(tid: string) {
        if (!tid || this.isGenerating) return;
        const task = this.store.getTask(tid);
        if (!task) return;

        this.panel.webview.postMessage({
            type: 'addSystemMessage',
            content: '🔍 AI 开始自验执行结果...',
            taskId: tid
        });

        const promptText = this.taskFlow.buildPhaseTransitionPrompt(tid, '请自验执行结果');
        const handler = this.createAgentResponseHandler(tid, false, '');

        if (this.agentReady && this.acpClient) {
            try {
                if (!this.acpClient.hasSession(tid)) {
                    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                    await this.acpClient.createSession(tid, workspacePath);
                }
            } catch (err: any) {
                this.showAgentError(tid, err?.message || 'Agent 连接失败');
                return;
            }
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private createAgentResponseHandler(tid: string, isGoalFormatting: boolean, originalText: string) {
        let reasoningText = '';
        let reasoningActive = false;
        let currentReasoningId = '';

        const completeReasoning = () => {
            if (!reasoningActive) return;
            reasoningActive = false;
            sendToolCallUpdate(currentReasoningId, '推理过程', 'thinking', 'completed', reasoningText);
            reasoningText = '';
        };

        const onError = (error: string) => {
            this.setGenerationState(false);
            this.flushAcpRecvBuffer();
            this.taskFlow.getCleanText(tid);
            if (!isGoalFormatting) {
                this.panel.webview.postMessage({
                    type: 'agentStreamUpdate',
                    text: `\n\n[错误: ${error}]`
                });
            }
            this.storeMessage(tid, 'agent', `错误: ${error}`);
        };

        const sendDisplayUpdate = () => {
            if (isGoalFormatting) return;
            const displayText = this.taskFlow.getCleanText(tid) + this.taskFlow.buildPlanSection(tid);
            this.panel.webview.postMessage({
                type: 'agentStreamUpdate',
                text: displayText
            });
        };

        const sendToolCallUpdate = (toolCallId: string, title: string, kind: string, status: string, content?: string) => {
            if (isGoalFormatting) return;
            this.panel.webview.postMessage({
                type: 'toolCallUpdate',
                toolCallId,
                title,
                kind,
                status,
                content
            });
        };

        return {
            onText: (chunk: string) => {
                completeReasoning();
                this.sendAcpLog('recv', chunk);
                this.taskFlow.processChunk(tid, chunk);
                sendDisplayUpdate();
            },
            onReasoning: (text: string) => {
                if (!reasoningActive) {
                    currentReasoningId = 'reasoning_' + this.store.nextMessageId(tid);
                    reasoningActive = true;
                    this.activeToolCalls.set(currentReasoningId, { title: '推理', kind: 'thinking', status: 'running' });
                    sendToolCallUpdate(currentReasoningId, '推理', 'thinking', 'running', '');
                }
                reasoningText += text;
                const tc = this.activeToolCalls.get(currentReasoningId);
                if (tc) tc.output = reasoningText;
                sendToolCallUpdate(currentReasoningId, '推理', 'thinking', 'running', reasoningText);
            },
            onToolCall: (toolCallId: string, title: string, kind: string, status: string) => {
                completeReasoning();
                this.activeToolCalls.set(toolCallId, { title, kind, status });
                sendToolCallUpdate(toolCallId, title, kind, status);
            },
            onToolCallUpdate: (toolCallId: string, status: string, content?: string, title?: string, kind?: string) => {
                const tc = this.activeToolCalls.get(toolCallId);
                if (tc) {
                    tc.status = status;
                    if (content) tc.output = content;
                    if (title) tc.title = title;
                    if (kind) tc.kind = kind;
                }
                sendToolCallUpdate(toolCallId, tc?.title || '', tc?.kind || '', status, content);
            },
            onPlan: (entries: { content: string; priority: string; status: string }[]) => {
                this.taskFlow.setPlanEntries(tid, entries);
                sendDisplayUpdate();
                this.sendNodePanelUpdate(tid);
            },
            onError,
            onDone: (stopReason?: string) => {
                completeReasoning();
                this.setGenerationState(false);
                this.flushAcpRecvBuffer();
                const cleanedText = this.taskFlow.getCleanText(tid);

                if (stopReason === 'cancelled') {
                    this.activeToolCalls.clear();
                    if (cleanedText && !isGoalFormatting) {
                        this.storeMessage(tid, 'agent', cleanedText);
                    }
                    this.taskFlow.resetGeneration(tid);
                    const task = this.store.getTask(tid);
                    this.panel.webview.postMessage({
                        type: 'loadMessages',
                        messages: this.store.getMessages(tid),
                        taskId: tid,
                        taskStatus: task?.status
                    });
                    return;
                }
                if (!isGoalFormatting) {
                    let firstToolMsgId: string | null = null;
                    for (const [toolCallId, tc] of this.activeToolCalls) {
                        const msgId = this.store.nextMessageId(tid);
                        if (!firstToolMsgId) firstToolMsgId = msgId;
                        this.store.addMessage({
                            id: msgId,
                            taskId: tid,
                            role: 'tool',
                            type: 'tool_call',
                            content: JSON.stringify({
                                toolCallId,
                                title: tc.title,
                                kind: tc.kind,
                                status: tc.status,
                                output: tc.output || ''
                            }),
                            timestamp: Date.now()
                        });
                    }
                    if (firstToolMsgId && !this.hasSetExecuteMessage) {
                        this.store.updateTaskNodeMessageId(tid, 'execute', firstToolMsgId);
                        this.hasSetExecuteMessage = true;
                    }
                }
                if (isGoalFormatting) {
                    this.taskFlow.processGoalProposal(tid, this.taskFlow.getCleanText(tid), originalText, originalText);
                } else {
                    const task = this.store.getTask(tid);
                    const genResult = this.taskFlow.getGenResult(tid);

                    if (task?.type === 'task' && task?.phase === 'review') {
                        this.triggerReviewRequest(tid, cleanedText);
                    } else if (genResult.planProposed && task?.type === 'task' && task?.phase === 'plan') {
                        const cardShown = this.showPlanConfirmation(tid);
                        if (cleanedText) {
                            const agentMsgId = this.storeMessage(tid, 'agent', cleanedText);
                            if (agentMsgId && !this.hasSetPlanMessage) {
                                this.store.updateTaskNodeMessageId(tid, 'plan', agentMsgId);
                                this.hasSetPlanMessage = true;
                            }
                        }
                        this.sendNodePanelUpdate(tid);
                        if (!cardShown) {
                            const t = this.store.getTask(tid);
                            this.panel.webview.postMessage({
                                type: 'loadMessages',
                                messages: this.store.getMessages(tid),
                                taskId: tid,
                                taskStatus: t?.status
                            });
                        }
                    } else if (genResult.executeFinished && task?.type === 'task' && task?.phase === 'execute') {
                        if (cleanedText) {
                            this.storeMessage(tid, 'agent', cleanedText);
                        }
                        this.taskFlow.confirmExecuteDone(tid);
                        this.sendTaskInfo(tid);
                        this.sendNodePanelUpdate(tid);
                        const t = this.store.getTask(tid);
                        this.panel.webview.postMessage({
                            type: 'loadMessages',
                            messages: this.store.getMessages(tid),
                            taskId: tid,
                            taskStatus: t?.status
                        });
                        setTimeout(() => this.startAutoGeneration(tid), 100);
                    } else if (genResult.selfVerifyFinished && task?.type === 'task' && task?.phase === 'self_verify') {
                        this.taskFlow.confirmSelfVerifyDone(tid);
                        this.triggerReviewRequest(tid, cleanedText || '自验完成，请验收变更');
                    } else {
                        const agentMsgId = this.storeMessage(tid, 'agent', cleanedText);
                        if (agentMsgId && !this.hasSetPlanMessage) {
                            this.store.updateTaskNodeMessageId(tid, 'plan', agentMsgId);
                            this.hasSetPlanMessage = true;
                        }
                        this.sendNodePanelUpdate(tid);
                        const t = this.store.getTask(tid);
                        this.panel.webview.postMessage({
                            type: 'loadMessages',
                            messages: this.store.getMessages(tid),
                            taskId: tid,
                            taskStatus: t?.status
                        });
                    }
                }
                this.activeToolCalls.clear();
                this.taskFlow.resetGeneration(tid);
            }
        };
    }

    private async handleConfirmGoal(tid: string, originalRequest: string) {
        const confirmMsg = '✅ 确认目标';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: confirmMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: confirmMsg });

        this.taskFlow.confirmGoal(tid);

        const promptText = this.taskFlow.buildPhaseTransitionPrompt(tid, originalRequest);
        const handler = this.createAgentResponseHandler(tid, false, originalRequest);

        if (this.agentReady && this.acpClient) {
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private handleReviseGoal(tid: string) {
        const reviseMsg = '↩️ 修改需求';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: reviseMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: reviseMsg });
        this.store.updateTaskStatus(tid, 'pending');
        this.store.updateTaskGoal(tid, '');
        this.refreshSidebarCallback?.();
        this.sendNodePanelUpdate(tid);
    }

    private handleCancelTask(tid: string) {
        const cancelMsg = '✕ 已取消任务';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: cancelMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: cancelMsg });
        this.store.updateTaskStatus(tid, 'cancelled');
        this.refreshSidebarCallback?.();
        this.sendNodePanelUpdate(tid);
        this.setGenerationState(false);
    }

    private showPlanConfirmation(tid: string): boolean {
        const task = this.store.getTask(tid);
        if (!task || task.planSteps.length === 0) return false;

        const stepsContent = task.planSteps.map(s =>
            `- [${s.status === 'completed' ? 'x' : ' '}] ${s.content}`
        ).join('\n');
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'agent',
            type: 'plan_proposal',
            content: `📋 计划方案\n\n${stepsContent}`,
            timestamp: Date.now()
        });

        this.panel.webview.postMessage({
            type: 'showPlanProposal',
            taskId: tid,
            planSteps: task.planSteps
        });
        return true;
    }

    private async handleConfirmPlan(tid: string) {
        const confirmMsg = '✅ 确认计划';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: confirmMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: confirmMsg });

        this.taskFlow.confirmPlan(tid);
        // 保留计划卡片不删除，用户可看到已确认的历史
        const promptText = this.taskFlow.buildPhaseTransitionPrompt(tid, '计划已确认，请开始执行。');

        const handler = this.createAgentResponseHandler(tid, false, '计划已确认，请开始执行。');

        if (this.agentReady && this.acpClient) {
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private async handleConfirmExecuteDone(tid: string) {
        const confirmMsg = '✅ 确认完成，进入自验';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: confirmMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: confirmMsg });

        this.taskFlow.confirmExecuteDone(tid);
        this.sendTaskInfo(tid);
        this.sendNodePanelUpdate(tid);
        setTimeout(() => this.startAutoGeneration(tid), 100);
    }

    private async handleConfirmGoalFromHeader(tid: string) {
        const msgs = this.store.getMessages(tid);
        const firstUserMsg = msgs.find(m => m.role === 'user');
        const originalRequest = firstUserMsg?.content || '';
        await this.handleConfirmGoal(tid, originalRequest);
    }

    private handleRejectPlan(tid: string) {
        const reviseMsg = '↩️ 调整计划';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: reviseMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: reviseMsg });
        this.taskFlow.rejectPlan(tid);
    }

    private async handleConfirmGoalWithEdit(tid: string, newGoal: string, originalRequest: string) {
        this.store.updateTaskGoal(tid, newGoal);
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: '✅ 确认目标',
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: '✅ 确认目标' });

        this.taskFlow.confirmGoalWithEdit(tid, newGoal);

        const promptText = this.taskFlow.buildPhaseTransitionPrompt(tid, originalRequest);
        const handler = this.createAgentResponseHandler(tid, false, originalRequest);

        if (this.agentReady && this.acpClient) {
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private handleStopGeneration(taskId?: string) {
        const tid = taskId || this.currentTaskId;
        if (!tid) return;
        this.setGenerationState(false);
        if (this.acpClient) {
            this.acpClient.cancel(tid);
        } else if (this.fakeAgent) {
            this.fakeAgent.cancel(tid);
        } else if (this.openaiAgent) {
            this.openaiAgent.cancel(tid);
        }
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'agent',
            type: 'stop_message',
            content: '⏹️ 用户已停止生成',
            timestamp: Date.now()
        });
        const partialText = this.taskFlow.getCleanText(tid);
        if (partialText) {
            this.storeMessage(tid, 'agent', partialText);
        }

        this.taskFlow.resetGeneration(tid);
        const task = this.store.getTask(tid);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: task?.status
        });
    }

    private acpLogs: { direction: 'send' | 'recv'; text: string; timestamp: number }[] = [];
    private acpLogEnabled = false;
    private acpRecvBuffer = '';

    private sendAcpLog(direction: 'send' | 'recv', text: string) {
        if (!this.acpLogEnabled) return;
        if (direction === 'recv') {
            this.acpRecvBuffer += text;
            const lines = this.acpRecvBuffer.split('\n');
            this.acpRecvBuffer = lines.pop() || '';
            for (const line of lines) {
                if (line.trim()) {
                    this.panel.webview.postMessage({ type: 'acpLogEntry', direction, text: line, timestamp: Date.now() });
                }
            }
        } else {
            this.panel.webview.postMessage({ type: 'acpLogEntry', direction, text, timestamp: Date.now() });
        }
    }

    private flushAcpRecvBuffer() {
        if (!this.acpLogEnabled || !this.acpRecvBuffer.trim()) return;
        this.panel.webview.postMessage({ type: 'acpLogEntry', direction: 'recv', text: this.acpRecvBuffer, timestamp: Date.now() });
        this.acpRecvBuffer = '';
    }

    private setGenerationState(generating: boolean) {
        this.isGenerating = generating;
        this.panel.webview.postMessage({ type: 'generationState', isGenerating: generating });
    }

    private triggerReviewRequest(tid: string, content: string) {
        const reviewMsgId = this.store.nextMessageId(tid);
        this.store.addMessage({
            id: reviewMsgId,
            taskId: tid,
            role: 'agent',
            type: 'review_request',
            content,
            timestamp: Date.now()
        });
        this.store.updateTaskNodeMessageId(tid, 'review', reviewMsgId);
        this.store.updateTaskStatus(tid, 'in_review');

        let changes: FileChange[] = [];
        if (this.acpClient) {
            changes = this.acpClient.getReviewChanges(tid);
        } else if (this.fakeAgent) {
            changes = this.fakeAgent.getReviewChanges(tid);
        } else if (this.openaiAgent) {
            changes = this.openaiAgent.getReviewChanges?.(tid) || [];
        }

        if (changes.length === 0) {
            changes = this.collectToolChanges(tid);
        }

        this.store.storeReviewChanges(tid, changes);

        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: 'in_review',
            reviewChanges: changes.length > 0 ? changes : undefined
        });

        this.sendNodePanelUpdate(tid);
        this.refreshSidebarCallback?.();
    }

    private collectToolChanges(tid: string): FileChange[] {
        const msgs = this.store.getMessages(tid);
        const touched = new Map<string, string>();
        const results: FileChange[] = [];

        for (const msg of msgs) {
            if (msg.role !== 'tool' || msg.type !== 'tool_call') continue;
            try {
                const info = JSON.parse(msg.content);
                if (info.kind === 'write' || info.kind === 'edit') {
                    const path = info.title || '';
                    if (path && !touched.has(path)) {
                        touched.set(path, '');
                        const content = info.output || '';
                        results.push({ filePath: path, original: '', modified: content });
                    }
                }
            } catch {}
        }

        return results;
    }

    private handleApproveReview(tid: string) {
        const approveMsg = '✅ 验收通过';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: approveMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: approveMsg });

        this.taskFlow.finishReview(tid);

        const task = this.store.getTask(tid);
        const changes = this.store.getReviewChanges(tid);
        let report = `🎉 任务已完成，《任务完成报告》如下：\n\n`;
        if (task) {
            report += `📋 **任务**：${task.title}\n`;
        }
        if (changes.length > 0) {
            report += `📄 **变更文件**：${changes.length} 个\n`;
            for (const c of changes) {
                report += `  - \`${c.filePath}\`\n`;
            }
        }

        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'agent',
            content: report,
            timestamp: Date.now()
        });

        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: 'completed',
            reviewChanges: this.store.getReviewChanges(tid)
        });
    }

    private async handleRejectReview(tid: string, reason?: string) {
        const rejectMsg = reason ? `↩️ 驳回: ${reason}` : '↩️ 驳回，请继续修改';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: rejectMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: rejectMsg });

        this.taskFlow.rejectReview(tid);

        const promptText = this.taskFlow.buildPhaseTransitionPrompt(tid, rejectMsg);
        const handler = this.createAgentResponseHandler(tid, false, rejectMsg);

        if (this.agentReady && this.acpClient) {
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.taskFlow.resetGeneration(tid);
            this.activeToolCalls.clear();
            this.setGenerationState(true);
            this.sendAcpLog('send', promptText);
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private showAgentError(tid: string, errorMsg: string) {
        this.storeMessage(tid, 'agent', `错误: ${errorMsg}`);
        this.panel.webview.postMessage({
            type: 'agentStreamUpdate',
            text: `\n\n[错误: ${errorMsg}]`
        });
        const task = this.store.getTask(tid);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: task?.status
        });
    }

    private async ensureConnection() {
        console.log('[KCode] ensureConnection called');
        if (this.agentReady || this.fakeAgent || this.openaiAgent) return;

        try {
            const config = vscode.workspace.getConfiguration('kcode');
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();

            const agentUrl = config.get<string>('agentUrl') || '';
            const agentName = config.get<string>('agentName') || '';
            const agentArgs = config.get<string[]>('agentArgs') || [];

            // OpenCode agent via stdio ACP
            if (agentName === 'opencode') {
                console.log('[KCode] Using OpenCode agent');
                const opencodePath = config.get<string>('opencodePath') || 'opencode';
                this.acpClient = new AcpClient(workspacePath);
                const connectPromise = this.acpClient.connect(opencodePath, [
                    'acp', '--port', '0', '--cwd', workspacePath
                ]);
                const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000));
                const connected = await Promise.race([connectPromise, timeoutPromise]);
                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: `OpenCode (${opencodePath})`
                    });
                    return;
                }
                console.log('[KCode] OpenCode connection failed');
                this.lastConnectError = this.acpClient?.lastError || `无法启动 opencode: ${opencodePath}`;
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: this.lastConnectError
                });
                return;
            }

            // FakeAgent for debugging
            if (agentName === 'fake') {
                console.log('[KCode] Using FakeAgent for debugging');
                this.fakeAgent = new FakeAgent();
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'connected',
                    message: 'Fake Agent (调试模式)'
                });
                return;
            }

            // OpenAI Agent
            if (agentName === 'openai') {
                console.log('[KCode] Using OpenAIAgent');
                const openaiConfig = vscode.workspace.getConfiguration('kcode');
                this.openaiAgent = new OpenAIAgent({
                    apiKey: openaiConfig.get<string>('openaiApiKey'),
                    model: openaiConfig.get<string>('openaiModel'),
                    baseURL: openaiConfig.get<string>('openaiBaseUrl'),
                });
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'connected',
                    message: `OpenAI Agent (${this.openaiAgent['config'].model})`
                });
                return;
            }

            this.acpClient = new AcpClient(workspacePath);

            // Priority 1: HTTP mode (when URL is configured)
            if (agentUrl) {
                console.log('[KCode] Trying to connect via HTTP:', agentUrl);
                const connected = await this.acpClient.connectHttp(agentUrl);
                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: 'Agent 已连接 (HTTP)'
                    });
                    return;
                }
                console.log('[KCode] HTTP connection failed');
                this.lastConnectError = this.acpClient?.lastError || `HTTP Agent 连接失败: ${agentUrl}`;
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: this.lastConnectError
                });
                return;
            }

            // Priority 2: stdio subprocess
            if (agentName && agentName !== 'npx') {
                console.log('[KCode] Trying to connect to agent:', agentName);

                const connectPromise = this.acpClient.connect(agentName, agentArgs);
                const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
                const connected = await Promise.race([connectPromise, timeoutPromise]);
                console.log('[KCode] connect result:', connected);

                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: 'Agent 已连接'
                    });
                    return;
                }

                console.log('[KCode] Connection failed');
                this.lastConnectError = this.acpClient?.lastError || `Agent 连接失败: ${agentName}`;
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: this.lastConnectError
                });
                return;
            }

            // No agent configured
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: 'Agent 未连接'
            });
        } catch (err: any) {
            this.lastConnectError = err?.message || 'Agent 连接失败';
            console.error('[KCode] ensureConnection error:', this.lastConnectError);
            this.acpClient = null;
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: this.lastConnectError
            });
        }
    }

    private async ensureSession(taskId: string) {
        if (!this.acpClient || !this.agentReady) return;
        if (this.acpClient.hasSession(taskId)) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        await this.acpClient.createSession(taskId, workspacePath);
    }

    private storeMessage(taskId: string, role: 'user' | 'agent', content: string): string {
        const id = this.store.nextMessageId(taskId);
        this.store.addMessage({
            id,
            taskId,
            role,
            content,
            timestamp: Date.now()
        });
        return id;
    }

    private getWebviewContent(): string {
        const webview = this.panel.webview;
        const extensionUri = this.context.extensionUri;

        const scriptUri = (name: string) => webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', `${name}.js`)
        ).toString();
        // NOTE: all CSS is inlined to avoid webview external resource loading issues
        const inlineStyles = this.getInlineStyles();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>${inlineStyles}</style>
    <title>KCode</title>
</head>
<body>
    <div id="container">
            <!-- Chat Area -->
            <div id="chat-area">
                <div id="chat-header">
                    <div id="task-info">
                        <div id="task-info-primary">
                            <span class="task-info-title">选择任务开始对话</span>
                            <span id="task-status-badge" class="task-status-badge hidden"></span>
                        </div>
                        <div id="task-info-secondary">
                            <span id="task-info-created"></span>
                            <span id="task-info-sep" class="hidden">|</span>
                            <span id="task-info-review"></span>
                        </div>
                        <div id="task-info-goal" class="hidden">
                            <span class="header-label">Goal：</span>
                            <span id="goal-header-text"></span>
                        </div>
                        <div id="task-info-phase" class="hidden">
                            <span id="task-phase-badge" class="task-phase-badge"></span>
                            <button id="goal-confirm-btn" class="plan-confirm-btn hidden">确认目标 ✓</button>
                            <button id="plan-confirm-btn" class="plan-confirm-btn hidden">确认计划</button>
                            <button id="execute-confirm-btn" class="plan-confirm-btn hidden">确认完成 ✓</button>
                        </div>
                        <div id="task-info-items" class="hidden">
                            <div id="confirmed-items"></div>
                            <div id="pending-items"></div>
                        </div>
                        <div id="task-info-plan" class="hidden">
                            <div id="plan-steps"></div>
                        </div>
                    </div>
                </div>
            <div id="chat-body">
                <div id="node-timeline-gutter" class="hidden">
                    <div id="tl-dots"></div>
                </div>
                <div id="chat-scroll" class="chat-empty">
                    <div id="chat-messages">
                    <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
                    <div id="working-indicator" class="hidden">
                        <span class="working-spinner"></span>
                        <span class="working-text">思考中</span>
                    </div>
                </div>
            </div>
            </div>
            <div id="chat-toolbar">
                <button id="acp-log-btn" class="toolbar-btn" title="ACP 协议日志">📄 ACP Log</button>
            </div>
            <div id="chat-input-area">
                <div class="input-wrapper">
                    <textarea id="chat-input" placeholder="提出后续修改要求"></textarea>
                    <div class="input-footer">
                        <div class="input-footer-left">
                            <span class="status-item">
                                <span id="agent-status-dot" class="status-dot offline"></span>
                                <span id="status-model">Agent</span>
                            </span>
                        </div>
                        <div class="input-footer-right">
                            <button class="input-tool-btn image-btn" title="图片">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
                                    <circle cx="5" cy="6" r="1.5" fill="currentColor"/>
                                    <path d="M1.5 11l3.5-3 2.5 2 3-3 3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                                </svg>
                            </button>
                            <button class="input-tool-btn attach-btn" title="附件">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 3v7a2 2 0 004 0V4.5a3.5 3.5 0 00-7 0V10a4.5 4.5 0 009 0V3h-1v7a3.5 3.5 0 01-7 0V4.5a2.5 2.5 0 015 0V10a1 1 0 01-2 0V3H8z" fill="currentColor"/>
                                </svg>
                            </button>
                            <button id="send-btn" class="input-tool-btn" title="发送">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M2 14L14 8L2 2v4.5l6 1.5-6 1.5V14z" fill="currentColor"/>
                                </svg>
                            </button>
                            <button id="stop-btn" class="input-tool-btn hidden" title="停止生成">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/>
                                </svg>
                            </button>

                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div id="splitter-2" class="splitter"></div>

        <div id="right-panel" class="hidden">
            <div id="right-panel-header">
                <div class="tabs">
                    <button class="tab active" data-tab="preview">Preview</button>
                    <button class="tab" data-tab="diff">Diff</button>
                    <button class="tab" data-tab="acplog">ACP Log</button>
                    <button class="tab disabled" data-tab="device" title="即将推出">Device</button>
                </div>
                <button id="right-panel-close" class="close-btn" title="关闭右侧面板">✕</button>
            </div>
            <div id="right-panel-content">
                <div id="tab-preview" class="tab-content active">Preview</div>
                <div id="tab-diff" class="tab-content">Diff</div>
                <div id="tab-acplog" class="tab-content">
                    <div id="acp-log-toolbar">
                        <label><input type="checkbox" id="acp-log-enable"> 采集日志</label>
                        <button id="acp-log-clear" class="toolbar-btn">清空</button>
                    </div>
                    <div id="acp-log-content"></div>
                </div>
                <div id="tab-device" class="tab-content">Device</div>
            </div>
        </div>
    </div>

    <script src="${scriptUri('app.bundle')}"></script>
    <script src="${scriptUri('preview')}"></script>
</body>
</html>`;
    }

    private getInlineStyles(): string {
        return `/* === Reset & Base === */
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#ccc;background:var(--vscode-sideBar-background,#1e1e1e)}
#container{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative}
#splitter-2{display:none}
#chat-area{position:relative;flex:1;display:flex;flex-direction:column;min-width:300px;background:var(--vscode-sideBar-background,#1e1e1e)}
#chat-body{position:relative;flex:1;display:flex;min-height:0}
#chat-scroll{flex:1;overflow-y:auto;min-height:0;background:var(--vscode-sideBar-background,#1e1e1e);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
#chat-messages{padding:0 24px 0 32px;min-height:100%;width:100%}
#chat-scroll.chat-empty{display:none}
#chat-area:has(#chat-scroll.chat-empty){justify-content:center}
#chat-area:has(#chat-scroll.chat-empty) #chat-header{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-body{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-input-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-top:none;gap:8px}
#chat-area:has(#chat-scroll.chat-empty) #chat-input-area .input-wrapper{width:100%;max-width:900px}

/* === Chat Header === */
#chat-header{flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.06)}

/* === Task Info === */
#task-info{padding:10px 24px 6px}
#task-info-primary{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.task-info-title{font-size:14px;font-weight:600;color:#e0e0e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.task-status-badge{font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(255,255,255,.06);color:#888;flex-shrink:0;white-space:nowrap}
.task-status-badge.status-pending{color:#888}
.task-status-badge.status-active{background:rgba(74,139,181,.15);color:#5a9bc8}
.task-status-badge.status-in_review{background:rgba(78,201,176,.12);color:#4ec9b0}
.task-status-badge.status-completed{background:rgba(90,157,107,.12);color:#5a9d6b}
.task-status-badge.status-cancelled{background:rgba(224,96,96,.1);color:#e06060}
#task-info-secondary{display:flex;align-items:center;gap:8px;font-size:11px;color:#666;flex-wrap:wrap}
#task-info-created,#task-info-review{color:#666}
#task-info-sep{color:#444}

/* === Task Info — Goal Row (read-only) === */
#task-info-goal{display:flex;align-items:center;gap:6px;padding:2px 24px 6px;background:rgba(78,201,176,.03)}
#task-info-goal.hidden{display:none}
#task-info-goal .header-label{font-size:11px;color:#888;font-weight:500;flex-shrink:0}
#task-info-goal #goal-header-text{font-size:12.5px;color:#4ec9b0;line-height:1.4;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* === Phase Badge & Consensus === */
#task-info-phase{display:flex;align-items:center;padding:2px 24px 2px;gap:6px}
#task-info-phase.hidden{display:none}
.task-phase-badge{font-size:11px;padding:1px 8px;border-radius:3px;background:rgba(78,201,176,.1);color:#4ec9b0;font-weight:500;display:inline-flex;align-items:center;gap:4px}
#task-info-items{display:flex;flex-direction:column;padding:2px 24px 2px;gap:2px}
#task-info-items.hidden{display:none}
#task-info-items .confirmed-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 6px;border-radius:3px;background:rgba(78,201,176,.08);color:#7ec8a0;margin:1px 4px 1px 0;white-space:nowrap}
#task-info-items .confirmed-tag::before{content:'✓';font-weight:700;font-size:10px}
#task-info-items .pending-tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,.03);color:#888;margin:1px 4px 1px 0;white-space:nowrap}
#task-info-items .pending-tag::before{content:'○';font-size:10px}
#task-info-items .items-label{font-size:10px;color:#666;margin-right:4px}
#task-info-items .items-row{display:flex;flex-wrap:wrap;align-items:center;gap:0}
#task-info-plan{display:flex;flex-direction:column;padding:2px 24px 2px}
#task-info-plan.hidden{display:none}
#task-info-plan .plan-step-item{display:flex;align-items:center;gap:6px;font-size:11px;padding:1px 0;color:#aaa}
#task-info-plan .plan-step-item .step-status{font-size:10px;width:14px;text-align:center;flex-shrink:0}
#task-info-plan .plan-step-item .step-status.status-pending{color:#666}
#task-info-plan .plan-step-item .step-status.status-active{color:#4a8bb5}
#task-info-plan .plan-step-item .step-status.status-completed{color:#5a9d6b}
#task-info-plan .plan-step-item .step-content{color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px;user-select:none}
#working-indicator{display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-size:12px;color:#888;width:100%}
#working-indicator.hidden{display:none}
.working-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:#5a9d6b;border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
.working-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-msg{padding:14px 0}
.msg-row{display:flex;align-items:center;min-height:20px}
.chat-msg.agent .msg-row{justify-content:flex-start;padding-left:2px}
.chat-msg.user .msg-row{justify-content:flex-end}
.chat-msg.system{padding:6px 0;text-align:center}
.chat-msg.system .msg-bubble{display:inline-block;font-size:12px;color:#888;padding:2px 12px;background:rgba(255,255,255,.02);border-radius:4px;line-height:1.4}
.copy-msg-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#555;cursor:pointer;padding:2px 4px;border-radius:3px;line-height:1;transition:opacity .2s,color .2s,background .2s;display:inline-flex;align-items:center;gap:3px;font-size:12px;font-family:inherit}
.chat-msg:hover .copy-msg-btn{opacity:1}
.copy-msg-btn:hover{background:rgba(255,255,255,.04);color:#999}
.chat-msg.user{text-align:right}
.chat-msg .msg-sender{display:none}
.chat-msg .msg-bubble{font-size:13.5px;line-height:1.6;word-wrap:break-word;color:#d2d2d4}
.chat-msg .msg-bubble p{margin:.3em 0}
.chat-msg .msg-bubble ul,.chat-msg .msg-bubble ol{margin:.3em 0;padding-left:1.5em}
.chat-msg .msg-bubble li{margin:.1em 0}
.chat-msg .msg-bubble hr{margin:.6em 0;border:none;border-top:1px solid rgba(255,255,255,.06)}
.chat-msg.user .msg-bubble{display:inline-block;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:8px 14px;background:rgba(255,255,255,.02);max-width:80%;line-height:1.5}
.chat-msg .msg-bubble code{font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12.5px;color:#d69d85;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:3px}
.chat-msg .msg-bubble pre code{color:inherit;background:transparent;padding:0;border-radius:0;font-size:12.5px}
.chat-msg .msg-bubble .code-block-wrapper{margin:12px 0;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.2)}
.chat-msg .msg-bubble .code-block-header{display:flex;align-items:center;justify-content:space-between;padding:5px 12px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.05);font-size:11px}
.chat-msg .msg-bubble .code-lang-label{color:#666}
.chat-msg .msg-bubble .code-copy-btn{background:none;border:1px solid transparent;color:#666;cursor:pointer;font-size:11px;padding:1px 6px;border-radius:3px;font-family:inherit;opacity:0;transition:opacity .2s,background .2s}
.chat-msg .msg-bubble .code-block-wrapper:hover .code-copy-btn{opacity:1}
.chat-msg .msg-bubble .code-copy-btn:hover{background:rgba(255,255,255,.06);color:#aaa}
.chat-msg .msg-bubble .code-block-wrapper pre{padding:14px 16px;margin:0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.06) transparent}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar{height:4px}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-track{background:transparent}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:2px}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.12)}
.chat-msg .msg-bubble .code-block-wrapper code.hljs{font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12.5px;line-height:1.55;background:transparent;padding:0;display:block}
.hljs{color:#d2d2d4}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-number,.hljs-class{color:#b5cea8}.hljs-string,.hljs-meta .hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#dcdcaa}.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#808080}.hljs-variable,.hljs-template-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background:#144212;display:inline-block;width:100%}.hljs-deletion{background:#600;display:inline-block;width:100%}
#chat-toolbar{display:flex;gap:4px;padding:8px 12px;background:var(--vscode-sideBar-background,#1e1e1e);border-top:1px solid rgba(255,255,255,.06);flex-shrink:0;justify-content:center}
.toolbar-btn{background:transparent;border:1px solid rgba(255,255,255,.1);color:#aaa;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:3px;white-space:nowrap}
.toolbar-btn:hover{color:#ddd;border-color:rgba(255,255,255,.25)}
.toolbar-btn.active{background:rgba(70,130,200,.25);border-color:rgba(70,130,200,.5);color:#7ab8f5}
#acp-log-btn{border:none;padding:3px 10px}
#acp-log-btn:hover{background:rgba(255,255,255,.04)}
#tab-acplog{display:flex;flex-direction:column;height:100%;font-size:11px}
#acp-log-toolbar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}
#acp-log-toolbar label{display:flex;align-items:center;gap:4px;cursor:pointer;color:#aaa;font-size:11px}
#acp-log-toolbar input[type=checkbox]{accent-color:#4a9eff;cursor:pointer}
#acp-log-content{flex:1;overflow-y:auto;padding:4px 6px;font-family:monospace;white-space:pre-wrap;word-break:break-all;line-height:1.4;background:var(--vscode-editor-background,#1e1e1e)}
.acp-log-entry{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.acp-log-entry.send{border-left:2px solid #4a9eff;padding-left:6px;margin:2px 0}
.acp-log-entry.recv{border-left:2px solid #6fcf97;padding-left:6px;margin:2px 0}
.acp-log-dir{display:inline-block;width:28px;font-weight:700;color:#888}
.acp-log-time{color:#666;font-size:10px;margin-right:6px}
.acp-log-text{color:#d4d4d4}
#chat-input-area{border-top:1px solid rgba(255,255,255,.06);padding:12px 24px 10px;background:var(--vscode-sideBar-background,#1e1e1e);flex-shrink:0}
.input-wrapper{background:#25252a;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:10px 12px 6px;transition:border-color .2s,box-shadow .2s}
.input-wrapper:focus-within{border-color:var(--vscode-focusBorder,#007fd4);box-shadow:0 0 8px rgba(0,127,212,.3)}
.input-wrapper.input-flash{animation:input-flash .8s ease-out}
@keyframes input-flash{0%{box-shadow:0 0 0 0 rgba(90,150,200,.2)}50%{box-shadow:0 0 0 4px rgba(90,150,200,.1)}100%{box-shadow:0 0 0 0 rgba(90,150,200,0)}}
#chat-input{width:100%;background:transparent;color:#d2d2d4;border:none;font-family:inherit;font-size:13.5px;resize:none;outline:none;min-height:52px;max-height:200px;line-height:1.5}
#chat-input::placeholder{color:#555}
.input-footer{display:flex;align-items:center;justify-content:space-between;padding-top:4px;min-height:28px}
.input-footer-left{display:flex;align-items:center;gap:2px}
.input-footer-right{display:flex;align-items:center;gap:2px}
.input-tool-btn{background:none;border:none;color:#666;cursor:pointer;padding:4px;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:color .2s,background .2s}
.input-tool-btn.hidden{display:none}
#send-btn{color:#4a8bb5}#send-btn:hover{color:#5a9bc8;background:rgba(74,139,181,.1)}
#stop-btn{color:#c94a4a}#stop-btn:hover{color:#e06060;background:rgba(201,74,74,.1)}
.input-tool-btn:hover{background:rgba(255,255,255,.05);color:#999}
.image-btn{color:#555}.image-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.attach-btn{color:#555}.attach-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 4px;white-space:nowrap;font-size:11px;color:#555;flex-shrink:0}
.status-item svg{opacity:.4}
.status-divider{width:1px;height:10px;background:rgba(255,255,255,.06);flex-shrink:0;margin:0 4px}
.status-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}
.status-dot.online{background:#5a9d6b}
.status-dot.offline{background:#555}
.thinking-dots{display:inline-flex;gap:4px;align-items:center;padding:6px 0}
.thinking-dots .dot{width:5px;height:5px;border-radius:50%;background:#666;animation:dot-bounce 1.4s infinite ease-in-out both}
.thinking-dots .dot:nth-child(1){animation-delay:-0.32s}
.thinking-dots .dot:nth-child(2){animation-delay:-0.16s}
.thinking-dots .dot:nth-child(3){animation-delay:0s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.3}40%{transform:scale(1);opacity:.8}}
#right-panel{position:absolute;right:0;top:0;height:100%;width:500px;background:var(--vscode-sideBar-background,#1e1e1e);border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;z-index:20;box-shadow:-4px 0 16px rgba(0,0,0,.35)}
#right-panel.hidden{display:none}
#right-panel-header{display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.tabs{display:flex;flex:1;overflow-x:auto}
.tab{padding:8px 14px;background:none;border:none;color:#777;font-size:12px;cursor:pointer;border-bottom:1px solid transparent;white-space:nowrap;transition:color .2s}
.tab:hover{color:#bbb}
.tab.active{color:#ddd;border-bottom-color:rgba(255,255,255,.2)}
.tab.disabled{color:#444;cursor:default}
.close-btn{background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:6px 12px;transition:color .2s}
.close-btn:hover{color:#ddd}
#right-panel-content{flex:1;overflow:hidden;position:relative}
.tab-content{display:none;height:100%;overflow-y:auto;padding:12px}
.tab-content.active{display:block}
.msg-bubble.card-bubble{padding:0;border:none;background:transparent}
.msg-card{border:1px solid rgba(255,255,255,.08);border-radius:6px;overflow:hidden;margin-bottom:8px}
.msg-card:last-child{margin-bottom:0}
.msg-card-header{display:flex;align-items:center;padding:7px 12px;font-size:12px;cursor:pointer;user-select:none;gap:6px;color:#bbb;background:rgba(0,0,0,.25)}
.msg-card-header:hover{background:rgba(255,255,255,.015)}
.msg-card-header-text{flex:1;display:flex;align-items:center;gap:5px;min-width:0}
.card-copy-raw-btn{background:none;border:none;color:#555;cursor:pointer;font-size:11px;padding:0 4px;border-radius:3px;flex-shrink:0;line-height:1;transition:color .2s,background .2s;margin-left:auto;margin-right:4px}
.card-copy-raw-btn:hover{color:#ddd;background:rgba(255,255,255,.05)}
.msg-card-toggle{font-size:10px;color:#666;flex-shrink:0;transition:transform .2s}
.msg-card-body{padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.05);font-size:13.5px;line-height:1.6;color:#fff;overflow-y:auto;max-height:300px}
.msg-card-body.tool-card-body{max-height:300px}
.msg-card-body.collapsed{display:none}
.msg-card-actions{display:flex;gap:8px;padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.05)}
.msg-card-btn{flex:1;max-width:150px;padding:5px 10px;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;transition:all .2s}
.msg-card-btn.primary{background:#4a8bb5;color:#fff}
.msg-card-btn.primary:hover{background:#5a9bc8}
.msg-card-btn.secondary{background:rgba(255,255,255,.06);color:#d2d2d4}
.msg-card-btn.secondary:hover{background:rgba(255,255,255,.1)}
.msg-card-btn.cancel{background:transparent;color:#888;border:1px solid rgba(255,255,255,.08)}
.msg-card-btn.cancel:hover{background:rgba(255,255,255,.04);color:#bbb}
.msg-card-status{padding:4px 12px 10px;font-size:12px;color:#777;text-align:center}
.review-changes{padding:6px 0 0;border-top:1px solid rgba(255,255,255,.04);margin-top:6px}
.review-changes-label{font-size:11px;color:#888;padding:4px 0 2px}
.review-changes-item{display:flex;align-items:center;gap:8px;padding:4px 4px;cursor:pointer;font-size:12px;color:#4ec9b0;border-radius:3px;transition:background .15s}
.review-changes-item:hover{background:rgba(255,255,255,.03)}
.review-changes-item.selected{background:rgba(78,201,176,.12);color:#fff}
.review-changes-icon{flex-shrink:0;font-size:13px}
.review-changes-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.review-changes-type{font-size:10px;color:#888;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.04);flex-shrink:0}
.review-changes-summary{font-size:10px;color:#5a9d6b;flex-shrink:0}
.review-changes-open{font-size:12px;color:#555;flex-shrink:0;cursor:pointer;padding:0 4px;transition:color .2s}
.review-changes-open:hover{color:#4a8bb5}
.unified-diff{direction:ltr}
.diff-hunk-header{color:#569cd6;padding:4px 0;font-weight:500;font-size:11px}
.diff-line{display:flex;gap:0;min-height:20px;align-items:stretch}
.diff-line.diff-add{background:rgba(90,157,107,.1)}
.diff-line.diff-del{background:rgba(226,119,122,.08)}
.diff-ln{min-width:36px;text-align:right;padding:0 6px;color:#555;font-size:11px;user-select:none;flex-shrink:0;line-height:20px}
.diff-ln-new{border-left:1px solid rgba(255,255,255,.06);margin-left:4px;padding-left:8px;min-width:36px}
.diff-prefix{width:16px;flex-shrink:0;text-align:center;color:#888;line-height:20px;font-weight:700}
.diff-add .diff-prefix{color:#7ec87e}
.diff-del .diff-prefix{color:#e2777a}
.diff-text{flex:1;white-space:pre;padding:0 4px;line-height:20px;overflow:hidden}
.diff-add .diff-text{color:#7ec87e}
.diff-del .diff-text{color:#e2777a}
.diff-eq .diff-text{color:#999}
.diff-file-header{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;border-bottom:1px solid #3c3c3c;margin-bottom:8px;gap:8px}
.diff-file-header span{font-size:12px;color:#888;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.diff-open-native{background:none;border:1px solid rgba(255,255,255,.1);color:#4a8bb5;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:3px;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .2s,border-color .2s}
.diff-open-native:hover{background:rgba(74,139,181,.08);border-color:rgba(74,139,181,.3)}
.goal-edit-textarea{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;min-height:120px;line-height:1.5}
.goal-edit-textarea:focus{border-color:rgba(78,201,176,.4)}
.plan-confirm-btn{background:#4a8bb5;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;white-space:nowrap;margin-left:8px;transition:background .2s}
.plan-confirm-btn:hover{background:#5a9bc8}
.plan-confirm-btn.hidden{display:none}
.plan-confirmation-card{margin:8px 0}
.plan-steps-body{padding:4px 0}
.plan-step-line{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#d2d2d4}
.plan-step-status{font-size:12px;width:16px;text-align:center;flex-shrink:0;color:#888}
.reject-input-area{padding:4px 0;width:100%}
.reject-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:32px}
.reject-input:focus{border-color:rgba(255,255,255,.2)}
.reject-btn-row{display:flex;gap:6px;padding:6px 0 0;justify-content:flex-end}
.msg-sender{display:flex;align-items:center;gap:4px}
.msg-timestamp{font-size:10px;color:#555;font-weight:400}
.chat-msg.tool{padding:6px 0}
.chat-msg.tool .msg-bubble{font-size:13px;line-height:1.5;color:#b5c9a8}
.tool-kind-icon{font-size:12px;flex-shrink:0;opacity:.45;display:inline-flex;vertical-align:middle}
.tool-body-content{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px;color:#9aa;background:transparent;padding:0}
.tool-body-bash{background:rgba(0,0,0,.3);border-radius:3px;padding:8px!important}
.tool-bash-output{color:#5a9d6b}
.tool-body-diff{color:#d2d2d4}
.tool-thinking{background:rgba(0,0,0,.25)}
.tool-thinking .msg-card-header{color:#777;font-style:italic}
.tool-thinking .tool-body-content{font-size:11.5px;font-style:italic;color:#777}
.tool-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:#5a9d6b;border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
@keyframes tool-spin{to{transform:rotate(360deg)}}
.agent-diff-summary{margin-top:10px;padding:6px 10px;background:rgba(78,201,176,.04);border-left:2px solid #4ec9b0;border-radius:3px;font-size:12px;line-height:1.6;color:#9aa}
.review-inline-actions{display:flex;gap:8px;padding:8px 0 2px}
.review-inline-status{font-size:12px;color:#777;padding:6px 0 2px}
.goal-confirmed-label{font-size:11px;color:#777;padding:4px 0 2px}
.chat-msg.stop-message .msg-bubble{text-align:center;font-size:12px;color:#666;padding:4px 0}

/* === Timeline Gutter === */
#node-timeline-gutter{position:absolute;left:2px;top:0;bottom:0;width:28px;z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:visible}
#node-timeline-gutter.hidden{display:none}
#tl-dots{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;width:100%;z-index:1;padding:4px 0}
.tl-node-wrap{display:flex;align-items:center;justify-content:center;width:100%;z-index:2;flex-shrink:0}
.tl-line-segment{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center;width:4px;z-index:1}.tl-line-dot{width:3px;height:3px;border-radius:50%;flex-shrink:0}
.tl-node{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;transition:background .3s,box-shadow .3s;pointer-events:auto;cursor:pointer;flex-shrink:0}
.tl-node.status-completed{background:#2ea043}
.tl-node.status-active{background:#1f7bc4;box-shadow:0 0 8px rgba(31,123,196,.6);animation:tl-pulse 2s infinite}
.tl-node.status-pending{background:rgba(255,255,255,.12)}
.tl-node.status-pending .tl-emoji{color:rgba(255,255,255,.45)}
.tl-node.status-cancelled{background:#e06060;box-shadow:0 0 6px rgba(224,96,96,.5)}
.tl-emoji{font-size:9px;font-weight:700;pointer-events:none;line-height:1;font-family:inherit;color:#fff}
@keyframes tl-pulse{0%{box-shadow:0 0 0 0 rgba(74,139,181,.4)}70%{box-shadow:0 0 0 6px rgba(74,139,181,0)}100%{box-shadow:0 0 0 0 rgba(74,139,181,0)}}
.msg-highlight{animation:msg-highlight-fade 1.5s ease-out}
@keyframes msg-highlight-fade{0%{background:rgba(78,201,176,.1);border-left:2px solid #4ec9b0}100%{background:transparent;border-left:2px solid transparent}}
`;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.taskFlow.loadTask(taskId);
        const task = this.store.getTask(taskId);
        this.hasSetPlanMessage = !!task?.nodeMessageIds?.plan;
        this.hasSetExecuteMessage = !!task?.nodeMessageIds?.execute;
        this.sendTaskMessages(taskId);
        this.sendTaskInfo(taskId);
        this.sendNodePanelUpdate(taskId);
        this.ensureSession(taskId);
    }

    private sendTaskInfo(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        const phaseLabels: Record<string, string> = {
            demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收'
        };
        this.panel.webview.postMessage({
            type: 'updateTaskInfo',
            title: task.title,
            goal: task.goal,
            goalHint: task.goal ? '🎯 ' + task.goal : '',
            status: task.status,
            phase: task.phase,
            phaseLabel: phaseLabels[task.phase] || task.phase,
            taskType: task.type,
            createdAt: task.createdAt,
            pendingReviewFiles: 0,
            confirmedItems: task.confirmedItems,
            pendingItems: task.pendingItems,
            planSteps: task.planSteps,
            executeFinished: this.taskFlow.isExecuteFinished(taskId)
        });
    }

    private sendTaskMessages(taskId: string) {
        const messages = this.store.getMessages(taskId);
        const task = this.store.getTask(taskId);
        const reviewChanges = this.store.getReviewChanges(taskId);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages,
            taskId,
            taskStatus: task?.status,
            reviewChanges: reviewChanges.length > 0 ? reviewChanges : undefined
        });
    }

    private deriveNodes(taskId: string): ProgressNode[] {
        const task = this.store.getTask(taskId);
        if (!task || task.type === 'chat') return [];

        const msgs = this.store.getMessages(taskId);
        const phase = task.phase;
        const s = task.status;
        const hasGoal = !!task.goal;
        const hasConfirmedGoal = msgs.some(m => m.type === 'goal_confirmed') || phase === 'plan' || phase === 'execute' || phase === 'self_verify' || phase === 'review';
        const hasReviewRequest = msgs.some(m => m.type === 'review_request');
        const hasPlan = this.taskFlow.getPlanEntries(taskId).length > 0 || phase === 'execute' || phase === 'self_verify' || phase === 'review';
        const hasSelfVerify = phase === 'review' || phase === 'self_verify';

        let interruptAt = '';
        if (s === 'cancelled') {
            if (!hasGoal || !hasConfirmedGoal) interruptAt = 'goal';
            else if (!hasReviewRequest) interruptAt = 'execute';
            else interruptAt = 'review';
        }

        const ns = (id: string, completed: boolean, active: boolean): 'pending' | 'active' | 'completed' | 'cancelled' => {
            if (s === 'cancelled' && id === interruptAt) return 'cancelled';
            if (completed) return 'completed';
            if (active) return 'active';
            return 'pending';
        };

        const demandDone = hasGoal || hasConfirmedGoal || s === 'in_review' || s === 'completed';
        const goalActive = hasGoal && !hasConfirmedGoal && s !== 'cancelled';

        const nm = task.nodeMessageIds || {};

        return [
            { id: 'demand', type: 'demand', label: '需求提交', status: ns('demand', demandDone, !demandDone && s !== 'cancelled'), order: 1, messageId: nm.demand },
            { id: 'goal', type: 'goal', label: '目标确认', status: ns('goal', hasConfirmedGoal, goalActive), order: 2, messageId: nm.goal },
            { id: 'plan', type: 'plan', label: '计划', status: ns('plan', hasPlan || s === 'in_review' || s === 'completed', phase === 'plan'), order: 3, messageId: nm.plan },
            { id: 'execute', type: 'execute', label: '执行', status: ns('execute', s === 'in_review' || s === 'completed' || phase === 'self_verify', phase === 'execute' && s === 'active'), order: 4, messageId: nm.execute },
            { id: 'self_verify', type: 'self_verify', label: '自验', status: ns('self_verify', hasSelfVerify && s !== 'active', phase === 'self_verify'), order: 5, messageId: nm.self_verify },
            { id: 'review', type: 'review', label: '验收', status: ns('review', s === 'completed', phase === 'review' && s === 'in_review'), order: 6, messageId: nm.review },
        ];
    }

    private sendNodePanelUpdate(taskId: string) {
        const nodes = this.deriveNodes(taskId);
        const task = this.store.getTask(taskId);
        this.panel.webview.postMessage({
            type: 'updateNodePanel',
            nodes,
            taskType: task?.type || 'task',
        });
    }

    onDidDispose(callback: () => void) {
        this.onDisposeCallback = callback;
    }

    showFilePreview(filePath: string, content: string) {
        this.panel.webview.postMessage({ type: 'showFilePreview', filePath, content });
    }

    showDiff(original: string, modified: string) {
        this.panel.webview.postMessage({ type: 'showDiff', original, modified });
    }

    private async handleOpenNativeDiff(original: string, modified: string, filePath: string) {
        const ext = path.extname(filePath) || '.txt';
        const baseName = path.basename(filePath, ext);
        const timestamp = Date.now();
        const leftUri = vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_original${ext}`));
        const rightUri = vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_modified${ext}`));
        try {
            await vscode.workspace.fs.writeFile(leftUri, Buffer.from(original));
            await vscode.workspace.fs.writeFile(rightUri, Buffer.from(modified));
            await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `变更对比: ${baseName}${ext}`);
        } catch (err) {
            console.error('[KCode] Failed to open diff:', err);
        }
    }

    private handleShowFileDiff(original: string, modified: string) {
        this.showDiff(original, modified);
    }

    showWebView(url: string) {
        this.panel.webview.postMessage({ type: 'showWebView', url });
    }

    deviceConnect(host: string, port: number, connectionType: 'ssh' | 'telnet') {
        this.panel.webview.postMessage({ type: 'deviceConnect', host, port, connectionType });
    }

    reveal() {
        this.panel.reveal();
    }

    flashInput() {
        this.panel.webview.postMessage({ type: 'flashInput' });
    }

    focusInput() {
        this.panel.webview.postMessage({ type: 'focusInput' });
    }

    toggleRightPanel() {
        this.panel.webview.postMessage({ type: 'toggleRightPanel' });
    }

    getCurrentTaskId(): string | null {
        return this.currentTaskId;
    }

    setRefreshSidebarCallback(callback: () => void) {
        this.refreshSidebarCallback = callback;
    }

    dispose() {
        this.acpClient?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
