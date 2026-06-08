import * as vscode from 'vscode';
import { Panel } from './view/Panel';
import { SidebarProvider } from './view/SidebarProvider';
import { TaskStore } from './store/TaskStore';
import { ProjectFs } from './store/ProjectFs';
import { Task } from './types';
import { importGitHubIssue } from './commands/importGitHubIssue';
import { ConfigService } from './core/ConfigService';
import { SettingsProvider } from './view/SettingsProvider';
import { MyTasksProvider } from './view/MyTasksProvider';
import { KnowledgePanel } from './view/KnowledgePanel';

let panel: Panel | undefined;
let store: TaskStore | undefined;
let sidebarProvider: SidebarProvider | undefined;
let configService: ConfigService | undefined;
let settingsProvider: SettingsProvider | undefined;
let myTasksProvider: MyTasksProvider | undefined;
let knowledgePanel: KnowledgePanel | undefined;

function openTaskInPanel(context: vscode.ExtensionContext, taskId: string, autoSendGoal?: string) {
    if (panel) {
        panel.reveal();
        panel.loadTask(taskId);
    } else {
        panel = new Panel(context, store!, configService);
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
        sidebarProvider.refresh(panel?.getCurrentTaskId());
    }
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('KCode is now active!');

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    const projectFs = new ProjectFs(undefined, workspaceRoot);
    store = new TaskStore(projectFs);

    configService = new ConfigService(workspaceRoot);
    ConfigService.setInstance(configService);
    await configService.load();
    configService.startWatch(context);
    context.subscriptions.push(configService.onDidChange(() => {
        // Config change handler — refresh UI elements if needed
    }));

    // Register sidebar view provider
    sidebarProvider = new SidebarProvider(
        context,
        store,
        (taskId) => openTaskInPanel(context, taskId)
    );
    sidebarProvider.setFlashInputCallback(() => panel?.flashInput());
    sidebarProvider.setToggleRightPanelCallback(() => panel?.toggleRightPanel());
    sidebarProvider.setSelectAssistantCallback(() => { if (panel) { panel.loadAssistant(); refreshSidebar(); } });
    sidebarProvider.setShowNewTaskViewCallback(() => { if (panel) { panel.showNewTaskView(); } sidebarProvider?.refresh('__newtask__'); });
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SidebarProvider.viewType,
            sidebarProvider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // First launch: show onboarding guide instead of creating sample tasks
    let isFirstLaunch = false;
    if (store.getTasks().length === 0) {
        isFirstLaunch = true;
    }

    // Auto-create the main panel when KCode is activated (shows assistant by default)
            panel = new Panel(context, store!, configService);
    panel.onDidDispose(() => { panel = undefined; });
    panel.setRefreshSidebarCallback(refreshSidebar);
    panel.loadAssistant(isFirstLaunch);

    // Open/focus the sidebar view and reveal the main panel
    const openCmd = vscode.commands.registerCommand('kcode.open', async () => {
        await vscode.commands.executeCommand('workbench.view.extension.kcode');
        if (panel) {
            panel.reveal();
        } else {
        panel = new Panel(context, store!, configService);
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
            type: 'task',
            status: 'pending',
            phase: 'goal',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            originalRequest: '',
            createdAt: Date.now(),
            workspace: workspaceRoot,
        };
        store.addTask(task);
        refreshSidebar();
        openTaskInPanel(context, task.id);
    });

    const selectTaskCmd = vscode.commands.registerCommand('kcode.selectTask', (taskId: string) => {
        openTaskInPanel(context, taskId);
    });

    const importGitHubCmd = vscode.commands.registerCommand('kcode.importGitHubIssue', async () => {
        if (!store) return;
        await importGitHubIssue(store, (taskId, goal) => openTaskInPanel(context, taskId, goal), refreshSidebar);
    });

    const settingsCmd = vscode.commands.registerCommand('kcode.openSettings', async () => {
        if (!settingsProvider) {
            settingsProvider = new SettingsProvider(context, configService!, () => {
                if (panel) {
                    panel.reconnectAgent();
                }
            });
            settingsProvider.onDidDispose(() => { settingsProvider = undefined; });
        }
        settingsProvider.reveal();
    });

    const myTasksCmd = vscode.commands.registerCommand('kcode.openMyTasks', async () => {
        if (!myTasksProvider) {
            myTasksProvider = new MyTasksProvider(context, store!, (taskId) => openTaskInPanel(context, taskId), refreshSidebar);
            myTasksProvider.onDidDispose(() => { myTasksProvider = undefined; });
        }
        myTasksProvider.reveal();
    });

    const knowledgeCmd = vscode.commands.registerCommand('kcode.openKnowledgeWiki', async (entryId?: string) => {
        if (!knowledgePanel) {
            knowledgePanel = new KnowledgePanel(context, store!);
            knowledgePanel.onDidDispose(() => { knowledgePanel = undefined; });
        }
        if (entryId) {
            knowledgePanel.focusEntry(entryId);
        } else {
            knowledgePanel.reveal();
            knowledgePanel.refresh();
        }
    });

    const refreshKnowledgeCmd = vscode.commands.registerCommand('kcode.refreshKnowledgePanel', () => {
        if (knowledgePanel) {
            knowledgePanel.refresh();
        }
    });

    context.subscriptions.push(openCmd, newTaskCmd, selectTaskCmd, importGitHubCmd, settingsCmd, myTasksCmd, knowledgeCmd, refreshKnowledgeCmd);
}

export function deactivate() {
    panel = undefined;
}
