import type { KCodePanelContext } from './PanelContext';
import { StreamHandlerBase } from './stream/StreamHandlerBase';
import type { AcpMessageHandler } from '../types';

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

    sendStreamChunk(text: string) {
        this.ctx.router.PostMessage({ type: 'stream-chunk', text });
    }

    sendStreamDone(taskId: string, cleanedText: string, toolCalls: Array<{ toolCallId: string; title: string; kind: string; status: string; output?: string }>) {
        const genResult = this.ctx.taskFlow.getGenResult(taskId);
        this.ctx.router.PostMessage({
            type: 'stream-done',
            cleanedText,
            planProposed: genResult.planProposed,
            executeFinished: genResult.executeFinished,
            selfVerifyFinished: genResult.selfVerifyFinished,
            toolCalls,
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

            protected sendDisplayUpdate(text: string): void {
                this._bridge.sendStreamChunk(text);
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
                    this._bridge.sendMessagesSync(this.tid);
                    return;
                }

                if (!this._isGoalFormatting) {
                    for (const [toolCallId, tc] of this.activeToolCalls) {
                        this._ctx.store.addMessage({
                            id: this._ctx.store.nextMessageId(this.tid),
                            taskId: this.tid,
                            role: 'tool',
                            type: 'tool_call',
                            content: JSON.stringify({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
                            phase: task?.phase,
                            timestamp: Date.now(),
                        });
                    }
                }

                if (!this._isGoalFormatting) {
                    for (const [, tc] of this.activeToolCalls) {
                        if (tc.output && (/\[TASK_UPDATE\]/i.test(tc.output) || /<TODO_UPDATE>|<\/*title>/i.test(tc.output))) {
                            this._ctx.taskFlow.processChunk(this.tid, tc.output);
                        }
                    }
                }

                if (this._isGoalFormatting) {
                    this._ctx.taskFlow.processGoalProposal(this.tid, cleanedText, this._originalText, this._originalText);
                } else {
                    if (task?.type === 'task' && this._ctx.taskFlow.isGoalProposed(this.tid) && task.phase === 'demand') {
                        this._ctx.taskFlow.processGoalProposal(this.tid, cleanedText, '', '');
                    }

                    if (cleanedText) {
                        this._ctx.storeMessage(this.tid, 'agent', cleanedText);
                    }

                    if (task?.type === 'task' && task?.phase === 'review' && task?.status !== 'completed' && task?.status !== 'cancelled') {
                        this._ctx.triggerReviewRequest(this.tid, cleanedText);
                    } else if (this._ctx.taskFlow.getGenResult(this.tid).planProposed && task?.type === 'task' && task?.phase === 'plan') {
                        if (cleanedText) this._ctx.storeMessage(this.tid, 'agent', cleanedText);
                        this._ctx.showPlanConfirmation(this.tid);
                    } else if (this._ctx.taskFlow.getGenResult(this.tid).executeFinished && task?.type === 'task' && task?.phase === 'execute') {
                        this._ctx.storeMessage(this.tid, 'agent', 'AI 已完成执行，请确认后进入自验阶段。', 'execute_confirmation');
                    } else if (this._ctx.taskFlow.getGenResult(this.tid).selfVerifyFinished && task?.type === 'task' && task?.phase === 'self_verify') {
                        this._ctx.storeMessage(this.tid, 'agent', 'AI 已完成自验，请确认后进入验收阶段。', 'self_verify_confirmation');
                    }

                    const toolCalls = Array.from(this.activeToolCalls.entries()).map(([id, tc]) => ({
                        toolCallId: id, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output,
                    }));

                    this._bridge.sendStateDelta(this.tid);
                    this._bridge.sendStreamDone(this.tid, cleanedText, toolCalls);
                    this._bridge.sendMessagesSync(this.tid);
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
