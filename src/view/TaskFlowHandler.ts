import * as vscode from 'vscode';
import type { KCodePanelContext } from './PanelContext';
import type { Task, FileChange, ProgressNode, PlanStep } from '../types';
import { getCategory } from '../taskflow/templates';
import { taskLogStore } from '../store/TaskLogStore';

export class TaskFlowHandler {
    constructor(private ctx: KCodePanelContext) {}

    async handleConfirmGoal(tid: string, originalRequest: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认目标', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认目标' });
        ctx.taskFlow.confirmGoal(tid);
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, originalRequest), false, originalRequest);
    }

    handleReviseGoal(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '↩️ 修改需求', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '↩️ 修改需求' });
        ctx.store.updateTaskStatus(tid, 'pending');
        ctx.store.updateTaskGoal(tid, '');
        ctx.refreshSidebarCallback?.();
        ctx.sendNodePanelUpdate(tid);
    }

    handleCancelTask(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✕ 已取消任务', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✕ 已取消任务' });
        ctx.store.updateTaskStatus(tid, 'cancelled');
        ctx.store.clearReviewChanges(tid);
        ctx.store.addTimelineEntry(tid, { timestamp: Date.now(), type: 'phase_change', summary: '任务取消', detail: '用户主动取消任务' });
        ctx.refreshSidebarCallback?.();
        ctx.sendNodePanelUpdate(tid);
        ctx.setGenerationState(false);
    }

    showPlanConfirmation(tid: string): boolean {
        const { ctx } = this;
        const task = ctx.store.getTask(tid);
        if (!task || task.planSteps.length === 0) return false;
        const stepsContent = task.planSteps.map(s => `- [${s.status === 'completed' ? 'x' : ' '}] ${s.content}`).join('\n');
        const goalContent = task.goal ? `🎯 目标\n${task.goal}\n\n` : '';
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', type: 'plan_proposal', content: `📋 计划方案\n\n${stepsContent}`, phase: 'plan', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'showPlanProposal', taskId: tid, planSteps: task.planSteps, goal: task.goal });
        return true;
    }

    async handleConfirmPlan(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认计划', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认计划' });
        ctx.taskFlow.confirmPlan(tid);
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, '计划已确认，请开始执行。'), false, '计划已确认，请开始执行。');
    }

    async handleConfirmPlanWithEdit(tid: string, goal: string, steps: PlanStep[]) {
        const { ctx } = this;
        if (goal) ctx.store.updateTaskGoal(tid, goal);
        if (steps.length > 0) ctx.store.updatePlanSteps(tid, steps);
        const userText = goal
            ? `用户已修改目标和计划，请按修改后的内容执行。\n\n🎯 目标\n${goal}\n\n📋 计划\n${steps.map(s => `- ${s.content}`).join('\n')}`
            : `用户已修改计划，请按修改后的计划执行。\n\n📋 计划\n${steps.map(s => `- ${s.content}`).join('\n')}`;
        ctx.store.addMessage({
            id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: userText, timestamp: Date.now()
        });
        ctx.router.PostMessage({ type: 'addUserMessage', content: userText });
        ctx.taskFlow.confirmPlan(tid);
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, userText), false, userText);
    }

    async handleConfirmExecuteDone(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认完成，进入自验', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认完成，进入自验' });
        ctx.taskFlow.confirmExecuteDone(tid);
        ctx.sendTaskInfo(tid);
        ctx.sendNodePanelUpdate(tid);
        setTimeout(() => ctx.startAutoGeneration(tid), 100);
    }

    async handleConfirmSelfVerifyDone(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认自验，进入验收', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认自验，进入验收' });
        const cleanedText = ctx.taskFlow.confirmSelfVerifyDone(tid);
        ctx.sendTaskInfo(tid);
        ctx.sendNodePanelUpdate(tid);
        ctx.triggerReviewRequest(tid, cleanedText || '自验完成，请验收变更');
    }

    async handleConfirmGoalFromHeader(tid: string) {
        const msgs = this.ctx.store.getMessages(tid);
        const originalRequest = msgs.find(m => m.role === 'user')?.content || '';
        await this.handleConfirmGoal(tid, originalRequest);
    }

    handleRejectPlan(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '↩️ 调整计划', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '↩️ 调整计划' });
        ctx.taskFlow.rejectPlan(tid);
    }

    async handleConfirmGoalWithEdit(tid: string, newGoal: string, originalRequest: string) {
        const { ctx } = this;
        ctx.store.updateTaskGoal(tid, newGoal);
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认目标', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认目标' });
        ctx.taskFlow.confirmGoalWithEdit(tid, newGoal);
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, originalRequest), false, originalRequest);
    }

    handleStopGeneration(taskId?: string) {
        const { ctx } = this;
        const tid = taskId || ctx.currentTaskId;
        if (!tid) return;
        ctx.setGenerationState(false);
        ctx.agentService.cancel(tid);
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', type: 'stop_message', content: '⏹️ 用户已停止生成', timestamp: Date.now() });
        const partialText = ctx.taskFlow.getCleanText(tid);
        if (partialText) {
            const id = ctx.store.nextMessageId(tid);
            ctx.store.addMessage({ id, taskId: tid, role: 'agent', content: partialText, timestamp: Date.now() });
        }
        ctx.taskFlow.resetGeneration(tid);
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskPhase: ctx.store.getTask(tid)?.phase, taskStatus: ctx.store.getTask(tid)?.status });
    }

    triggerReviewRequest(tid: string, content: string) {
        const { ctx } = this;
        const task = ctx.store.getTask(tid);
        if (task?.status === 'completed' || task?.status === 'cancelled') return;
        const reviewMsgId = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({ id: reviewMsgId, taskId: tid, role: 'agent', type: 'review_request', content, phase: 'review', timestamp: Date.now() });
        ctx.store.updateTaskNodeMessageId(tid, 'review', reviewMsgId);
        ctx.store.updateTaskStatus(tid, 'in_review');

        let changes: FileChange[] = ctx.agentService.getReviewChanges(tid);
        if (changes.length === 0) changes = this.collectToolChanges(tid);

        if (changes.length > 0) {
            ctx.store.addTimelineEntry(tid, { timestamp: Date.now(), type: 'file_change', summary: `变更 ${changes.length} 个文件`, detail: changes.map(c => `${c.filePath}`).join('\n') });
        }

        ctx.store.storeReviewChanges(tid, changes);

        let acceptanceCriteria: string[] | undefined;
        if (task?.category) {
            const cat = getCategory(task.category);
            acceptanceCriteria = cat?.acceptanceCriteria;
        }

        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskPhase: task?.phase, taskStatus: 'in_review', reviewChanges: changes.length > 0 ? changes : undefined, acceptanceCriteria });
        ctx.sendNodePanelUpdate(tid);
        ctx.refreshSidebarCallback?.();
    }

    private collectToolChanges(tid: string): FileChange[] {
        const msgs = this.ctx.store.getMessages(tid);
        const touched = new Map<string, string>();
        const results: FileChange[] = [];
        for (const msg of msgs) {
            if (msg.role !== 'tool' || msg.type !== 'tool_call') continue;
            try {
                const info = JSON.parse(msg.content);
                if (info.kind === 'write' || info.kind === 'edit') {
                    const path2 = info.title || '';
                    if (path2 && !touched.has(path2)) { touched.set(path2, ''); results.push({ filePath: path2, original: '', modified: info.output || '' }); }
                }
            } catch {}
        }
        return results;
    }

    handleApproveReview(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 验收通过', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 验收通过' });
        ctx.taskFlow.finishReview(tid);
        const task = ctx.store.getTask(tid);
        const changes = ctx.store.getReviewChanges(tid);
        ctx.store.addTimelineEntry(tid, { timestamp: Date.now(), type: 'message', summary: '用户验收通过', detail: '' });
        let report = `🎉 任务已完成，《任务完成报告》如下：\n\n📋 **任务**：${task?.title || ''}\n`;
        if (changes.length > 0) report += `📄 **变更文件**：${changes.length} 个\n${changes.map(c => `  - \`${c.filePath}\``).join('\n')}`;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', content: report, timestamp: Date.now() });
        ctx.store.clearReviewChanges(tid);
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskPhase: 'review', taskStatus: 'completed', reviewChanges: [] });
        this.sendTaskInfo(tid);
    }

    async handlePartialApproveReview(tid: string, passed: string[], failed: string[]) {
        const { ctx } = this;
        const approveMsg = `📋 逐条验收结果：${passed.length}/${passed.length + failed.length} 项通过`;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: approveMsg, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: approveMsg });
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', content: `✅ 部分验收通过（${passed.length}/${passed.length + failed.length}）`, timestamp: Date.now() });
        ctx.store.clearReviewChanges(tid);

        if (failed.length === 0) {
            ctx.taskFlow.finishReview(tid);
            ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskPhase: 'review', taskStatus: 'completed' });
            this.sendTaskInfo(tid);
        } else {
            ctx.store.updateTaskPhase(tid, 'execute');
            ctx.store.updateTaskStatus(tid, 'active');
            ctx.sendNodePanelUpdate(tid);
            ctx.refreshSidebarCallback?.();
            await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, approveMsg), false, approveMsg);
        }
    }

    async handleRejectReview(tid: string, reason?: string) {
        const { ctx } = this;
        const rejectMsg = reason ? `↩️ 驳回: ${reason}` : '↩️ 驳回，请继续修改';
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: rejectMsg, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: rejectMsg });
        ctx.taskFlow.rejectReview(tid);
        ctx.store.clearReviewChanges(tid);
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, rejectMsg), false, rejectMsg);
    }

    showAgentError(tid: string, errorMsg: string) {
        const { ctx } = this;
        const id = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({ id, taskId: tid, role: 'agent', content: `错误: ${errorMsg}`, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n---\n⚠️ **${errorMsg}**\n\n\`👉 在 KCode 侧边栏底部齿轮图标 → 设置 → Agent 配置 中填写 agentName\`\n---` });
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskPhase: ctx.store.getTask(tid)?.phase, taskStatus: ctx.store.getTask(tid)?.status });
    }

    sendTaskInfo(taskId: string) {
        const { ctx } = this;
        const task = ctx.store.getTask(taskId);
        if (!task) return;
        const phaseLabels: Record<string, string> = { demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收' };
        const messages = ctx.store.getMessages(taskId);
        const filePathsFromTools: string[] = [];
        for (const msg of messages) {
            if (msg.type === 'tool_call') {
                try {
                    const info = JSON.parse(msg.content);
                    if ((info.kind === 'write' || info.kind === 'edit') && info.title) {
                        const fp = info.title.replace(/^(write|edit)\s+/i, '').trim();
                        if (fp && !filePathsFromTools.includes(fp)) filePathsFromTools.push(fp);
                    }
                } catch {}
            }
        }

        ctx.router.PostMessage({
            type: 'updateTaskInfo', taskId: taskId, title: task.title, goal: task.goal, goalHint: task.goal ? '🎯 ' + task.goal : '',
            status: task.status, phase: task.phase,             phaseLabel: phaseLabels[task.phase] || task.phase,
            taskType: task.type, category: task.category, createdAt: task.createdAt, originalRequest: task.originalRequest || '', pendingReviewFiles: 0,
            confirmedItems: task.confirmedItems, pendingItems: task.pendingItems, planSteps: task.planSteps,
            planVersion: task.planVersion || 1,
            riskItems: task.riskItems || [],
            boundaryItems: task.boundaryItems || [],
            filePathsFromTools: filePathsFromTools,
            hooks: task.hooks || {}, workspaceHooks: ctx.taskFlow['workspaceHooks'] || {},
            messageCount: messages.length, executeFinished: ctx.taskFlow.isExecuteFinished(taskId),
            terminalLogCount: taskLogStore.getTerminalLog(taskId).length,
            flowIteration: task.flowIteration,
        });

        this.sendOutputPanelUpdate(taskId);
    }

    sendOutputPanelUpdate(taskId: string) {
        const { ctx } = this;
        const changes = ctx.store.getReviewChanges(taskId);
        const messages = ctx.store.getMessages(taskId);
        const todos: any[] = [];
        const toolCalls: { toolCallId: string; title: string; kind: string; status: string; output?: string }[] = [];
        const knowledgeItems: { id: string; type: string; title: string; content: string; tags: string[] }[] = [];
        const seenToolCalls = new Set<string>();

        const storedKnowledge = ctx.store.getTaskKnowledgeEntries(taskId);
        for (const ke of storedKnowledge) {
            knowledgeItems.push({ id: ke.id, type: ke.type, title: ke.title, content: ke.content.substring(0, 120), tags: ke.tags });
        }

        for (const msg of messages) {
            if (msg.type === 'todo') {
                try { todos.push(...JSON.parse(msg.content || '[]')); } catch {}
            } else if (msg.type === 'tool_call') {
                try {
                    const info = JSON.parse(msg.content);
                    if (info.kind === 'todowrite' && info.output) {
                        const raw = parseTodosFromOutput(info.output);
                        for (let idx = 0; idx < raw.length; idx++) {
                            todos.push({ id: String(idx), content: String(raw[idx].content || ''), status: raw[idx].status === 'completed' ? 'completed' : 'pending' });
                        }
                    } else if (info.toolCallId && !seenToolCalls.has(info.toolCallId)) {
                        seenToolCalls.add(info.toolCallId);
                        toolCalls.push({ toolCallId: info.toolCallId, title: info.title || '', kind: info.kind || '', status: info.status || '', output: info.output || '' });
                    }
                } catch {}
            }
        }
        const task = ctx.store.getTask(taskId);
        ctx.router.PostMessage({ type: 'updateOutputPanel', taskInfo: {
            taskId,
            planSteps: task?.planSteps,
            todos,
            toolCalls,
            knowledgeItems,
            canExport: messages.length > 0,
            status: task?.status,
            phase: task?.phase,
            isAssistant: false,
        }, changes });
    }

    sendTaskMessages(taskId: string) {
        const { ctx } = this;
        const messages = ctx.store.getMessages(taskId);
        const task = ctx.store.getTask(taskId);
        const reviewChanges = ctx.store.getReviewChanges(taskId);
        let acceptanceCriteria: string[] | undefined;
        if (task?.category && task?.status === 'in_review') {
            acceptanceCriteria = getCategory(task.category)?.acceptanceCriteria;
        }
        ctx.router.PostMessage({ type: 'loadMessages', messages, taskId, title: task?.title, taskType: task?.type, taskStatus: task?.status, taskPhase: task?.phase, category: task?.category, reviewChanges: reviewChanges.length > 0 ? reviewChanges : undefined, acceptanceCriteria });
    }

    deriveNodes(taskId: string): ProgressNode[] {
        const task = this.ctx.store.getTask(taskId);
        if (!task) return [];

        const msgs = this.ctx.store.getMessages(taskId);
        const phase = task.phase;
        const s = task.status;
        const hasGoal = !!task.goal;
        const hasConfirmedGoal = msgs.some(m => m.type === 'goal_confirmed') || ['plan', 'execute', 'self_verify', 'review'].includes(phase);
        const hasReviewRequest = msgs.some(m => m.type === 'review_request');
        const hasPlan = this.ctx.taskFlow.getPlanEntries(taskId).length > 0 || ['execute', 'self_verify', 'review'].includes(phase);
        const hasSelfVerify = ['review', 'self_verify'].includes(phase);

        let interruptAt = '';
        if (s === 'cancelled') {
            if (!hasGoal || !hasConfirmedGoal) interruptAt = 'goal';
            else if (!hasReviewRequest) interruptAt = 'execute';
            else interruptAt = 'review';
        }

        const fi = task.flowIteration;
        const iterCount = fi?.enabled ? fi.state.currentIteration : 0;
        const maxIter = fi?.enabled ? fi.config.iterationLimit : 0;

        const ns = (id: string, completed: boolean, active: boolean): 'pending' | 'active' | 'completed' | 'cancelled' => {
            if (s === 'cancelled' && id === interruptAt) return 'cancelled';
            if (completed) return 'completed';
            if (active) return 'active';
            return 'pending';
        };

        const nm = task.nodeMessageIds || {};
        return [
            { id: 'demand', type: 'demand' as const, label: '需求提交', status: ns('demand', hasGoal || hasConfirmedGoal || s === 'in_review' || s === 'completed', !(hasGoal || hasConfirmedGoal) && s !== 'cancelled'), order: 1, messageId: nm.demand },
            { id: 'goal', type: 'goal' as const, label: '目标确认', status: ns('goal', hasConfirmedGoal, hasGoal && !hasConfirmedGoal && s !== 'cancelled'), order: 2, messageId: nm.goal },
            { id: 'plan', type: 'plan' as const, label: '计划', status: ns('plan', hasPlan || s === 'in_review' || s === 'completed', phase === 'plan'), order: 3, messageId: nm.plan },
            { id: 'execute', type: 'execute' as const, label: '执行', status: ns('execute', s === 'in_review' || s === 'completed' || phase === 'self_verify', phase === 'execute' && s === 'active'), order: 4, messageId: nm.execute, iteration: iterCount, maxIteration: maxIter },
            { id: 'self_verify', type: 'self_verify' as const, label: '自验', status: ns('self_verify', hasSelfVerify && s !== 'active', phase === 'self_verify'), order: 5, messageId: nm.self_verify },
            { id: 'review', type: 'review' as const, label: '验收', status: ns('review', s === 'completed', phase === 'review' && s === 'in_review'), order: 6, messageId: nm.review },
        ];
    }

    sendNodePanelUpdate(taskId: string) {
        this.ctx.router.PostMessage({ type: 'updateNodePanel', nodes: this.deriveNodes(taskId), taskType: this.ctx.store.getTask(taskId)?.type || 'task' });
    }

    private _syncTodosToPlanSteps(taskId: string) {
        const { ctx } = this;
        const messages = ctx.store.getMessages(taskId);
        const itemsMap = new Map<string, { id: string; content: string; status: string }>();

        for (const msg of messages) {
            if (msg.type === 'todo') {
                try {
                    const items: { id: string; content: string; status: string }[] = JSON.parse(msg.content || '[]');
                    for (const item of items) {
                        itemsMap.set(item.id, item);
                    }
                } catch {}
            } else if (msg.type === 'tool_call') {
                try {
                    const info = JSON.parse(msg.content);
                    if (info.kind === 'todowrite' && info.output) {
                        const raw = parseTodosFromOutput(info.output);
                        for (let idx = 0; idx < raw.length; idx++) {
                            const id = String(raw[idx].id ?? idx);
                            itemsMap.set(id, {
                                id,
                                content: String(raw[idx].content || ''),
                                status: raw[idx].status === 'completed' ? 'completed' : 'pending',
                            });
                        }
                    }
                } catch {}
            }
        }

        if (itemsMap.size > 0) {
            const planSteps: PlanStep[] = Array.from(itemsMap.values()).map(item => ({
                content: item.content,
                status: item.status === 'completed' ? 'completed' : 'pending',
            }));
            ctx.store.updatePlanSteps(taskId, planSteps);
        }
    }

    handleTodoUpdate(taskId: string, items: { id: string; content: string; status: string }[], action: string) {
        const { ctx } = this;
        const messages = ctx.store.getMessages(taskId);
        const existingTodoMsgs = messages.filter(m => m.type === 'todo');

        if (action === 'replace') {
            const msgId = ctx.store.nextMessageId(taskId);
            ctx.store.addMessage({ id: msgId, taskId, role: 'agent', type: 'todo', content: JSON.stringify(items), timestamp: Date.now() });
        } else if (action === 'add' && existingTodoMsgs.length > 0) {
            const last = existingTodoMsgs[existingTodoMsgs.length - 1];
            const existing: { id: string; content: string; status: string }[] = JSON.parse(last.content || '[]');
            const merged = [...existing];
            for (const item of items) {
                const idx = merged.findIndex(i => i.id === item.id);
                if (idx >= 0) merged[idx] = item;
                else merged.push(item);
            }
            ctx.store.updateMessageContent(taskId, last.id, JSON.stringify(merged));
        } else if (action === 'update' && existingTodoMsgs.length > 0) {
            const last = existingTodoMsgs[existingTodoMsgs.length - 1];
            const existing: { id: string; content: string; status: string }[] = JSON.parse(last.content || '[]');
            for (const item of items) {
                const idx = existing.findIndex(i => i.id === item.id);
                if (idx >= 0) existing[idx].status = item.status;
            }
            ctx.store.updateMessageContent(taskId, last.id, JSON.stringify(existing));
        } else {
            const msgId = ctx.store.nextMessageId(taskId);
            ctx.store.addMessage({ id: msgId, taskId, role: 'agent', type: 'todo', content: JSON.stringify(items), timestamp: Date.now() });
        }

        this._syncTodosToPlanSteps(taskId);
        const t = ctx.store.getTask(taskId);
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(taskId), taskId, taskPhase: t?.phase, taskStatus: t?.status });
        this.sendOutputPanelUpdate(taskId);
    }

    handleKnowledgeEntry(taskId: string, entries: { id: string; type: string; title: string; content: string; tags: string[]; createdAt: number }[]) {
        const { ctx } = this;
        for (const entry of entries) {
            ctx.store.addKnowledgeEntry(taskId, { ...entry, taskId } as any);
        }
        const titles = entries.map(e => e.title).join('、');
        ctx.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'knowledge_extract', summary: `萃取知识: ${titles.substring(0, 80)}`, detail: `共 ${entries.length} 条知识条目` });
        ctx.router.PostMessage({ type: 'knowledgeExtract', entries, taskId });
        this.sendOutputPanelUpdate(taskId);
        vscode.commands.executeCommand('kcode.refreshKnowledgePanel');
    }

    handleTaskDelegated(parentTaskId: string, payload: any) {
        const { ctx } = this;
        const parentTask = ctx.store.getTask(parentTaskId);
        if (!parentTask) return;
        const fullGoal = payload.relevantSnippets ? `${payload.goal}\n\n技术上下文：${payload.relevantSnippets}` : payload.goal;
        const newTask: Task = {
            id: `task_${Date.now()}`, title: payload.title, goal: fullGoal, type: 'task', status: 'pending', phase: 'demand',
            confirmedItems: payload.confirmedItems || [], pendingItems: [], planSteps: [], originalRequest: payload.title, createdAt: Date.now(),
            pinned: false, source: parentTask.source, containerId: parentTask.containerId, group: parentTask.group,
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        };
        ctx.store.addTask(newTask);
        ctx.store.addMessage({ id: ctx.store.nextMessageId(parentTaskId), taskId: parentTaskId, role: 'agent', type: 'stop_message', content: `📤 已委派新任务「${payload.title}」`, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addSystemMessage', content: `📤 已委派新任务「${payload.title}」`, taskId: parentTaskId });
        ctx.refreshSidebarCallback?.();
    }
}

function parseTodosFromOutput(output: string): any[] {
    const titleMatch = output.match(/<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/);
    if (titleMatch) {
        try { return JSON.parse(titleMatch[1]); } catch {}
    }
    try {
        const arr = JSON.parse(output);
        if (Array.isArray(arr)) return arr;
    } catch {}
    if (output.trim().startsWith('[')) {
        try { return JSON.parse(output.trim()); } catch {}
    }
    return [];
}


