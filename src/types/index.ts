export interface Task {
    id: string;
    title: string;
    goal: string;
    type: 'task' | 'chat';
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    createdAt: number;
    pinned?: boolean;
    archived?: boolean;
    group?: string;
}

export interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type?: 'text' | 'goal_confirmation' | 'goal_confirmed' | 'review_request' | 'review_approved' | 'review_rejected' | 'tool_call' | 'stop_message';
    content: string;
    timestamp: number;
}

export interface ACPConfig {
    agentName: string;
    apiKey?: string;
}

export interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

export interface AcpMessageHandler {
    onText: (text: string) => void;
    onReasoning?: (text: string) => void;
    onToolCall?: (toolCallId: string, title: string, kind: string, status: string) => void;
    onToolCallUpdate?: (toolCallId: string, status: string, content?: string) => void;
    onPlan?: (entries: { content: string; priority: string; status: string }[]) => void;
    onError: (error: string) => void;
    onDone: (stopReason?: string) => void;
}
