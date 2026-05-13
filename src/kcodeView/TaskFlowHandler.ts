import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import type { KCodePanelContext } from './PanelContext';
import type { Task, FileChange, ProgressNode } from '../types';
import { getTemplate, getCategory } from '../taskflow/templates';

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
        let report = `🎉 任务已完成，《任务完成报告》如下：\n\n📋 **任务**：${task?.title || ''}\n`;
        if (changes.length > 0) report += `📄 **变更文件**：${changes.length} 个\n${changes.map(c => `  - \`${c.filePath}\``).join('\n')}`;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', content: report, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'loadMessages', messages: ctx.store.getMessages(tid), taskId: tid, taskStatus: 'completed', reviewChanges: ctx.store.getReviewChanges(tid) });
    }

    async handlePartialApproveReview(tid: string, passed: string[], failed: string[]) {
        const { ctx } = this;
        const approveMsg = `📋 逐条验收结果：${passed.length}/${passed.length + failed.length} 项通过`;
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'user', content: approveMsg, timestamp: Date.now() });
        ctx.router.PostMessage({ type: 'addUserMessage', content: approveMsg });
        ctx.store.addMessage({ id: ctx.store.nextMessageId(tid), taskId: tid, role: 'agent', content: `✅ 部分验收通过（${passed.length}/${passed.length + failed.length}）`, timestamp: Date.now() });

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
        if (!task || task.type === 'chat') return [];

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

}
