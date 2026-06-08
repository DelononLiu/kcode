export interface AppState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    activeTaskPhase: string;
    activeTaskStatus: string;
    taskInfo: TaskInfo;
    /** 所有消息（含正在流式的），消息一旦创建永不销毁 */
    messages: Message[];
    /** 消息版本号，subscriber 据此判断是否需要重渲染消息 */
    msgVersion: number;
    reviewState: ReviewState;
    isGenerating: boolean;
    pendingMessages: PendingMessage[];
    agentName: string;
    modelName: string;
}

export interface Message {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type?: string;
    content: string;
    phase?: string;
    timestamp: number;

    // 流式状态 — 此消息正在流式构建中
    streaming?: boolean;

    // 折叠/分组 — 同 roundGroup 的消息在一轮交互中
    collapsed?: boolean;
    roundGroup?: string;

    // 卡片元数据（goal/plan/execute 等交互卡片）
    cardMeta?: {
        type?: 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
        confirmed?: boolean;
        status?: 'pending' | 'confirmed' | 'rejected';
    };
}

export interface TaskInfo {
    title: string;
    goal: string;
    category: string;
    categoryLabel: string;
    phase: string;
    phaseLabel: string;
    status: string;
    taskType: string;
    createdAt: number;
    executeFinished: boolean;
}

export interface ToolCallState {
    toolCallId: string;
    title: string;
    kind: string;
    status: 'running' | 'completed' | 'failed';
    output?: string;
    content?: string;
    taskId?: string;
}

export interface ReviewState {
    changes: FileChange[];
    acceptanceCriteria: string[];
}

interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

export interface PendingMessage {
    text: string;
    taskId: string;
}

export interface StreamResult {
    cleanedText: string;
    planProposed: boolean;
    executeFinished: boolean;
    selfVerifyFinished: boolean;
    toolCalls: ToolCallState[];
}

export interface UserAction {
    type: 'confirmGoal' | 'confirmGoalWithEdit' | 'reviseGoal' | 'cancelTask'
        | 'confirmPlan' | 'confirmPlanWithEdit' | 'rejectPlan'
        | 'confirmExecuteDone'
        | 'confirmSelfVerifyDone'
        | 'approveReview' | 'rejectReview' | 'partialApproveReview'
        | 'stopGeneration' | 'convertToTask';
    taskId: string;
    payload?: unknown;
}

export type StateSubscriber = (state: AppState) => void;
export type StateDelta = Partial<AppState>;
