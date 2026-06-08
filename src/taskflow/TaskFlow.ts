import type { Task, PlanStep, ChatMessage, TodoItem, KnowledgeEntry, TimelineEntry } from '../types';
import { BASE_PROMPT } from './prompts/base';
import { PROTOCOL_CORE, PROTOCOL_DELEGATE, PROTOCOL_KNOWLEDGE } from './prompts/protocol';
import { GOAL_PROMPT } from './prompts/goal';
import { PLAN_PROMPT } from './prompts/plan';
import { EXECUTE_PROMPT } from './prompts/execute';
import { REVIEW_PROMPT } from './prompts/review';
import { SELF_VERIFY_PROMPT } from './prompts/self_verify';

import { getCategory } from './templates';
import { loadExternalPrompt } from './externalPrompts';
import { getTypePrompt } from './prompts/types';

const CHAT_PROMPT = `你是一个专业的技术顾问，职责是为用户答疑解惑、提供方案、出谋划策。
你深入理解当前工作区的代码结构和上下文。

核心约束：
1. 只输出方案和思路，不要直接写文件、编辑文件或执行任何会修改工作区的命令
2. 你可以展示代码示例（放在 markdown 代码块中），但不落地到实际文件
3. 除非用户明确要求（如"写文件""保存""创建""编辑"等关键词），否则不得执行写操作

使用中文回复。

【排版规范】
4. 文件路径、函数名、变量名、状态值等所有技术名词，必须用单个反引号包裹，禁止裸写中文
5. 加粗仅限核心结论，普通解说文字禁止加粗
6. 每段聚焦一个观点，不超过三行。块与块之间用空行拉开视觉距离
7. 按紧急度使用前缀信号：❌ 阻断、⚠️ 注意、💡 建议、🔍 根因、🎯 结论
8. 调用链按层级分点展开，子属逻辑缩进`;

export interface ITaskStore {
    getTask(taskId: string): Task | undefined;
    updateTaskPhase(taskId: string, phase: Task['phase']): void;
    updateTaskStatus(taskId: string, status: Task['status']): void;
    updateConfirmedItems(taskId: string, items: string[]): void;
    updatePendingItems(taskId: string, items: string[]): void;
    updatePlanSteps(taskId: string, steps: PlanStep[]): void;
    updateTaskGoal(taskId: string, goal: string): void;
    updatePlanStepStatus(taskId: string, index: number, status: PlanStep['status']): void;
    updateTaskNodeMessageId(taskId: string, nodeType: string, messageId: string): void;
    incrementPlanVersion(taskId: string): void;
    updateRiskItems(taskId: string, items: string[]): void;
    updateBoundaryItems(taskId: string, items: string[]): void;
    getMessages(taskId: string): ChatMessage[];
    addMessage(msg: ChatMessage): void;
    nextMessageId(taskId: string): string;
    updateMessageType(taskId: string, messageId: string, type?: ChatMessage['type']): void;
    updateMessageContent(taskId: string, messageId: string, content: string): void;
    updateTaskTitle(taskId: string, title: string): void;
    updateTaskType(taskId: string, type: 'task'): void;
    updateTaskHooks(taskId: string, phase: string, commands: string[]): void;
    updateTaskCategory(taskId: string, category: Task['category']): void;
    getTaskKnowledgeEntries(taskId: string): KnowledgeEntry[];
    getAllKnowledgeEntries(): KnowledgeEntry[];
    addTimelineEntry(taskId: string, entry: TimelineEntry): void;
    getTaskTimeline(taskId: string): TimelineEntry[];
}

export interface DelegatePayload {
    title: string;
    goal: string;
    relatedFiles?: string[];
    confirmedItems?: string[];
    relevantSnippets?: string;
}

export interface TaskFlowDelegate {
    onPhaseChanged(taskId: string): void;
    onExecuteFinished(taskId: string): void;
    onGoalFormatted(taskId: string, goalText: string, originalRequest: string): void;
    onError(taskId: string, error: string): void;
    onSelfVerifyNeeded(taskId: string): void;
    onSelfVerifyFinished(taskId: string): void;
    onPlanStepUpdate(taskId: string): void;
    onTaskDelegated(taskId: string, payload: DelegatePayload): void;
    onTodoUpdate(taskId: string, items: TodoItem[], action: string): void;
    onKnowledgeEntry(taskId: string, entries: KnowledgeEntry[]): void;
}

export interface GenResult {
    planProposed: boolean;
    executeFinished: boolean;
    selfVerifyFinished: boolean;
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
    private goalProposed: Map<string, boolean> = new Map();
    private executeFinished: Map<string, boolean> = new Map();
    private selfVerifyFinished: Map<string, boolean> = new Map();
    private accumulatedText: Map<string, string> = new Map();
    private tableParsed: Set<string> = new Set();
    private planEntries: Map<string, PlanEntry[]> = new Map();
    private workspaceHooks: Record<string, string[]> = {};
    private availableCommands: string = '';

    setWorkspaceHooks(hooks: Record<string, string[]>): void {
        this.workspaceHooks = hooks;
    }

    setAvailableCommands(text: string): void {
        this.availableCommands = text;
    }

    constructor(store: ITaskStore, delegate: TaskFlowDelegate) {
        this.store = store;
        this.delegate = delegate;
    }

    loadTask(taskId: string): void {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.planProposed.set(taskId, false);
        this.goalProposed.set(taskId, false);
        this.executeFinished.set(taskId, false);
        this.selfVerifyFinished.set(taskId, false);
        this.accumulatedText.set(taskId, '');
        this.planEntries.set(taskId, []);
    }

    resetGeneration(taskId: string): void {
        this.accumulatedText.set(taskId, '');
        this.planEntries.set(taskId, []);
        this.planProposed.set(taskId, false);
        this.goalProposed.set(taskId, false);
        this.executeFinished.set(taskId, false);
        this.selfVerifyFinished.set(taskId, false);
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

    isGoalProposed(taskId: string): boolean {
        return this.goalProposed.get(taskId) || false;
    }

    isExecuteFinished(taskId: string): boolean {
        return this.executeFinished.get(taskId) || false;
    }

    isSelfVerifyFinished(taskId: string): boolean {
        return this.selfVerifyFinished.get(taskId) || false;
    }

    getCleanText(taskId: string): string {
        let text = this.accumulatedText.get(taskId) || '';
        text = text.replace(/```[^\n]*\n?\s*\[TASK_UPDATE\]/g, '[TASK_UPDATE]');
        text = text.replace(/\[\/TASK_UPDATE\]\s*\n?```/g, '[/TASK_UPDATE]');
        text = text.replace(/`{1,2}\s*\[TASK_UPDATE\]/g, '[TASK_UPDATE]');
        text = text.replace(/\[\/TASK_UPDATE\]\s*`{1,2}/g, '[/TASK_UPDATE]');
        return text.replace(/\s*\[TASK_UPDATE\][\s\S]*?\[\/TASK_UPDATE\]\s*/g, '\n').trim();
    }

    processChunk(taskId: string, chunk: string, parseTables = false): string {
        const current = this.accumulatedText.get(taskId) || '';
        this.accumulatedText.set(taskId, current + chunk);
        this.parseTaskUpdate(taskId);
        this.parseTaskDelegate(taskId);
        this.parseTodoUpdate(taskId);
        this.parseKnowledgeEntry(taskId);
        if (parseTables) this.parseKnowledgeTable(taskId);
        return this.getCleanText(taskId);
    }

    private parseTaskDelegate(taskId: string): void {
        let text = this.accumulatedText.get(taskId) || '';
        const regex = /\[TASK_DELEGATE\]([\s\S]*?)\[\/TASK_DELEGATE\]/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const payload = this.parseDelegatePayload(match[1]);
                text = text.replace(match[0], '');
                this.accumulatedText.set(taskId, text);
                regex.lastIndex = 0;
                this.delegate.onTaskDelegated(taskId, payload);
            } catch {
                // malformed payload, skip
            }
        }
    }

    private static readonly DELEGATE_KEYS = new Set(['TITLE', 'GOAL', 'RELATED', 'CONFIRMED', 'CONTEXT']);

    private parseDelegatePayload(body: string): DelegatePayload {
        const payload: any = {};
        let currentKey = '';
        for (const line of body.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
            if (kvMatch && TaskFlow.DELEGATE_KEYS.has(kvMatch[1])) {
                currentKey = kvMatch[1];
                const value = kvMatch[2].trim();
                if (value) {
                    payload[currentKey] = value;
                }
            }
        }
        if (!payload.TITLE || !payload.GOAL) throw new Error('missing title or goal');
        return {
            title: payload.TITLE,
            goal: payload.GOAL,
            relatedFiles: payload.RELATED ? payload.RELATED.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
            confirmedItems: payload.CONFIRMED ? payload.CONFIRMED.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
            relevantSnippets: payload.CONTEXT || undefined,
        };
    }

    private parseTodoUpdate(taskId: string): void {
        let text = this.accumulatedText.get(taskId) || '';
        let found = false;

        // 格式1: <TODO_UPDATE>{ action, items }</TODO_UPDATE>（自定义协议）
        const regex1 = /<TODO_UPDATE>([\s\S]*?)<\/TODO_UPDATE>/gi;
        let match;
        while ((match = regex1.exec(text)) !== null) {
            try {
                const payload = JSON.parse(match[1].trim());
                if (!payload.action || !Array.isArray(payload.items)) continue;
                const items: TodoItem[] = payload.items.map((item: any) => ({
                    id: String(item.id),
                    content: String(item.content || ''),
                    status: item.status === 'completed' ? 'completed' : 'pending'
                }));
                text = text.replace(match[0], '');
                found = true;
                regex1.lastIndex = 0;
                this.delegate.onTodoUpdate(taskId, items, payload.action);
            } catch {
                // skip
            }
        }

        // 格式2: <title>N todos</title>\n[{ content, status, priority }]（ACP 原生格式）
        const regex2 = /<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/gi;
        while ((match = regex2.exec(text)) !== null) {
            try {
                const rawItems = JSON.parse(match[1].trim());
                if (!Array.isArray(rawItems) || rawItems.length === 0) continue;
                const items: TodoItem[] = rawItems.map((item: any, idx: number) => ({
                    id: String(idx),
                    content: String(item.content || ''),
                    status: item.status === 'completed' ? 'completed' : 'pending',
                    priority: item.priority,
                }));
                text = text.replace(match[0], '');
                found = true;
                regex2.lastIndex = 0;
                this.delegate.onTodoUpdate(taskId, items, 'replace');
            } catch {
                // skip
            }
        }

        if (found) {
            this.accumulatedText.set(taskId, text);
        }
    }

    private parseKnowledgeEntry(taskId: string): void {
        let text = this.accumulatedText.get(taskId) || '';
        const task = this.store.getTask(taskId);
        const regex = /<KNOWLEDGE_ENTRY>([\s\S]*?)<\/KNOWLEDGE_ENTRY>/gi;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const raw = match[1].trim();
                const entries = JSON.parse(raw);
                if (!Array.isArray(entries)) continue;
                const knowledge: KnowledgeEntry[] = entries.map((e: any, i: number) => ({
                    id: `ke_${taskId}_${Date.now()}_${i}`,
                    taskId,
                    type: e.type || 'decision',
                    title: e.title || '',
                    content: e.content || '',
                    tags: Array.isArray(e.tags) ? e.tags : [],
                    createdAt: Date.now(),
                    source: `task:${taskId}`,
                    phase: task?.phase,
                }));
                text = text.replace(match[0], '');
                this.accumulatedText.set(taskId, text);
                regex.lastIndex = 0;
                this.delegate.onKnowledgeEntry(taskId, knowledge);
            } catch {
                // malformed payload, skip
            }
        }
    }

    private parseKnowledgeTable(taskId: string): void {
        if (this.tableParsed.has(taskId)) return;
        const text = this.accumulatedText.get(taskId) || '';
        const task = this.store.getTask(taskId);
        if (!task) return;
        const marker = '📚 萃取知识表格';
        const markerIdx = text.indexOf(marker);
        if (markerIdx < 0) return;
        const afterMarker = text.slice(markerIdx + marker.length);
        const tableRegex = /^\|.+\|\s*$/gm;
        const lines: string[] = [];
        let match;
        while ((match = tableRegex.exec(afterMarker)) !== null) {
            lines.push(match[0]);
        }
        if (lines.length < 3) return;
        let tableStart = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^\|[\s\-:]+\|[\s\-:]+\|/.test(lines[i]) && i > 0 && i < lines.length - 1) {
                tableStart = i - 1;
                break;
            }
        }
        if (tableStart < 0) return;
        const headerCells = lines[tableStart].split('|').map(s => s.trim()).filter(Boolean);
        const colIdx = new Map<string, number>();
        for (const name of ['类型', '标题', '内容', '简介', '标签']) {
            const colName = name === '类型' ? 'type' : name === '标题' ? 'title' : name === '内容' || name === '简介' ? 'content' : 'tags';
            const idx = headerCells.findIndex(h => h.includes(name));
            if (idx >= 0) colIdx.set(colName, idx);
        }
        const typeIdx = colIdx.get('type');
        const titleIdx = colIdx.get('title');
        if (typeIdx === undefined || titleIdx === undefined) return;
        const contentIdx = colIdx.get('content');
        const tagsIdx = colIdx.get('tags');
        const entries: KnowledgeEntry[] = [];
        for (let ri = tableStart + 2; ri < lines.length; ri++) {
            const cells = lines[ri].split('|').map(s => s.trim()).filter(Boolean);
            if (cells.length < 2) break;
            const type = (cells[typeIdx] || 'decision') as KnowledgeEntry['type'];
            const title = cells[titleIdx];
            const content = contentIdx !== undefined ? cells[contentIdx] : title;
            const tags = tagsIdx !== undefined
                ? cells[tagsIdx].split(/[,，、\/]/).map((s: string) => s.trim().replace(/^#/, '')).filter(Boolean)
                : [];
            if (!title) continue;
            entries.push({
                id: `ke_${taskId}_${Date.now()}_${entries.length}`,
                taskId, type, title, content, tags,
                createdAt: Date.now(), source: `task:${taskId}`, phase: task.phase,
            });
        }
        if (entries.length > 0) {
            this.delegate.onKnowledgeEntry(taskId, entries);
            this.tableParsed.add(taskId);
        }
    }

    extractTableKnowledge(taskId: string): void {
        this.tableParsed.delete(taskId);
        this.parseKnowledgeTable(taskId);
    }

    getGenResult(taskId: string): GenResult {
        return {
            planProposed: this.isPlanProposed(taskId),
            executeFinished: this.isExecuteFinished(taskId),
            selfVerifyFinished: this.isSelfVerifyFinished(taskId)
        };
    }

    private parseTaskUpdate(taskId: string): void {
        const task = this.store.getTask(taskId);
        if (!task || task.type !== 'task') return;
        let text = this.accumulatedText.get(taskId) || '';

        // 归一化: 去掉可能的代码块包裹 (```text, ```, ``, `)
        text = text.replace(/```[^\n]*\n?\s*\[TASK_UPDATE\]/g, '[TASK_UPDATE]');
        text = text.replace(/\[\/TASK_UPDATE\]\s*\n?```/g, '[/TASK_UPDATE]');
        text = text.replace(/`{1,2}\s*\[TASK_UPDATE\]/g, '[TASK_UPDATE]');
        text = text.replace(/\[\/TASK_UPDATE\]\s*`{1,2}/g, '[/TASK_UPDATE]');
        this.accumulatedText.set(taskId, text);

        // 匹配 [TASK_UPDATE] 块
        const regex = /\s*\[TASK_UPDATE\]\s*([\s\S]*?)\s*\[\/TASK_UPDATE\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            try {
                const payload = this.parseSimplePayload(match[1]);

                const blockingActions = ['accept', 'reject'];
                if (blockingActions.includes(payload.ACTION)) {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    regex.lastIndex = 0;
                    continue;
                }

                if (task.phase === 'execute' && payload.ACTION === 'finish_execute') {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    this.executeFinished.set(taskId, true);
                    this.delegate.onExecuteFinished(taskId);
                    regex.lastIndex = 0;
                    continue;
                }

                if (task.phase === 'self_verify' && payload.ACTION === 'finish_verify') {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    if (payload.DECISION === 'continue' && task.flowIteration?.enabled) {
                        const state = task.flowIteration.state;
                        state.currentIteration++;
                        this.store.updateTaskPhase(taskId, 'execute');
                        this.store.updateTaskStatus(taskId, 'active');
                        this.store.addTimelineEntry(taskId, {
                            timestamp: Date.now(),
                            type: 'phase_change',
                            summary: `自验通过 → 继续执行（第 ${state.currentIteration} 轮迭代）`,
                        });
                        this.delegate.onPhaseChanged(taskId);
                    } else {
                        this.selfVerifyFinished.set(taskId, true);
                        this.delegate.onSelfVerifyFinished(taskId);
                    }
                    regex.lastIndex = 0;
                    continue;
                }

                if (this.validateAction(task.phase, payload.ACTION)) {
                    text = text.replace(match[0], '');
                    this.accumulatedText.set(taskId, text);
                    this.executeAction(taskId, payload);
                    regex.lastIndex = 0;
                }
            } catch {
                // malformed payload, skip
            }
        }
    }

    private static readonly PROTOCOL_KEYS = new Set(['ACTION', 'CATEGORY', 'CONFIRMED', 'PENDING', 'STEPS', 'INDEX', 'STATUS', 'DECISION', 'METRICS', 'ITERATION']);

    private parseSimplePayload(body: string): any {
        const payload: any = {};
        let currentKey = '';
        for (const line of body.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const kvMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)$/);
            if (kvMatch && TaskFlow.PROTOCOL_KEYS.has(kvMatch[1])) {
                currentKey = kvMatch[1];
                const value = kvMatch[2].trim();
                if (value) {
                    payload[currentKey] = value;
                } else if (!payload[currentKey]) {
                    payload[currentKey] = [];
                }
                continue;
            }
            const listMatch = trimmed.match(/^-\s+(.+)$/);
            if (listMatch && currentKey && Array.isArray(payload[currentKey])) {
                payload[currentKey].push(listMatch[1].trim());
            }
        }
        if (!payload.ACTION) throw new Error('missing action');
        return payload;
    }

    private normalizeSteps(steps: any): { content: string; status: 'pending' }[] {
        if (Array.isArray(steps)) {
            return steps.map(s => ({
                content: typeof s === 'string' ? s : s?.content || String(s),
                status: 'pending' as const
            }));
        }
        if (typeof steps === 'string' && steps.trim()) {
            return [{ content: steps.trim(), status: 'pending' as const }];
        }
        return [];
    }

    validateAction(currentPhase: string, action: string): boolean {
        const validActions: Record<string, string[]> = {
            
            'goal': ['propose_goal'],
            'plan': ['propose_plan'],
            'execute': ['plan_step_update'],
            'self_verify': [],
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

        switch (payload.ACTION) {
            case 'propose_goal':
                {
                    if (payload.CATEGORY && this.store.updateTaskCategory) {
                        this.store.updateTaskCategory(taskId, payload.CATEGORY);
                    }
                    this.goalProposed.set(taskId, true);
                    this.delegate.onPhaseChanged(taskId);
                }
                break;

            case 'propose_plan':
                {
                    const steps = this.normalizeSteps(payload.STEPS);
                    if (steps.length > 0) {
                        this.store.updatePlanSteps(taskId, steps);
                        this.store.incrementPlanVersion(taskId);
                    }
                    this.planProposed.set(taskId, true);
                    this.delegate.onPhaseChanged(taskId);
                }
                break;

            case 'plan_step_update':
                {
                    const idx = parseInt(payload.INDEX, 10);
                    const status = payload.STATUS as 'active' | 'completed';
                    if (!isNaN(idx) && (status === 'active' || status === 'completed')) {
                        this.store.updatePlanStepStatus(taskId, idx, status);
                        this.delegate.onPlanStepUpdate(taskId);
                    }
                }
                break;
        }
    }

    processGoalProposal(taskId: string, goalText: string, originalRequest: string, userText: string): void {
        this.store.updateTaskGoal(taskId, goalText);
        const lines = goalText.split('\n').filter(l => l.trim());
        const firstLine = lines[0] || '';
        const title = firstLine.replace(/^[#*\s]+/, '').replace(/[^\w\u4e00-\u9fff\s-]/g, '').trim().substring(0, 30);
        if (title) {
            this.store.updateTaskTitle(taskId, title);
        }
        this.store.updateTaskPhase(taskId, 'goal');
        this.store.updateTaskStatus(taskId, 'pending');
        this.delegate.onPhaseChanged(taskId);
        this.delegate.onGoalFormatted(taskId, goalText, originalRequest);
    }

    confirmGoal(taskId: string): void {
        this.store.updateTaskPhase(taskId, 'plan');
        this.store.updateTaskStatus(taskId, 'active');
        this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '目标确认 → 计划', detail: '用户确认目标，进入计划阶段' });
        this.delegate.onPhaseChanged(taskId);
    }

    confirmGoalWithEdit(taskId: string, newGoal: string): void {
        this.store.updateTaskGoal(taskId, newGoal);
        this.confirmGoal(taskId);
    }

    confirmPlan(taskId: string): void {
        const msgs = this.store.getMessages(taskId);
        const lastPlan = msgs.filter(m => m.type === 'plan_proposal').pop();
        if (lastPlan) {
            this.store.updateMessageType(taskId, lastPlan.id, 'plan_confirmed');
        }

        const task = this.store.getTask(taskId);
        if (task) {
            this.store.incrementPlanVersion(taskId);
            this.planProposed.set(taskId, false);
            this.store.updateTaskPhase(taskId, 'execute');
            this.store.updateTaskStatus(taskId, 'active');
            this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '计划确认 → 执行', detail: '用户确认计划，进入执行阶段' });
            this.delegate.onPhaseChanged(taskId);
        }
    }

    rejectPlan(taskId: string): void {
        this.planProposed.set(taskId, false);
    }

    confirmExecuteDone(taskId: string): void {
        this.executeFinished.set(taskId, false);
        this.store.updateTaskPhase(taskId, 'self_verify');
        this.store.updateTaskStatus(taskId, 'active');
        this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '执行完成 → 自验', detail: 'AI 执行完成，进入自验阶段' });
        this.delegate.onPhaseChanged(taskId);
    }

    confirmSelfVerifyDone(taskId: string): string {
        this.selfVerifyFinished.set(taskId, false);
        this.store.updateTaskPhase(taskId, 'review');
        this.store.updateTaskStatus(taskId, 'in_review');
        this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '自验完成 → 验收', detail: 'AI 自验通过，进入验收阶段' });
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
        this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '验收通过 → 已完成', detail: '用户验收通过，任务完成' });
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
        this.store.addTimelineEntry(taskId, { timestamp: Date.now(), type: 'phase_change', summary: '验收驳回 → 执行', detail: '用户驳回验收，回到执行阶段' });
        this.delegate.onPhaseChanged(taskId);
    }

    buildInitialPrompt(taskId: string, userText: string): string {
        const task = this.store.getTask(taskId);
        if (!task) return userText;
        if (task.type !== 'task') {
            return `${CHAT_PROMPT}\n\n${userText}`;
        }

        const appendix = this.buildProtocolAppendix(task);
        const layers = [
            BASE_PROMPT,
            PROTOCOL_CORE,
            this.buildTaskContext(task),
            this.buildPhasePrompt(task),
            appendix || undefined,
            this.availableCommands || undefined,
        ];

        return layers.filter(Boolean).join('\n\n---\n\n') + '\n\n---\n\n## 用户任务\n' + userText;
    }

    buildPhaseTransitionPrompt(taskId: string, userText: string): string {
        const task = this.store.getTask(taskId);
        if (!task) return userText;
        if (task.type !== 'task') {
            return userText;
        }

        const appendix = this.buildProtocolAppendix(task);
        // 只有需求/目标/计划阶段需要目标上下文，执行/自验/验收阶段已确认目标无需重复发送
        const needsContext = ['goal', 'plan'].includes(task.phase);
        const layers = [
            needsContext ? this.buildTaskContext(task) : '',
            this.buildPhasePrompt(task),
            appendix || undefined,
        ];

        const hooksStr = this.getPhaseHooksString(task.phase, task);
        if (hooksStr) {
            layers.push(`请先执行以下命令完成阶段准备工作，再继续后续任务。\n${hooksStr}`);
        }

        return layers.filter(Boolean).join('\n\n---\n\n') + '\n\n## 用户任务\n' + userText;
    }

    /** @deprecated 使用 buildInitialPrompt 或 buildPhaseTransitionPrompt */
    buildPrompt(taskId: string, userText: string): string {
        return this.buildInitialPrompt(taskId, userText);
    }

    private buildTaskContext(task: Task): string {
        const lines: string[] = [];

        if (task.goal) {
            lines.push(`目标：${task.goal}`);
        }

        return lines.length > 0 ? lines.join('\n') : '';
    }

    private buildKnowledgeContext(task: Task): string {
        const entries = this.store.getTaskKnowledgeEntries(task.id);
        const allEntries = this.store.getAllKnowledgeEntries();
        const related: KnowledgeEntry[] = [];

        const taskKeywords = [task.goal, task.title, task.category]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length > 2);

        for (const e of allEntries) {
            if (e.taskId === task.id) {
                related.push(e);
                continue;
            }
            const matchTitle = taskKeywords.some(k => e.title.toLowerCase().includes(k));
            const matchContent = taskKeywords.some(k => e.content.toLowerCase().includes(k));
            const matchTags = e.tags.some(t => taskKeywords.some(k => t.toLowerCase().includes(k)));
            if (matchTitle || matchContent || matchTags) {
                related.push(e);
            }
        }

        if (related.length === 0) return '';

        const lines: string[] = ['## 相关历史知识'];
        lines.push('以下是从已完成任务中提取的经验，可能与当前任务相关：\n');
        for (const e of related.slice(0, 8)) {
            const typeIcon: Record<string, string> = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' };
            lines.push(`### ${typeIcon[e.type] || '📌'} ${e.title}`);
            const preview = e.content.replace(/<[^>]+>/g, '').substring(0, 200);
            if (preview) lines.push(`> ${preview}`);
            if (e.tags.length) lines.push(`\ntags: ${e.tags.join(', ')}`);
            lines.push('');
        }

        return lines.join('\n');
    }

    private buildPhasePrompt(task: Task): string {
        let basePrompt = (() => {
            switch (task.phase) {
                
                case 'goal':    return GOAL_PROMPT;
                case 'plan':    return PLAN_PROMPT;
                case 'execute':     return EXECUTE_PROMPT;
                case 'self_verify': return SELF_VERIFY_PROMPT;
                case 'review':      return REVIEW_PROMPT;
                default:        return '';
            }
        })();

        // 合并类别专属提示词
        if (task.category) {
            const typePrompts = getTypePrompt(task.category);
            const phasePrompt = typePrompts?.[task.phase as keyof typeof typePrompts];
            if (phasePrompt) {
                basePrompt = basePrompt + '\n\n---\n' + phasePrompt;
            }
        }

        const extraParts: string[] = [];
        if (task.category) {
            const cat = getCategory(task.category);
            if (cat) {
                if (task.phase === 'plan' && cat.analysisFramework) {
                    extraParts.push(`【分析框架】\n${cat.analysisFramework}`);
                }
                if (task.phase === 'execute' && cat.executionHints.length > 0) {
                    extraParts.push(`【执行约束】\n${cat.executionHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}`);
                }
            }
        }
        if (extraParts.length > 0) {
            basePrompt = basePrompt + '\n\n' + extraParts.join('\n\n');
        }

        if (task.flowIteration?.enabled && (task.phase === 'execute' || task.phase === 'self_verify')) {
            const { state, config } = task.flowIteration;
            const iterLines: string[] = [
                '',
                `【迭代优化 - 第 ${state.currentIteration + 1}/${config.iterationLimit} 轮】`,
                '',
            ];
            if (state.currentIteration > 0) {
                const last = state.history[state.history.length - 1];
                if (last) {
                    const metricsStr = Object.entries(last.metrics)
                        .map(([k, v]) => `${k}=${v}${config.targets[k] !== undefined ? `(目标: ${config.targets[k]})` : ''}`)
                        .join(', ');
                    iterLines.push(`当前基线: ${metricsStr}`);
                }
                iterLines.push(`历史迭代: ${state.history.map(h => `iter ${h.iteration}: ${h.passed ? '✅' : '❌'} ${h.improved ? '有改进' : '停滞'}`).join('; ')}`);
                iterLines.push('');
            }
            if (task.phase === 'self_verify') {
                if (config.correctnessTests.length > 0) {
                    iterLines.push('【正确性测试】');
                    config.correctnessTests.forEach(t => iterLines.push(`  ${t}`));
                    iterLines.push('');
                }
                iterLines.push('【决策规则】');
                iterLines.push('1. 正确性测试失败 → 最多自动修复 3 次，仍失败则 DECISION=continue');
                iterLines.push('2. 全部指标达标 → DECISION=success');
                iterLines.push('3. 未达标 + 未达上限 + 有改进 → DECISION=continue');
                iterLines.push('4. 已达迭代上限 → DECISION=timeout');
                iterLines.push('5. 连续 2 轮无改进 → DECISION=stagnation');
            } else {
                iterLines.push('当前需要在前一轮基础上继续优化。');
            }
            basePrompt = basePrompt + '\n\n' + iterLines.join('\n');
        }

        const externalContent = loadExternalPrompt(task.type, task.category, task.subType, task.phase);
        if (externalContent) {
            basePrompt = basePrompt + '\n\n【用户自定义规则】\n' + externalContent;
        }

        return basePrompt;
    }

    private buildProtocolAppendix(task: Task): string {
        const parts: string[] = [];
        if (task.phase === 'review') {
            parts.push(PROTOCOL_KNOWLEDGE);
        }
        return parts.join('\n\n');
    }

    getPhaseHooksString(phase: string, task: Task): string {
        const lines: string[] = [];
        const wsHooks = this.workspaceHooks[phase] || [];
        const taskHooks = task.hooks?.[phase as Task['phase']] || [];

        if (wsHooks.length > 0) {
            lines.push('【项目全局命令】');
            wsHooks.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
        }
        if (taskHooks.length > 0) {
            if (lines.length > 0) lines.push('');
            lines.push('【任务级命令】');
            taskHooks.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
        }
        return lines.length > 0 ? lines.join('\n') : '';
    }
}
