import type { AppState, StateSubscriber, StateDelta, StreamState, ReviewState, TaskInfo, PendingMessage, ToolCallState } from './types';

function createInitialState(): AppState {
    return {
        viewMode: 'task',
        activeTaskId: null,
        activeTaskPhase: '',
        activeTaskStatus: '',
        taskInfo: createInitialTaskInfo(),
        confirmedItems: [],
        planSteps: [],
        planVersion: 1,
        messages: [],
        streamState: createInitialStreamState(),
        reviewState: createInitialReviewState(),
        isGenerating: false,
        pendingMessages: [],
        agentName: '',
        modelName: '',
        hooks: {},
        workspaceHooks: {},
    };
}

function createInitialTaskInfo(): TaskInfo {
    return {
        title: '',
        goal: '',
        category: '',
        phase: '',
        phaseLabel: '',
        status: '',
        taskType: 'task',
        createdAt: 0,
        executeFinished: false,
    };
}

function createInitialStreamState(): StreamState {
    return {
        active: false,
        buffer: '',
        toolCalls: [],
        reasoningText: '',
        reasoningActive: false,
    };
}

function createInitialReviewState(): ReviewState {
    return {
        changes: [],
        acceptanceCriteria: [],
    };
}

class StateManager {
    private _state: AppState = createInitialState();
    private _subscribers = new Set<StateSubscriber>();

    get state(): Readonly<AppState> {
        return this._state;
    }

    /** 获取当前快照 */
    snapshot(): AppState {
        return JSON.parse(JSON.stringify(this._state));
    }

    /** 订阅状态变更 */
    subscribe(fn: StateSubscriber): () => void {
        this._subscribers.add(fn);
        return () => this._subscribers.delete(fn);
    }

    /** 批量更新状态 + 通知订阅者 */
    update(delta: StateDelta): void {
        Object.assign(this._state, delta);
        for (const fn of this._subscribers) {
            fn(this._state);
        }
    }

    /** 重置为初始状态 */
    reset(): void {
        this._state = createInitialState();
    }

    // ── 便利方法 ──

    setViewMode(mode: 'task' | 'assistant'): void {
        this.update({ viewMode: mode });
    }

    setTaskInfo(info: Partial<TaskInfo> & { confirmedItems?: string[]; planSteps?: import('../../../types').PlanStep[] }): void {
        const delta: StateDelta = { taskInfo: { ...this._state.taskInfo, ...info } };
        if (info.confirmedItems !== undefined) delta.confirmedItems = info.confirmedItems;
        if (info.planSteps !== undefined) delta.planSteps = info.planSteps;
        this.update(delta);
    }

    setStreamActive(active: boolean): void {
        const delta: StateDelta = { streamState: { ...this._state.streamState, active } };
        if (!active) delta.streamState!.buffer = '';
        this.update(delta);
    }

    appendStreamChunk(chunk: string): void {
        const ss = this._state.streamState;
        const delta: StateDelta = {
            streamState: { ...ss, buffer: ss.buffer + chunk, active: true },
        };
        this.update(delta);
    }

    addToolCall(tc: ToolCallState): void {
        const ss = this._state.streamState;
        const existing = ss.toolCalls.filter(t => t.toolCallId !== tc.toolCallId);
        this.update({ streamState: { ...ss, toolCalls: [...existing, tc] } });
    }

    updateToolCall(toolCallId: string, changes: Partial<ToolCallState>): void {
        const ss = this._state.streamState;
        const updated = ss.toolCalls.map(t =>
            t.toolCallId === toolCallId ? { ...t, ...changes } : t
        );
        this.update({ streamState: { ...ss, toolCalls: updated } });
    }

    setMessages(messages: import('../../../types').ChatMessage[]): void {
        this.update({ messages });
    }

    setGenerating(isGenerating: boolean): void {
        this.update({ isGenerating });
    }

    addPendingMessage(msg: PendingMessage): void {
        this.update({ pendingMessages: [...this._state.pendingMessages, msg] });
    }

    shiftPendingMessage(): PendingMessage | undefined {
        const [next, ...rest] = this._state.pendingMessages;
        this.update({ pendingMessages: rest });
        return next;
    }

    clearPendingMessages(): void {
        this.update({ pendingMessages: [] });
    }

    setReviewChanges(changes: import('../../../types').FileChange[]): void {
        const rs = this._state.reviewState;
        this.update({ reviewState: { ...rs, changes } });
    }

    setAcceptanceCriteria(criteria: string[]): void {
        const rs = this._state.reviewState;
        this.update({ reviewState: { ...rs, acceptanceCriteria: criteria } });
    }
}

export const stateManager = new StateManager();
