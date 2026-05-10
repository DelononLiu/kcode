import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { TaskStore } from '../store/TaskStore';
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
    private accumulatedAgentText: string = '';
    private activeToolCalls: Map<string, { title: string; kind: string; status: string; output?: string }> = new Map();
    private planEntries: { content: string; priority: string; status: string }[] = [];
    private taskStatusMarker: string | null = null;
    private refreshSidebarCallback?: () => void;
    private isGenerating: boolean = false;
    private hasSetPlanMessage: boolean = false;
    private hasSetExecuteMessage: boolean = false;

    constructor(context: vscode.ExtensionContext, store: TaskStore) {
        this.context = context;
        this.store = store;

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
                case 'updateGoal':
                    this.handleUpdateGoal(message.taskId, message.goal);
                    break;
                case 'collapseTimeline':
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
        const isGoalFormatting = task.status === 'pending' && intent === 'task';
        let promptText: string;

        if (isGoalFormatting) {
            promptText = `请将以下需求格式化为清晰的任务目标描述：\n\n${text}`;
        } else {
            promptText = this.buildTaskPrompt(tid, text);
        }

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
            this.store.updateTaskType(tid, intent);
            if (intent === 'chat') {
                this.store.updateTaskStatus(tid, 'active');
            }
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

            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.openaiAgent.prompt(sessionId, promptText);
        } else {
            const config = vscode.workspace.getConfiguration('kcode');
            const agentName = config.get<string>('agentName') || '';
            const errorMsg = !agentName || agentName === 'npx'
                ? '请配置 Agent：在 VS Code 设置中设置 `kcode.agentName`，指向 Agent 可执行文件路径'
                : `Agent 连接失败：无法连接到 "${agentName}"，请检查路径是否正确并确保 Agent 已启动`;
            this.showAgentError(tid, errorMsg);
        }
    }

    private buildPlanSection(): string {
        if (this.planEntries.length === 0) return '';
        const lines = ['', '📋 计划:'];
        for (const e of this.planEntries) {
            const icon = e.status === 'completed' ? '✅' : e.status === 'in_progress' ? '🔄' : '⬜';
            lines.push(` ${icon} ${e.content}`);
        }
        return '\n' + lines.join('\n');
    }

    private createAgentResponseHandler(tid: string, isGoalFormatting: boolean, originalText: string) {
        const REASONING_ID_PREFIX = '_reasoning_';
        let reasoningText = '';
        let reasoningActive = false;
        let reasoningBlockCount = 0;
        let currentReasoningId = '';

        const completeReasoning = () => {
            if (!reasoningActive) return;
            reasoningActive = false;
            sendToolCallUpdate(currentReasoningId, '推理过程', 'thinking', 'completed', reasoningText);
            reasoningText = '';
        };

        const onError = (error: string) => {
            this.setGenerationState(false);
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
            this.panel.webview.postMessage({
                type: 'agentStreamUpdate',
                text: this.accumulatedAgentText + this.buildPlanSection()
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
                this.accumulatedAgentText += chunk;
                this.stripTaskMarker();
                sendDisplayUpdate();
            },
            onReasoning: (text: string) => {
                if (!reasoningActive) {
                    reasoningBlockCount++;
                    currentReasoningId = REASONING_ID_PREFIX + reasoningBlockCount;
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
                this.planEntries = entries;
                sendDisplayUpdate();
                this.sendNodePanelUpdate(tid);
            },
            onError,
            onDone: (stopReason?: string) => {
                completeReasoning();
                this.setGenerationState(false);
                if (stopReason === 'cancelled') {
                    this.taskStatusMarker = null;
                    this.activeToolCalls.clear();
                    this.planEntries = [];
                    if (this.accumulatedAgentText && !isGoalFormatting) {
                        this.storeMessage(tid, 'agent', this.accumulatedAgentText);
                    }
                    this.accumulatedAgentText = '';
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
                if (this.accumulatedAgentText) {
                    if (isGoalFormatting) {
                        this.processGoalProposal(tid, this.accumulatedAgentText, originalText);
                    } else {
                        const cleanedText = this.stripTaskMarker();
                        this.stripFileMarkers();
                        const task = this.store.getTask(tid);
                        if (task?.type === 'task' && this.taskStatusMarker === 'completed') {
                            this.triggerReviewRequest(tid, cleanedText);
                        } else {
                            const agentMsgId = this.storeMessage(tid, 'agent', cleanedText);
                            if (agentMsgId && !this.hasSetPlanMessage) {
                                this.store.updateTaskNodeMessageId(tid, 'plan', agentMsgId);
                                this.hasSetPlanMessage = true;
                            }
                            this.sendNodePanelUpdate(tid);
                            const task = this.store.getTask(tid);
                            this.panel.webview.postMessage({
                                type: 'loadMessages',
                                messages: this.store.getMessages(tid),
                                taskId: tid,
                                taskStatus: task?.status
                            });
                        }
                    }
                }
                this.taskStatusMarker = null;
                this.activeToolCalls.clear();
                this.planEntries = [];
            }
        };
    }

    private stripTaskMarker(): string {
        const match = this.accumulatedAgentText.match(/\[TASK_STATUS:\s*(completed|in_progress)\]/);
        if (match) {
            this.taskStatusMarker = match[1];
            this.accumulatedAgentText = this.accumulatedAgentText.replace(match[0], '');
        }
        return this.accumulatedAgentText;
    }

    private parsedFileChanges: FileChange[] = [];

    private stripFileMarkers(): void {
        this.parsedFileChanges = [];
        const lines = this.accumulatedAgentText.split('\n');
        const kept: string[] = [];
        for (const line of lines) {
            const m = line.match(/^\s*\[FILE\]\s+(.+?)\s*\((\w+)\)\s*$/);
            if (m) {
                const filePath = m[1].trim();
                const status = m[2];
                this.parsedFileChanges.push({
                    filePath,
                    original: status === 'new' ? '' : '(see file)',
                    modified: status === 'deleted' ? '' : '(see file)'
                });
            } else {
                kept.push(line);
            }
        }
        this.accumulatedAgentText = kept.join('\n');
    }

    private buildTaskPrompt(tid: string, userText: string): string {
        const task = this.store.getTask(tid);
        if (!task || task.type !== 'task') return userText;

        const goal = task.goal || '(待确认)';
        const systemPrompt = `[System]\n任务目标：${goal}\n请按以下要求回答：\n1. 回答末尾标注任务状态标记（不显示给用户）：\n   - 已完成：[TASK_STATUS: completed]\n   - 进行中：[TASK_STATUS: in_progress]\n2. 如果你创建、修改或删除了文件，请在回答中用以下格式逐行列出行（不显示给用户）：\n   [FILE] 文件路径 (状态)\n   状态为：new / modified / deleted\n   例如：\n   [FILE] hello.py (new)\n   [FILE] src/main.py (modified)\n[/System]\n\n`;
        return systemPrompt + userText;
    }

    private processGoalProposal(tid: string, goalText: string, originalRequest: string) {
        this.store.updateTaskGoal(tid, goalText);
        this.store.updateTaskStatus(tid, 'pending');
        const goalMsgId = this.store.nextMessageId(tid);
        this.store.addMessage({
            id: goalMsgId,
            taskId: tid,
            role: 'agent',
            type: 'goal_confirmation',
            content: `📋 任务目标确认\n\n${goalText}`,
            timestamp: Date.now()
        });
        this.store.updateTaskNodeMessageId(tid, 'goal', goalMsgId);
        this.sendTaskInfo(tid);
        this.sendNodePanelUpdate(tid);
        this.refreshSidebarCallback?.();
        this.panel.webview.postMessage({
            type: 'showGoalConfirmation',
            goal: goalText,
            originalRequest,
            taskId: tid
        });
    }

    private async handleConfirmGoal(tid: string, originalRequest: string) {
        const confirmMsg = '✅ 确认目标，开始执行';
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'user',
            content: confirmMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: confirmMsg });

        const msgs = this.store.getMessages(tid);
        const lastGoal = msgs.filter(m => m.type === 'goal_confirmation').pop();
        if (lastGoal) {
            this.store.updateMessageType(tid, lastGoal.id, 'goal_confirmed');
        }

        this.store.updateTaskStatus(tid, 'active');
        this.sendTaskInfo(tid);
        this.refreshSidebarCallback?.();
        this.sendNodePanelUpdate(tid);

        this.accumulatedAgentText = '';
        this.activeToolCalls.clear();
        this.planEntries = [];
        const promptText = this.buildTaskPrompt(tid, originalRequest);
        const handler = this.createAgentResponseHandler(tid, false, originalRequest);

        if (this.agentReady && this.acpClient) {
            this.setGenerationState(true);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
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

    private handleUpdateGoal(tid: string, newGoal: string) {
        const task = this.store.getTask(tid);
        if (!task) return;
        const oldGoal = task.goal;
        if (oldGoal === newGoal) return;
        this.store.updateTaskGoal(tid, newGoal);
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'agent',
            type: 'goal_updated',
            content: `🎯 目标已更新\n\n\`\`\`\n${oldGoal}\n\`\`\` → \n\`\`\`\n${newGoal}\n\`\`\``,
            timestamp: Date.now()
        });
        this.sendTaskInfo(tid);
        this.refreshSidebarCallback?.();
        this.sendTaskMessages(tid);
        this.panel.webview.postMessage({ type: 'focusInput' });
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
        if (this.accumulatedAgentText) {
            this.storeMessage(tid, 'agent', this.accumulatedAgentText);
            this.accumulatedAgentText = '';
        }
        const task = this.store.getTask(tid);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: task?.status
        });
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
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: 'in_review'
        });

        let changes: FileChange[] = [];
        if (this.acpClient) {
            changes = this.acpClient.getReviewChanges(tid);
        } else if (this.fakeAgent) {
            changes = this.fakeAgent.getReviewChanges(tid);
        } else if (this.openaiAgent) {
            changes = this.openaiAgent.getReviewChanges?.(tid) || [];
        }
        if (changes.length === 0 && this.parsedFileChanges.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';
            changes = this.parsedFileChanges.map(pc => {
                const filePath = pc.filePath;
                const isDeleted = pc.modified === '';
                const isAbsolute = filePath.startsWith('/');
                const resolvedPath = isAbsolute ? filePath : path.join(workspaceRoot, filePath);
                let currentContent = '';
                try {
                    currentContent = fs.readFileSync(resolvedPath, 'utf-8');
                } catch {}
                let originalFromGit = '';
                if (workspaceRoot && currentContent) {
                    const gitPath = isAbsolute && filePath.startsWith(workspaceRoot)
                        ? filePath.slice(workspaceRoot.length + 1)
                        : filePath;
                    try {
                        originalFromGit = execSync(`git show HEAD:"${gitPath}"`, {
                            encoding: 'utf-8',
                            cwd: workspaceRoot,
                            timeout: 3000,
                            stdio: ['pipe', 'pipe', 'ignore']
                        });
                    } catch {}
                }
                if (isDeleted) {
                    return { filePath, original: originalFromGit || currentContent || '(deleted)', modified: '' };
                }
                return { filePath, original: originalFromGit || '', modified: currentContent };
            }).filter(fc => fc.modified !== '' || (fc.original !== '' && fc.original !== '(deleted)'));
        }
        if (changes.length > 0) {
            this.panel.webview.postMessage({
                type: 'showReviewRequest',
                taskId: tid,
                changes
            });
        }

        this.sendNodePanelUpdate(tid);
        this.refreshSidebarCallback?.();
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
        this.store.addMessage({
            id: this.store.nextMessageId(tid),
            taskId: tid,
            role: 'agent',
            content: '🎉 任务已完成',
            timestamp: Date.now()
        });
        const msgs = this.store.getMessages(tid);
        const lastReview = msgs.filter(m => m.type === 'review_request').pop();
        if (lastReview) {
            this.store.updateMessageType(tid, lastReview.id, 'review_approved');
        }
        this.store.updateTaskStatus(tid, 'completed');
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: 'completed'
        });
        this.sendNodePanelUpdate(tid);
        this.refreshSidebarCallback?.();
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
        const msgs = this.store.getMessages(tid);
        const lastReview = msgs.filter(m => m.type === 'review_request').pop();
        if (lastReview) {
            this.store.updateMessageType(tid, lastReview.id, 'review_rejected');
        }
        this.store.updateTaskStatus(tid, 'active');
        this.refreshSidebarCallback?.();
        this.sendNodePanelUpdate(tid);

        const promptText = this.buildTaskPrompt(tid, rejectMsg);
        const handler = this.createAgentResponseHandler(tid, false, rejectMsg);

        if (this.agentReady && this.acpClient) {
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            this.setGenerationState(true);
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
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: `OpenCode 连接失败: ${opencodePath}`
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
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: `HTTP Agent 连接失败: ${agentUrl}`
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
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: `Agent 连接失败: ${agentName}`
                });
                return;
            }

            // No agent configured
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: 'Agent 未连接'
            });
        } catch (err) {
            console.error('[KCode] ensureConnection error:', err);
            this.acpClient = null;
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: 'Agent 连接失败'
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
                            <div id="goal-header-view">
                                <span class="header-label">Goal：</span>
                                <span id="goal-header-text"></span>
                                <button id="goal-edit-btn" title="修改目标">✏️</button>
                            </div>
                            <div id="task-info-points" class="hidden">
                                <span class="header-label">验收要点：</span>
                                <span id="points-text"></span>
                            </div>
                            <div id="goal-header-edit" class="hidden">
                                <textarea id="goal-edit-input" rows="2"></textarea>
                                <div id="goal-edit-actions">
                                    <button id="goal-save-btn" class="goal-edit-btn">保存</button>
                                    <button id="goal-cancel-btn" class="goal-edit-btn cancel">取消</button>
                                </div>
                            </div>
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
            <div id="chat-input-area">
                <div class="input-wrapper">
                    <div class="input-tools">
                    </div>
                    <textarea id="chat-input" placeholder="提出后续修改要求"></textarea>
                    <div class="input-actions">
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
                        <button class="input-tool-btn settings-btn" title="设置">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.2"/>
                                <path d="M13.5 8c0-.3 0-.7-.1-1l1.5-1.2-.6-1.9-1.9-.4c-.4-.4-.9-.7-1.4-1L10.5.5H8.5L7.5 2c-.5.1-1 .4-1.4.7l-1.9-.4-1.5 1L2.5 5c-.3.4-.5.9-.6 1.4L.5 7.5v2l1.5 1.1c.1.5.3 1 .6 1.4l-.6 1.9 1.5 1.5 1.9-.4c.4.4.9.7 1.4 1l1 1.5h2l1-1.5c.5-.3 1-.6 1.4-1l1.9.4 1.5-1.5-.6-1.9c.3-.4.5-.9.6-1.4l1.5-1.1V8z" stroke="currentColor" stroke-width="1.2"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div id="chat-statusbar">
                    <span class="status-item">
                        <span id="agent-status-dot" class="status-dot offline"></span>
                        <span id="status-model">Agent</span>
                    </span>
                </div>
            </div>
        </div>

        <div id="splitter-2" class="splitter"></div>

        <div id="right-panel" class="hidden">
            <div id="right-panel-header">
                <div class="tabs">
                    <button class="tab active" data-tab="preview">Preview</button>
                    <button class="tab" data-tab="diff">Diff</button>
                    <button class="tab disabled" data-tab="device" title="即将推出">Device</button>
                </div>
                <button id="right-panel-close" class="close-btn" title="关闭右侧面板">✕</button>
            </div>
            <div id="right-panel-content">
                <div id="tab-preview" class="tab-content active">Preview</div>
                <div id="tab-diff" class="tab-content">Diff</div>
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
#chat-area:has(#chat-scroll.chat-empty) #chat-input-area{border-top:none}

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

/* === Task Info — Goal Row (merged into header) === */
#task-info-goal{display:flex;flex-direction:column;gap:2px;padding:2px 24px 6px;background:rgba(78,201,176,.03)}
#task-info-goal.hidden{display:none}
#task-info-goal .header-label{font-size:11px;color:#888;font-weight:500;flex-shrink:0}
#task-info-goal #goal-header-view{display:flex;align-items:center;gap:6px}
#task-info-goal #goal-header-text{font-size:12.5px;color:#4ec9b0;line-height:1.4;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#task-info-goal #goal-edit-btn{background:none;border:none;color:#555;cursor:pointer;padding:1px 4px;border-radius:3px;font-size:11px;flex-shrink:0;line-height:1;transition:color .2s,background .2s}
#task-info-goal #goal-edit-btn:hover{color:#ddd;background:rgba(255,255,255,.04)}
#task-info-goal #task-info-points{display:flex;align-items:flex-start;gap:6px;padding:0 0 0 0}
#task-info-goal #task-info-points.hidden{display:none}
#task-info-goal #points-text{font-size:12px;color:#d2d2d4;line-height:1.4}
#task-info-goal #goal-header-edit{padding:2px 0}
#task-info-goal #goal-header-edit.hidden{display:none}
#goal-edit-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12.5px;padding:6px 8px;resize:vertical;outline:none;min-height:36px}
#goal-edit-input:focus{border-color:rgba(255,255,255,.25)}
#goal-edit-actions{display:flex;gap:6px;padding:6px 0 0}
.goal-edit-btn{padding:3px 10px;border:none;border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit;transition:background .2s}
#goal-save-btn{background:#4a8bb5;color:#fff}
#goal-save-btn:hover{background:#5a9bc8}
#goal-cancel-btn{background:rgba(255,255,255,.06);color:#d2d2d4}
#goal-cancel-btn:hover{background:rgba(255,255,255,.1)}
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px;user-select:none}
#working-indicator{display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-size:12px;color:#888;width:100%}
#working-indicator.hidden{display:none}
.working-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:#5a9d6b;border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
.working-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-msg{padding:14px 0}
.msg-row{display:flex;align-items:center;min-height:20px}
.chat-msg.agent .msg-row{justify-content:flex-start;padding-left:2px}
.chat-msg.user .msg-row{justify-content:flex-end}
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
#chat-input-area{border-top:1px solid rgba(255,255,255,.06);padding:12px 24px 10px;background:var(--vscode-sideBar-background,#1e1e1e);flex-shrink:0}
.input-wrapper{background:#25252a;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:10px 12px;transition:border-color .2s,box-shadow .2s}
.input-wrapper:focus-within{border-color:rgba(255,255,255,.15);box-shadow:0 0 0 2px rgba(255,255,255,.03)}
.input-wrapper.input-flash{animation:input-flash .8s ease-out}
@keyframes input-flash{0%{box-shadow:0 0 0 0 rgba(90,150,200,.2)}50%{box-shadow:0 0 0 4px rgba(90,150,200,.1)}100%{box-shadow:0 0 0 0 rgba(90,150,200,0)}}
#chat-input{width:100%;background:transparent;color:#d2d2d4;border:none;font-family:inherit;font-size:13.5px;resize:none;outline:none;min-height:52px;max-height:200px;line-height:1.5}
#chat-input::placeholder{color:#555}
.input-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;position:absolute;right:12px;bottom:10px}
.input-tool-btn{background:none;border:none;color:#666;cursor:pointer;padding:4px;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:color .2s,background .2s}
.input-tool-btn.hidden{display:none}
#send-btn{color:#4a8bb5}#send-btn:hover{color:#5a9bc8;background:rgba(74,139,181,.1)}
#stop-btn{color:#c94a4a}#stop-btn:hover{color:#e06060;background:rgba(201,74,74,.1)}
.input-tool-btn:hover{background:rgba(255,255,255,.05);color:#999}
#chat-statusbar{display:flex;align-items:center;gap:2px;padding:6px 0 0;font-size:11px;color:#555;flex-shrink:0}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 4px;white-space:nowrap}
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
.msg-card{background:#1f1f23;border:1px solid rgba(255,255,255,.08);border-radius:6px;overflow:hidden}
.msg-card-header{display:flex;align-items:center;padding:7px 12px;font-size:12px;cursor:pointer;user-select:none;gap:6px}
.msg-card-header:hover{background:rgba(255,255,255,.015)}
.msg-card-header-text{flex:1;display:flex;align-items:center;gap:5px;min-width:0}
.msg-card-toggle{font-size:10px;color:#666;flex-shrink:0;transition:transform .2s}
.msg-card{background:rgba(0,0,0,.15)}
.msg-card-body{padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.05);font-size:13.5px;line-height:1.6;color:#d2d2d4;overflow-y:auto;max-height:300px}
.msg-card-body.tool-card-body{max-height:100px}
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
.reject-input-area{padding:4px 0;width:100%}
.reject-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:32px}
.reject-input:focus{border-color:rgba(255,255,255,.2)}
.reject-btn-row{display:flex;gap:6px;padding:6px 0 0;justify-content:flex-end}
.msg-sender{display:flex;align-items:center;gap:4px}
.msg-timestamp{font-size:10px;color:#555;font-weight:400}
.chat-msg.tool{padding:2px 0}
.chat-msg.tool .msg-bubble{font-size:13px;line-height:1.5;color:#b5c9a8}
.tool-kind-icon{font-size:12px;flex-shrink:0;opacity:.45;display:inline-flex;vertical-align:middle}
.tool-body-content{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px;color:#9aa;background:transparent;padding:0}
.tool-body-bash{background:rgba(0,0,0,.3);border-radius:3px;padding:8px!important}
.tool-bash-output{color:#5a9d6b}
.tool-body-diff{color:#d2d2d4}
.tool-thinking .msg-card-header{color:#888;font-style:italic}
.tool-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:#5a9d6b;border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
@keyframes tool-spin{to{transform:rotate(360deg)}}
.agent-diff-summary{margin-top:10px;padding:6px 10px;background:rgba(78,201,176,.04);border-left:2px solid #4ec9b0;border-radius:3px;font-size:12px;line-height:1.6;color:#9aa}
.chat-msg.stop-message .msg-bubble{text-align:center;font-size:12px;color:#666;padding:4px 0}

/* === Timeline Gutter === */
#node-timeline-gutter{position:absolute;left:2px;top:0;bottom:0;width:20px;z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:visible}
#node-timeline-gutter.hidden{display:none}
#tl-dots{flex:1;display:flex;flex-direction:column;justify-content:space-between;align-items:center;position:relative;width:100%;z-index:1}
#tl-dots::before{content:'';position:absolute;left:50%;top:5px;bottom:5px;width:2px;background:rgba(255,255,255,.05);transform:translateX(-50%);border-radius:1px}
.tl-node-wrap{display:flex;align-items:center;justify-content:center;width:100%;z-index:2}
.tl-node{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.08);position:relative;transition:background .3s,box-shadow .3s;pointer-events:auto;cursor:pointer;flex-shrink:0}
.tl-node.status-completed{background:#4ec9b0}
.tl-node.status-active{background:#4a8bb5;box-shadow:0 0 6px rgba(74,139,181,.5);animation:tl-pulse 2s infinite}
.tl-node.status-pending{background:rgba(255,255,255,.12)}
.tl-node.status-cancelled{background:#e06060;box-shadow:0 0 6px rgba(224,96,96,.5)}
.tl-emoji{position:absolute;left:-16px;top:-3px;font-size:9px;pointer-events:none;line-height:1}
@keyframes tl-pulse{0%{box-shadow:0 0 0 0 rgba(74,139,181,.4)}70%{box-shadow:0 0 0 6px rgba(74,139,181,0)}100%{box-shadow:0 0 0 0 rgba(74,139,181,0)}}
.msg-highlight{animation:msg-highlight-fade 1.5s ease-out}
@keyframes msg-highlight-fade{0%{background:rgba(78,201,176,.1);border-left:2px solid #4ec9b0}100%{background:transparent;border-left:2px solid transparent}}
`;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.planEntries = [];
        const task = this.store.getTask(taskId);
        this.hasSetPlanMessage = !!task?.nodeMessageIds?.plan;
        this.hasSetExecuteMessage = !!task?.nodeMessageIds?.execute;
        this.sendTaskMessages(taskId);
        this.sendTaskInfo(taskId);
        this.sendNodePanelUpdate(taskId);
        // Ensure a session exists for this task (non-blocking)
        this.ensureSession(taskId);
    }

    private sendTaskInfo(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.panel.webview.postMessage({
            type: 'updateTaskInfo',
            title: task.title,
            goal: task.goal,
            goalHint: task.goal ? '🎯 ' + task.goal : '',
            status: task.status,
            taskType: task.type,
            createdAt: task.createdAt,
            pendingReviewFiles: 0
        });
    }

    private sendTaskMessages(taskId: string) {
        const messages = this.store.getMessages(taskId);
        const task = this.store.getTask(taskId);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages,
            taskId,
            taskStatus: task?.status
        });
    }

    private deriveNodes(taskId: string): ProgressNode[] {
        const task = this.store.getTask(taskId);
        if (!task || task.type === 'chat') return [];

        const msgs = this.store.getMessages(taskId);
        const hasGoal = !!task.goal;
        const hasConfirmedGoal = msgs.some(m => m.type === 'goal_confirmed');
        const hasReviewRequest = msgs.some(m => m.type === 'review_request');
        const hasPlan = this.planEntries.length > 0;
        const s = task.status;

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
            { id: 'plan', type: 'plan', label: '计划', status: ns('plan', hasPlan || s === 'in_review' || s === 'completed', false), order: 3, messageId: nm.plan },
            { id: 'execute', type: 'execute', label: '执行', status: ns('execute', s === 'in_review' || s === 'completed', s === 'active'), order: 4, messageId: nm.execute },
            { id: 'review', type: 'review', label: '验收', status: ns('review', s === 'completed', s === 'in_review'), order: 5, messageId: nm.review },
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
