import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { AcpClient, AcpMessageHandler } from '../acp/AcpClient';

export class KCodePanel {
    private panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private store: TaskStore;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;
    private currentTaskId: string | null = null;
    private acpClient: AcpClient | null = null;
    private currentWorkspacePath: string = '';
    private agentReady: boolean = false;
    private accumulatedAgentText: string = '';

    constructor(context: vscode.ExtensionContext, store: TaskStore) {
        this.context = context;
        this.store = store;

        this.panel = vscode.window.createWebviewPanel(
            'kcode',
            'KCode',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'kcodeView', 'webview')
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();
        this.setupMessageHandler();

        // Send initial task list once webview is ready
        setTimeout(() => this.refreshTaskList(), 500);
    }

    private setupMessageHandler() {
        this.panel.webview.onDidReceiveMessage(async (message: any) => {
            switch (message.type) {
                case 'newTask':
                    await vscode.commands.executeCommand('kcode.newTask');
                    break;
                case 'openWorkspace':
                    await vscode.commands.executeCommand('kcode.openWorkspace');
                    break;
                case 'selectTask':
                    this.currentTaskId = message.taskId;
                    this.sendTaskMessages(message.taskId);
                    // Track workspace path for ACP
                    const ws = this.store.getWorkspaces().find(w => w.id === message.workspaceId);
                    if (ws) {
                        this.currentWorkspacePath = ws.path;
                    }
                    break;
                case 'sendMessage':
                    await this.handleSendMessage(message.text, message.taskId);
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'kcode');
                    break;
            }
        }, null, this.context.subscriptions);
    }

    private async handleSendMessage(text: string, taskId?: string) {
        const tid = taskId || this.currentTaskId;
        if (!tid) return;

        // Store user message
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        if (!this.agentReady) {
            // Auto-initialize ACP agent on first message
            await this.ensureAgent();
        }

        if (this.agentReady && this.acpClient) {
            // Send via ACP
            this.accumulatedAgentText = '';

            await this.acpClient.prompt(text, {
                onText: (chunk: string) => {
                    this.accumulatedAgentText += chunk;
                    // Send streaming update to webview
                    this.panel.webview.postMessage({
                        type: 'agentStreamUpdate',
                        text: this.accumulatedAgentText
                    });
                },
                onError: (error: string) => {
                    this.panel.webview.postMessage({
                        type: 'agentStreamUpdate',
                        text: `\n\n[错误: ${error}]`
                    });
                    // Also store the error message
                    this.storeMessage(tid, 'agent', `错误: ${error}`);
                },
                onDone: () => {
                    // Store complete message
                    if (this.accumulatedAgentText) {
                        this.storeMessage(tid, 'agent', this.accumulatedAgentText);
                    }
                }
            });
        } else {
            // Fallback echo when agent not available
            setTimeout(() => {
                const echoText = `收到: "${text}"\n\n（ACP Agent 未连接，请在设置中配置 Agent 路径）`;
                this.storeMessage(tid, 'agent', echoText);
                this.panel.webview.postMessage({
                    type: 'loadMessages',
                    messages: this.store.getMessages(tid)
                });
            }, 300);
        }
    }

    private async ensureAgent() {
        try {
            this.acpClient = new AcpClient(this.currentWorkspacePath || vscode.workspace.rootPath || '');

            // Try to find the ACP agent
            const config = vscode.workspace.getConfiguration('kcode');
            const agentPath = config.get<string>('agentPath') || '';
            const agentArgs = config.get<string[]>('agentArgs') || [];

            if (agentPath) {
                const connected = await this.acpClient.connect(agentPath, agentArgs);
                if (connected) {
                    const sessionId = await this.acpClient.createSession(
                        this.currentWorkspacePath || vscode.workspace.rootPath || process.cwd()
                    );
                    if (sessionId) {
                        this.agentReady = true;
                        this.panel.webview.postMessage({
                            type: 'agentStatus',
                            status: 'connected',
                            message: 'Agent 已连接'
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Failed to initialize ACP agent:', err);
            // agentReady stays false, fallback echo will be used
        }
    }

    private storeMessage(taskId: string, role: 'user' | 'agent', content: string) {
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId,
            role,
            content,
            timestamp: Date.now()
        });
    }

    private getWebviewContent(): string {
        const webview = this.panel.webview;
        const extensionUri = this.context.extensionUri;

        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'app.js')
        );
        const styleCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'src', 'kcodeView', 'webview', 'style.css')
        );

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <link rel="stylesheet" href="${styleCssUri}">
    <title>KCode</title>
</head>
<body>
    <div id="container">
        <!-- 左侧栏 -->
        <div id="sidebar">
            <div id="sidebar-content">
                <div class="sidebar-section">
                    <button id="btn-new-task" class="sidebar-btn">+ New Task</button>
                    <button id="btn-open-workspace" class="sidebar-btn">📂 Open Workspace</button>
                </div>
                <div id="task-list">
                </div>
            </div>
            <div id="sidebar-footer">
                <button id="btn-user" class="sidebar-icon-btn" title="User">👤</button>
                <button id="btn-settings" class="sidebar-icon-btn" title="Settings">⚙️</button>
            </div>
            <div id="sidebar-collapse-btn" class="collapse-btn" title="折叠侧栏">◀</div>
        </div>

        <div id="splitter-1" class="splitter"></div>

        <div id="chat-area">
            <div id="chat-messages">
                <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
            </div>
            <div id="chat-input-area">
                <textarea id="chat-input" placeholder="描述你的开发需求..." rows="3"></textarea>
                <div id="chat-input-tools">
                    <label class="think-toggle">
                        <input type="checkbox" id="think-mode">
                        <span class="toggle-label">思考模式</span>
                    </label>
                    <button id="btn-send" class="send-btn">发送</button>
                </div>
            </div>
        </div>

        <div id="splitter-2" class="splitter"></div>

        <div id="right-panel">
            <div id="right-panel-header">
                <div class="tabs">
                    <button class="tab active" data-tab="preview">Preview</button>
                    <button class="tab" data-tab="diff">Diff</button>
                    <button class="tab" data-tab="webview">WebView</button>
                    <button class="tab" data-tab="device">Device</button>
                </div>
                <button id="right-panel-close" class="close-btn" title="关闭右侧面板">✕</button>
            </div>
            <div id="right-panel-content">
                <div id="tab-preview" class="tab-content active">Preview</div>
                <div id="tab-diff" class="tab-content">Diff</div>
                <div id="tab-webview" class="tab-content">WebView</div>
                <div id="tab-device" class="tab-content">Device</div>
            </div>
        </div>
    </div>

    <script>const vscode = acquireVsCodeApi();</script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    refreshTaskList() {
        const workspaces = this.store.getWorkspaces();
        const data = workspaces.map(ws => ({
            id: ws.id,
            name: ws.name,
            tasks: this.store.getTasks(ws.id)
        }));
        this.panel.webview.postMessage({
            type: 'updateTaskList',
            workspaces: data
        });
    }

    private sendTaskMessages(taskId: string) {
        const messages = this.store.getMessages(taskId);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages
        });
    }

    onDidDispose(callback: () => void) {
        this.onDisposeCallback = callback;
    }

    showFilePreview(filePath: string, content: string) {
        this.panel.webview.postMessage({ type: 'showFilePreview', filePath, content });
    }

    showDiff(original: string, modified: string) {
        this.panel.webview.postMessage({ type: 'showDiff', original, modified });
    }

    showWebView(url: string) {
        this.panel.webview.postMessage({ type: 'showWebView', url });
    }

    deviceConnect(host: string, port: number, connectionType: 'ssh' | 'telnet') {
        this.panel.webview.postMessage({ type: 'deviceConnect', host, port, connectionType });
    }

    reveal() {
        this.panel.reveal();
    }

    dispose() {
        this.acpClient?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
