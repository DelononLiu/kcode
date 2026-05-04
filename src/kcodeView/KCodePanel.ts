import * as vscode from 'vscode';
import { TaskStore } from '../store/TaskStore';
import { AcpClient } from '../acp/AcpClient';
import { FakeAgent } from '../acp/FakeAgent';
import { OpenAIAgent } from '../acp/OpenAIAgent';

export class KCodePanel {
    private panel: vscode.WebviewPanel;
    private context: vscode.ExtensionContext;
    private store: TaskStore;
    private disposables: vscode.Disposable[] = [];
    private onDisposeCallback?: () => void;
    private currentTaskId: string | null = null;
    private acpClient: AcpClient | null = null;
    private fakeAgent: FakeAgent | null = null;
    private openaiAgent: OpenAIAgent | null = null;
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

        this.ensureConnection();

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
        console.log('[KCode] handleSendMessage called, text:', text, 'tid:', tid, 'agentReady:', this.agentReady, 'acpClient:', !!this.acpClient, 'fakeAgent:', !!this.fakeAgent);
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
            this.sendTaskInfo(tid);
        }

        // Send user message to webview for immediate rendering
        this.panel.webview.postMessage({ type: 'addUserMessage', content: text });

        if (!this.agentReady) {
            await this.ensureConnection();
        }

        if (this.agentReady && this.acpClient) {
            // Real ACP Agent
            try {
                if (!this.acpClient.hasSession(tid)) {
                    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
                    await this.acpClient.createSession(tid, workspacePath);
                }
            } catch (err: any) {
                const errorMsg = err?.message || 'Agent 连接失败';
                this.showAgentError(tid, errorMsg);
                return;
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
                        this.panel.webview.postMessage({
                            type: 'loadMessages',
                            messages: this.store.getMessages(tid),
                            taskId: tid
                        });
                    }
                }
            });
        } else if (this.fakeAgent) {
            // Fake Agent for debugging (only when explicitly enabled)
            const sessionId = this.fakeAgent.createSession(tid);
            this.fakeAgent.setHandler(sessionId, {
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
                        this.panel.webview.postMessage({
                            type: 'loadMessages',
                            messages: this.store.getMessages(tid),
                            taskId: tid
                        });
                    }
                }
            });

            this.accumulatedAgentText = '';
            await this.fakeAgent.prompt(sessionId, text);
        } else if (this.openaiAgent) {
            const sessionId = this.openaiAgent.createSession(tid);
            this.openaiAgent.setHandler(sessionId, {
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
                        this.panel.webview.postMessage({
                            type: 'loadMessages',
                            messages: this.store.getMessages(tid),
                            taskId: tid
                        });
                    }
                }
            });

            this.accumulatedAgentText = '';
            await this.openaiAgent.prompt(sessionId, text);
        } else {
            // No agent available - show error to user
            const config = vscode.workspace.getConfiguration('kcode');
            const agentName = config.get<string>('agentName') || '';
            const errorMsg = !agentName || agentName === 'npx'
                ? '请配置 Agent：在 VS Code 设置中设置 `kcode.agentName`，指向 Agent 可执行文件路径'
                : `Agent 连接失败：无法连接到 "${agentName}"，请检查路径是否正确并确保 Agent 已启动`;
            this.showAgentError(tid, errorMsg);
        }
    }

    private showAgentError(tid: string, errorMsg: string) {
        this.storeMessage(tid, 'agent', `错误: ${errorMsg}`);
        this.panel.webview.postMessage({
            type: 'agentStreamUpdate',
            text: `\n\n[错误: ${errorMsg}]`
        });
        this.panel.webview.postMessage({
            type: 'loadMessages',
            messages: this.store.getMessages(tid),
            taskId: tid
        });
    }

    private async ensureConnection() {
        console.log('[KCode] ensureConnection called');
        if (this.agentReady || this.fakeAgent || this.openaiAgent) return;

        try {
            const config = vscode.workspace.getConfiguration('kcode');
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();

            const agentUrl = config.get<string>('agentUrl') || '';
            const agentName = config.get<string>('agentName') || '';
            const agentArgs = config.get<string[]>('agentArgs') || [];

            // FakeAgent for debugging
            if (agentName === 'fake') {
                console.log('[KCode] Using FakeAgent for debugging');
                this.fakeAgent = new FakeAgent();
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'connected',
                    message: 'Fake Agent (调试模式)'
                });
                return;
            }

            // OpenAI Agent
            if (agentName === 'openai') {
                console.log('[KCode] Using OpenAIAgent');
                this.openaiAgent = new OpenAIAgent();
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'connected',
                    message: `OpenAI Agent (${this.openaiAgent['config'].model})`
                });
                return;
            }

            this.acpClient = new AcpClient(workspacePath);

            // Priority 1: HTTP mode (when URL is configured)
            if (agentUrl) {
                console.log('[KCode] Trying to connect via HTTP:', agentUrl);
                const connected = await this.acpClient.connectHttp(agentUrl);
                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: 'Agent 已连接 (HTTP)'
                    });
                    return;
                }
                console.log('[KCode] HTTP connection failed');
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: `HTTP Agent 连接失败: ${agentUrl}`
                });
                return;
            }

            // Priority 2: stdio subprocess
            if (agentName && agentName !== 'npx') {
                console.log('[KCode] Trying to connect to agent:', agentName);

                const connectPromise = this.acpClient.connect(agentName, agentArgs);
                const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000));
                const connected = await Promise.race([connectPromise, timeoutPromise]);
                console.log('[KCode] connect result:', connected);

                if (connected) {
                    this.agentReady = true;
                    this.panel.webview.postMessage({
                        type: 'agentStatus',
                        status: 'connected',
                        message: 'Agent 已连接'
                    });
                    return;
                }

                console.log('[KCode] Connection failed');
                this.acpClient = null;
                this.panel.webview.postMessage({
                    type: 'agentStatus',
                    status: 'disconnected',
                    message: `Agent 连接失败: ${agentName}`
                });
                return;
            }

            // No agent configured
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: 'Agent 未连接'
            });
        } catch (err) {
            console.error('[KCode] ensureConnection error:', err);
            this.acpClient = null;
            this.panel.webview.postMessage({
                type: 'agentStatus',
                status: 'disconnected',
                message: 'Agent 连接失败'
            });
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
            <div id="task-info">
                <div id="task-info-primary">
                    <span class="task-info-title">选择任务开始对话</span>
                </div>
                <div id="task-info-secondary">
                    <span id="task-info-created"></span>
                    <span id="task-info-review"></span>
                </div>
            </div>
            <div id="chat-scroll" class="chat-empty">
                <div id="chat-messages">
                    <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
                </div>
            </div>
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
                    </div>
                </div>
                <div id="chat-statusbar">
                    <span class="status-item">
                        <span id="agent-status-dot" class="status-dot offline"></span>
                        <span id="status-model">Agent</span>
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
#task-info{padding:10px 16px;border-bottom:1px solid #2d2d2d;flex-shrink:0;background:#1e1e1e;width:100%;max-width:900px;margin:0 auto}
#task-info-primary{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px}
.task-info-title{font-size:14px;font-weight:600;color:#e0e0e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}
#task-info-secondary{display:flex;align-items:center;justify-content:center;gap:16px;font-size:11px;color:#888}
#chat-scroll{flex:1;overflow-y:auto;min-height:0;background:#1e1e1e;scrollbar-color:#28292b #1e1e1e;--vscode-scrollbarSlider-background:#28292b80;--vscode-scrollbarSlider-hoverBackground:#3a3a3b;--vscode-scrollbarSlider-activeButton-background:#1e1e1e}
#chat-messages{max-width:900px;margin:0 auto;padding:8px 16px;min-height:100%;width:100%}
#chat-scroll.chat-empty{display:none}
#chat-area:has(#chat-scroll.chat-empty){justify-content:center}
#chat-area:has(#chat-scroll.chat-empty) #task-info{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-input-area{border-top:none}
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#6b6b6b;font-size:14px}
.chat-msg{margin-bottom:4px;margin-top:8px}
.chat-msg.user{text-align:right}
.chat-msg.agent{text-align:left}
.chat-msg .msg-bubble{padding:10px 14px;border-radius:8px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word;font-size:13px;max-width:90%;display:inline-block;text-align:left}
.chat-msg.user .msg-bubble{background:#0e639c;color:#fff;border-bottom-right-radius:2px}
.chat-msg.agent .msg-bubble{background:#2d2d2d;color:#d4d4d4;border-bottom-left-radius:2px;border:1px solid #3c3c3c}
.chat-msg.agent .msg-bubble code{background:#1e1e1e;padding:2px 6px;border-radius:3px;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px}
.chat-msg.agent .msg-bubble pre{background:#1e1e1e;padding:12px;border-radius:6px;overflow-x:auto;margin:8px 0;border:1px solid #333}
.chat-msg.agent .msg-bubble pre code{background:transparent;padding:0}
#chat-input-area{border-top:1px solid #2d2d2d;padding:8px 16px 0;background:#1e1e1e;flex-shrink:0;width:100%;max-width:900px;margin:0 auto}
.input-wrapper{display:flex;align-items:flex-end;gap:8px;background:#2d2d2d;border:1px solid #3c3c3c;border-radius:10px;padding:6px 8px;transition:border-color .15s}
.input-wrapper:focus-within{border-color:#0e639c}

.input-wrapper.input-flash{animation:input-flash 1s ease-out}
@keyframes input-flash{0%{background:#2d2d2d;box-shadow:0 0 0 0 rgba(14,99,156,0)}20%{background:rgba(14,99,156,.15);box-shadow:0 0 0 6px rgba(14,99,156,.15)}100%{background:#2d2d2d;box-shadow:0 0 0 0 rgba(14,99,156,0)}}
.input-tools{display:flex;align-items:center;gap:2px;flex-shrink:0;padding-bottom:2px}
.input-tool-btn{background:none;border:none;color:#888;cursor:pointer;padding:4px 5px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;transition:color .15s,background .15s}
.input-tool-btn:hover{background:#3c3c3c;color:#ccc}
#chat-input{flex:1;background:transparent;color:#d4d4d4;border:none;padding:6px 4px;font-family:inherit;font-size:13px;resize:none;outline:none;height:48px;max-height:200px;line-height:1.4}
#chat-input::placeholder{color:#6b6b6b}
.input-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;padding-bottom:2px}
#chat-statusbar{display:flex;align-items:center;gap:0;padding:5px 4px 6px;font-size:11px;color:#6b6b6b;flex-wrap:wrap;flex-shrink:0}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 8px;white-space:nowrap}
.status-item svg{opacity:.5}
.status-divider{width:1px;height:12px;background:#3c3c3c;flex-shrink:0}
.status-item.model-badge{color:#888;font-weight:500}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.status-dot.online{background:#4ec9b0}
.status-dot.offline{background:#6b6b6b}
.thinking-dots{display:inline-flex;gap:5px;align-items:center;padding:4px 0}
.thinking-dots .dot{width:6px;height:6px;border-radius:50%;background:#888;animation:dot-bounce 1.4s infinite ease-in-out both}
.thinking-dots .dot:nth-child(1){animation-delay:-0.32s}
.thinking-dots .dot:nth-child(2){animation-delay:-0.16s}
.thinking-dots .dot:nth-child(3){animation-delay:0s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.4}40%{transform:scale(1);opacity:1}}
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
.tab-content.active{display:block}`;
    }

    loadTask(taskId: string) {
        this.currentTaskId = taskId;
        this.sendTaskMessages(taskId);
        this.sendTaskInfo(taskId);
        // Ensure a session exists for this task (non-blocking)
        this.ensureSession(taskId);
    }

    private sendTaskInfo(taskId: string) {
        const task = this.store.getTask(taskId);
        if (!task) return;
        this.panel.webview.postMessage({
            type: 'updateTaskInfo',
            title: task.title,
            status: task.status,
            createdAt: task.createdAt,
            pendingReviewFiles: 0
        });
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

    flashInput() {
        this.panel.webview.postMessage({ type: 'flashInput' });
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
