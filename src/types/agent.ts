/**
 * Agent 层类型（Agent 运行时专属，不持久化到 Task/Message）
 *
 * 遵循原则 3：Agent 状态不混入 Domain Model
 */
import type { Phase, TaskStatus, PlanStep } from './index';

export type AgentType = 'acp' | 'langgraph';

export type GraphMessageRole = 'user' | 'assistant' | 'tool';

export interface GraphMessage {
    id: string;
    role: GraphMessageRole;
    content: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
    }>;
}

/** LangGraph StateGraph 状态 */
export interface GraphState {
    messages: GraphMessage[];
    phase: Phase;
    status: TaskStatus;
    goal: string;
    confirmedItems: string[];
    planSteps: PlanStep[];
    taskId: string;
}

/** Agent 配置 */
export interface AgentConfig {
    type: AgentType;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    graphThreadId?: string;  // LangGraph checkpoint 线程 ID
    sessionId?: string;      // ACP session ID
}
