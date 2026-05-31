export interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

export const G = {
    vscode: null as any,

    activeTaskId: null as string | null,
    activeTaskStatus: '',
    activeTaskType: '',
    activeModelName: '',
    activeTaskPhase: '',
    activeTaskGoal: '',
    activeTaskTitle: '',

    categoryDefs: [] as any[],
    selectedCategory: null as string | null,
    selectedSubType: null as string | null,
    lastAcceptanceCriteria: null as string[] | null,
    acceptanceCheckedState: new Map<string, boolean[]>(),
    taskHooks: {} as Record<string, string[]>,
    workspaceHooks: {} as Record<string, string[]>,
    slashCommands: [] as { name: string; description: string }[],
    lastTaskInfo: null as any,
    lastReviewChanges: [] as any[],

    acpLogEnabled: false,
    acpLogEntries: [] as { direction: string; text: string; timestamp: number; taskId: string }[],
    acpLogMaxGlobal: 5000,
    acpLogMaxTask: 2000,

    streamMessageEl: null as HTMLElement | null,
    latestStreamText: '',
    streamRenderPending: false,
    _userScrolledUp: false,
    _programmaticScroll: false,

    _slashMenuEl: null as HTMLElement | null,
    _slashSelIdx: -1,
    _queueExpanded: false,

    activeToolCallElements: new Map<string, HTMLElement>(),
    _tabGroup: null as { elems: Map<string, any>; element: HTMLElement } | null,
    _mergeState: null as { thinkingId: string; thinkingTitle: string; thinkingBody: string; tools: any[] } | null,
    mergeDone: false,

    reviewChangesMap: new Map<string, FileChange[]>(),
    selectedReviewFileIdx: null as number | null,

    _demoCards: new Map<string, HTMLElement>(),
    _deviceTabInited: false,
};
