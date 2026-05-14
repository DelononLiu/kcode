import type { TaskStore } from '../store/TaskStore';
import type { TaskFlow } from '../taskflow/TaskFlow';
import type { AgentService } from '../core/AgentService';
import type { MessageRouter } from './MessageRouter';
import type { Task, FileChange } from '../types';

export interface ToolCallState {
    title: string;
    kind: string;
    status: string;
    output?: string;
}

export interface PendingMessage {
    text: string;
    taskId: string;
    category?: string;
    subType?: string;
}

/**
 * KCodePanelContext — KCodePanel 暴露给 handler 模块的能力接口
 *
 * 各 handler 模块通过此上下文访问共享状态和服务，避免循环依赖。
 */
export interface KCodePanelContext {
    store: TaskStore;
    taskFlow: TaskFlow;
    agentService: AgentService;
    router: MessageRouter;

    currentTaskId: string | null;
    activeToolCalls: Map<string, ToolCallState>;
    isGenerating: boolean;
    pendingMessages: PendingMessage[];
    hasSetPlanMessage: boolean;
    hasSetExecuteMessage: boolean;
    refreshSidebarCallback?: () => void;

    setGenerationState(generating: boolean): void;
    sendPendingQueueUpdate(): void;
    sendAcpLog(taskId: string, direction: 'send' | 'recv', text: string): void;
    flushAcpRecvBuffer(): void;
    storeMessage(taskId: string, role: 'user' | 'agent', content: string): string;
    sendTaskInfo(taskId: string): void;
    sendNodePanelUpdate(taskId: string): void;
    sendHooksAsMessage(tid: string, phase: string): Promise<void>;
    triggerReviewRequest(tid: string, content: string): void;
    showPlanConfirmation(tid: string): boolean;
    showAgentError(tid: string, errorMsg: string): void;
    /** 发送 prompt 并创建完整 response handler（委托给 sessionHandler） */
    sendAgentPrompt(tid: string, promptText: string, isGoalFormatting: boolean, originalText: string): Promise<void>;
    startAutoGeneration(tid: string): Promise<void>;
}
