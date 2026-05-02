import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { Task } from '../types';

export class KCodeSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'kcode.viewsMain';

    private _view?: vscode.WebviewView;
    private _store: TaskStore;
    private _context: vscode.ExtensionContext;
    private _onTaskSelected: (taskId: string) => void;

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
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'kcode');
                    break;
            }
        });

        this.refresh();
    }

    createNewTask(): void {
        const task: Task = {
            id: `task_${Date.now()}`,
            title: 'New Task',
            status: 'pending',
            createdAt: Date.now()
        };
        this._store.addTask(task);
        this._onTaskSelected(task.id);
        this.refresh();
    }

    refresh(): void {
        if (!this._view) return;
        const tasks = this._store.getTasks();
        this._view.webview.postMessage({
            type: 'updateTaskList',
            tasks
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
            color: #d4d4d4;
            background: #1e1e1e;
        }
        body {
            display: flex;
            flex-direction: column;
        }
        #sidebar-content {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }
        .sidebar-section {
            margin-bottom: 8px;
        }
        .sidebar-btn {
            display: block;
            width: 100%;
            padding: 6px 10px;
            margin-bottom: 4px;
            background: #0e639c;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            text-align: left;
        }
        .sidebar-btn:hover { background: #1177bb; }
        .placeholder-text {
            padding: 20px 0;
            font-size: 12px;
            color: #6b6b6b;
            text-align: center;
        }
        .task-item {
            padding: 6px 8px;
            cursor: pointer;
            border-radius: 3px;
            color: #a0a0a0;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .task-item:hover { background: #2a2d2e; color: #e0e0e0; }
        .task-item.active {
            background: #37373d;
            color: #ffffff;
            border-left: 3px solid #0e639c;
        }
        .task-item .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .task-item .status-dot.pending { background: #6b6b6b; }
        .task-item .status-dot.active { background: #0e639c; }
        .task-item .status-dot.completed { background: #4ec9b0; }
        #sidebar-footer {
            padding: 6px 8px;
            border-top: 1px solid #3c3c3c;
            display: flex;
            justify-content: center;
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #777; }
    </style>
    <title>KCode</title>
</head>
<body>
    <div id="sidebar-content">
        <div class="sidebar-section">
            <button id="btn-new-task" class="sidebar-btn">+ New Task</button>
        </div>
        <div id="task-list">
            <div class="placeholder-text">暂无任务</div>
        </div>
    </div>
    <div id="sidebar-footer">
        <span style="font-size:11px;color:#6b6b6b;padding:2px 0;">KCode v0.1.0</span>
    </div>

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}