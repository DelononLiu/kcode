import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import type { KCodePanelContext } from './PanelContext';
import type { Task, FileChange, ProgressNode, TodoItem, KnowledgeEntry } from '../types';
import { getTemplate, getCategory } from '../taskflow/templates';

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

function replaceTodosInOutput(output: string, todos: any[]): string {
    const titleMatch = output.match(/^(<title>\s*\d+\s*todos?\s*<\/title>\s*)/i);
    if (titleMatch) {
        return titleMatch[1] + JSON.stringify(todos, null, 2);
    }
    return JSON.stringify(todos, null, 2);
}

export class TaskFlowHandler {
    constructor(private ctx: KCodePanelContext) {}

    async handleConfirmGoal(tid: string, originalRequest: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认目标', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认目标' });
        ctx.taskFlow.confirmGoal(tid);
        await ctx.sendHooksAsMessage(tid, 'plan');
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
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', type: 'plan_proposal', content: `📋 计划方案\n\n${stepsContent}`, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'showPlanProposal', taskId: tid, planSteps: task.planSteps });
        return true;
    }

    async handleConfirmPlan(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认计划', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认计划' });
        ctx.taskFlow.confirmPlan(tid);
        await ctx.sendHooksAsMessage(tid, 'execute');
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, '计划已确认，请开始执行。'), false, '计划已确认，请开始执行。');
    }

    async handleConfirmExecuteDone(tid: string) {
        const { ctx } = this;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: '✅ 确认完成，进入自验', timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: '✅ 确认完成，进入自验' });
        ctx.taskFlow.confirmExecuteDone(tid);
        await ctx.sendHooksAsMessage(tid, 'self_verify');
        ctx.sendTaskInfo(tid);
        ctx.sendNodePanelUpdate(tid);
        setTimeout(() => ctx.startAutoGeneration(tid), 100);
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
        await ctx.sendHooksAsMessage(tid, 'plan');
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
        if (partialText) ctx.storeMessage(tid, 'agent', partialText);
        ctx.taskFlow.resetGeneration(tid);
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: ctx.store.getTask(tid)?.status });
    }

    triggerReviewRequest(tid: string, content: string) {
        const { ctx } = this;
        const reviewMsgId = ctx.store.nextMessageId(tid);
        ctx.store.addMessage({ id: reviewMsgId, taskId: tid, role: 'agent', type: 'review_request', content, timestamp: Date.now() });
        ctx.store.updateTaskNodeMessageId(tid, 'review', reviewMsgId);
        ctx.store.updateTaskStatus(tid, 'in_review');

        let changes: FileChange[] = ctx.agentService.getReviewChanges(tid);
        if (changes.length === 0) changes = this.collectToolChanges(tid);

        if (changes.length > 0) {
            ctx.store.addTimelineEntry(tid, { timestamp: Date.now(), type: 'file_change', summary: `变更 ${changes.length} 个文件`, detail: changes.map(c => `${c.filePath}`).join('\n') });
        }

        ctx.store.storeReviewChanges(tid, changes);

        const task = ctx.store.getTask(tid);
        let acceptanceCriteria: string[] | undefined;
        if (task?.category && task?.subType) {
            const template = getTemplate(task.category, task.subType);
            acceptanceCriteria = template?.acceptanceCriteria;
        } else if (task?.category) {
            const cat = getCategory(task.category);
            acceptanceCriteria = cat?.acceptanceCriteria;
        }

        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: 'in_review', reviewChanges: changes.length > 0 ? changes : undefined, acceptanceCriteria });
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
                    const path = info.title || '';
                    if (path && !touched.has(path)) { touched.set(path, ''); results.push({ filePath: path, original: '', modified: info.output || '' }); }
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
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: 'completed', reviewChanges: [] });
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
            ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: 'completed' });
        } else {
            ctx.store.updateTaskPhase(tid, 'execute');
            ctx.store.updateTaskStatus(tid, 'active');
            ctx.sendNodePanelUpdate(tid);
            ctx.refreshSidebarCallback?.();
            await ctx.sendHooksAsMessage(tid, 'execute');
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
        await ctx.sendHooksAsMessage(tid, 'execute');
        await ctx.sendAgentPrompt(tid, ctx.taskFlow.buildPhaseTransitionPrompt(tid, rejectMsg), false, rejectMsg);
    }

    showAgentError(tid: string, errorMsg: string) {
        const { ctx } = this;
        ctx.storeMessage(tid, 'agent', `错误: ${errorMsg}`);
        ctx.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${errorMsg}]` });
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: ctx.store.getTask(tid)?.status });
    }

    sendTaskInfo(taskId: string) {
        const { ctx } = this;
        const task = ctx.store.getTask(taskId);
        if (!task) return;
        const phaseLabels: Record<string, string> = { demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收' };
        ctx.router.PostMessage({
            type: 'updateTaskInfo', title: task.title, goal: task.goal, goalHint: task.goal ? '🎯 ' + task.goal : '',
            status: task.status, phase: task.phase, phaseLabel: phaseLabels[task.phase] || task.phase,
            taskType: task.type, createdAt: task.createdAt, pendingReviewFiles: 0,
            confirmedItems: task.confirmedItems, pendingItems: task.pendingItems, planSteps: task.planSteps,
            hooks: task.hooks || {}, workspaceHooks: ctx.taskFlow['workspaceHooks'] || {},
            messageCount: ctx.store.getMessages(taskId).length, executeFinished: ctx.taskFlow.isExecuteFinished(taskId)
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

        // Read real knowledge entries from store
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
        if (task?.category && task?.subType && task?.status === 'in_review') {
            acceptanceCriteria = getTemplate(task.category, task.subType)?.acceptanceCriteria;
        } else if (task?.category && task?.status === 'in_review') {
            acceptanceCriteria = getCategory(task.category)?.acceptanceCriteria;
        }
        ctx.router.PostMessage({ type: 'loadMessages', messages, taskId, taskType: task?.type, taskStatus: task?.status, reviewChanges: reviewChanges.length > 0 ? reviewChanges : undefined, acceptanceCriteria });
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
            { id: 'execute', type: 'execute' as const, label: '执行', status: ns('execute', s === 'in_review' || s === 'completed' || phase === 'self_verify', phase === 'execute' && s === 'active'), order: 4, messageId: nm.execute },
            { id: 'self_verify', type: 'self_verify' as const, label: '自验', status: ns('self_verify', hasSelfVerify && s !== 'active', phase === 'self_verify'), order: 5, messageId: nm.self_verify },
            { id: 'review', type: 'review' as const, label: '验收', status: ns('review', s === 'completed', phase === 'review' && s === 'in_review'), order: 6, messageId: nm.review },
        ];
    }

    sendNodePanelUpdate(taskId: string) {
        this.ctx.router.PostMessage({ type: 'updateNodePanel', nodes: this.deriveNodes(taskId), taskType: this.ctx.store.getTask(taskId)?.type || 'task' });
    }

    handleOpenNativeDiff(original: string, modified: string, filePath: string) {
        const ext = path.extname(filePath) || '.txt';
        const baseName = path.basename(filePath, ext);
        const timestamp = Date.now();
        vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_original${ext}`)), Buffer.from(original));
        vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_modified${ext}`)), Buffer.from(modified));
        vscode.commands.executeCommand('vscode.diff',
            vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_original${ext}`)),
            vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_modified${ext}`)),
            `变更对比: ${baseName}${ext}`);
    }

    handleConvertToTask(taskId: string) {
        const { ctx } = this;
        const chatTask = ctx.store.getTask(taskId);
        if (!chatTask) return;
        const messages = ctx.store.getMessages(taskId);
        const firstUserMsg = messages.find(m => m.role === 'user');
        const newTask: Task = {
            id: `task_${Date.now()}`, title: firstUserMsg ? firstUserMsg.content.substring(0, 50).replace(/\n/g, ' ') : '从对话创建的任务',
            goal: '', type: 'task', status: 'pending', phase: 'demand', confirmedItems: [], pendingItems: [], planSteps: [], createdAt: Date.now(), pinned: false,
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        };
        ctx.store.addTask(newTask);
        const newId = newTask.id;
        for (const msg of messages) {
            ctx.store.addMessage({ id: ctx.store.nextMessageId(newId), taskId: newId, role: msg.role, content: msg.content, type: msg.type, timestamp: msg.timestamp });
        }
        ctx.loadTask(newId);
        ctx.refreshSidebarCallback?.();
    }

    handleTodoUpdate(taskId: string, items: TodoItem[], action: string) {
        const { ctx } = this;
        const messages = ctx.store.getMessages(taskId);
        const existingTodoMsgs = messages.filter(m => m.type === 'todo');

        if (action === 'replace') {
            const msgId = ctx.store.nextMessageId(taskId);
            ctx.store.addMessage({ id: msgId, taskId, role: 'agent', type: 'todo', content: JSON.stringify(items), timestamp: Date.now() });
        } else if (action === 'add' && existingTodoMsgs.length > 0) {
            const last = existingTodoMsgs[existingTodoMsgs.length - 1];
            const existing: TodoItem[] = JSON.parse(last.content || '[]');
            const merged = [...existing];
            for (const item of items) {
                const idx = merged.findIndex(i => i.id === item.id);
                if (idx >= 0) merged[idx] = item;
                else merged.push(item);
            }
            ctx.store.updateMessageContent(taskId, last.id, JSON.stringify(merged));
        } else if (action === 'update' && existingTodoMsgs.length > 0) {
            const last = existingTodoMsgs[existingTodoMsgs.length - 1];
            const existing: TodoItem[] = JSON.parse(last.content || '[]');
            for (const item of items) {
                const idx = existing.findIndex(i => i.id === item.id);
                if (idx >= 0) existing[idx].status = item.status;
            }
            ctx.store.updateMessageContent(taskId, last.id, JSON.stringify(existing));
        } else {
            const msgId = ctx.store.nextMessageId(taskId);
            ctx.store.addMessage({ id: msgId, taskId, role: 'agent', type: 'todo', content: JSON.stringify(items), timestamp: Date.now() });
        }

        const t = ctx.store.getTask(taskId);
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(taskId), taskId, taskStatus: t?.status });
        this.sendOutputPanelUpdate(taskId);
    }

    handleUpdateTodoItem(taskId: string, msgId: string, itemId: string, checked: boolean) {
        const { ctx } = this;
        const messages = ctx.store.getMessages(taskId);
        let msg = messages.find(m => m.id === msgId);

        if (!msg && msgId.startsWith('tool_')) {
            const toolCallId = msgId.slice(5);
            msg = messages.find(m => {
                if (m.type !== 'tool_call') return false;
                try {
                    const info = JSON.parse(m.content);
                    return info.toolCallId === toolCallId;
                } catch { return false; }
            });
        }

        if (!msg) return;
        try {
            if (msg.type === 'todo') {
                const items: TodoItem[] = JSON.parse(msg.content || '[]');
                const item = items.find(i => i.id === itemId);
                if (item) {
                    item.status = checked ? 'completed' : 'pending';
                    ctx.store.updateMessageContent(taskId, msg.id, JSON.stringify(items));
                }
            } else if (msg.type === 'tool_call') {
                const info = JSON.parse(msg.content);
                const rawOutput = info.output || '';
                const todos = parseTodosFromOutput(rawOutput);
                const idx = parseInt(itemId, 10);
                const item = !isNaN(idx) && idx >= 0 && idx < todos.length ? todos[idx] : todos.find((i: any) => String(i.id) === itemId);
                if (item) {
                    item.status = checked ? 'completed' : 'pending';
                    const newOutput = replaceTodosInOutput(rawOutput, todos);
                    info.output = newOutput;
                    ctx.store.updateMessageContent(taskId, msg.id, JSON.stringify(info));
                }
            }
            const t = ctx.store.getTask(taskId);
            ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(taskId), taskId, taskStatus: t?.status });
            this.sendOutputPanelUpdate(taskId);
        } catch {}
    }

    handleKnowledgeEntry(taskId: string, entries: KnowledgeEntry[]) {
        const { ctx } = this;
        for (const entry of entries) {
            ctx.store.addKnowledgeEntry(taskId, entry);
        }
        const titles = entries.map(e => e.title).join('、');
        ctx.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'knowledge_extract', summary: `萃取知识: ${titles.substring(0, 80)}`, detail: `共 ${entries.length} 条知识条目` });
        ctx.router.PostMessage({ type: 'addSystemMessage', content: `📚 已沉淀 ${entries.length} 条知识条目`, taskId });
        this.sendOutputPanelUpdate(taskId);
    }

    handleTaskDelegated(parentTaskId: string, payload: any) {
        const { ctx } = this;
        const parentTask = ctx.store.getTask(parentTaskId);
        if (!parentTask) return;
        const fullGoal = payload.relevantSnippets ? `${payload.goal}\n\n技术上下文：${payload.relevantSnippets}` : payload.goal;
        const newTask: Task = {
            id: `task_${Date.now()}`, title: payload.title, goal: fullGoal, type: 'task', status: 'pending', phase: 'demand',
            confirmedItems: payload.confirmedItems || [], pendingItems: [], planSteps: [], createdAt: Date.now(),
            pinned: false, source: parentTask.source, containerId: parentTask.containerId, group: parentTask.group,
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        };
        ctx.store.addTask(newTask);
        ctx.store.addMessage({ id: ctx.store.nextMessageId(parentTaskId), taskId: parentTaskId, role: 'agent', type: 'stop_message', content: `📤 已委派新任务「${payload.title}」`, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addSystemMessage', content: `📤 已委派新任务「${payload.title}」`, taskId: parentTaskId });
        ctx.refreshSidebarCallback?.();
    }

}
