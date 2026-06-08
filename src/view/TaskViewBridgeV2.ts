import * as vscode from 'vscode';
import type { KCodePanelContext } from './PanelContext';
import { StreamHandlerBase } from './stream/StreamHandlerBase';
import type { AcpMessageHandler } from '../types';

const _dbg = vscode.window.createOutputChannel('KCode Debug', { log: true });

export class TaskViewBridgeV2 {
    private ctx: KCodePanelContext;

    constructor(ctx: KCodePanelContext) {
        this.ctx = ctx;
    }

    sendStateDelta(taskId: string) {
        const task = this.ctx.store.getTask(taskId);
        if (!task) return;

        const phaseLabels: Record<string, string> = {
            demand: '需求', goal: '目标', plan: '计划',
            execute: '执行', self_verify: '自验', review: '验收',
        };

        this.ctx.router.PostMessage({
            type: 'state-delta',
            viewMode: 'task',
            activeTaskId: taskId,
            activeTaskPhase: task.phase,
            activeTaskStatus: task.status,
            taskInfo: {
                title: task.title,
                goal: task.goal,
                category: task.category || '',
                phase: task.phase,
                phaseLabel: phaseLabels[task.phase] || task.phase,
                status: task.status,
                taskType: task.type,
                createdAt: task.createdAt,
                executeFinished: this.ctx.taskFlow.isExecuteFinished(taskId),
            },
            confirmedItems: task.confirmedItems || [],
            planSteps: task.planSteps || [],
            planVersion: task.planVersion || 1,
            hooks: task.hooks || {},
            workspaceHooks: this.ctx.taskFlow['workspaceHooks'] || {},
        });
    }

    sendMessagesSync(taskId: string) {
        const messages = this.ctx.store.getMessages(taskId);
        this.ctx.router.PostMessage({ type: 'messages-sync', messages });
    }

    sendStreamChunk(taskId: string, text: string) {
        this.ctx.router.PostMessage({ type: 'stream-chunk', taskId, text });
    }

    sendStreamDone(taskId: string, cleanedText: string, toolCalls: Array<{ toolCallId: string; title: string; kind: string; status: string; output?: string }>, phaseFlags?: { planProposed?: boolean; executeFinished?: boolean; selfVerifyFinished?: boolean }) {
        const genResult = this.ctx.taskFlow.getGenResult(taskId);
        const task = this.ctx.store.getTask(taskId);
        _dbg.info(`stream-done taskId=${taskId} phase=${task?.phase} planProposed=${genResult.planProposed} executeFinished=${genResult.executeFinished} selfVerifyFinished=${genResult.selfVerifyFinished} toolCalls=${toolCalls.length}`);
        this.ctx.router.PostMessage({
            type: 'stream-done',
            taskId,
            cleanedText,
            planProposed: genResult.planProposed,
            executeFinished: genResult.executeFinished,
            selfVerifyFinished: genResult.selfVerifyFinished,
            toolCalls,
            ...phaseFlags,
        });
    }

    loadTask(taskId: string) {
        this.ctx.currentTaskId = taskId;
        this.ctx.taskFlow.loadTask(taskId);
        this.sendStateDelta(taskId);
        this.sendMessagesSync(taskId);
    }

    createStreamHandler(taskId: string, isGoalFormatting: boolean, originalText: string): AcpMessageHandler {
        const bridge = this;
        const ctx = this.ctx;

        class V2StreamHandler extends StreamHandlerBase {
            private _id: string;
            private _ctx: KCodePanelContext;
            private _bridge: TaskViewBridgeV2;
            private _isGoalFormatting: boolean;
            private _originalText: string;
            private _agentStartTime: number = 0;

            constructor(tid: string, b: TaskViewBridgeV2, c: KCodePanelContext, isGF: boolean, ot: string) {
                super(
                    tid,
                    c.router,
                    (g: boolean) => c.setGenerationState(g),
                    (dir: 'send' | 'recv', text: string) => c.sendAcpLog(taskId, dir, text),
                    () => c.flushAcpRecvBuffer(taskId),
                );
                this._id = tid;
                this._ctx = c;
                this._bridge = b;
                this._isGoalFormatting = isGF;
                this._originalText = ot;
            }

            protected shouldSuppressToolCallDisplay(): boolean {
                return true;
            }

            protected completeReasoning(): void {
                if (!this.reasoningActive) return;
                this.reasoningActive = false;
                const full = this.reasoningText;
                this.reasoningText = '';
                this.flushAcpRecvBuffer?.();
                if (full) this.sendAcpLog?.('recv', full);
                this.flushAcpRecvBuffer?.();
                const rc = this.activeToolCalls.get(this.currentReasoningId);
                if (rc) {
                    rc.status = 'completed';
                    rc.output = full;
                }
                // V3: send thinking as independent card message, NOT embedded in stream-chunk
                if (full) {
                    this.router.PostMessage({
                        type: 'thinking-chunk',
                        taskId: this.tid,
                        toolCallId: this.currentReasoningId,
                        text: full,
                        status: 'completed',
                    });
                }
            }

            create(): AcpMessageHandler {
                return {
                    onText: (chunk: string) => {
                        this.completeReasoning();
                        if (!this._agentStartTime) this._agentStartTime = Date.now();
                        this.onText(chunk);
                    },
                    onReasoning: (text: string) => {
                        if (!this.reasoningActive) {
                            this.currentReasoningId = 'reasoning_' + Date.now();
                            this.reasoningActive = true;
                            this.activeToolCalls.set(this.currentReasoningId, { title: '思考', kind: 'thinking', status: 'running', eventTime: Date.now() });
                            this.router.PostMessage({ type: 'thinking-chunk', taskId: this.tid, toolCallId: this.currentReasoningId, text: '', status: 'running' });
                        }
                        this.reasoningText += text;
                        const tc = this.activeToolCalls.get(this.currentReasoningId);
                        if (tc) tc.output = this.reasoningText;
                        this.router.PostMessage({ type: 'thinking-chunk', taskId: this.tid, toolCallId: this.currentReasoningId, text: this.reasoningText, status: 'running' });
                    },
                    onToolCall: (toolCallId: string, title: string, kind: string, status: string) => {
                        this.completeReasoning();
                        this.activeToolCalls.set(toolCallId, { title, kind, status, eventTime: Date.now() });
                        this._emitToolCall(toolCallId, title, kind, status);
                        // V3: 实时工具卡片
                        this.router.PostMessage({ type: 'tool-chunk', taskId: this.tid, toolCallId, title, kind, status, content: '' });
                    },
                    onToolCallUpdate: (toolCallId: string, status: string, content?: string, title?: string, kind?: string) => {
                        const tc = this.activeToolCalls.get(toolCallId);
                        if (tc) {
                            tc.status = status;
                            if (content) tc.output = content;
                            if (title) tc.title = title;
                            if (kind) tc.kind = kind;
                        }
                        console.log('[V3 bridge tool-chunk]', JSON.stringify({
                            toolCallId,
                            kind: tc?.kind || kind,
                            title: tc?.title || title,
                            status,
                            contentLength: content?.length || 0,
                            contentPreview: content ? content.substring(0, 200) : '(empty)',
                        }));
                        // V3: 更新实时工具卡片
                        this.router.PostMessage({ type: 'tool-chunk', taskId: this.tid, toolCallId, title: tc?.title || title, kind: tc?.kind || kind, status, content: content || '' });
                    },
                    onPlan: (entries) => this.onPlan(entries),
                    onError: (error) => this.onError(error),
                    onDone: (stopReason) => this.onDone(stopReason),
                };
            }

            protected sendDisplayUpdate(text: string): void {
                this._bridge.sendStreamChunk(this._id, text);
            }

            protected onText(chunk: string): void {
                this.sendAcpLog?.('recv', chunk);
                this._ctx.taskFlow.processChunk(this.tid, chunk);
                const cleanText = this._ctx.taskFlow.getCleanText(this.tid);
                const planSection = this._ctx.taskFlow.buildPlanSection(this.tid);
                this.sendDisplayUpdate(cleanText + planSection);
            }

            protected onDone(stopReason?: string): void {
                this.completeReasoning();
                this.setGenState(false);
                this.flushAcpRecvBuffer?.();

                const cleanedText = this._ctx.taskFlow.getCleanText(this.tid);
                const task = this._ctx.store.getTask(this.tid);

                if (stopReason === 'cancelled') {
                    this.activeToolCalls.clear();
                    if (cleanedText && !this._isGoalFormatting) {
                        this._ctx.storeMessage(this.tid, 'agent', cleanedText);
                    }
                    this._ctx.taskFlow.resetGeneration(this.tid);
                    return;
                }

                // 1. 从工具输出中解析协议指令
                if (!this._isGoalFormatting) {
                    for (const [, tc] of this.activeToolCalls) {
                        if (tc.output && (/\[TASK_UPDATE\]/i.test(tc.output) || /<TODO_UPDATE>|<\/*title>/i.test(tc.output))) {
                            this._ctx.taskFlow.processChunk(this.tid, tc.output);
                        }
                    }
                }

                // 2. 先存工具消息（时序上 thinking/tool 在 agent 文本之前）
                if (!this._isGoalFormatting) {
                    const sorted = Array.from(this.activeToolCalls.entries())
                        .sort((a, b) => (a[1].eventTime || 0) - (b[1].eventTime || 0));
                    for (const [toolCallId, tc] of sorted) {
                        this._ctx.store.addMessage({
                            id: this._ctx.store.nextMessageId(this.tid),
                            taskId: this.tid,
                            role: 'tool',
                            type: 'tool_call',
                            content: JSON.stringify({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
                            phase: task?.phase,
                            timestamp: tc.eventTime || Date.now(),
                        });
                    }
                }

                // 3. 再存 agent 消息（时序上在工具之后）
                if (this._isGoalFormatting) {
                    this._ctx.taskFlow.processGoalProposal(this.tid, cleanedText, this._originalText, this._originalText);
                } else {
                    if (task?.type === 'task' && this._ctx.taskFlow.isGoalProposed(this.tid) && task.phase === 'demand') {
                        this._ctx.taskFlow.processGoalProposal(this.tid, cleanedText, '', '');
                    }

                    if (cleanedText) {
                        this._ctx.store.addMessage({
                            id: this._ctx.store.nextMessageId(this.tid),
                            taskId: this.tid,
                            role: 'agent',
                            content: cleanedText,
                            phase: task?.phase,
                            timestamp: this._agentStartTime || Date.now(),
                        });
                    }

                    if (task?.type === 'task' && task?.phase === 'review' && task?.status !== 'completed' && task?.status !== 'cancelled') {
                        this._ctx.triggerReviewRequest(this.tid, cleanedText);
                    } else if (task?.type === 'task' && task?.phase === 'plan') {
                        this._ctx.showPlanConfirmation(this.tid);
                    }
                }

                const genResult = this._ctx.taskFlow.getGenResult(this.tid);
                const toolCalls = Array.from(this.activeToolCalls.entries()).map(([id, tc]) => ({
                    toolCallId: id, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output,
                }));

                // 只有当前用户正在查看的任务才发 state-delta/stream-done，
                // 否则等回切时由 loadTask 统一同步
                if (this.tid === this._ctx.currentTaskId) {
                    this._bridge.sendStateDelta(this.tid);
                    this._bridge.sendStreamDone(this.tid, cleanedText, toolCalls, {
                        planProposed: genResult.planProposed,
                        executeFinished: genResult.executeFinished,
                        selfVerifyFinished: genResult.selfVerifyFinished,
                    });
                }

                this.activeToolCalls.clear();
                this._ctx.taskFlow.resetGeneration(this.tid);
            }
        }

        return new V2StreamHandler(taskId, bridge, ctx, isGoalFormatting, originalText).create();
    }

    async sendAgentPrompt(taskId: string, promptText: string, isGoalFormatting: boolean, originalText: string) {
        const handler = this.createStreamHandler(taskId, isGoalFormatting, originalText);
        await this.ctx.agentService.sendPrompt(taskId, promptText, handler);
    }
}
