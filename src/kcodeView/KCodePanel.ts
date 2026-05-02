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
            <!-- Top: Instruction Card -->
            <div id="instruction-panel">
                <div class="instruction-card">
                    <div class="instruction-text">按如下改现: ## UI 设计描述: 侧边栏 (Sidebar)...</div>
                    <div class="instruction-toggle">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                        <span class="toggle-detail">### 1. 顶部操作区</span>
                    </div>
                </div>
            </div>

            <!-- Middle: Timeline / Messages -->
            <div id="chat-messages">
                <div class="timeline-header">
                    <span class="timeline-duration-label">已处理 <span class="duration-value">3m 3s</span></span>
                </div>
                <div class="timeline-item">
                    <span class="timeline-icon thinking">⟳</span>
                    <span class="timeline-text">思考过程</span>
                    <span class="timeline-time">9.1s</span>
                </div>
                <div class="timeline-item">
                    <span class="timeline-icon done">✓</span>
                    <span class="timeline-text">已开启 Plan Mode</span>
                    <span class="timeline-time">2.3s</span>
                </div>
                <div class="timeline-item">
                    <span class="timeline-icon thinking">⟳</span>
                    <span class="timeline-text">思考过程</span>
                    <span class="timeline-time">4.7s</span>
                </div>
                <div class="timeline-item">
                    <span class="timeline-icon agent">◇</span>
                    <span class="timeline-text">子智能体 1 Explore codebase structure</span>
                    <span class="timeline-time">1.2s</span>
                </div>
            </div>

            <!-- Bottom: Input -->
            <div id="chat-input-area">
                <div class="input-wrapper">
                    <div class="input-tools">
                        <button class="input-tool-btn" title="附件">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8.5 4v5.5a2 2 0 01-4 0V4a3.5 3.5 0 017 0v6.5a4.5 4.5 0 01-9 0V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                            </svg>
                        </button>
                        <button class="input-tool-btn" title="@提及" style="font-weight:600;font-size:14px;">@</button>
                        <button class="input-tool-btn" title="截图">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                                <circle cx="8" cy="7" r="2" stroke="currentColor" stroke-width="1.3"/>
                                <path d="M11 13.5v-2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <textarea id="chat-input" placeholder="提出后续修改要求" rows="1"></textarea>
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
                        Claude CLI
                    </span>
                    <span class="status-divider"></span>
                    <span class="status-item model-badge">glm-5v-turbo</span>
                    <span class="status-divider"></span>
                    <span class="status-item">跳过权限检查</span>
                    <span class="status-divider"></span>
                    <span class="status-item">11.9%</span>
                    <span class="status-divider"></span>
                    <span class="status-item">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 4h8M2 4v5a1 1 0 001 1h6a1 1 0 001-1V4M2 4l1-2h6l1 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                            <path d="M4.5 7h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                        </svg>
                        master
                    </span>
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

    private getInlineStyles(): string {
        return `/* === Reset & Base === */
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#d4d4d4;background:#1e1e1e}
#container{display:flex;height:100vh;width:100vw;overflow:hidden}
.splitter{width:4px;cursor:col-resize;background:transparent;flex-shrink:0;z-index:10}
.splitter:hover,.splitter.active{background:#0e639c}
#chat-area{flex:1;display:flex;flex-direction:column;min-width:300px;background:#1e1e1e}
#instruction-panel{flex-shrink:0;padding:12px 16px 8px;border-bottom:1px solid #2d2d2d}
.instruction-card{background:#2a2a2a;border:1px solid #3c3c3c;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.instruction-text{font-size:13px;line-height:1.5;color:#d4d4d4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.instruction-toggle{display:flex;align-items:center;gap:6px;cursor:pointer;color:#888;font-size:12px;user-select:none;transition:color .15s}
.instruction-toggle:hover{color:#b0b0b0}
.instruction-toggle svg{transition:transform .15s ease;flex-shrink:0}
.instruction-toggle.collapsed svg{transform:rotate(-90deg)}
.instruction-toggle .toggle-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#chat-messages{flex:1;overflow-y:auto;padding:8px 16px;display:flex;flex-direction:column;gap:2px}
.timeline-header{padding:4px 8px 8px;font-size:11px;color:#6b6b6b;flex-shrink:0}
.timeline-duration-label{font-weight:500}
.duration-value{color:#888}
.timeline-item{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:4px;font-size:13px;color:#b0b0b0;cursor:default}
.timeline-item:hover{background:#2a2a2a}
.timeline-icon{width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.timeline-icon.thinking{color:#888;font-size:14px}
.timeline-icon.done{background:#1a3a2a;color:#4ec9b0;font-size:11px}
.timeline-icon.agent{background:#2a2d3a;color:#8888cc;font-size:12px}
.timeline-text{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.timeline-time{font-size:11px;color:#6b6b6b;flex-shrink:0;font-variant-numeric:tabular-nums}
.chat-msg{margin-bottom:4px;max-width:90%}
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
#chat-input{flex:1;background:transparent;color:#d4d4d4;border:none;padding:6px 4px;font-family:inherit;font-size:13px;resize:none;outline:none;min-height:20px;max-height:200px;line-height:1.4}
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
