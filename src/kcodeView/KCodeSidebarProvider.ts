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
    private _activeTaskId: string | null = null;

    constructor(
        context: vscode.ExtensionContext,
        store: TaskStore,
        onTaskSelected: (taskId: string) => void
    ) {
        this._context = context;
        this._store = store;
        this._onTaskSelected = onTaskSelected;
        _output.appendLine('[KCodeSidebarProvider] constructor called, store tasks: ' + store.getTasks().length);
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
        _output.appendLine('[KCodeSidebarProvider] resolveWebviewView done, HTML set. Script URI: ' + webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'out', 'kcodeView', 'webview', 'sidebar.js')
        ));

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            _output.appendLine('[KCodeSidebarProvider] onDidReceiveMessage: type=' + message.type + ' data=' + JSON.stringify(message));
            switch (message.type) {
                case 'debugLog':
                    _output.appendLine('[WebView] ' + message.text);
                    return;
                case 'newTask':
                    this.createNewTask();
                    break;
                case 'newTaskFromTemplate':
                    vscode.commands.executeCommand('kcode.newTaskFromTemplate');
                    break;
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
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'kcode');
                    break;
                case 'newGroup':
                    this.createNewGroup();
                    break;
                case 'reorderTask':
                    this._store.moveTask(message.taskId, message.targetTaskId, message.position, message.group);
                    this.refresh();
                    break;
                case 'reorderTasks':
                    for (const taskId of message.taskIds) {
                        this._store.moveTask(taskId, message.targetTaskId, message.position, message.group);
                    }
                    this.refresh();
                    break;
                case 'deleteGroup':
                    this._store.deleteGroup(message.groupName);
                    this.refresh();
                    break;
                case 'reorderGroups':
                    this._store.reorderGroups(message.groupNames);
                    this.refresh();
                    break;
                case 'renameTask':
                    this.renameTask(message.taskId, message.currentTitle);
                    break;
                case 'archiveTask':
                    this._store.updateTaskArchive(message.taskId, message.archived);
                    this.refresh();
                    break;
                case 'archiveTasks':
                    this._store.updateTasksArchive(message.taskIds, message.archived);
                    this.refresh();
                    break;
                case 'moveTaskToGroup':
                    this._store.updateTaskGroup(message.taskId, message.group);
                    this.refresh();
                    break;
                case 'renameGroup':
                    this.renameGroup(message.groupName, message.currentName);
                    break;
                case 'moveGroup':
                    this._store.moveGroup(message.groupName, message.direction);
                    this.refresh();
                    break;
                case 'toggleRightPanel':
                    this._onToggleRightPanel?.();
                    break;
                case 'importGitHubIssue':
                    vscode.commands.executeCommand('kcode.importGitHubIssue');
                    break;
                case 'newProject':
                    this.createNewProject();
                    break;
                case 'newGroupInProject':
                    this.createNewGroupInProject(message.projectId);
                    break;
                case 'addContainer':
                    this.createNewContainer(message.name, message.containerType, message.parentId);
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
                    this._store.updateContainer(message.containerId, { name: message.name });
                    this.refresh();
                    break;
                case 'moveContainer':
                    this._store.moveContainer(message.containerId, message.direction);
                    this.refresh();
                    break;
                case 'updateContainer':
                    this._store.updateContainer(message.containerId, message.updates);
                    this.refresh();
                    break;
            }
        });
    }

    private createNewGroup(): void {
        const groups = this._store.getGroups();
        let name = '新分组';
        let i = 1;
        while (groups.includes(name)) {
            i++;
            name = `新分组 ${i}`;
        }
        this._store.addGroup(name);
        this.refresh(undefined, name);
    }

    private createNewContainer(name: string, type: ContainerEntity['type'], parentId?: string): void {
        this._store.addContainer(name, type, parentId);
        this.refresh();
        // Auto-expand parent project after adding child
        if (parentId) {
            this._view?.webview.postMessage({ type: 'expandContainer', containerId: parentId });
        }
    }

    private createNewProject(): void {
        vscode.window.showInputBox({ prompt: '项目名称', placeHolder: '输入项目名称...' }).then(name => {
            if (name && name.trim()) {
                this.createNewContainer(name.trim(), 'project');
            }
        });
    }

    private createNewGroupInProject(projectId: string): void {
        const project = this._store.getContainer(projectId);
        const hint = project ? `在「${project.name}」中新建分组` : '分组名称';
        vscode.window.showInputBox({ prompt: hint, placeHolder: '输入分组名称...' }).then(name => {
            if (name && name.trim()) {
                this.createNewContainer(name.trim(), 'group', projectId);
            }
        });
    }

    private renameTask(taskId: string, newTitle: string): void {
        if (newTitle && newTitle.trim()) {
            this._store.updateTaskTitle(taskId, newTitle.trim());
            this.refresh();
        }
    }

    private renameGroup(groupName: string, newName: string): void {
        if (newName && newName.trim() && newName.trim() !== groupName && !this._store.getGroups().includes(newName.trim())) {
            this._store.renameGroup(groupName, newName.trim());
            this.refresh();
        }
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
            type: 'chat',
            status: 'pending',
            phase: 'demand',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            createdAt: Date.now(),
            pinned: false
        };
        this._store.addTask(task);
        this._onTaskSelected(task.id);
        this.refresh();
    }

    private escapeAttr(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
    }

    refresh(activeTaskId?: string, editingGroupName?: string): void {
        if (!this._view) {
            _output.appendLine('[KCodeSidebarProvider] refresh skipped — _view is null');
            return;
        }
        const tasks = this._store.getTasks();
        const groups = this._store.getGroups();
        const containers = this._store.getContainers();
        this._activeTaskId = activeTaskId ?? this._activeTaskId;
        _output.appendLine('[KCodeSidebarProvider] refresh — tasks=' + tasks.length + ' groups=' + groups.length + ' containers=' + containers.length + ' active=' + this._activeTaskId);
        this._view.webview.postMessage({
            type: 'updateTaskList',
            tasks,
            groups,
            containers,
            activeTaskId: this._activeTaskId,
            editingGroupName,
        });
    }

    private getHtml(): string {
        const webview = this._view!.webview!;
        const extensionUri = this._context.extensionUri;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'sidebar.js')
        );
        _output.appendLine('[KCodeSidebarProvider] getHtml() called — generating new HTML with new CSS (separator/submenu styles). scriptUri=' + scriptUri);

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

        /* --- Project Section --- */
        .project-section { margin-bottom: 4px; }
        .project-header {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px 6px 16px;
            cursor: pointer;
            user-select: none;
            border-radius: 3px;
            margin: 1px 4px;
        }
        .project-header:hover { background: #252526; }
        .project-header.dragging { opacity: 0.5; }
        .project-header.group-drop-before { border-top: 2px solid var(--vscode-button-background, #0e639c); }
        .project-header.group-drop-after { border-bottom: 2px solid var(--vscode-button-background, #0e639c); }
        .project-header .arrow {
            display: inline-block;
            width: 7px;
            height: 7px;
            border-right: 1.5px solid var(--vscode-sideBar-foreground, #888);
            border-bottom: 1.5px solid var(--vscode-sideBar-foreground, #888);
            flex-shrink: 0;
            transition: transform 0.1s ease;
        }
        .project-header .arrow.collapsed { transform: rotate(-45deg); }
        .project-header .arrow:not(.collapsed) { transform: rotate(45deg); }
        .project-name {
            font-weight: 600;
            font-size: 13px;
            color: var(--vscode-sideBar-foreground, #d4d4d4);
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
        .project-progress-bar {
            height: 2px;
            background: var(--vscode-sideBar-border, #3c3c3c);
            border-radius: 2px;
            margin: 0 16px 4px;
            overflow: hidden;
        }
        .project-progress-fill {
            height: 100%;
            background: var(--vscode-button-background, #0e639c);
            border-radius: 2px;
            transition: width 0.2s ease;
        }
        .project-body { padding: 0 4px 4px 12px; }
        .project-body.hidden { display: none; }
        .project-body .section-body { padding: 0; }
        .project-add-btn {
            background: none;
            border: none;
            color: var(--vscode-sideBar-foreground, #888);
            cursor: pointer;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 18px;
            line-height: 1;
            font-family: inherit;
            margin-left: auto;
        }
        .project-add-btn:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
            color: var(--vscode-sideBar-foreground, #ccc);
        }

        /* --- Action Bar --- */
        .action-bar {
            padding: 8px 8px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            border-bottom: 1px solid var(--vscode-sideBar-border, #3c3c3c);
            margin-bottom: 4px;
        }
        .sidebar-btn {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            margin: 1px 0;
            background: transparent;
            color: #a0a0a0;
            font-size: 13px;
            cursor: pointer;
            border: none;
            border-radius: 3px;
            font-family: inherit;
            font-weight: 500;
        }
        .sidebar-btn .sidebar-btn-icon {
            font-size: 16px;
            width: 20px;
            text-align: center;
            flex-shrink: 0;
            line-height: 1;
        }
        .sidebar-btn:hover { background: #252526; }
        #task-search-wrap { padding: 2px 8px 6px; }
        #task-search-wrap.hidden { display: none; }
        #task-search {
            width: 100%;
            background: #3c3c3c;
            color: #d4d4d4;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 5px 8px;
            font-size: 12px;
            font-family: inherit;
            outline: none;
            box-sizing: border-box;
        }
        #task-search:focus { border-color: #0e639c; }
        /* --- Section --- */
        .section { margin-bottom: 8px; }
        .section-header {
            display: flex;
            align-items: center;
            padding: 4px 8px 4px 16px;
            font-size: 13px;
            font-weight: 600;
            color: var(--vscode-sideBarSectionHeader-foreground, #888);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            cursor: pointer;
            user-select: none;
        }
        .section-header .arrow {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-right: 1.5px solid var(--vscode-sideBar-foreground, #888);
            border-bottom: 1.5px solid var(--vscode-sideBar-foreground, #888);
            margin-right: 6px;
            flex-shrink: 0;
            transition: transform 0.1s ease;
        }
        .section-header .arrow.collapsed { transform: rotate(-45deg); }
        .section-header .arrow:not(.collapsed) { transform: rotate(45deg); }
        .section-header.dragging { opacity: 0.5; }
        .section-header.group-drop-before { border-top: 2px solid var(--vscode-button-background, #0e639c); }
        .section-header.group-drop-after { border-bottom: 2px solid var(--vscode-button-background, #0e639c); }
        .section-header-btn {
            background: none;
            border: none;
            color: var(--vscode-sideBarSectionHeader-foreground, #888);
            cursor: pointer;
            padding: 2px 8px;
            margin-left: auto;
            font-size: 18px;
            font-weight: 700;
            line-height: 1;
            font-family: inherit;
            border-radius: 4px;
        }
        .section-header-btn:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
            color: var(--vscode-sideBar-foreground, #ccc);
        }
        .section-body { padding: 0 4px; }
        .drop-zone { padding: 0 4px; min-height: 4px; }
        .drop-zone.empty { min-height: 32px; }
        .drop-zone.drag-over { background: rgba(14, 99, 156, 0.15); border-radius: 3px; }
        .group-placeholder {
            padding: 6px 16px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground, #666);
            font-style: italic;
            text-align: center;
            user-select: none;
        }
        .drop-zone.drag-over .group-placeholder {
            color: var(--vscode-button-foreground, #fff);
        }

        /* --- Drop Indicator (reorder line) --- */
        .task-item {
            position: relative;
        }
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
        .task-item.drop-before::before {
            top: -1px;
        }
        .task-item.drop-after::after {
            bottom: -1px;
        }

        /* --- Task Item --- */
        .task-item {
            padding: 6px 8px 6px 16px;
            cursor: pointer;
            border-radius: 3px;
            color: #a0a0a0;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
            margin: 1px 4px;
            background: transparent;
        }
        .task-item:not(.active):not(.selected):hover { background: #252526; }
        .task-item.dragging { opacity: 0.5; }
        .task-item.active {
            background: #0E364B;
            color: #ffffff;
            font-weight: 600;
        }

        .task-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .inline-edit-input {
            flex: 1;
            background: var(--vscode-input-background, #3c3c3c);
            color: var(--vscode-input-foreground, #d4d4d4);
            border: 1px solid var(--vscode-input-border, #555);
            border-radius: 2px;
            padding: 1px 4px;
            font-family: inherit;
            font-size: 13px;
            outline: none;
        }
        .inline-edit-input:focus {
            border-color: var(--vscode-focusBorder, #0e639c);
        }

        .task-status {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            flex-shrink: 0;
            font-size: 12px;
            line-height: 1;
        }
        .task-status.status-completed { color: #4caf50; }
        .task-status.status-cancelled { color: #888; }
        .task-status.status-active { color: #4caf50; }
        .task-status.status-waiting { color: #ffa726; }

        /* --- Placeholder --- */
        .placeholder-text {
            padding: 24px 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #6b6b6b);
            text-align: center;
        }

        /* --- Footer --- */
        #sidebar-footer {
            padding: 6px 8px;
            border-top: 1px solid var(--vscode-sideBar-border, #3c3c3c);
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .footer-left {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .footer-icon {
            width: 16px;
            height: 16px;
            background: var(--vscode-button-background, #0e639c);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            color: var(--vscode-button-foreground, #fff);
            flex-shrink: 0;
        }
        .footer-label {
            font-size: 13px;
            color: var(--vscode-sideBar-foreground, #a0a0a0);
        }
        .footer-btn {
            background: none;
            border: none;
            color: var(--vscode-sideBar-foreground, #888);
            cursor: pointer;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 20px;
            line-height: 1;
            display: flex;
            align-items: center;
        }
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

        /* --- Batch Bar --- */
        .batch-bar {
            padding: 6px 8px;
            border-top: 1px solid var(--vscode-sideBar-border, #3c3c3c);
            display: flex;
            gap: 4px;
            align-items: center;
            background: var(--vscode-sideBar-background, #1e1e1e);
        }
        #btn-batch-clear {
            padding: 2px 6px;
            background: transparent;
            color: var(--vscode-sideBar-foreground, #888);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            font-family: inherit;
            line-height: 1;
            margin-left: auto;
        }
        #btn-batch-clear:hover {
            background: var(--vscode-list-hoverBackground, #2a2d2e);
            color: var(--vscode-sideBar-foreground, #ccc);
        }


        /* --- Multi-select --- */
        .task-item.selected {
            background: rgba(14, 99, 156, 0.25);
        }
        .task-item.selected.active {
            background: #0E364B;
        }


    </style>
    <title>KCode</title>
</head>
<body>
    <div id="sidebar-content">
        <div class="action-bar">
            <button id="btn-new-task" class="sidebar-btn"><span class="sidebar-btn-icon">+</span> 新建任务</button>
            <button id="btn-template-task" class="sidebar-btn"><span class="sidebar-btn-icon">📋</span> 按模板新建任务</button>
            <button id="btn-import-issue" class="sidebar-btn"><span class="sidebar-btn-icon">⤓</span> 导入 Issue</button>
            <button id="btn-new-project" class="sidebar-btn"><span class="sidebar-btn-icon">📦</span> 新建项目</button>
            <button id="btn-task-search" class="sidebar-btn" style="font-size:12px;"><span class="sidebar-btn-icon">🔍</span> 搜索任务</button>
            <button id="btn-toggle-panel" class="sidebar-btn" style="font-size:12px;">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
                    <rect x="1" y="2" width="14" height="10" rx="1"/>
                    <line x1="5" y1="14" x2="11" y2="14"/>
                    <line x1="8" y1="12" x2="8" y2="14"/>
                </svg>
                打开右侧面板
            </button>
        </div>

        <div id="section-pinned" class="section" style="display:none">
            <div class="section-header">
                <span>已置顶</span>
            </div>
            <div class="section-body" id="pinned-list"></div>
        </div>

        <div id="section-ungrouped" class="section" style="display:none">
            <div class="section-header" id="ungrouped-header">
                <span>任务列表</span>
            </div>
            <div class="section-body drop-zone" id="ungrouped-list" data-container=""></div>
        </div>

        <div id="project-list"></div>

        <div id="section-old-groups" class="section" style="display:none"></div>
    </div>

    <div id="task-search-wrap" class="hidden">
        <input id="task-search" type="text" placeholder="搜索任务名称..." />
    </div>

    <div id="batch-bar" class="batch-bar" style="display:none">
        <button id="btn-batch-clear" class="batch-bar-btn" title="取消选择">✕</button>
    </div>

    <div id="sidebar-footer">
        <div class="footer-left">
            <div class="footer-icon">K</div>
            <span class="footer-label">KCode</span>
        </div>
        <button id="btn-settings" class="footer-btn" title="Settings">&#x2699;</button>
    </div>
    <div id="__sidebarData"
         data-tasks="${this.escapeAttr(JSON.stringify(this._store.getTasks()))}"
         data-groups="${this.escapeAttr(JSON.stringify(this._store.getGroups()))}"
         data-containers="${this.escapeAttr(JSON.stringify(this._store.getContainers()))}"
         data-active-task-id="${this._activeTaskId || ''}"
         style="display:none"></div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}