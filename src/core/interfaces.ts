import type { FileChange, AcpMessageHandler } from '../types';

/**
 * IAgentService — 封装 Agent（ACP / OpenAI）通信
 *
 * 职责：
 * - 管理 ACP 连接生命周期
 * - 管理 session 池（taskId → sessionId）
 * - 发送 prompt、cancel、close session
 * - 回调转发（onText → 流式更新）
 */
export interface IAgentService {
    connect(agentName: string, agentArgs?: string[]): Promise<boolean>;
    disconnect(): Promise<void>;
    createSession(taskId: string, cwd: string): Promise<string | null>;
    hasSession(taskId: string): boolean;
    getSessionId(taskId: string): string | undefined;
    sendPrompt(taskId: string, text: string, handler: AcpMessageHandler): Promise<void>;
    cancel(taskId: string): Promise<void>;
    closeTaskSession(taskId: string): Promise<void>;
    getReviewChanges(taskId: string): FileChange[];
    setLogCallback(cb: (direction: 'send' | 'recv', text: string) => void): void;
    get isConnected(): boolean;
    get lastError(): string;
}

/**
 * IMessageBus — Extension ↔ WebView 消息总线
 *
 * 职责：
 * - 类型安全的 Extension → WebView 消息发送
 * - 类型安全的 WebView → Extension 消息接收
 * - 生命周期管理
 */
export interface IMessageBus {
    postMessage(message: any): void;
    onMessage(type: string, handler: (message: any) => void): void;
    dispose(): void;
}

/**
 * IPhaseFlow — 阶段状态机接口
 *
 * TaskFlow 已满足此接口，此处仅为类型引用。
 * 详见 src/taskflow/TaskFlow.ts
 */
export type { ITaskStore, TaskFlowDelegate } from '../taskflow/TaskFlow';
