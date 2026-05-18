import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Task, ContainerEntity } from '../types';

const _output = vscode.window.createOutputChannel('KCode Sidebar');

export class KCodeSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kcode.viewsMain';

    private _view?: vscode.WebviewView;
    private _store: TaskStore;
    private _context: vscode.ExtensionContext;
    private _onTaskSelected: (taskId: string) => void;
    private _onFlashInput?: () => void;
    private _onToggleRightPanel?: () => void;
    private _onSelectAssistant?: () => void;
    private _activeTaskId: string | null = null;
    private _messageListener?: vscode.Disposable;

    constructor(
        context: vscode.ExtensionContext,
        store: TaskStore,
        onTaskSelected: (taskId: string) => void
    ) {
        this._context = context;
        this._store = store;
        this._onTaskSelected = onTaskSelected;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._context.extensionUri, 'out'),
                vscode.Uri.joinPath(this._context.extensionUri, 'src', 'kcodeView', 'webview')
            ]
        };

        webviewView.webview.html = this.getHtml();

        this._messageListener?.dispose();
        this._messageListener = webviewView.webview.onDidReceiveMessage(async (message: any) => {
            _output.appendLine('[KCodeSidebarProvider] onDidReceiveMessage: type=' + message.type);
            switch (message.type) {
                case 'debugLog':
                    _output.appendLine('[WebView] ' + message.text);
                    return;
                case 'selectTask':
                    this._activeTaskId = message.taskId;
                    this._onTaskSelected(message.taskId);
                    break;
                case 'pinTask':
                    this._store.updateTaskPin(message.taskId, message.pinned);
                    this.refresh();
                    break;
                case 'deleteTask':
                    this._store.deleteTask(message.taskId);
                    this.refresh();
                    break;
                case 'deleteTasks':
                    this._store.deleteTasks(message.taskIds);
                    this.refresh();
                    break;
                case 'pinTasks':
                    this._store.updateTasksPin(message.taskIds, message.pinned);
                    this.refresh();
                    break;
                case 'archiveTasks':
                    this._store.updateTasksArchive(message.taskIds, message.archived);
                    this.refresh();
                    break;
                case 'newGroupInProject':
                    this.createNewGroupInProject(message.projectId);
                    break;
                case 'addContainer':
                    if (!this._store.addContainer(message.name, message.containerType, message.parentId)) {
                        vscode.window.showWarningMessage(`名称「${message.name}」已存在`);
                    }
                    this.refresh();
                    if (message.parentId) {
                        this._view?.webview.postMessage({ type: 'expandContainer', containerId: message.parentId });
                    }
                    break;
                case 'deleteContainer':
                    this._store.deleteContainer(message.containerId);
                    this.refresh();
                    break;
                case 'updateTaskContainer':
                    this._store.updateTaskContainer(message.taskId, message.containerId);
                    this.refresh();
                    break;
                case 'renameContainer':
                    if (message.name) {
                        if (!this._store.updateContainer(message.containerId, { name: message.name })) {
                            vscode.window.showWarningMessage(`名称「${message.name}」已存在`);
                        }
                        this.refresh();
                    } else {
                        const container = this._store.getContainer(message.containerId);
                        if (container) {
                            vscode.window.showInputBox({ prompt: '重命名', value: container.name }).then(name => {
                                if (name && name.trim()) {
                                    const trimmed = name.trim();
                                    if (!this._store.updateContainer(message.containerId, { name: trimmed })) {
                                        vscode.window.showWarningMessage(`名称「${trimmed}」已存在`);
                                    }
                                    this.refresh();
                                }
                            });
                        }
                    }
                    break;
                case 'moveContainer':
                    this._store.moveContainer(message.containerId, message.direction);
                    this.refresh();
                    break;
                case 'reorderTasks':
                    for (const taskId of message.taskIds) {
                        this._store.moveTask(taskId, message.targetTaskId, message.position, null);
                    }
                    this.refresh();
                    break;
                case 'updateContainer':
                    if (!this._store.updateContainer(message.containerId, message.updates)) {
                        vscode.window.showWarningMessage(`名称已被使用`);
                    }
                    this.refresh();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('kcode.openSettings');
                    break;
                case 'newProject':
                    this.createNewProject();
                    break;
                case 'newTaskFromTemplate':
                    vscode.commands.executeCommand('kcode.newTaskFromTemplate');
                    break;
                case 'newTask':
                    vscode.commands.executeCommand('kcode.newTask');
                    break;
                case 'showMyTasks':
                    vscode.commands.executeCommand('kcode.openMyTasks');
                    break;
                case 'showKnowledgeBase':
                    vscode.commands.executeCommand('kcode.openKnowledgeWiki');
                    break;
                case 'importGitHubIssue':
                    vscode.commands.executeCommand('kcode.importGitHubIssue');
                    break;
                case 'selectAssistant':
                    this._onSelectAssistant?.();
                    break;
            }
        });
    }

    private createNewProject(): void {
        vscode.window.showInputBox({ prompt: '项目名称', placeHolder: '输入项目名称...' }).then(name => {
            if (name && name.trim()) {
                const trimmed = name.trim();
                if (!this._store.addContainer(trimmed, 'project')) {
                    vscode.window.showWarningMessage(`项目「${trimmed}」已存在`);
                }
                this.refresh();
            }
        });
    }

    private createNewGroupInProject(projectId: string): void {
        const project = this._store.getContainer(projectId);
        const hint = project ? `在「${project.name}」中新建分组` : '分组名称';
        vscode.window.showInputBox({ prompt: hint, placeHolder: '输入分组名称...' }).then(name => {
            if (name && name.trim()) {
                const trimmed = name.trim();
                if (!this._store.addContainer(trimmed, 'group', projectId)) {
                    vscode.window.showWarningMessage(`分组「${trimmed}」已存在`);
                }
                this.refresh();
                this._view?.webview.postMessage({ type: 'expandContainer', containerId: projectId });
            }
        });
    }

    setSelectAssistantCallback(cb: () => void) {
        this._onSelectAssistant = cb;
    }

    setFlashInputCallback(cb: () => void) {
        this._onFlashInput = cb;
    }

    setToggleRightPanelCallback(cb: () => void) {
        this._onToggleRightPanel = cb;
    }

    createNewTask(): void {
        const existingEmpty = this._store.findEmptyTask();
        if (existingEmpty) {
            this._onTaskSelected(existingEmpty.id);
            this._onFlashInput?.();
            this.refresh();
            return;
        }
        const task: Task = {
            id: `task_${Date.now()}`,
            title: 'New Task',
            goal: '',
            type: 'task',
            status: 'pending',
            phase: 'demand',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            createdAt: Date.now(),
            pinned: false,
            workspace: vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath,
        };
        this._store.addTask(task);
        this._onTaskSelected(task.id);
        this.refresh();
    }

    private escapeAttr(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
    }

    refresh(activeTaskId?: string | null, editingGroupName?: string): void {
        if (!this._view) return;
        const tasks = this._store.getTasks();
        const groups = this._store.getGroups();
        const containers = this._store.getContainers();
        this._activeTaskId = activeTaskId !== undefined ? activeTaskId : this._activeTaskId;
        const resolvedActiveId = this._activeTaskId === null ? '__assistant__' : this._activeTaskId;
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
        this._view.webview.postMessage({
            type: 'updateTaskList',
            tasks,
            groups,
            containers,
            activeTaskId: resolvedActiveId,
            editingGroupName,
            currentWorkspace,
        });
    }

    private getHtml(): string {
        const webview = this._view!.webview!;
        const extensionUri = this._context.extensionUri;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'sidebar.js')
        );

        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || '';

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            height: 100%;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            color: var(--vscode-sideBar-foreground, #d4d4d4);
            background: var(--vscode-sideBar-background, #1e1e1e);
        }
        body {
            display: flex;
            flex-direction: column;
        }
        #sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 4px 0;
        }
        #sidebar-content{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}

        /* --- Assistant Entry --- */
        .assistant-entry {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 3px;
            margin: 2px 4px;
            font-weight: 600;
            font-size: 13px;
            user-select: none;
        }
        .assistant-entry:hover { background: #252526; }
        .assistant-entry.active {
            background: #0E364B;
            color: #ffffff;
        }
        .assistant-entry .assistant-icon { font-size: 15px; flex-shrink: 0; }

        /* --- New Task Actions --- */
        .new-task-actions {
            padding: 2px 8px 6px;
            border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c);
            margin-bottom: 2px;
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .sidebar-btn {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            background: transparent;
            color: var(--vscode-sideBar-foreground, #a0a0a0);
            font-size: 13px;
            cursor: pointer;
            border: none;
            border-radius: 3px;
            font-family: inherit;
        }
        .sidebar-btn .sidebar-btn-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; line-height: 1; }
        .sidebar-btn:hover { background: #252526; }

        /* --- Project Section --- */
        .project-section { margin-bottom: 2px; }
        .project-header {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px 4px 12px;
            cursor: pointer;
            user-select: none;
            border-radius: 3px;
            margin: 1px 4px;
        }
        .project-header:hover { background: #252526; }
        .project-header .arrow {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-right: 1.5px solid var(--vscode-sideBar-foreground, #888);
            border-bottom: 1.5px solid var(--vscode-sideBar-foreground, #888);
            flex-shrink: 0;
            transition: transform 0.1s ease;
        }
        .project-header .arrow.collapsed { transform: rotate(-45deg); }
        .project-header .arrow:not(.collapsed) { transform: rotate(45deg); }
        .project-icon { flex-shrink: 0; font-size: 14px; }
        .project-name {
            font-weight: 600;
            font-size: 13px;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .project-progress-text {
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #888);
            flex-shrink: 0;
        }
        .project-body { padding: 0 4px 2px 8px; }
        .project-body.hidden { display: none; }
        .section-body { min-height: 4px; }

        /* --- Task Group --- */
        .group-header {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px 3px 16px;
            cursor: pointer;
            user-select: none;
            border-radius: 3px;
            margin: 1px 0;
        }
        .group-header:hover { background: #252526; }
        .group-header .arrow {
            display: inline-block;
            width: 5px;
            height: 5px;
            border-right: 1.5px solid var(--vscode-sideBar-foreground, #888);
            border-bottom: 1.5px solid var(--vscode-sideBar-foreground, #888);
            flex-shrink: 0;
            transition: transform 0.1s ease;
        }
        .group-header .arrow.collapsed { transform: rotate(-45deg); }
        .group-header .arrow:not(.collapsed) { transform: rotate(45deg); }
        .group-icon { flex-shrink: 0; font-size: 12px; }
        .group-label { font-size: 12px; color: #999; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .group-body { }
        .group-body.hidden { display: none; }

        /* --- Task Item --- */
        .task-item {
            position: relative;
            padding: 4px 8px 4px 16px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 5px;
            margin: 1px 4px;
        }
        .task-item:not(.active):not(.selected):hover { background: #252526; }
        .task-item.selected { background: rgba(14, 99, 156, 0.25); }
        .task-item.selected.active { background: #0E364B; }
        .task-item.dragging { opacity: 0.5; }
        .task-item.drop-before::before,
        .task-item.drop-after::after {
            content: '';
            position: absolute;
            left: 16px;
            right: 16px;
            height: 2px;
            background: var(--vscode-button-background, #0e639c);
            pointer-events: none;
            z-index: 1;
        }
        .task-item.drop-before::before { top: -1px; }
        .task-item.drop-after::after { bottom: -1px; }
        .task-item.active {
            background: #0E364B;
            color: #ffffff;
            font-weight: 600;
        }
        .task-status-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
        }
        .task-status-icon.s-completed { color: #4caf50; }
        .task-status-icon.s-cancelled { color: #888; }
        .task-status-icon.s-active {
            background: #1a5f9e;
            color: #fff;
            border-radius: 50%;
        }
        .task-status-icon.s-waiting { color: #ffa726; }
        .task-status-icon.s-chat { color: #666; }
        .task-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* --- Placeholder --- */
        .placeholder-text {
            padding: 4px 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #6b6b6b);
            text-align: center;
        }

        /* --- Footer --- */
        #sidebar-footer {
            padding: 4px 6px;
            border-top: 1px solid var(--vscode-sideBar-border, #3c3c3c);
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .footer-btn {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 5px 8px;
            background: transparent;
            color: var(--vscode-sideBar-foreground, #888);
            font-size: 12px;
            cursor: pointer;
            border: none;
            border-radius: 3px;
            font-family: inherit;
        }
        .footer-btn .footer-btn-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
        .footer-btn:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
            color: var(--vscode-sideBar-foreground, #ccc);
        }

        /* --- Context Menu --- */
        .context-menu {
            position: fixed;
            background: var(--vscode-menu-background, #252526);
            border: 1px solid var(--vscode-menu-border, #3c3c3c);
            border-radius: 4px;
            padding: 4px 0;
            min-width: 120px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.36);
        }
        .context-menu-item {
            padding: 4px 12px;
            cursor: pointer;
            color: var(--vscode-menu-foreground, #d4d4d4);
            font-size: 13px;
        }
        .context-menu-item:hover {
            background: var(--vscode-menu-selectionBackground, #094771);
            color: var(--vscode-menu-selectionForeground, #fff);
        }
        .context-menu-separator {
            height: 1px;
            background: var(--vscode-menu-border, #3c3c3c);
            margin: 4px 8px;
        }
        .context-menu-item.has-submenu {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
        }
        .submenu-arrow {
            font-size: 10px;
            margin-left: 12px;
            color: var(--vscode-menu-foreground, #888);
        }
        .context-menu.submenu {
            display: none;
            position: absolute;
            left: 100%;
            top: -4px;
            background: var(--vscode-menu-background, #252526);
            border: 1px solid var(--vscode-menu-border, #3c3c3c);
            border-radius: 4px;
            padding: 4px 0;
            min-width: 120px;
            z-index: 1001;
            box-shadow: 0 2px 8px rgba(0,0,0,0.36);
        }
    </style>
    <title>KCode</title>
</head>
    <body>
        <div id="sidebar-content">
            <div id="assistant-entry" class="assistant-entry">
                <span class="assistant-icon">🤖</span>
                <span>小助手</span>
            </div>

            <div class="new-task-actions">
                <button id="btn-new-task" class="sidebar-btn"><span class="sidebar-btn-icon">📝</span> 新建任务</button>
                <button id="btn-import-task" class="sidebar-btn"><span class="sidebar-btn-icon">⤓</span> 导入任务</button>
                <button id="btn-template-task" class="sidebar-btn"><span class="sidebar-btn-icon">📋</span> 根据模板新建</button>
            </div>

            <div id="project-list"></div>
        </div>

        <div id="sidebar-footer">
            <button class="footer-btn" id="btn-my-tasks"><span class="footer-btn-icon">📋</span> 我的任务</button>
            <button class="footer-btn" id="btn-knowledge"><span class="footer-btn-icon">📚</span> 我的知识库</button>
            <button class="footer-btn" id="btn-settings"><span class="footer-btn-icon">⚙️</span> 设置</button>
        </div>
        <div id="__sidebarData"
             data-tasks="${this.escapeAttr(JSON.stringify(this._store.getTasks()))}"
             data-groups="${this.escapeAttr(JSON.stringify(this._store.getGroups()))}"
             data-containers="${this.escapeAttr(JSON.stringify(this._store.getContainers()))}"
             data-active-task-id="${this._activeTaskId !== null ? this._activeTaskId : '__assistant__'}"
             data-current-workspace="${this.escapeAttr(currentWorkspace)}"
             style="display:none"></div>
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
    }
}
