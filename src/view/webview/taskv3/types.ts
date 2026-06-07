export interface AppState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    activeTaskPhase: string;
    activeTaskStatus: string;
    taskInfo: TaskInfo;
    messages: Message[];
    streamState: StreamState;
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
    collapsed?: boolean;
}

export interface TaskInfo {
    title: string;
    goal: string;
    category: string;
    phase: string;
    phaseLabel: string;
    status: string;
    taskType: string;
    createdAt: number;
    executeFinished: boolean;
}

export interface StreamState {
    active: boolean;
    buffer: string;
    toolCalls: ToolCallState[];
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
