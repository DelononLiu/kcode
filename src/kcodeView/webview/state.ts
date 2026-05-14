export interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

export const AppState = {
    activeTaskId: null as string | null,
    activeTaskStatus: '',
    activeTaskType: '',
    activeTaskPhase: '',
    categoryDefs: [] as any[],
    selectedCategory: null as string | null,
    selectedSubType: null as string | null,
    lastAcceptanceCriteria: null as string[] | null,
    acceptanceCheckedState: new Map<string, boolean[]>(),
    taskHooks: {} as Record<string, string[]>,
    workspaceHooks: {} as Record<string, string[]>,

    acpLogEnabled: false,
    acpLogEntries: [] as { direction: string; text: string; timestamp: number; taskId: string }[],
    acpLogMaxGlobal: 5000,
    acpLogMaxTask: 2000,

    streamMessageEl: null as HTMLElement | null,
    latestStreamText: '',
    streamRenderPending: false,

    activeToolCallElements: new Map<string, HTMLElement>(),
    reviewChangesMap: new Map<string, FileChange[]>(),
    selectedReviewFileIdx: null as number | null,
};
