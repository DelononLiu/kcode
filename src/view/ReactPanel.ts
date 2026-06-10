import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewBridge } from '../adapters/WebviewBridge';
import { EngineAdapter } from '../adapters/EngineAdapter';
import type { AgentService } from '../core/AgentService';
import type { TaskStore } from '../store/TaskStore';

/**
 * ReactPanel — 新版 React Webview（全屏 WebviewPanel）
 *
 * 点击活动栏图标 → resolveWebviewView 显示启动入口
 * kcode.openReactView 命令 → 直接打开全屏 Panel
 *
 * Bridge + EngineAdapter 对接 kcode 后端服务。
 */
export class ReactPanel {
  public static readonly viewType = 'kcode.reactView';
  public static readonly viewId = 'kcode.viewsMain';

  private _bridge: WebviewBridge;

  constructor(
    private _context: vscode.ExtensionContext,
    agentService: AgentService,
    taskStore: TaskStore,
  ) {
    this._bridge = new WebviewBridge();
    const engineAdapter = new EngineAdapter(this._bridge, agentService, taskStore);
    engineAdapter.registerAll();
  }

  /** WebviewViewProvider.resolveWebviewView — 活动栏图标点击时触发 */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('[ReactPanel] resolveWebviewView called');
    webviewView.webview.html = this._launcherHtml();
    webviewView.webview.onDidReceiveMessage((msg) => {
      console.log('[ReactPanel] received message:', JSON.stringify(msg));
      if (msg?.command === 'openReactView') {
        console.log('[ReactPanel] opening panel...');
        this.openPanel();
      }
    });
  }

  /** 打开全屏 Webview Panel */
  openPanel() {
    console.log('[ReactPanel] openPanel called');
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    const panel = vscode.window.createWebviewPanel(
      ReactPanel.viewType,
      'KCode AI',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._context.extensionPath, 'out', 'webview')),
        ],
      },
    );

    this._bridge.bindPanel(panel);
    this._setHtml(panel.webview);
    this._emitStatus();
    console.log('[ReactPanel] panel created');
  }

  private _setHtml(webview: vscode.Webview) {
    const webviewDir = vscode.Uri.file(
      path.join(this._context.extensionPath, 'out', 'webview'),
    );
    const assetsDir = webviewDir.with({ path: path.join(webviewDir.path, 'assets') });
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, 'style.css'));

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-eval'`,
      `img-src ${webview.cspSource} data: https:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    webview.html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>KCode AI</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _launcherHtml(): string {
    return `<!DOCTYPE html>
<html>
<body style="background:#0d0f14;color:#e6e7ea;padding:16px;font-family:-apple-system,sans-serif;font-size:13px;text-align:center">
  <h2 style="color:#04d361;font-size:16px;margin:24px 0 8px">KCode AI</h2>
  <p style="color:#808080;font-size:12px;margin:0 0 20px">VS Code AI 编码助手</p>
  <button id="openBtn" style="background:#04d361;color:#000;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">打开 KCode AI</button>
  <script nonce="react">
    document.getElementById('openBtn').addEventListener('click', function() {
      acquireVsCodeApi().postMessage({command:'openReactView'});
    });
  </script>
</body>
</html>`;
  }

  private _emitStatus() {
    this._bridge.emit('engine:status', {
      connected: false,
      agentName: '',
      modelName: '',
    });
  }
}
