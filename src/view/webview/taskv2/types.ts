import type { ChatMessage as _ChatMessage, PlanStep, FileChange } from '../../../types';

export type ChatMessage = _ChatMessage;
export type { PlanStep, FileChange };

export interface AppState {
    viewMode: 'task' | 'assistant';
    activeTaskId: string | null;
    activeTaskPhase: string;
    activeTaskStatus: string;
    taskInfo: TaskInfo;
    confirmedItems: string[];
    planSteps: PlanStep[];
    planVersion: number;
    messages: ChatMessage[];
    streamState: StreamState;
    reviewState: ReviewState;
    isGenerating: boolean;
    pendingMessages: PendingMessage[];
    agentName: string;
    modelName: string;
    hooks: Record<string, string[]>;
    workspaceHooks: Record<string, string[]>;
}

export interface TaskInfo {
    title: string;
    goal: string;
    category: string;
    categoryLabel?: string;
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
    reasoningText: string;
    reasoningActive: boolean;
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
