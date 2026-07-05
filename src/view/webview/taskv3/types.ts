/**
 * WebView 渲染层类型
 *
 * 此文件原为独立类型定义（与 types/index.ts 不同步），
 * 现在改为引用 Domain Model 类型 + 扩展 WebView 特有字段。
 *
 * 遵循原则 1：Domain Model 是唯一的 Task/Message 定义
 * 遵循原则 2：UI 状态不混入 Domain Model
 */

import type { Message as DomainMessage } from '../../../types';
import type { MessageUIState, AppUIState } from '../../../types/ui';

// ── 扩展：渲染层消息 = Domain Message + UI 状态 ──
export interface Message extends Omit<DomainMessage, 'type'>, MessageUIState {
    type: string;  // 覆盖为宽松类型，兼容 WebView 动态 type 赋值
}

// ── 扩展：渲染层 AppState ──
export interface AppState extends AppUIState {
    activeTaskPhase: string;
    activeTaskStatus: string;
    taskInfo: TaskInfo;
    messages: Message[];
    msgVersion: number;
    reviewState: ReviewState;
    pendingMessages: PendingMessage[];
    agentName: string;
    modelName: string;
}

// ── 以下为 WebView 特有类型（不涉及 Domain Model）──

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
