import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Workspace } from '../types';

export async function openWorkspace(store: TaskStore): Promise<Workspace | undefined> {
    const folders = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: '选择项目目录'
    });

    if (!folders || folders.length === 0) return undefined;

    const folderPath = folders[0].fsPath;
    const name = folderPath.split('/').pop() || folderPath.split('\\').pop() || 'untitled';

    // Check if already exists
    const existing = store.getWorkspaces().find(w => w.path === folderPath);
    if (existing) {
        vscode.window.showInformationMessage(`工作区 "${name}" 已存在`);
        return existing;
    }

    const workspace: Workspace = {
        id: `ws_${Date.now()}`,
        name,
        path: folderPath,
        createdAt: Date.now()
    };

    store.addWorkspace(workspace);
    vscode.window.showInformationMessage(`工作区 "${name}" 已创建`);
    return workspace;
}
