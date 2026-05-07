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
    role: 'user' | 'agent';
    type?: 'text' | 'goal_confirmation' | 'goal_confirmed' | 'review_request' | 'review_approved' | 'review_rejected';
    content: string;
    timestamp: number;
}

export interface ACPConfig {
    agentName: string;
    apiKey?: string;
}

export interface AcpMessageHandler {
    onText: (text: string) => void;
    onError: (error: string) => void;
    onDone: () => void;
}
