import * as vscode from 'vscode';
import { KCodePanel } from './kcodeView/KCodePanel';
import { KCodeSidebarProvider } from './kcodeView/KCodeSidebarProvider';
import { TaskStore } from './store/TaskStore';
import { Task } from './types';

let panel: KCodePanel | undefined;
let store: TaskStore | undefined;
let sidebarProvider: KCodeSidebarProvider | undefined;

function openTaskInPanel(context: vscode.ExtensionContext, taskId: string) {
    store?.updateTaskStatus(taskId, 'active');
    if (panel) {
        panel.reveal();
        panel.loadTask(taskId);
        panel.focusInput();
    } else {
        panel = new KCodePanel(context, store!);
        panel.onDidDispose(() => { panel = undefined; });
        panel.setRefreshSidebarCallback(refreshSidebar);
        panel.loadTask(taskId);
        panel.focusInput();
    }
    refreshSidebar();
}

function refreshSidebar() {
    if (sidebarProvider) {
        sidebarProvider.refresh();
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
        const task: Task = {
            id: `task_${Date.now()}`,
            title: 'New Task',
            status: 'pending',
            createdAt: Date.now()
        };
        store.addTask(task);
        refreshSidebar();
        openTaskInPanel(context, task.id);
    });

    context.subscriptions.push(openCmd, newTaskCmd);
}

export function deactivate() {
    panel = undefined;
}
