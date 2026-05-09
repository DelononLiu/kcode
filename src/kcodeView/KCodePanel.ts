import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { AcpClient } from '../acp/AcpClient';
import { FakeAgent } from '../acp/FakeAgent';
import { OpenAIAgent } from '../acp/OpenAIAgent';
import { classifyIntent } from '../acp/intentUtils';
import type { Task, FileChange } from '../types';

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
                    this.handleRejectReview(message.taskId);
                    break;
                case 'showFileDiff':
                    this.handleShowFileDiff(message.original, message.modified);
                    break;
            }
        }, null, this.context.subscriptions);
    }

    private async handleSendMessage(text: string, taskId?: string) {
        const tid = taskId || this.currentTaskId;
        console.log('[KCode] handleSendMessage called, text:', text, 'tid:', tid, 'agentReady:', this.agentReady, 'acpClient:', !!this.acpClient, 'fakeAgent:', !!this.fakeAgent);
        if (!tid) return;

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
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        if (isFirstMessage) {
            const prefix = intent === 'task' ? 'Task: ' : 'Chat: ';
            const rawTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
            this.store.updateTaskTitle(tid, prefix + rawTitle);
            this.store.updateTaskType(tid, intent);
            if (intent === 'chat') {
                this.store.updateTaskStatus(tid, 'active');
            }
            this.refreshSidebarCallback?.();
            this.sendTaskInfo(tid);
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
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
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
        const onError = (error: string) => {
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
                this.accumulatedAgentText += chunk;
                this.stripTaskMarker();
                sendDisplayUpdate();
            },
            onToolCall: (toolCallId: string, title: string, kind: string, status: string) => {
                this.activeToolCalls.set(toolCallId, { title, kind, status });
                sendToolCallUpdate(toolCallId, title, kind, status);
            },
            onToolCallUpdate: (toolCallId: string, status: string, content?: string) => {
                const tc = this.activeToolCalls.get(toolCallId);
                if (tc) {
                    tc.status = status;
                    if (content) tc.output = content;
                }
                sendToolCallUpdate(toolCallId, tc?.title || '', tc?.kind || '', status, content);
            },
            onPlan: (entries: { content: string; priority: string; status: string }[]) => {
                this.planEntries = entries;
                sendDisplayUpdate();
            },
            onError,
            onDone: (stopReason?: string) => {
                if (stopReason === 'cancelled') {
                    this.taskStatusMarker = null;
                    this.activeToolCalls.clear();
                    this.planEntries = [];
                    return;
                }
                if (!isGoalFormatting) {
                    for (const [toolCallId, tc] of this.activeToolCalls) {
                        this.store.addMessage({
                            id: `msg_tool_${toolCallId}`,
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
                }
                if (this.accumulatedAgentText) {
                    if (isGoalFormatting) {
                        this.processGoalProposal(tid, this.accumulatedAgentText, originalText);
                    } else {
                        const cleanedText = this.stripTaskMarker();
                        const task = this.store.getTask(tid);
                        if (task?.type === 'task' && this.taskStatusMarker === 'completed') {
                            this.triggerReviewRequest(tid, cleanedText);
                        } else {
                            this.storeMessage(tid, 'agent', cleanedText);
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

    private buildTaskPrompt(tid: string, userText: string): string {
        const task = this.store.getTask(tid);
        if (!task || task.type !== 'task') return userText;

        const goal = task.goal || '(待确认)';
        const systemPrompt = `[System]\n任务目标：${goal}\n请在回答末尾标注任务状态标记（不显示给用户）：\n- 已完成：[TASK_STATUS: completed]\n- 进行中：[TASK_STATUS: in_progress]\n[/System]\n\n`;
        return systemPrompt + userText;
    }

    private processGoalProposal(tid: string, goalText: string, originalRequest: string) {
        this.store.updateTaskGoal(tid, goalText);
        this.store.updateTaskStatus(tid, 'pending');
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'agent',
            type: 'goal_confirmation',
            content: `📋 任务目标确认\n\n${goalText}`,
            timestamp: Date.now()
        });
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
            id: `msg_${Date.now()}`,
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
        this.refreshSidebarCallback?.();

        this.accumulatedAgentText = '';
        this.activeToolCalls.clear();
        this.planEntries = [];
        const promptText = this.buildTaskPrompt(tid, originalRequest);
        const handler = this.createAgentResponseHandler(tid, false, originalRequest);

        if (this.agentReady && this.acpClient) {
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            await this.openaiAgent.prompt(sessionId, promptText);
        }
    }

    private handleReviseGoal(tid: string) {
        const reviseMsg = '↩️ 修改需求';
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: reviseMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: reviseMsg });
        this.store.updateTaskStatus(tid, 'pending');
        this.store.updateTaskGoal(tid, '');
        this.refreshSidebarCallback?.();
    }

    private handleCancelTask(tid: string) {
        const cancelMsg = '✕ 已取消任务';
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: cancelMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: cancelMsg });
        this.store.updateTaskStatus(tid, 'cancelled');
        this.refreshSidebarCallback?.();
    }

    private triggerReviewRequest(tid: string, content: string) {
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'agent',
            type: 'review_request',
            content,
            timestamp: Date.now()
        });
        this.store.updateTaskStatus(tid, 'in_review');
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid,
            taskStatus: 'in_review'
        });

        const changes = this.acpClient?.getReviewChanges(tid)
            || this.fakeAgent?.getReviewChanges(tid)
            || [];
        if (changes.length > 0) {
            this.panel.webview.postMessage({
                type: 'showReviewRequest',
                taskId: tid,
                changes
            });
        }

        this.refreshSidebarCallback?.();
    }

    private handleApproveReview(tid: string) {
        const approveMsg = '✅ 验收通过';
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: approveMsg,
            timestamp: Date.now()
        });
        this.panel.webview.postMessage({ type: 'addUserMessage', content: approveMsg });
        this.store.addMessage({
            id: `msg_${Date.now()}`,
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
        this.refreshSidebarCallback?.();
    }

    private async handleRejectReview(tid: string) {
        const rejectMsg = '↩️ 驳回，请继续修改';
        this.store.addMessage({
            id: `msg_${Date.now()}`,
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

        const promptText = this.buildTaskPrompt(tid, rejectMsg);
        const handler = this.createAgentResponseHandler(tid, false, rejectMsg);

        if (this.agentReady && this.acpClient) {
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            await this.acpClient.prompt(tid, promptText, handler);
        } else if (this.fakeAgent) {
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
            await this.fakeAgent.prompt(sessionId, promptText);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, handler);
            this.accumulatedAgentText = '';
            this.activeToolCalls.clear();
            this.planEntries = [];
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

    private storeMessage(taskId: string, role: 'user' | 'agent', content: string) {
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId,
            role,
            content,
            timestamp: Date.now()
        });
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
            <div id="task-info">
                <div id="task-info-primary">
                    <span class="task-info-title">选择任务开始对话</span>
                </div>
                <div id="task-info-secondary">
                    <span id="task-info-created"></span>
                    <span id="task-info-review"></span>
                </div>
            </div>
            <div id="chat-scroll" class="chat-empty">
                <div id="chat-messages">
                    <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
                </div>
            </div>
            <div id="chat-input-area">
                <div class="input-wrapper">
                    <div class="input-tools">
                    </div>
                    <textarea id="chat-input" placeholder="提出后续修改要求"></textarea>
                    <div class="input-actions">
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
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#d4d4d4;background:#1e1e1e}
#container{display:flex;height:100vh;width:100vw;overflow:hidden}
.splitter{width:4px;cursor:col-resize;background:transparent;flex-shrink:0;z-index:10}
.splitter:hover,.splitter.active{background:#0e639c}
#chat-area{flex:1;display:flex;flex-direction:column;min-width:300px;background:#1e1e1e}
#task-info{padding:10px 16px;border-bottom:1px solid #2d2d2d;flex-shrink:0;background:#1e1e1e;width:100%;max-width:900px;margin:0 auto}
#task-info-primary{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px}
.task-info-title{font-size:14px;font-weight:600;color:#e0e0e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}
#task-info-secondary{display:flex;align-items:center;justify-content:center;gap:16px;font-size:11px;color:#888}
#chat-scroll{flex:1;overflow-y:auto;min-height:0;background:#1e1e1e;scrollbar-color:#28292b #1e1e1e;--vscode-scrollbarSlider-background:#28292b80;--vscode-scrollbarSlider-hoverBackground:#3a3a3b;--vscode-scrollbarSlider-activeButton-background:#1e1e1e}
#chat-messages{max-width:900px;margin:0 auto;padding:8px 16px;min-height:100%;width:100%}
#chat-scroll.chat-empty{display:none}
#chat-area:has(#chat-scroll.chat-empty){justify-content:center}
#chat-area:has(#chat-scroll.chat-empty) #task-info{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-input-area{border-top:none}
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#6b6b6b;font-size:14px}
.chat-msg{margin-bottom:4px;margin-top:8px}
.chat-msg.user{text-align:right}
.chat-msg.agent{text-align:left}
.chat-msg .msg-bubble{padding:10px 14px;border-radius:8px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-size:13px;max-width:90%;display:inline-block;text-align:left}
.chat-msg.user .msg-bubble{background:#0e639c;color:#fff;border-bottom-right-radius:2px}
.chat-msg.agent .msg-bubble{background:#2d2d2d;color:#d4d4d4;border-bottom-left-radius:2px;border:1px solid #3c3c3c}
.chat-msg.agent .msg-bubble code{background:#1e1e1e;padding:2px 6px;border-radius:3px;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px}
.chat-msg.agent .msg-bubble .code-block-wrapper{margin:8px 0;border-radius:6px;overflow:hidden;border:1px solid #333;background:#1e1e1e}
.chat-msg.agent .msg-bubble .code-block-header{display:flex;align-items:center;justify-content:space-between;padding:4px 12px;background:#252526;border-bottom:1px solid #333;font-size:11px}
.chat-msg.agent .msg-bubble .code-lang-label{color:#888}
.chat-msg.agent .msg-bubble .code-copy-btn{background:none;border:none;color:#888;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:3px;font-family:inherit}
.chat-msg.agent .msg-bubble .code-copy-btn:hover{background:#3c3c3c;color:#ccc}
.chat-msg.agent .msg-bubble .code-block-wrapper pre{background:transparent;padding:12px;margin:0;border:none;border-radius:0;overflow-x:auto}
.chat-msg.agent .msg-bubble .code-block-wrapper code.hljs{background:transparent;padding:0;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px;line-height:1.5}
/* highlight.js vs2015 theme */
pre code.hljs{display:block;overflow-x:auto;padding:1em}code.hljs{padding:3px 5px}.hljs{background:#1e1e1e;color:#dcdcdc}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-number,.hljs-class{color:#b8d7a3}.hljs-string,.hljs-meta .hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#dcdcdc}.hljs-comment,.hljs-quote{color:#57a64a;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#9b9b9b}.hljs-variable,.hljs-template-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background-color:#144212;display:inline-block;width:100%}.hljs-deletion{background-color:#600;display:inline-block;width:100%}
#chat-input-area{border-top:1px solid #2d2d2d;padding:8px 16px 0;background:#1e1e1e;flex-shrink:0;width:100%;max-width:900px;margin:0 auto}
.input-wrapper{display:flex;align-items:flex-end;gap:8px;background:#2d2d2d;border:1px solid #3c3c3c;border-radius:10px;padding:6px 8px;transition:border-color .15s}
.input-wrapper:focus-within{border-color:#0e639c}

.input-wrapper.input-flash{animation:input-flash 1s ease-out}
@keyframes input-flash{0%{background:#2d2d2d;box-shadow:0 0 0 0 rgba(14,99,156,0)}20%{background:rgba(14,99,156,.15);box-shadow:0 0 0 6px rgba(14,99,156,.15)}100%{background:#2d2d2d;box-shadow:0 0 0 0 rgba(14,99,156,0)}}
.input-tools{display:flex;align-items:center;gap:2px;flex-shrink:0;padding-bottom:2px}
.input-tool-btn{background:none;border:none;color:#888;cursor:pointer;padding:4px 5px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:color .15s,background .15s}
.input-tool-btn:hover{background:#3c3c3c;color:#ccc}
#chat-input{flex:1;background:transparent;color:#d4d4d4;border:none;padding:6px 4px;font-family:inherit;font-size:13px;resize:none;outline:none;height:48px;max-height:200px;line-height:1.4}
#chat-input::placeholder{color:#6b6b6b}
.input-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;padding-bottom:2px}
#chat-statusbar{display:flex;align-items:center;gap:0;padding:5px 4px 6px;font-size:11px;color:#6b6b6b;flex-wrap:wrap;flex-shrink:0}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 8px;white-space:nowrap}
.status-item svg{opacity:.5}
.status-divider{width:1px;height:12px;background:#3c3c3c;flex-shrink:0}
.status-item.model-badge{color:#888;font-weight:500}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.status-dot.online{background:#4ec9b0}
.status-dot.offline{background:#6b6b6b}
.thinking-dots{display:inline-flex;gap:5px;align-items:center;padding:4px 0}
.thinking-dots .dot{width:6px;height:6px;border-radius:50%;background:#888;animation:dot-bounce 1.4s infinite ease-in-out both}
.thinking-dots .dot:nth-child(1){animation-delay:-0.32s}
.thinking-dots .dot:nth-child(2){animation-delay:-0.16s}
.thinking-dots .dot:nth-child(3){animation-delay:0s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}
#right-panel{width:320px;min-width:200px;max-width:600px;background:#252526;border-left:1px solid #3c3c3c;display:flex;flex-direction:column;transition:width .2s ease}
#right-panel.hidden{width:0!important;min-width:0;overflow:hidden;border-left:none}
#right-panel-header{display:flex;align-items:center;border-bottom:1px solid #3c3c3c;flex-shrink:0}
.tabs{display:flex;flex:1;overflow-x:auto}
.tab{padding:8px 12px;background:none;border:none;color:#888;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tab:hover{color:#ccc}
 .tab.active{color:#fff;border-bottom-color:#0e639c}
 .tab.disabled{color:#555;cursor:default}
 .close-btn{background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:8px 12px}
.close-btn:hover{color:#fff}
#right-panel-content{flex:1;overflow:hidden;position:relative}
.tab-content{display:none;height:100%;overflow-y:auto;padding:12px}
.tab-content.active{display:block}
.msg-bubble.card-bubble{background:transparent;border:none;padding:0}
.confirm-card{background:#252526;border:1px solid #3c3c3c;border-radius:8px;overflow:hidden}
.confirm-card-header{padding:8px 14px;background:#2d2d2d;font-size:12px;font-weight:600;color:#e0e0e0;border-bottom:1px solid #3c3c3c}
.confirm-card-body{padding:12px 14px;font-size:13px;line-height:1.5;color:#d4d4d4;white-space:pre-wrap;word-wrap:break-word}
.confirm-card-actions{display:flex;gap:8px;padding:8px 14px 12px;border-top:1px solid #3c3c3c}
.confirm-btn{flex:1;padding:6px 12px;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;transition:background .15s}
.confirm-btn.primary{background:#0e639c;color:#fff}
.confirm-btn.primary:hover{background:#1177bb}
.confirm-btn.secondary{background:#3c3c3c;color:#d4d4d4}
.confirm-btn.secondary:hover{background:#4a4a4a}
.confirm-btn.cancel{background:transparent;color:#888;border:1px solid #4a4a4a}
 .confirm-btn.cancel:hover{background:#3c3c3c;color:#ccc}
 .confirm-card-status{padding:6px 14px 12px;font-size:12px;color:#888;text-align:center}
.review-changes{user-select:none}
.review-changes div:hover{background:#2a2a2a;border-radius:3px}
.chat-msg.tool{text-align:left}
.chat-msg.tool .msg-bubble{background:#1e2a1e;color:#b5cea8;border-bottom-left-radius:2px;border:1px solid #3a4a3a;padding:8px 14px;cursor:default;display:inline-block;max-width:90%}
.tool-header{display:flex;align-items:center;gap:6px;font-size:12px;font-family:'Cascadia Code','Fira Code',Consolas,monospace}
.tool-toggle{font-size:10px;color:#888;margin-left:auto;flex-shrink:0;padding-left:8px}
.tool-body{font-size:12px;line-height:1.4;padding:8px 0 0;border-top:1px solid #3a4a3a;margin-top:6px}
.tool-body.collapsed{display:none}
.tool-body-content{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px;color:#b5cea8;background:transparent;padding:0}
.msg-sender{font-size:10px;color:#6b6b6b;margin-bottom:2px;display:flex;align-items:center;gap:4px}`;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.sendTaskMessages(taskId);
        this.sendTaskInfo(taskId);
        // Ensure a session exists for this task (non-blocking)
        this.ensureSession(taskId);
    }

    private sendTaskInfo(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.panel.webview.postMessage({
            type: 'updateTaskInfo',
            title: task.title,
            status: task.status,
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

    onDidDispose(callback: () => void) {
        this.onDisposeCallback = callback;
    }

    showFilePreview(filePath: string, content: string) {
        this.panel.webview.postMessage({ type: 'showFilePreview', filePath, content });
    }

    showDiff(original: string, modified: string) {
        this.panel.webview.postMessage({ type: 'showDiff', original, modified });
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
