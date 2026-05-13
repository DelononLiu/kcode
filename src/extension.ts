import * as vscode from 'vscode';
import { KCodePanel } from './kcodeView/KCodePanel';
import { KCodeSidebarProvider } from './kcodeView/KCodeSidebarProvider';
import { TaskStore } from './store/TaskStore';
import { Task } from './types';
import { importGitHubIssue } from './commands/importGitHubIssue';

let panel: KCodePanel | undefined;
let store: TaskStore | undefined;
let sidebarProvider: KCodeSidebarProvider | undefined;

function openTaskInPanel(context: vscode.ExtensionContext, taskId: string, autoSendGoal?: string) {
    if (panel) {
        panel.reveal();
        panel.loadTask(taskId);
    } else {
        panel = new KCodePanel(context, store!);
        panel.onDidDispose(() => { panel = undefined; });
        panel.setRefreshSidebarCallback(refreshSidebar);
        panel.loadTask(taskId);
    }
    refreshSidebar();
    if (autoSendGoal) {
        panel.autoSendGoal(taskId, autoSendGoal);
    }
}

function refreshSidebar() {
    if (sidebarProvider) {
        sidebarProvider.refresh(panel?.getCurrentTaskId() ?? undefined);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('KCode is now active!');
    store = new TaskStore(context.workspaceState);

    // Register sidebar view provider
    sidebarProvider = new KCodeSidebarProvider(
        context,
        store,
        (taskId) => openTaskInPanel(context, taskId)
    );
    sidebarProvider.setFlashInputCallback(() => panel?.flashInput());
    sidebarProvider.setToggleRightPanelCallback(() => panel?.toggleRightPanel());
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            KCodeSidebarProvider.viewType,
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Auto-create the main panel when KCode is activated
    panel = new KCodePanel(context, store!);
    panel.onDidDispose(() => { panel = undefined; });
    panel.setRefreshSidebarCallback(refreshSidebar);

    const activeTask = store!.getTasks().find(t => t.status === 'active');
    if (activeTask) {
        openTaskInPanel(context, activeTask.id);
    }

    // Open/focus the sidebar view and reveal the main panel
    const openCmd = vscode.commands.registerCommand('kcode.open', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.kcode');
        if (panel) {
            panel.reveal();
        } else {
            panel = new KCodePanel(context, store!);
            panel.onDidDispose(() => { panel = undefined; });
        }
    });

    const newTaskCmd = vscode.commands.registerCommand('kcode.newTask', async () => {
        if (!store) return;
        const existingEmpty = store.findEmptyTask();
        if (existingEmpty) {
            refreshSidebar();
            openTaskInPanel(context, existingEmpty.id);
            return;
        }
        const task: Task = {
            id: `task_${Date.now()}`,
            title: 'New Task',
            goal: '',
            type: 'chat',
            status: 'pending',
            phase: 'demand',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            createdAt: Date.now()
        };
        store.addTask(task);
        refreshSidebar();
        openTaskInPanel(context, task.id);
    });

    const importGitHubCmd = vscode.commands.registerCommand('kcode.importGitHubIssue', async () => {
        if (!store) return;
        await importGitHubIssue(store, (taskId, goal) => openTaskInPanel(context, taskId, goal), refreshSidebar);
    });

    const newTaskFromTemplateCmd = vscode.commands.registerCommand('kcode.newTaskFromTemplate', () => {
        if (!store || !panel) return;
        const existingEmpty = store.findEmptyTask();
        if (existingEmpty) {
            refreshSidebar();
            panel.startTemplateFlow(existingEmpty.id);
            return;
        }
        const task: Task = {
            id: `task_${Date.now()}`,
            title: 'New Task',
            goal: '',
            type: 'chat',
            status: 'pending',
            phase: 'demand',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            createdAt: Date.now()
        };
        store.addTask(task);
        refreshSidebar();
        panel.startTemplateFlow(task.id);
    });

    context.subscriptions.push(openCmd, newTaskCmd, importGitHubCmd, newTaskFromTemplateCmd);
}

export function deactivate() {
    panel = undefined;
}
