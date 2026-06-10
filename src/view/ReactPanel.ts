import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewBridge } from '../adapters/WebviewBridge';
import { EngineAdapter } from '../adapters/EngineAdapter';
import type { AgentService } from '../core/AgentService';
import type { TaskStore } from '../store/TaskStore';

/**
 * ReactPanel — 新版 React Webview Panel
 *
 * 读取 Vite 构建产物（out/webview/assets/），注入到 Webview 中。
 * Bridge 通信层通过 WebviewBridge + EngineAdapter 对接 kcode 后端服务。
 */
export class ReactPanel {
  public static readonly viewType = 'kcode.reactView';

  private _panel: vscode.WebviewPanel | null = null;
  private _bridge: WebviewBridge;
  private _engineAdapter: EngineAdapter;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private _context: vscode.ExtensionContext,
    agentService: AgentService,
    taskStore: TaskStore,
  ) {
    this._bridge = new WebviewBridge();
    this._engineAdapter = new EngineAdapter(this._bridge, agentService, taskStore);
    this._engineAdapter.registerAll();
  }

  /** 创建并显示 Webview Panel */
  public static createOrShow(context: vscode.ExtensionContext, agentService: AgentService, taskStore: TaskStore) {
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
          vscode.Uri.file(path.join(context.extensionPath, 'out', 'webview')),
        ],
      },
    );

    const instance = new ReactPanel(context, agentService, taskStore);
    instance._panel = panel;
    instance._bridge.bind(panel);
    instance._setHtml(panel);

    // 通知状态
    instance._bridge.emit('engine:status', {
      connected: agentService.isConnected,
      agentName: agentService.agentName,
      modelName: agentService.modelName,
    });

    instance._disposables.push(
      panel.onDidDispose(() => instance.dispose()),
    );
    return instance;
  }

  private _setHtml(panel: vscode.WebviewPanel) {
    const webview = panel.webview;
    const webviewDir = vscode.Uri.file(
      path.join(this._context.extensionPath, 'out', 'webview'),
    );

    const assetsDir = webviewDir.with({ path: path.join(webviewDir.path, 'assets') });
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(assetsDir, 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(assetsDir, 'style.css'),
    );

    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'unsafe-eval'`,
      `img-src ${webview.cspSource} data: https:`,
      `font-src ${webview.cspSource}`,
    ].join('; ');

    panel.webview.html = `<!DOCTYPE html>
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

  dispose() {
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }
}
