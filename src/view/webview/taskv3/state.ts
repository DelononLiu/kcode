import type { AppState, StateSubscriber, StateDelta, ReviewState, Message, TaskInfo, PendingMessage } from './types';

function createInitialState(): AppState {
    return {
        viewMode: 'task',
        activeTaskId: null,
        activeTaskPhase: '',
        activeTaskStatus: '',
        taskInfo: createInitialTaskInfo(),
        messages: [],
        msgVersion: 0,
        reviewState: createInitialReviewState(),
        isGenerating: false,
        pendingMessages: [],
        agentName: '',
        modelName: '',
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

function createInitialReviewState(): ReviewState {
    return { changes: [], acceptanceCriteria: [] };
}

class StateManager {
    private _state: AppState = createInitialState();
    private _subscribers = new Set<StateSubscriber>();

    get state(): Readonly<AppState> {
        return this._state;
    }

    snapshot(): AppState {
        return JSON.parse(JSON.stringify(this._state));
    }

    subscribe(fn: StateSubscriber): () => void {
        this._subscribers.add(fn);
        return () => this._subscribers.delete(fn);
    }

    update(delta: StateDelta): void {
        Object.assign(this._state, delta);
        for (const fn of this._subscribers) {
            fn(this._state);
        }
    }

    /** 静默更新，不触发订阅者（高频率 streaming 用） */
    patch(delta: StateDelta): void {
        Object.assign(this._state, delta);
    }

    reset(): void {
        this._state = createInitialState();
    }
}

export const stateManager = new StateManager();
