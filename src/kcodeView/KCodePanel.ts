import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { AcpClient } from '../acp/AcpClient';

export class KCodePanel {
    private panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private store: TaskStore;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;
    private currentTaskId: string | null = null;
    private acpClient: AcpClient | null = null;
    private agentReady: boolean = false;
    private accumulatedAgentText: string = '';
    private refreshSidebarCallback?: () => void;

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

        this.panel.onDidDispose(() => {
            this.onDisposeCallback?.();
        });
    }

    private setupMessageHandler() {
        this.panel.webview.onDidReceiveMessage(async (message: any) => {
            switch (message.type) {
                case 'sendMessage':
                    await this.handleSendMessage(message.text, message.taskId);
                    break;
            }
        }, null, this.context.subscriptions);
    }

    private async handleSendMessage(text: string, taskId?: string) {
        const tid = taskId || this.currentTaskId;
        if (!tid) return;

        const isFirstMessage = this.store.getMessages(tid).length === 0;

        // Store user message
        this.store.addMessage({
            id: `msg_${Date.now()}`,
            taskId: tid,
            role: 'user',
            content: text,
            timestamp: Date.now()
        });

        if (isFirstMessage) {
            const shortTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
            this.store.updateTaskTitle(tid, shortTitle);
            this.refreshSidebarCallback?.();
        }

        // Send user message to webview for immediate rendering
        this.panel.webview.postMessage({ type: 'addUserMessage', content: text });

        if (!this.agentReady) {
            await this.ensureConnection();
        }

        if (this.agentReady && this.acpClient) {
            // Ensure a session exists for this task
            if (!this.acpClient.hasSession(tid)) {
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                await this.acpClient.createSession(tid, workspacePath);
            }

            this.accumulatedAgentText = '';

            await this.acpClient.prompt(tid, text, {
                onText: (chunk: string) => {
                    this.accumulatedAgentText += chunk;
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
                    this.storeMessage(tid, 'agent', `错误: ${error}`);
                },
                onDone: () => {
                    if (this.accumulatedAgentText) {
                        this.storeMessage(tid, 'agent', this.accumulatedAgentText);
                    }
                }
            });
        } else {
            setTimeout(() => {
                const echoText = `收到: "${text}"\n\n（ACP Agent 未连接，请在设置中配置 Agent 路径）`;
                this.storeMessage(tid, 'agent', echoText);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid
        });
            }, 300);
        }
    }

    private async ensureConnection() {
        try {
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
            this.acpClient = new AcpClient(workspacePath);

            const config = vscode.workspace.getConfiguration('kcode');
            const agentPath = config.get<string>('agentPath') || '';
            const agentArgs = config.get<string[]>('agentArgs') || [];

            if (agentPath) {
                const connected = await this.acpClient.connect(agentPath, agentArgs);
                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: 'Agent 已连接'
                    });
                }
            }
        } catch (err) {
            console.error('Failed to initialize ACP agent:', err);
        }
    }

    private async ensureSession(taskId: string) {
        if (!this.acpClient || !this.agentReady) return;
        if (this.acpClient.hasSession(taskId)) return;

        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
        await this.acpClient.createSession(taskId, workspacePath);
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
        // NOTE: all CSS is inlined to avoid webview external resource loading issues
        const inlineStyles = this.getInlineStyles();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>${inlineStyles}</style>
    <title>KCode</title>
</head>
<body>
    <div id="container">
        <!-- Chat Area -->
        <div id="chat-area">
            <div id="chat-inner">
                <!-- Middle: Chat Messages -->
                <div id="chat-messages">
                    <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
                </div>

                <!-- Bottom: Input -->
                <div id="chat-input-area">
                    <div class="input-wrapper">
                        <div class="input-tools">
                        </div>
                        <textarea id="chat-input" placeholder="提出后续修改要求"></textarea>
                        <div class="input-actions">
                            <button class="input-tool-btn settings-btn" title="设置">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" stroke-width="1.2"/>
                                    <path d="M13.5 8c0-.3 0-.7-.1-1l1.5-1.2-.6-1.9-1.9-.4c-.4-.4-.9-.7-1.4-1L10.5.5H8.5L7.5 2c-.5.1-1 .4-1.4.7l-1.9-.4-1.5 1L2.5 5c-.3.4-.5.9-.6 1.4L.5 7.5v2l1.5 1.1c.1.5.3 1 .6 1.4l-.6 1.9 1.5 1.5 1.9-.4c.4.4.9.7 1.4 1l1 1.5h2l1-1.5c.5-.3 1-.6 1.4-1l1.9.4 1.5-1.5-.6-1.9c.3-.4.5-.9.6-1.4l1.5-1.1V8z" stroke="currentColor" stroke-width="1.2"/>
                                </svg>
                            </button>
                            <button id="btn-send" class="send-btn">发送</button>
                        </div>
                    </div>
                    <div id="chat-statusbar">
                        <span class="status-item">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1"/>
                                <path d="M6 3v3l2 1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
                            </svg>
                            <span id="status-model">Agent</span>
                        </span>
                    </div>
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

    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    private getInlineStyles(): string {
        return `/* === Reset & Base === */
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#d4d4d4;background:#1e1e1e}
#container{display:flex;height:100vh;width:100vw;overflow:hidden}
.splitter{width:4px;cursor:col-resize;background:transparent;flex-shrink:0;z-index:10}
.splitter:hover,.splitter.active{background:#0e639c}
#chat-area{flex:1;display:flex;flex-direction:column;min-width:300px;background:#1e1e1e;align-items:center}
#chat-inner{width:100%;max-width:720px;display:flex;flex-direction:column;flex:1;min-height:0}
#chat-messages{flex:1;overflow-y:auto;padding:8px 16px;display:flex;flex-direction:column;gap:2px}
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#6b6b6b;font-size:14px}
.chat-msg{margin-bottom:4px}
.chat-msg.user{align-self:flex-end;margin-left:auto;margin-top:8px}
.chat-msg.agent{align-self:flex-start;margin-top:8px}
.chat-msg .msg-sender{font-size:11px;color:#888;margin-bottom:4px}
.chat-msg .msg-bubble{padding:10px 14px;border-radius:8px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-size:13px}
.chat-msg.user .msg-bubble{background:#0e639c;color:#fff;border-bottom-right-radius:2px}
.chat-msg.agent .msg-bubble{background:#2d2d2d;color:#d4d4d4;border-bottom-left-radius:2px;border:1px solid #3c3c3c}
.chat-msg.agent .msg-bubble code{background:#1e1e1e;padding:2px 6px;border-radius:3px;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px}
.chat-msg.agent .msg-bubble pre{background:#1e1e1e;padding:12px;border-radius:6px;overflow-x:auto;margin:8px 0;border:1px solid #333}
.chat-msg.agent .msg-bubble pre code{background:transparent;padding:0}
#chat-input-area{border-top:1px solid #2d2d2d;padding:8px 16px 0;background:#1e1e1e;flex-shrink:0}
.input-wrapper{display:flex;align-items:flex-end;gap:8px;background:#2d2d2d;border:1px solid #3c3c3c;border-radius:10px;padding:6px 8px;transition:border-color .15s}
.input-wrapper:focus-within{border-color:#555}
.input-tools{display:flex;align-items:center;gap:2px;flex-shrink:0;padding-bottom:2px}
.input-tool-btn{background:none;border:none;color:#888;cursor:pointer;padding:4px 5px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:color .15s,background .15s}
.input-tool-btn:hover{background:#3c3c3c;color:#ccc}
#chat-input{flex:1;background:transparent;color:#d4d4d4;border:none;padding:6px 4px;font-family:inherit;font-size:13px;resize:none;outline:none;height:48px;max-height:200px;line-height:1.4}
#chat-input::placeholder{color:#6b6b6b}
.input-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;padding-bottom:2px}
.send-btn{padding:5px 16px;background:#0e639c;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-weight:500;transition:background .15s;white-space:nowrap}
.send-btn:hover{background:#1177bb}
.send-btn:disabled{background:#555;cursor:not-allowed}
#chat-statusbar{display:flex;align-items:center;gap:0;padding:5px 4px 6px;font-size:11px;color:#6b6b6b;flex-wrap:wrap;flex-shrink:0}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 8px;white-space:nowrap}
.status-item svg{opacity:.5}
.status-divider{width:1px;height:12px;background:#3c3c3c;flex-shrink:0}
.status-item.model-badge{color:#888;font-weight:500}
#right-panel{width:320px;min-width:200px;max-width:600px;background:#252526;border-left:1px solid #3c3c3c;display:flex;flex-direction:column;transition:width .2s ease}
#right-panel.hidden{width:0!important;min-width:0;overflow:hidden;border-left:none}
#right-panel-header{display:flex;align-items:center;border-bottom:1px solid #3c3c3c;flex-shrink:0}
.tabs{display:flex;flex:1;overflow-x:auto}
.tab{padding:8px 12px;background:none;border:none;color:#888;font-size:12px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
.tab:hover{color:#ccc}
.tab.active{color:#fff;border-bottom-color:#0e639c}
.close-btn{background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:8px 12px}
.close-btn:hover{color:#fff}
#right-panel-content{flex:1;overflow:hidden;position:relative}
.tab-content{display:none;height:100%;overflow-y:auto;padding:12px}
.tab-content.active{display:block}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#555;border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#777}`;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.sendTaskMessages(taskId);
        // Ensure a session exists for this task (non-blocking)
        this.ensureSession(taskId);
    }

    private sendTaskMessages(taskId: string) {
        const messages = this.store.getMessages(taskId);
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages,
            taskId
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

    focusInput() {
        this.panel.webview.postMessage({ type: 'focusInput' });
    }

    setRefreshSidebarCallback(callback: () => void) {
        this.refreshSidebarCallback = callback;
    }

    dispose() {
        this.acpClient?.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
