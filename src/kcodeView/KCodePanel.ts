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

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; color: #d4d4d4; background: #1e1e1e; }

        #container { display: flex; height: 100vh; width: 100vw; overflow: hidden; }

        #chat-area { flex: 1; display: flex; flex-direction: column; min-width: 300px; background: #1e1e1e; }

        #chat-messages { flex: 1; overflow-y: auto; padding: 16px 20px; }

        .chat-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: #6b6b6b; font-size: 14px; }

        .chat-msg { margin-bottom: 16px; max-width: 85%; }
        .chat-msg.user { align-self: flex-end; margin-left: auto; }
        .chat-msg.agent { align-self: flex-start; }

        .chat-msg .msg-sender { font-size: 11px; color: #888; margin-bottom: 4px; }
        .chat-msg .msg-bubble { padding: 10px 14px; border-radius: 8px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }

        .chat-msg.user .msg-bubble { background: #0e639c; color: #fff; border-bottom-right-radius: 2px; }
        .chat-msg.agent .msg-bubble { background: #2d2d2d; color: #d4d4d4; border-bottom-left-radius: 2px; }

        .chat-msg.agent .msg-bubble code { background: #1e1e1e; padding: 2px 6px; border-radius: 3px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 12px; }
        .chat-msg.agent .msg-bubble pre { background: #1e1e1e; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
        .chat-msg.agent .msg-bubble pre code { background: transparent; padding: 0; }

        #chat-input-area { border-top: 1px solid #3c3c3c; padding: 12px 16px; background: #252526; }

        #chat-input { width: 100%; background: #3c3c3c; color: #d4d4d4; border: 1px solid #555; border-radius: 6px; padding: 10px 12px; font-family: inherit; font-size: 13px; resize: none; outline: none; }
        #chat-input:focus { border-color: #0e639c; }

        #chat-input-tools { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }

        .think-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: #a0a0a0; }
        .think-toggle input { accent-color: #0e639c; }

        .send-btn { padding: 6px 20px; background: #0e639c; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
        .send-btn:hover { background: #1177bb; }
        .send-btn:disabled { background: #555; cursor: not-allowed; }

        .splitter { width: 4px; cursor: col-resize; background: transparent; flex-shrink: 0; z-index: 10; }
        .splitter:hover, .splitter.active { background: #0e639c; }

        #right-panel { width: 320px; min-width: 200px; max-width: 600px; background: #252526; border-left: 1px solid #3c3c3c; display: flex; flex-direction: column; transition: width 0.2s ease; }
        #right-panel.hidden { width: 0 !important; min-width: 0; overflow: hidden; border-left: none; }

        #right-panel-header { display: flex; align-items: center; border-bottom: 1px solid #3c3c3c; flex-shrink: 0; }
        .tabs { display: flex; flex: 1; overflow-x: auto; }
        .tab { padding: 8px 12px; background: none; border: none; color: #888; font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
        .tab:hover { color: #ccc; }
        .tab.active { color: #fff; border-bottom-color: #0e639c; }
        .close-btn { background: none; border: none; color: #888; font-size: 14px; cursor: pointer; padding: 8px 12px; }
        .close-btn:hover { color: #fff; }

        #right-panel-content { flex: 1; overflow: hidden; position: relative; }
        .tab-content { display: none; height: 100%; overflow-y: auto; padding: 12px; }
        .tab-content.active { display: block; }

        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #777; }
    </style>
    <title>KCode</title>
</head>
<body>
    <div id="container">
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

        <div id="right-panel" class="hidden">
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

    loadTask(taskId: string, workspaceId: string) {
        this.currentTaskId = taskId;
        const ws = this.store.getWorkspaces().find(w => w.id === workspaceId);
        if (ws) {
            this.currentWorkspacePath = ws.path;
        }
        this.sendTaskMessages(taskId);
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
