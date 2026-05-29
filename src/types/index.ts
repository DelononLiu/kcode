export type ContainerType = 'group' | 'project';

export interface ContainerEntity {
    id: string;
    name: string;
    type: ContainerType;
    parentId?: string;
    createdAt: number;
}

export type TaskCategory = 'requirement_dev' | 'code_review' | 'problem_analysis' | 'defect_analysis' | 'log_analysis';

export interface InputField {
    key: string;
    label: string;
    type: 'input' | 'textarea';
    placeholder: string;
    required: boolean;
}

export interface IterationRecord {
    iteration: number;
    metrics: Record<string, number>;
    passed: boolean;
    improved: boolean;
    timestamp: number;
}

export interface TargetDef {
    key: string;
    label: string;
    direction: 'lower' | 'higher';
    unit: string;
}

export interface FlowIterationTemplate {
    loopPhases: [string, string];
    defaultTargets: TargetDef[];
    defaultIterationLimit: number;
    defaultCorrectnessTests?: string[];
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
    flowIteration?: FlowIterationTemplate;
}

export interface CategoryDef {
    key: TaskCategory;
    label: string;
    icon: string;
    analysisFramework: string;
    executionHints: string[];
    acceptanceCriteria: string[];
    subTypes: Record<string, TaskTemplate>;
}

export interface TodoItem {
    id: string;
    content: string;
    status: 'pending' | 'completed';
    priority?: 'low' | 'medium' | 'high';
}

export interface AssistantMessage {
    id: string;
    role: 'user' | 'agent' | 'tool';
    type?: string;
    content: string;
    timestamp: number;
}

export interface PlanStep {
    content: string;
    status: 'pending' | 'active' | 'completed';
}

export interface Task {
    id: string;
    title: string;
    goal: string;
    type: 'task';
    category?: TaskCategory;
    subType?: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    phase: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    confirmedItems: string[];
    pendingItems: string[];
    planSteps: PlanStep[];
    planVersion?: number;
    riskItems?: string[];
    boundaryItems?: string[];
    createdAt: number;
    workspace?: string;
    pinned?: boolean;
    archived?: boolean;
    group?: string;
    containerId?: string;
    source?: TaskSource;
    nodeMessageIds?: Partial<Record<'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review', string>>;
    hooks?: Partial<Record<'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review', string[]>>;
    sessionId?: string;  // ACP session ID for agent context persistence
    flowIteration?: {
        enabled: boolean;
        loopPhases: [string, string];
        config: {
            correctnessTests: string[];
            targets: Record<string, number>;
            iterationLimit: number;
        };
        state: {
            currentIteration: number;
            stagnatedCount: number;
            baselines: Record<string, number>;
            history: IterationRecord[];
        };
    };
}

export interface ChatMessage {
    id: string;
    taskId: string;
    role: 'user' | 'agent' | 'tool';
    type?: 'text' | 'goal_confirmation' | 'goal_confirmed' | 'goal_updated' | 'plan_proposal' | 'plan_confirmed' | 'review_request' | 'review_approved' | 'review_rejected' | 'tool_call' | 'stop_message' | 'todo' | 'card_comment';
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

export interface ToolItem {
    id: string;
    groupId: string;
    toolCallId: string;
    title: string;
    kind: string;
    status: string;
    detail?: string;
    createdAt: number;
}

export interface ToolGroup {
    id: string;
    taskId: string;
    items: ToolItem[];
    createdAt: number;
}

export interface KnowledgeEntry {
    id: string;
    taskId: string;
    type: 'decision' | 'pitfall' | 'pattern' | 'code_snippet';
    title: string;
    content: string;
    tags: string[];
    createdAt: number;
    source?: string;
    phase?: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
}

export interface TimelineEntry {
    timestamp: number;
    type: 'phase_change' | 'message' | 'file_change' | 'knowledge_extract';
    summary: string;
    detail?: string;
}

export interface FileChangeSummary {
    filePath: string;
    operation: 'added' | 'modified' | 'deleted';
    lines?: number;
}

export interface TerminalLogEntry {
    id: string;
    command: string;
    output: string;
    cwd: string;
    exitCode: number;
    timestamp: number;
    duration?: number;
}

export interface MessageLogEntry {
    id: string;
    role: 'user' | 'agent' | 'tool';
    type?: string;
    content: string;
    timestamp: number;
}

export interface FileLogEntry {
    id: string;
    filePath: string;
    operation: 'added' | 'modified' | 'deleted';
    original?: string;
    modified?: string;
    timestamp: number;
}

export interface ProgressNode {
    id: string;
    type: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    label: string;
    status: 'pending' | 'active' | 'completed' | 'cancelled';
    order: number;
    messageId?: string;
    iteration?: number;
    maxIteration?: number;
}

export interface AcpLogEntry {
    direction: 'send' | 'recv';
    text: string;
    timestamp: number;
}

export type DeviceType = 'ssh' | 'telnet' | 'adb' | 'local';

export interface DeviceConfig {
    type: DeviceType;
    host: string;
    port: number;
    username?: string;
    password?: string;
    privateKey?: string;
}

export interface DeviceConnection {
    deviceId: string;
    config: DeviceConfig;
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    connectedAt?: number;
    error?: string;
}

export interface IDeviceClient {
    connect(config: DeviceConfig): Promise<DeviceConnection>;
    disconnect(): Promise<void>;
    exec(command: string): Promise<string>;
    onOutput(callback: (data: string) => void): void;
    onError(callback: (error: string) => void): void;
    onDisconnected(callback: () => void): void;
    getStatus(): DeviceConnection['status'];
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
