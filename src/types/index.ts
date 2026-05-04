export interface Task {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    createdAt: number;
    pinned?: boolean;
    group?: string;
}

export interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent';
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
