import * as vscode from 'vscode';
import { KCodePanel } from './kcodeView/KCodePanel';
import { TaskStore } from './store/TaskStore';
import { newTask } from './commands/newTask';
import { openWorkspace } from './commands/openWorkspace';

let panel: KCodePanel | undefined;
let store: TaskStore | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('KCode is now active!');
    store = new TaskStore(context.workspaceState);

    const openCmd = vscode.commands.registerCommand('kcode.open', () => {
        if (panel) {
            panel.reveal();
        } else {
            panel = new KCodePanel(context, store!);
            panel.onDidDispose(() => { panel = undefined; });
        }
    });

    const newTaskCmd = vscode.commands.registerCommand('kcode.newTask', async () => {
        if (!store) return;
        const task = await newTask(store);
        if (task && panel) {
            panel.refreshTaskList();
        }
    });

    const openWsCmd = vscode.commands.registerCommand('kcode.openWorkspace', async () => {
        if (!store) return;
        const ws = await openWorkspace(store);
        if (ws && panel) {
            panel.refreshTaskList();
        }
    });

    context.subscriptions.push(openCmd, newTaskCmd, openWsCmd);
}

export function deactivate() {
    panel = undefined;
}
