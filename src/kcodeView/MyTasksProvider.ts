import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';

const _output = vscode.window.createOutputChannel('KCode MyTasks');

export class MyTasksProvider {
    static readonly viewType = 'kcode.myTasksPanel';
    readonly panel: vscode.WebviewPanel;

    private onDisposeCallback?: () => void;
    private _store: TaskStore;
    private _onOpenTask: (taskId: string) => void;
    private _onRefreshSidebar: () => void;

    constructor(context: vscode.ExtensionContext, store: TaskStore, onOpenTask?: (taskId: string) => void, onRefreshSidebar?: () => void) {
        this._store = store;
        this._onOpenTask = onOpenTask || (() => {});
        this._onRefreshSidebar = onRefreshSidebar || (() => {});

        this.panel = vscode.window.createWebviewPanel(
            MyTasksProvider.viewType,
            '我的任务',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'kcodeView', 'webview'),
                ],
            }
        );
        this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'kcode.png');

        this.panel.webview.html = this._getHtml(this.panel.webview, context.extensionUri);
        this._setupMessageHandler();

        this.panel.onDidDispose(() => {
            this.onDisposeCallback?.();
        });
    }

    reveal(): void {
        this.panel.reveal();
    }

    onDidDispose(callback: () => void): void {
        this.onDisposeCallback = callback;
    }

    private _setupMessageHandler(): void {
        this.panel.webview.onDidReceiveMessage(async (msg: any) => {
            _output.appendLine('[MyTasksProvider] onDidReceiveMessage: type=' + msg.type);
            switch (msg.type) {
                case 'debugLog': {
                    _output.appendLine('[WebView] ' + msg.text);
                    return;
                }
                case 'ready': {
                    this._sendProjectData();
                    this._sendTaskData();
                    break;
                }
                case 'openTask': {
                    this._openTask(msg.taskId);
                    break;
                }
                case 'archiveTask': {
                    this._store.updateTaskArchive(msg.taskId, msg.archived);
                    this._sendTaskData();
                    break;
                }
                case 'renameTask': {
                    const task = this._store.getTask(msg.taskId);
                    if (task) {
                        vscode.window.showInputBox({ prompt: '重命名任务', value: task.title }).then(name => {
                            if (name && name.trim()) {
                                this._store.updateTaskTitle(msg.taskId, name.trim());
                                this._sendTaskData();
                            }
                        });
                    }
                    break;
                }
                case 'openSettings': {
                    vscode.commands.executeCommand('kcode.openSettings');
                    break;
                }
                case 'newProject': {
                    this._createNewProject();
                    break;
                }
                case 'createProject': {
                    if (msg.name) {
                        const trimmed = msg.name.trim();
                        if (trimmed) {
                            if (!this._store.addContainer(trimmed, 'project')) {
                                vscode.window.showWarningMessage(`项目「${trimmed}」已存在`);
                            }
                            this._sendProjectData();
                            this._sendTaskData();
                            this._onRefreshSidebar();
                        }
                    }
                    break;
                }
                case 'renameProject': {
                    if (msg.name) {
                        const trimmed = msg.name.trim();
                        if (trimmed) {
                            if (!this._store.updateContainer(msg.containerId, { name: trimmed })) {
                                vscode.window.showWarningMessage(`名称「${trimmed}」已被使用`);
                            }
                            this._sendProjectData();
                            this._sendTaskData();
                            this._onRefreshSidebar();
                        }
                    } else {
                        this._renameProject(msg.containerId);
                    }
                    break;
                }
                case 'deleteProject': {
                    const container = this._store.getContainer(msg.containerId);
                    if (container) {
                        vscode.window.showWarningMessage(
                            `确定删除项目「${container.name}」及其所有关联任务？`,
                            { modal: true },
                            '确定删除'
                        ).then(choice => {
                            if (choice === '确定删除') {
                                this._deleteProjectWithTasks(msg.containerId);
                                this._onRefreshSidebar();
                            }
                        });
                    }
                    break;
                }
            }
        });
    }

    private _createNewProject(): void {
        vscode.window.showInputBox({ prompt: '项目名称', placeHolder: '输入项目名称...' }).then(name => {
            if (name && name.trim()) {
                const trimmed = name.trim();
                if (!this._store.addContainer(trimmed, 'project')) {
                    vscode.window.showWarningMessage(`项目「${trimmed}」已存在`);
                }
                this._sendProjectData();
                this._sendTaskData();
                this._onRefreshSidebar();
            }
        });
    }

    private _renameProject(containerId: string): void {
        const container = this._store.getContainer(containerId);
        if (!container) return;
        vscode.window.showInputBox({ prompt: '项目名称', value: container.name }).then(name => {
            if (name && name.trim()) {
                const trimmed = name.trim();
                if (!this._store.updateContainer(containerId, { name: trimmed })) {
                    vscode.window.showWarningMessage(`名称「${trimmed}」已被使用`);
                }
                this._sendProjectData();
            }
        });
    }

    private _deleteProjectWithTasks(containerId: string): void {
        const containers = this._store.getContainers();
        const idsToRemove = new Set<string>();
        const collectChildren = (parentId: string) => {
            idsToRemove.add(parentId);
            for (const c of containers) {
                if (c.parentId === parentId) collectChildren(c.id);
            }
        };
        collectChildren(containerId);

        const tasks = this._store.getTasks();
        const taskIdsToDelete = tasks
            .filter(t => t.containerId && idsToRemove.has(t.containerId))
            .map(t => t.id);
        if (taskIdsToDelete.length > 0) {
            this._store.deleteTasks(taskIdsToDelete);
        }
        this._store.deleteContainer(containerId);
        this._sendProjectData();
    }

    private _openTask(taskId: string): void {
        this.panel.dispose();
        this._onOpenTask(taskId);
    }

    private _sendTaskData(): void {
        const tasks = this._store.getTasks();
        const containers = this._store.getContainers();
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.name || '';
        try {
            this.panel.webview.postMessage({
                type: 'updateTasks',
                tasks,
                containers,
                currentWorkspace,
            });
        } catch (err) {
            _output.appendLine('[MyTasksProvider] sendTaskData error: ' + err);
        }
    }

    private _sendProjectData(): void {
        const containers = this._store.getContainers();
        const projects = containers.filter(c => c.type === 'project');
        const currentWorkspace = vscode.workspace.workspaceFolders?.[0]?.name || '';
        _output.appendLine(`[MyTasksProvider] _sendProjectData: ${projects.length} projects, ${containers.length} containers`);
        try {
            this.panel.webview.postMessage({
                type: 'updateProjects',
                containers,
                projects,
                currentWorkspace,
            });
        } catch (err) {
            _output.appendLine('[MyTasksProvider] postMessage error: ' + err);
        }
    }

    private _getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'myTasksApp.js')
        ).toString();
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>我的任务</title>
    <style nonce="${nonce}">
        :root {
            --border: var(--vscode-panel-border, rgba(128,128,128,.35));
            --bg: var(--vscode-sideBar-background, #1e1e1e);
            --bg-alt: var(--vscode-editor-background, #1e1e1e);
            --text: var(--vscode-foreground, #cccccc);
            --text-secondary: var(--vscode-descriptionForeground, #969696);
            --text-link: var(--vscode-textLink-foreground, #3794ff);
            --input-bg: var(--vscode-input-background, #3c3c3c);
            --input-border: var(--vscode-input-border, transparent);
            --input-fg: var(--vscode-input-foreground, #cccccc);
            --btn-bg: var(--vscode-button-background, #0e639c);
            --btn-fg: var(--vscode-button-foreground, #ffffff);
            --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
            --btn-secondary: var(--vscode-button-secondaryBackground, #3a3d41);
            --btn-secondary-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
            --badge-bg: var(--vscode-badge-background, #4d4d4d);
            --badge-fg: var(--vscode-badge-foreground, #ffffff);
            --focus-border: var(--vscode-focusBorder, #007fd4);
            --table-row-hover: rgba(255,255,255,.04);
            --table-row-active: rgba(14,99,156,.2);
            --tag-bg: rgba(255,255,255,.06);
            font-size: 13px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        #tab-bar { display: flex; border-bottom: 1px solid var(--border); padding: 0 12px; flex-shrink: 0; background: var(--bg); }
        .tab-btn { padding: 8px 16px; background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; }
        .tab-btn:hover { color: var(--text); }
        .tab-btn.active { color: var(--text); border-bottom-color: var(--btn-bg); }
        .tab-btn .tab-count { margin-left: 6px; font-size: 11px; opacity: .7; }
        #content { flex: 1; overflow: auto; }
        #content table { table-layout: fixed; }
        table { width: 100%; border-collapse: collapse; }
        thead { position: sticky; top: 0; background: var(--bg); z-index: 1; }
        th { text-align: left; padding: 8px 16px; font-size: 12px; color: var(--text-secondary); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; user-select: none; overflow: hidden; text-overflow: ellipsis; }
        th.col-title { width: 180px; }
        th.col-project { width: 80px; }
        th.col-workspace { width: 90px; }
        th.col-status { width: 65px; }
        th.col-phase { width: 55px; }
        th.col-time { width: 75px; }
        th.col-action { width: 60px; }
        td { padding: 8px 16px; border-bottom: 1px solid rgba(128,128,128,.08); font-size: 13px; }
        #table-body td:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        tr:hover td { background: var(--table-row-hover); }
        tr.active td { background: var(--table-row-active); }
        .task-title { color: var(--text-link); cursor: pointer; }
        .task-title:hover { text-decoration: underline; }
        .ws-tag { display: inline-block; padding: 1px 6px; font-size: 11px; border-radius: 3px; background: var(--tag-bg); color: var(--text-secondary); }
        .status-dot { display: inline-flex; align-items: center; gap: 4px; }
        .status-dot::before { content: ''; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .status-active::before { background: #4caf50; }
        .status-in_review::before { background: #ffa726; }
        .status-completed::before { background: #42a5f5; }
        .status-pending::before { background: #888; }
        .status-cancelled::before { background: #555; }
        .phase-tag { display: inline-block; padding: 1px 6px; font-size: 11px; border-radius: 3px; font-weight: 500; }
        .phase-demand { background: rgba(156,39,176,.2); color: #ce93d8; }
        .phase-goal { background: rgba(33,150,243,.2); color: #90caf9; }
        .phase-plan { background: rgba(255,152,0,.2); color: #ffcc80; }
        .phase-execute { background: rgba(76,175,80,.2); color: #a5d6a7; }
        .phase-self_verify { background: rgba(0,188,212,.2); color: #80deea; }
        .phase-review { background: rgba(244,67,54,.2); color: #ef9a9a; }
        .btn-action { padding: 2px 10px; border: none; cursor: pointer; font-size: 12px; border-radius: 2px; background: var(--btn-secondary); color: var(--text); white-space: nowrap; }
        .btn-action:hover { background: var(--btn-secondary-hover); }
        .btn-action.btn-restore { background: var(--btn-bg); color: var(--btn-fg); }
        .btn-action.btn-restore:hover { background: var(--btn-hover); }
        .btn-action.btn-archive { background: transparent; border: 1px solid var(--border); }
        .btn-action.btn-archive:hover { background: var(--table-row-hover); }
        .btn-action.btn-rename { background: transparent; border: 1px solid var(--border); }
        .btn-action.btn-rename:hover { background: var(--table-row-hover); color: var(--text); }
        #footer { padding: 8px 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-secondary); flex-shrink: 0; display: flex; align-items: center; gap: 12px; background: var(--bg); }
        #footer .f-count { flex: 1; }
        #empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 32px; color: var(--text-secondary); }
        #empty-state .empty-icon { font-size: 32px; margin-bottom: 12px; opacity: .5; }
        #empty-state .empty-text { font-size: 14px; }
        #empty-state .empty-hint { font-size: 12px; margin-top: 4px; }
        .skeleton { height: 20px; background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.08) 50%, rgba(255,255,255,.04) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 2px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* --- Primary Tab Bar --- */
        #tab-bar { border-bottom: 1px solid var(--border); flex-shrink: 0; }
        #tab-bar .tab-btn { font-weight: 600; }
        #tab-bar .tab-btn:first-child { margin-left: 4px; }

        /* --- Toolbars --- */
        #task-toolbar, #project-toolbar {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 16px; border-bottom: 1px solid var(--border);
            flex-shrink: 0; background: var(--bg);
        }
        #workspace-filter-label {
            display: flex; align-items: center; gap: 4px;
            font-size: 12px; color: var(--text-secondary);
            cursor: pointer; white-space: nowrap; user-select: none;
        }
        #workspace-filter-label input { margin: 0; cursor: pointer; }
        #search-input {
            flex: 1; max-width: 260px; padding: 4px 8px;
            background: var(--input-bg); color: var(--input-fg);
            border: 1px solid var(--input-border); outline: none;
            font-size: 13px; border-radius: 2px;
        }
        #search-input:focus { border-color: var(--focus-border); }
        #task-toolbar .spacer { flex: 1; }
        .badge { display: inline-block; padding: 1px 8px; font-size: 11px; border-radius: 3px; background: var(--badge-bg); color: var(--badge-fg); }

        /* --- Sub Tab Bar (task filters) --- */
        #sub-tab-bar { display: flex; border-bottom: 1px solid var(--border); padding: 0 16px; flex-shrink: 0; background: var(--bg); }
        #sub-tab-bar .tab-btn { padding: 6px 14px; background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 12px; border-bottom: 2px solid transparent; }
        #sub-tab-bar .tab-btn:hover { color: var(--text); }
        #sub-tab-bar .tab-btn.active { color: var(--text); border-bottom-color: var(--btn-bg); }
        #sub-tab-bar .tab-btn .tab-count { margin-left: 4px; font-size: 11px; opacity: .7; }

        /* --- Task / Project content areas --- */
        #task-content, #project-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

        /* --- Project Content --- */
        #btn-new-project {
            font-size: 12px; padding: 3px 10px; border: none; border-radius: 3px;
            cursor: pointer; background: var(--btn-bg); color: var(--btn-fg); white-space: nowrap;
        }
        #btn-new-project:hover { background: var(--btn-hover); }
        #project-body { flex: 1; overflow-y: auto; }
        #project-body table { width: 100%; border-collapse: collapse; }
        #project-body table { table-layout: fixed; }
        #project-body th { text-align: left; padding: 8px 16px; font-size: 12px; color: var(--text-secondary); font-weight: 500; border-bottom: 1px solid var(--border); white-space: nowrap; position: sticky; top: 0; background: var(--bg); z-index: 1; overflow: hidden; text-overflow: ellipsis; }
        #project-body th:first-child { width: 160px; }
        #project-body td:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #project-body th:nth-child(2) { width: 120px; }
        #project-body th:nth-child(3) { width: 60px; }
        #project-body td { padding: 8px 16px; border-bottom: 1px solid rgba(128,128,128,.08); font-size: 13px; }
        #project-body tbody tr:hover td { background: var(--table-row-hover); }
        .project-item {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 12px; font-size: 13px; border-radius: 3px; margin-bottom: 2px;
        }
        .project-item:hover { background: var(--table-row-hover); }
        .project-item .p-icon { flex-shrink: 0; font-size: 16px; }
        .project-item .p-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .project-item .p-delete {
            font-size: 12px; padding: 2px 8px; border: none; border-radius: 2px;
            cursor: pointer; background: transparent; color: var(--text-secondary); visibility: hidden;
        }
        .project-item:hover .p-delete { visibility: visible; }
        .project-item .p-delete:hover { background: rgba(244,67,54,.2); color: #ef9a9a; }
        .project-empty {
            padding: 32px 16px; font-size: 13px; color: var(--text-secondary); text-align: center;
        }

        /* --- Project Context Menu --- */
        .project-context-menu {
            position: fixed;
            background: var(--vscode-menu-background, #252526);
            border: 1px solid var(--vscode-menu-border, #3c3c3c);
            border-radius: 4px;
            padding: 4px 0;
            min-width: 100px;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.36);
        }
        .project-context-menu-item {
            padding: 5px 14px;
            cursor: pointer;
            color: var(--vscode-menu-foreground, #d4d4d4);
            font-size: 13px;
        }
        .project-context-menu-item:hover {
            background: var(--vscode-menu-selectionBackground, #094771);
            color: var(--vscode-menu-selectionForeground, #fff);
        }
        .project-context-menu-separator {
            height: 1px;
            background: var(--vscode-menu-border, #3c3c3c);
            margin: 4px 8px;
        }
    </style>
</head>
<body>
    <div id="tab-bar">
        <button class="tab-btn active" data-primary-tab="tasks">📋 我的任务</button>
        <button class="tab-btn" data-primary-tab="projects">📦 我的项目</button>
    </div>
    <div id="task-toolbar">
        <label id="workspace-filter-label">
            <input type="checkbox" id="workspace-filter" checked>
            <span>仅当前工作区</span>
        </label>
        <input id="search-input" type="text" placeholder="搜索任务标题...">
        <button class="btn-action btn-restore" id="btn-refresh" title="刷新">↻ 刷新</button>
    </div>
    <div id="project-toolbar" style="display:none">
        <button id="btn-new-project">+ 新建项目</button>
    </div>
    <div id="task-content">
        <div id="sub-tab-bar">
            <button class="tab-btn active" data-tab="active">进行中 <span class="tab-count"></span></button>
            <button class="tab-btn" data-tab="review">待验收 <span class="tab-count"></span></button>
            <button class="tab-btn" data-tab="archived">已归档 <span class="tab-count"></span></button>
            <button class="tab-btn" data-tab="all">全部 <span class="tab-count"></span></button>
        </div>
        <div id="content">
            <table>
                <thead>
                    <tr>
                        <th class="col-title">任务</th>
                        <th class="col-project">项目</th>
                        <th class="col-workspace">工作区</th>
                        <th class="col-status">状态</th>
                        <th class="col-phase">阶段</th>
                        <th class="col-time">开始时间</th>
                        <th class="col-action"></th>
                    </tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
            <div id="empty-state" style="display:none">
                <div class="empty-icon">📋</div>
                <div class="empty-text">没有找到匹配的任务</div>
                <div class="empty-hint">尝试调整筛选条件或搜索关键词</div>
            </div>
        </div>
    </div>
    <div id="project-content" style="display:none">
        <div id="project-body">
            <table>
                <thead>
                    <tr>
                        <th>项目</th>
                        <th>工作空间</th>
                        <th>任务数</th>
                    </tr>
                </thead>
                <tbody id="project-table-body"></tbody>
            </table>
            <div id="project-empty" style="display:none">
                <div class="empty-icon">📦</div>
                <div class="empty-text" style="padding:32px 16px;text-align:center;color:var(--text-secondary)">暂无项目</div>
            </div>
        </div>
    </div>
    <div id="footer">
        <span class="f-count" id="footer-count"></span>
        <span id="footer-workspaces"></span>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 64; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
