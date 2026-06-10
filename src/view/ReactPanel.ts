import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewBridge } from '../adapters/WebviewBridge';
import { EngineAdapter } from '../adapters/EngineAdapter';
import type { AgentService } from '../core/AgentService';
import type { TaskStore } from '../store/TaskStore';

/**
 * ReactPanel — 新版 React Webview（全屏 WebviewPanel）
 *
 * 点击活动栏图标 → resolveWebviewView 打开全屏 Panel。
 * 侧边栏 view 本身仅作启动跳板，渲染在 WebviewPanel 中。
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
    // 侧边栏内显示一个启动提示，同时打开全屏 Panel
    webviewView.webview.html = this._loadingHtml();
    this._openPanel();
  }

  private _openPanel() {
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
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _loadingHtml(): string {
    return `<!DOCTYPE html>
<html><body style="background:#0d0f14;color:#808080;padding:16px;font-family:sans-serif;font-size:13px">
  <p>KCode AI 面板已打开 →</p>
</body></html>`;
  }

  private _emitStatus() {
    this._bridge.emit('engine:status', {
      connected: false,
      agentName: '',
      modelName: '',
    });
  }
}
