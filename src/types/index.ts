export interface Task {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'completed';
    createdAt: number;
}

export interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: number;
}

export interface ACPConfig {
    agentPath: string;
    apiKey?: string;
}
