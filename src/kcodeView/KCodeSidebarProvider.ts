import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Task } from '../types';

export class KCodeSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kcode.viewsMain';

    private _view?: vscode.WebviewView;
    private _store: TaskStore;
    private _context: vscode.ExtensionContext;
    private _onTaskSelected: (taskId: string) => void;
    private _onFlashInput?: () => void;

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

        webviewView.webview.onDidReceiveMessage(async (message: any) => {
            switch (message.type) {
                case 'newTask':
                    this.createNewTask();
                    break;
                case 'selectTask':
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
            }
        });

        this.refresh();
    }

    private async createNewGroup(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: '输入分组名称',
            placeHolder: '分组名称',
            validateInput: (value: string) => {
                if (!value.trim()) return '名称不能为空';
                if (this._store.getGroups().includes(value.trim())) return '分组已存在';
                return null;
            }
        });
        if (name && name.trim()) {
            this._store.addGroup(name.trim());
            this.refresh();
        }
    }

    setFlashInputCallback(cb: () => void) {
        this._onFlashInput = cb;
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
            status: 'pending',
            createdAt: Date.now(),
            pinned: false
        };
        this._store.addTask(task);
        this._onTaskSelected(task.id);
        this.refresh();
    }

    refresh(): void {
        if (!this._view) return;
        const tasks = this._store.getTasks();
        const groups = this._store.getGroups();
        this._view.webview.postMessage({
            type: 'updateTaskList',
            tasks,
            groups
        });
    }

    private getHtml(): string {
        const webview = this._view!.webview!;
        const extensionUri = this._context.extensionUri;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'sidebar.js')
        );

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
        #sidebar-content::-webkit-scrollbar { width: 4px; }
        #sidebar-content::-webkit-scrollbar-track { background: transparent; }
        #sidebar-content::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, #555); border-radius: 2px; }

        /* --- Action Bar --- */
        .action-bar {
            padding: 8px 8px 8px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .sidebar-btn {
            flex: 1;
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
        }
        .sidebar-btn:hover { background: #252526; }
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
        .section-header-btn {
            background: none;
            border: none;
            color: var(--vscode-sideBarSectionHeader-foreground, #888);
            cursor: pointer;
            padding: 0 4px;
            margin-left: auto;
            font-size: 14px;
            line-height: 1;
            font-family: inherit;
            border-radius: 3px;
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
        .task-item:not(.active):hover { background: #252526; }
        .task-item.dragging { opacity: 0.5; }
        .task-item.active {
            background: #0E364B;
            color: #ffffff;
            font-weight: 600;
        }
        .task-item .status-icon {
            font-size: 13px;
            line-height: 1;
            flex-shrink: 0;
            width: 18px;
            text-align: center;
        }
        .task-item .status-icon.pending { display: none; }
        .task-item .status-icon.active { color: #cc7832; }
        .task-item .status-icon.in_review { color: #cca700; }
        .task-item .status-icon.completed { color: #4ec9b0; }
        .task-item .status-icon.cancelled { color: #6b6b6b; }
        .task-title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

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
            padding: 4px 6px;
            border-radius: 3px;
            font-size: 16px;
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
    </style>
    <title>KCode</title>
</head>
<body>
    <div id="sidebar-content">
        <div class="action-bar">
            <button id="btn-new-task" class="sidebar-btn">+ 新建任务</button>
        </div>

        <div id="section-pinned" class="section" style="display:none">
            <div class="section-header">
                <span>已置顶</span>
            </div>
            <div class="section-body" id="pinned-list"></div>
        </div>

        <div id="section-tasks" class="section">
            <div class="section-header" id="tasks-header">
                <span>任务</span>
                <button id="btn-new-group" class="section-header-btn" title="新建分组">+</button>
            </div>
            <div class="section-body" id="task-list">
                <div class="placeholder-text">No tasks yet</div>
            </div>
        </div>
    </div>

    <div id="sidebar-footer">
        <div class="footer-left">
            <div class="footer-icon">K</div>
            <span class="footer-label">KCode</span>
        </div>
        <button id="btn-settings" class="footer-btn" title="Settings">&#x2699;</button>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}