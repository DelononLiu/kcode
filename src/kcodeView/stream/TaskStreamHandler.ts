import { StreamHandlerBase } from './StreamHandlerBase';
import type { KCodePanelContext } from '../PanelContext';
import type { PlanStep } from '../../types';

export class TaskStreamHandler extends StreamHandlerBase {
    constructor(
        tid: string,
        private ctx: KCodePanelContext,
        private isGoalFormatting: boolean,
        private originalText: string,
        private parseTables = false,
    ) {
        super(tid, ctx.router, ctx.setGenerationState,
            (dir, text) => ctx.sendAcpLog(tid, dir, text),
            () => ctx.flushAcpRecvBuffer(tid));
    }

    protected shouldSuppressToolCallDisplay(): boolean {
        return this.isGoalFormatting;
    }

    protected _emitToolCall(toolCallId: string, title: string, kind: string, status: string, content?: string): void {
        super._emitToolCall(toolCallId, title, kind, status, content);
        if (kind === 'todowrite' && content) {
            this._syncTodoToPlanSteps(content);
        }
    }

    private _syncTodoToPlanSteps(content: string): void {
        try {
            const items = JSON.parse(content);
            if (!Array.isArray(items) || items.length === 0) return;
            if (!items.every((i: any) => typeof i.content === 'string')) return;
            const planSteps: PlanStep[] = items.map((item: any) => ({
                content: String(item.content || ''),
                status: (item.status === 'completed') ? 'completed' : 'pending',
            }));
            this.ctx.store.updatePlanSteps(this.tid, planSteps);
        } catch {}
    }

    protected sendDisplayUpdate(text: string): void {
        if (this.isGoalFormatting) return;
        this.router.PostMessage({ type: 'agentStreamUpdate', text });
    }

    protected onText(chunk: string): void {
        this.sendAcpLog?.('recv', chunk);
        this.ctx.taskFlow.processChunk(this.tid, chunk, this.parseTables);
        const cleanText = this.ctx.taskFlow.getCleanText(this.tid);
        const planSection = this.ctx.taskFlow.buildPlanSection(this.tid);
        this.sendDisplayUpdate(cleanText + planSection);
    }

    protected onPlan(entries: { content: string; priority: string; status: string }[]): void {
        this.ctx.taskFlow.setPlanEntries(this.tid, entries);
        this.sendDisplayUpdate(this.ctx.taskFlow.getCleanText(this.tid) + this.ctx.taskFlow.buildPlanSection(this.tid));
        this.ctx.sendNodePanelUpdate(this.tid);
    }

    protected onError(error: string): void {
        this.setGenState(false);
        this.ctx.taskFlow.getCleanText(this.tid);
        if (!this.isGoalFormatting) {
            this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${error}]` });
        }
        this.ctx.storeMessage(this.tid, 'agent', `错误: ${error}`);
    }

    protected onDone(stopReason?: string): void {
        this.completeReasoning();
        this.setGenState(false);
        this.flushAcpRecvBuffer?.();
        const cleanedText = this.ctx.taskFlow.getCleanText(this.tid);

        if (stopReason === 'cancelled') {
            this.activeToolCalls.clear();
            if (cleanedText && !this.isGoalFormatting) {
                this.ctx.storeMessage(this.tid, 'agent', cleanedText);
            }
            this.ctx.taskFlow.resetGeneration(this.tid);
            const task = this.ctx.store.getTask(this.tid);
            this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: task?.status });
            return;
        }

        if (!this.isGoalFormatting) {
            let firstToolMsgId: string | null = null;
            const toolItems: { toolCallId: string; title: string; kind: string; status: string; output?: string }[] = [];
            for (const [toolCallId, tc] of this.activeToolCalls) {
                const msgId = this.ctx.store.nextMessageId(this.tid);
                if (!firstToolMsgId) firstToolMsgId = msgId;
                this.ctx.store.addMessage({
                    id: msgId, taskId: this.tid, role: 'tool', type: 'tool_call',
                    content: JSON.stringify({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output || '' }),
                    timestamp: Date.now(),
                });
                toolItems.push({ toolCallId, title: tc.title, kind: tc.kind, status: tc.status, output: tc.output });
            }
            if (toolItems.length > 0) {
                const groupId = `tg_${this.tid}_${Date.now()}`;
                this.ctx.store.addToolGroup(this.tid, groupId, toolItems.map((ti, i) => ({
                    id: `ti_${groupId}_${i}`, groupId, toolCallId: ti.toolCallId,
                    title: ti.title, kind: ti.kind, status: ti.status,
                    detail: ti.output, createdAt: Date.now(),
                })));
            }
            if (firstToolMsgId && !this.ctx.hasSetExecuteMessage) {
                this.ctx.store.updateTaskNodeMessageId(this.tid, 'execute', firstToolMsgId);
            }
        }

        if (!this.isGoalFormatting) {
            for (const [, tc] of this.activeToolCalls) {
                if (tc.output && /\[TASK_UPDATE\]/i.test(tc.output)) {
                    this.ctx.taskFlow.processChunk(this.tid, tc.output);
                }
            }
        }

        if (this.isGoalFormatting) {
            this.ctx.taskFlow.processGoalProposal(this.tid, this.ctx.taskFlow.getCleanText(this.tid), this.originalText, this.originalText);
        } else {
            const task = this.ctx.store.getTask(this.tid);
            const genResult = this.ctx.taskFlow.getGenResult(this.tid);

            if (task?.type === 'task' && this.ctx.taskFlow.isGoalProposed(this.tid) && task.phase === 'demand') {
                this.ctx.taskFlow.processGoalProposal(this.tid, cleanedText, '', '');
            } else if (task?.type === 'task' && task?.phase === 'review' && task?.status !== 'completed' && task?.status !== 'cancelled') {
                this.ctx.triggerReviewRequest(this.tid, cleanedText);
            } else if (genResult.planProposed && task?.type === 'task' && task?.phase === 'plan') {
                const cardShown = this.ctx.showPlanConfirmation(this.tid);
                if (cleanedText) {
                    const agentMsgId = this.ctx.storeMessage(this.tid, 'agent', cleanedText);
                    if (agentMsgId && !this.ctx.hasSetPlanMessage) {
                        this.ctx.store.updateTaskNodeMessageId(this.tid, 'plan', agentMsgId);
                    }
                }
                this.ctx.sendNodePanelUpdate(this.tid);
                if (!cardShown) {
                    this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
                }
            } else if (genResult.executeFinished && task?.type === 'task' && task?.phase === 'execute') {
                if (cleanedText) this.ctx.storeMessage(this.tid, 'agent', cleanedText);
                this.ctx.taskFlow.confirmExecuteDone(this.tid);
                this.ctx.sendTaskInfo(this.tid);
                this.ctx.sendNodePanelUpdate(this.tid);
                this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
                setTimeout(() => this.ctx.startAutoGeneration(this.tid), 100);
            } else if (genResult.selfVerifyFinished && task?.type === 'task' && task?.phase === 'self_verify') {
                this.ctx.taskFlow.confirmSelfVerifyDone(this.tid);
                this.ctx.sendHooksAsMessage(this.tid, 'review');
                this.ctx.triggerReviewRequest(this.tid, cleanedText || '自验完成，请验收变更');
            } else {
                const agentMsgId = this.ctx.storeMessage(this.tid, 'agent', cleanedText);
                if (agentMsgId && !this.ctx.hasSetPlanMessage) {
                    this.ctx.store.updateTaskNodeMessageId(this.tid, 'plan', agentMsgId);
                }
                this.ctx.sendNodePanelUpdate(this.tid);
                this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
            }
        }

        this.activeToolCalls.clear();
        this.ctx.taskFlow.resetGeneration(this.tid);
    }
}
