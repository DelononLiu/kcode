import type { Task, PlanStep, ChatMessage } from '../types';
import { BASE_PROMPT } from './prompts/base';
import { PROTOCOL_PROMPT } from './prompts/protocol';
import { DEMAND_PROMPT } from './prompts/demand';
import { GOAL_PROMPT } from './prompts/goal';
import { PLAN_PROMPT } from './prompts/plan';
import { EXECUTE_PROMPT } from './prompts/execute';
import { REVIEW_PROMPT } from './prompts/review';

export interface ITaskStore {
    getTask(taskId: string): Task | undefined;
    updateTaskPhase(taskId: string, phase: Task['phase']): void;
    updateTaskStatus(taskId: string, status: Task['status']): void;
    updateConfirmedItems(taskId: string, items: string[]): void;
    updatePendingItems(taskId: string, items: string[]): void;
    updatePlanSteps(taskId: string, steps: PlanStep[]): void;
    updateTaskGoal(taskId: string, goal: string): void;
    updateTaskNodeMessageId(taskId: string, nodeType: string, messageId: string): void;
    getMessages(taskId: string): ChatMessage[];
    addMessage(msg: ChatMessage): void;
    nextMessageId(taskId: string): string;
    updateMessageType(taskId: string, messageId: string, type?: ChatMessage['type']): void;
    updateTaskTitle(taskId: string, title: string): void;
    updateTaskType(taskId: string, type: 'task' | 'chat'): void;
}

export interface TaskFlowDelegate {
    onPhaseChanged(taskId: string): void;
    onExecuteFinished(taskId: string): void;
    onGoalFormatted(taskId: string, goalText: string, originalRequest: string): void;
    onError(taskId: string, error: string): void;
}

export interface GenResult {
    planProposed: boolean;
    executeFinished: boolean;
}

interface PlanEntry {
    content: string;
    priority: string;
    status: string;
}

export class TaskFlow {
    private store: ITaskStore;
    private delegate: TaskFlowDelegate;

    private planProposed: Map<string, boolean> = new Map();
    private executeFinished: Map<string, boolean> = new Map();
    private accumulatedText: Map<string, string> = new Map();
    private planEntries: Map<string, PlanEntry[]> = new Map();

    constructor(store: ITaskStore, delegate: TaskFlowDelegate) {
        this.store = store;
        this.delegate = delegate;
    }

    loadTask(taskId: string): void {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.planProposed.set(taskId, false);
        this.executeFinished.set(taskId, false);
        this.accumulatedText.set(taskId, '');
        this.planEntries.set(taskId, []);
    }

    resetGeneration(taskId: string): void {
        this.accumulatedText.set(taskId, '');
        this.planEntries.set(taskId, []);
        this.planProposed.set(taskId, false);
        this.executeFinished.set(taskId, false);
    }

    setPlanEntries(taskId: string, entries: PlanEntry[]): void {
        this.planEntries.set(taskId, entries);
    }

    getPlanEntries(taskId: string): PlanEntry[] {
        return this.planEntries.get(taskId) || [];
    }

    buildPlanSection(taskId: string): string {
        const entries = this.getPlanEntries(taskId);
        if (entries.length === 0) return '';
        const lines = ['', '📋 计划:'];
        for (const e of entries) {
            const icon = e.status === 'completed' ? '✅' : e.status === 'in_progress' ? '🔄' : '⬜';
            lines.push(` ${icon} ${e.content}`);
        }
        return '\n' + lines.join('\n');
    }

    isPlanProposed(taskId: string): boolean {
        return this.planProposed.get(taskId) || false;
    }

    isExecuteFinished(taskId: string): boolean {
        return this.executeFinished.get(taskId) || false;
    }

    getCleanText(taskId: string): string {
        const text = this.accumulatedText.get(taskId) || '';
        return text.replace(/<TASK_UPDATE>[\s\S]*?<\/TASK_UPDATE>/g, '').trim();
    }

    processChunk(taskId: string, chunk: string): string {
        const current = this.accumulatedText.get(taskId) || '';
        this.accumulatedText.set(taskId, current + chunk);
        this.parseTaskUpdate(taskId);
        return this.getCleanText(taskId);
    }

    getGenResult(taskId: string): GenResult {
        return {
            planProposed: this.isPlanProposed(taskId),
            executeFinished: this.isExecuteFinished(taskId)
        };
    }

    private parseTaskUpdate(taskId: string): void {
        const task = this.store.getTask(taskId);
        if (!task || task.type !== 'task') return;
        let text = this.accumulatedText.get(taskId) || '';

        const regex = /<TASK_UPDATE>([\s\S]*?)<\/TASK_UPDATE>/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const payload = JSON.parse(match[1]);

                const blockingActions = ['lock_goal', 'lock_plan', 'accept', 'reject'];
                if (blockingActions.includes(payload.action)) {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    regex.lastIndex = 0;
                    continue;
                }

                if (task.phase === 'execute' && payload.action === 'finish_execute') {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    this.executeFinished.set(taskId, true);
                    this.delegate.onExecuteFinished(taskId);
                    regex.lastIndex = 0;
                    continue;
                }

                if (this.validateAction(task.phase, payload.action)) {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    this.executeAction(taskId, payload);
                    regex.lastIndex = 0;
                }
            } catch {
                // malformed JSON, skip
            }
        }
    }

    validateAction(currentPhase: string, action: string): boolean {
        const validActions: Record<string, string[]> = {
            'demand': ['propose_goal'],
            'goal': ['propose_goal'],
            'plan': ['propose_plan'],
            'execute': [],
            'review': [],
        };
        const allowed = validActions[currentPhase] || [];
        if (!allowed.includes(action)) {
            console.warn(`[TaskFlow] Invalid action "${action}" for phase "${currentPhase}"`);
            return false;
        }
        return true;
    }

    executeAction(taskId: string, payload: any): void {
        const task = this.store.getTask(taskId);
        if (!task) return;

        switch (payload.action) {
            case 'propose_goal':
                if (payload.confirmed_items) {
                    this.store.updateConfirmedItems(taskId, payload.confirmed_items);
                }
                if (payload.pending_items) {
                    this.store.updatePendingItems(taskId, payload.pending_items);
                }
                this.delegate.onPhaseChanged(taskId);
                break;

            case 'propose_plan':
                if (payload.plan_steps) {
                    this.store.updatePlanSteps(taskId, payload.plan_steps);
                }
                this.planProposed.set(taskId, true);
                this.delegate.onPhaseChanged(taskId);
                break;
        }
    }

    processGoalProposal(taskId: string, goalText: string, originalRequest: string, userText: string): void {
        this.store.updateTaskGoal(taskId, goalText);
        this.store.updateTaskPhase(taskId, 'goal');
        this.store.updateTaskStatus(taskId, 'pending');
        const goalMsgId = this.store.nextMessageId(taskId);
        this.store.addMessage({
            id: goalMsgId,
            taskId,
            role: 'agent',
            type: 'goal_confirmation',
            content: `📋 任务目标确认\n\n${goalText}`,
            timestamp: Date.now()
        });
        this.store.updateTaskNodeMessageId(taskId, 'goal', goalMsgId);
        this.delegate.onPhaseChanged(taskId);
        this.delegate.onGoalFormatted(taskId, goalText, originalRequest);
    }

    confirmGoal(taskId: string): void {
        const msgs = this.store.getMessages(taskId);
        const lastGoal = msgs.filter(m => m.type === 'goal_confirmation').pop();
        if (lastGoal) {
            this.store.updateMessageType(taskId, lastGoal.id, 'goal_confirmed');
        }

        this.store.updateTaskPhase(taskId, 'plan');
        this.store.updateTaskStatus(taskId, 'active');
        this.delegate.onPhaseChanged(taskId);
    }

    confirmGoalWithEdit(taskId: string, newGoal: string): void {
        this.store.updateTaskGoal(taskId, newGoal);
        this.confirmGoal(taskId);
    }

    confirmPlan(taskId: string): void {
        const task = this.store.getTask(taskId);
        if (task) {
            this.planProposed.set(taskId, false);
            this.store.updateTaskPhase(taskId, 'execute');
            this.store.updateTaskStatus(taskId, 'active');
            this.delegate.onPhaseChanged(taskId);
        }
    }

    rejectPlan(taskId: string): void {
        this.planProposed.set(taskId, false);
    }

    confirmExecuteDone(taskId: string): string {
        this.executeFinished.set(taskId, false);
        this.store.updateTaskPhase(taskId, 'review');
        this.store.updateTaskStatus(taskId, 'in_review');
        this.delegate.onPhaseChanged(taskId);

        const msgs = this.store.getMessages(taskId);
        const lastAgentMsg = [...msgs].reverse().find(m => m.role === 'agent' && !m.type);
        return lastAgentMsg?.content || '';
    }

    finishReview(taskId: string): void {
        const msgs = this.store.getMessages(taskId);
        const lastReview = msgs.filter(m => m.type === 'review_request').pop();
        if (lastReview) {
            this.store.updateMessageType(taskId, lastReview.id, 'review_approved');
        }

        this.store.updateTaskStatus(taskId, 'completed');
        this.delegate.onPhaseChanged(taskId);
    }

    rejectReview(taskId: string): void {
        const msgs = this.store.getMessages(taskId);
        const lastReview = msgs.filter(m => m.type === 'review_request').pop();
        if (lastReview) {
            this.store.updateMessageType(taskId, lastReview.id, 'review_rejected');
        }

        this.store.updateTaskPhase(taskId, 'execute');
        this.store.updateTaskStatus(taskId, 'active');
        this.delegate.onPhaseChanged(taskId);
    }

    buildPrompt(taskId: string, userText: string): string {
        const task = this.store.getTask(taskId);
        if (!task || task.type !== 'task') return userText;

        const layers = [
            BASE_PROMPT,
            PROTOCOL_PROMPT,
            this.buildTaskContext(task),
            this.buildPhasePrompt(task),
        ];

        return layers.filter(Boolean).join('\n\n---\n\n') + '\n\n' + userText;
    }

    private buildTaskContext(task: Task): string {
        const lines: string[] = [];

        if (task.goal) {
            lines.push(`目标：${task.goal}`);
        }
        if (task.confirmedItems.length > 0) {
            lines.push('已锁定目标：');
            task.confirmedItems.forEach((item, i) => {
                lines.push(`${i + 1}. ${item}`);
            });
        }
        if (task.planSteps.length > 0) {
            lines.push('计划步骤：');
            task.planSteps.forEach((s, i) => {
                lines.push(`   ${i + 1}. [${s.status}] ${s.content}`);
            });
        }
        if (task.pendingItems.length > 0) {
            lines.push('待讨论条目：');
            task.pendingItems.forEach((item, i) => {
                lines.push(`${i + 1}. ${item}`);
            });
        }

        return lines.length > 0 ? lines.join('\n') : '';
    }

    private buildPhasePrompt(task: Task): string {
        switch (task.phase) {
            case 'demand':  return DEMAND_PROMPT;
            case 'goal':    return GOAL_PROMPT;
            case 'plan':    return PLAN_PROMPT;
            case 'execute': return EXECUTE_PROMPT;
            case 'review':  return REVIEW_PROMPT;
            default:        return '';
        }
    }
}
