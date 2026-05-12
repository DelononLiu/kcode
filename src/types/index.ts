export type TaskCategory = 'requirement_dev' | 'problem_analysis' | 'performance_opt' | 'precision_issue';

export interface InputField {
    key: string;
    label: string;
    type: 'input' | 'textarea';
    placeholder: string;
    required: boolean;
}

export interface TaskTemplate {
    label: string;
    icon: string;
    inputPlaceholder: string;
    inputFields: InputField[];
    analysisFramework: string;
    executionHints: string[];
    acceptanceCriteria: string[];
    flowOverride?: Array<'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review'>;
}

export interface CategoryDef {
    key: TaskCategory;
    label: string;
    icon: string;
    subTypes: Record<string, TaskTemplate>;
}

export interface PlanStep {
    content: string;
    status: 'pending' | 'active' | 'completed';
}

export interface Task {
    id: string;
    title: string;
    goal: string;
    type: 'task' | 'chat';
    category?: TaskCategory;
    subType?: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    phase: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    confirmedItems: string[];
    pendingItems: string[];
    planSteps: PlanStep[];
    createdAt: number;
    pinned?: boolean;
    archived?: boolean;
    group?: string;
    source?: TaskSource;
    nodeMessageIds?: Partial<Record<'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review', string>>;
}

export interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type?: 'text' | 'goal_confirmation' | 'goal_confirmed' | 'goal_updated' | 'plan_proposal' | 'plan_confirmed' | 'review_request' | 'review_approved' | 'review_rejected' | 'tool_call' | 'stop_message';
    content: string;
    timestamp: number;
}

export interface TaskSource {
    type: 'github_issue';
    url: string;
    owner: string;
    repo: string;
    issueNumber: number;
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

export interface ProgressNode {
    id: string;
    type: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    label: string;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
    order: number;
    messageId?: string;
}

export interface AcpLogEntry {
    direction: 'send' | 'recv';
    text: string;
    timestamp: number;
}

export interface AcpMessageHandler {
    onText: (text: string) => void;
    onReasoning?: (text: string) => void;
    onToolCall?: (toolCallId: string, title: string, kind: string, status: string) => void;
    onToolCallUpdate?: (toolCallId: string, status: string, content?: string, title?: string, kind?: string) => void;
    onPlan?: (entries: { content: string; priority: string; status: string }[]) => void;
    onError: (error: string) => void;
    onDone: (stopReason?: string) => void;
}
