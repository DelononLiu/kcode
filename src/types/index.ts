export interface Workspace {
    id: string;
    name: string;
    path: string;
    createdAt: number;
}

export interface Task {
    id: string;
    workspaceId: string;
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

export interface WorkspaceData {
    workspace: Workspace;
    tasks: Task[];
}

export interface ACPConfig {
    agentPath: string;
    apiKey?: string;
}
