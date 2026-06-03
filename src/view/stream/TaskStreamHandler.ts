import { StreamHandlerBase } from './StreamHandlerBase';
import type { KCodePanelContext } from '../PanelContext';
import type { PlanStep } from '../../types';
import { taskLogStore } from '../../store/TaskLogStore';

const _output = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const v = require('vscode');
        const ch = v.window.createOutputChannel('KCode Debug');
        return ch;
    } catch { return null; }
})();
function debug(msg: string) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(line);
    if (_output) _output.appendLine(line);
}

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
        return false;
    }

    protected _emitToolCall(toolCallId: string, title: string, kind: string, status: string, content?: string): void {
        super._emitToolCall(toolCallId, title, kind, status, content);
        if (kind === 'todowrite' && content) {
            this._syncTodoToPlanSteps(content);
            this.ctx.sendTaskInfo(this.tid);
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
            this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskPhase: task?.phase, taskStatus: task?.status });
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
            for (const [toolCallId, tc] of this.activeToolCalls) {
                const kindLower = (tc.kind || '').toLowerCase();
                const titleLower = (tc.title || '').toLowerCase();
                const isCommand = kindLower === 'bash' || kindLower === 'command' || kindLower === 'terminal' || kindLower === 'shell' || kindLower === 'execute'
                    || titleLower === 'bash' || titleLower.startsWith('bash') || titleLower.startsWith('ls ') || titleLower.startsWith('cd ')
                    || titleLower.startsWith('cat ') || titleLower.startsWith('grep ') || titleLower.startsWith('find ')
                    || titleLower.startsWith('npm ') || titleLower.startsWith('git ') || titleLower.startsWith('mkdir');
                if (isCommand) {
                    const exitCode = /exit code:? (\d+)/i.test(tc.output || '') ? parseInt((tc.output || '').match(/exit code:? (\d+)/i)?.[1] || '0', 10) : 0;
                    taskLogStore.appendTerminal(this.tid, {
                        id: toolCallId,
                        command: tc.title,
                        output: tc.output || '',
                        cwd: process.cwd(),
                        exitCode,
                        timestamp: Date.now(),
                    });
                }
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
                if (tc.output) {
                    if (/\[TASK_UPDATE\]/i.test(tc.output) || /<TODO_UPDATE>|<\/*title>/i.test(tc.output)) {
                        this.ctx.taskFlow.processChunk(this.tid, tc.output);
                    }
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
                this.ctx.sendTaskInfo(this.tid);
                this.ctx.sendNodePanelUpdate(this.tid);
                this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
                this.router.PostMessage({ type: 'showExecuteConfirmation', taskId: this.tid });
            } else if (genResult.selfVerifyFinished && task?.type === 'task' && task?.phase === 'self_verify') {
                debug('selfVerifyFinished, waiting for user confirmation');
                if (cleanedText) this.ctx.storeMessage(this.tid, 'agent', cleanedText);
                this.ctx.sendTaskInfo(this.tid);
                this.ctx.sendNodePanelUpdate(this.tid);
                this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
                this.router.PostMessage({ type: 'showSelfVerifyConfirmation', taskId: this.tid });
            } else {
                const agentMsgId = this.ctx.storeMessage(this.tid, 'agent', cleanedText);
                if (agentMsgId && !this.ctx.hasSetPlanMessage) {
                    this.ctx.store.updateTaskNodeMessageId(this.tid, 'plan', agentMsgId);
                }
                this.ctx.sendNodePanelUpdate(this.tid);
                this.router.PostMessage({ type: 'loadMessages', messages: this.ctx.store.getMessages(this.tid), taskId: this.tid, taskStatus: this.ctx.store.getTask(this.tid)?.status });
            }
        }

        this.ctx.sendTaskInfo(this.tid);
        this.activeToolCalls.clear();
        this.ctx.taskFlow.resetGeneration(this.tid);
    }
}
