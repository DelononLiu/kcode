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
        categoryLabel: '',
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
    private _patchSubscribers = new Set<() => void>();

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

    /** 注册 patch 订阅者，每次 patch() 后触发，用于数据驱动 DOM 同步 */
    onPatch(fn: () => void): () => void {
        this._patchSubscribers.add(fn);
        return () => this._patchSubscribers.delete(fn);
    }

    update(delta: StateDelta): void {
        Object.assign(this._state, delta);
        for (const fn of this._subscribers) {
            fn(this._state);
        }
    }

    /** 静默更新 state，通知 patch 订阅者（高频 streaming 用） */
    patch(delta: StateDelta): void {
        Object.assign(this._state, delta);
        for (const fn of this._patchSubscribers) {
            fn();
        }
    }

    reset(): void {
        this._state = createInitialState();
    }
}

export const stateManager = new StateManager();
