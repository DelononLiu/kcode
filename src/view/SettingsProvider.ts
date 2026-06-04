import * as vscode from 'vscode';
import { ConfigService } from '../core/ConfigService';

export class SettingsProvider {
    static readonly viewType = 'kcode.settingsPanel';
    readonly panel: vscode.WebviewPanel;

    private configService: ConfigService;
    private onDisposeCallback?: () => void;
    private onConfigSaved?: () => void;

    constructor(context: vscode.ExtensionContext, configService: ConfigService, onConfigSaved?: () => void) {
        this.configService = configService;
        this.onConfigSaved = onConfigSaved;

        this.panel = vscode.window.createWebviewPanel(
            SettingsProvider.viewType,
            'KCode 设置',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out'),
                    vscode.Uri.joinPath(context.extensionUri, 'src', 'view', 'webview'),
                ],
            }
        );
        this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'kcode.png');

        this.panel.webview.html = this._getHtml(this.panel.webview, context.extensionUri);
        this._setupMessageHandler(context);
        this._sendConfig();

        this.panel.onDidDispose(() => {
            this.onDisposeCallback?.();
        });
    }

    reveal(): void {
        this.panel.reveal();
    }

    onDidDispose(callback: () => void): void {
        this.onDisposeCallback = callback;
    }

    private _setupMessageHandler(context: vscode.ExtensionContext): void {
        this.panel.webview.onDidReceiveMessage(async (msg: any) => {
            switch (msg.type) {
                case 'loadConfig': {
                    await this.configService.load();
                    this._sendConfig();
                    break;
                }
                case 'updateConfig': {
                    if (msg.config) {
                        this.configService.updateDraft(msg.config);
                    }
                    break;
                }
                case 'saveConfig': {
                    try {
                        await this.configService.save();
                        this._sendConfig();
                        this.panel.webview.postMessage({ type: 'configSaved' });
                        this.onConfigSaved?.();
                    } catch (e) {
                        this.panel.webview.postMessage({
                            type: 'configUpdateFailed',
                            error: `保存失败: ${(e as Error).message}`,
                        });
                    }
                    break;
                }
                case 'discardConfig': {
                    this.configService.discardDraft();
                    this._sendConfig();
                    this.panel.webview.postMessage({ type: 'configDiscarded' });
                    break;
                }
                case 'exportConfig': {
                    try {
                        const json = await this.configService.exportConfig();
                        const doc = await vscode.workspace.openTextDocument({
                            content: json,
                            language: 'json',
                        });
                        await vscode.window.showTextDocument(doc);
                    } catch (e) {
                        vscode.window.showErrorMessage(`导出失败: ${(e as Error).message}`);
                    }
                    break;
                }
                case 'importConfig': {
                    if (!msg.json) return;
                    const result = await this.configService.importConfig(msg.json);
                    if (result.ok) {
                        this._sendConfig();
                        this.panel.webview.postMessage({ type: 'configImportDone' });
                    } else {
                        this.panel.webview.postMessage({
                            type: 'configUpdateFailed',
                            error: result.error,
                        });
                    }
                    break;
                }
                case 'openFile': {
                    const target = msg.target === 'global'
                        ? this.configService.globalPath
                        : this.configService.projectPath;
                    if (target) {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
                        await vscode.window.showTextDocument(doc);
                    }
                    break;
                }
            }
        }, null, context.subscriptions);
    }

    private _sendConfig(): void {
        const cfg = this.configService.config;
        const draft = this.configService.draft;
        const isDirty = this.configService.isDirty;
        this.panel.webview.postMessage({
            type: 'configLoaded',
            config: cfg,
            draft,
            isDirty,
            globalPath: this.configService.globalPath,
            projectPath: this.configService.projectPath,
        });
    }

    private _getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview', 'settingsApp.js')
        ).toString();
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>KCode 设置</title>
    <style nonce="${nonce}">
        :root {
            --border: var(--vscode-panel-border, rgba(128,128,128,.35));
            --bg: var(--vscode-sideBar-background, #1e1e1e);
            --bg-alt: var(--vscode-editor-background, #1e1e1e);
            --text: var(--vscode-foreground, #cccccc);
            --text-secondary: var(--vscode-descriptionForeground, #969696);
            --input-bg: var(--vscode-input-background, #3c3c3c);
            --input-border: var(--vscode-input-border, transparent);
            --input-fg: var(--vscode-input-foreground, #cccccc);
            --btn-bg: var(--vscode-button-background, #0e639c);
            --btn-fg: var(--vscode-button-foreground, #ffffff);
            --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
            --btn-secondary: var(--vscode-button-secondaryBackground, #3a3d41);
            --btn-secondary-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
            --focus-border: var(--vscode-focusBorder, #007fd4);
            --badge-bg: var(--vscode-badge-background, #4d4d4d);
            --badge-fg: var(--vscode-badge-foreground, #ffffff);
            --scrollbar-shadow: var(--vscode-scrollbar-shadow, #00000033);
            font-size: 13px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        #header { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--border); gap: 12px; flex-shrink: 0; background: var(--bg); }
        #header h1 { font-size: 15px; font-weight: 600; flex: 1; }
        #header-actions { display: flex; gap: 8px; align-items: center; }
        #content { display: flex; flex: 1; overflow: hidden; }
        #tabs { width: 160px; flex-shrink: 0; border-right: 1px solid var(--border); overflow-y: auto; padding: 8px 0; }
        .tab-btn { display: block; width: 100%; padding: 8px 16px; text-align: left; background: none; border: none; color: var(--text); cursor: pointer; font-size: 13px; }
        .tab-btn:hover { background: rgba(128,128,128,.1); }
        .tab-btn.active { background: rgba(128,128,128,.15); border-left: 3px solid var(--btn-bg); font-weight: 600; }
        #panels { flex: 1; overflow-y: auto; padding: 16px 24px; }
        .settings-panel { display: none; }
        .settings-panel.active { display: block; }
        .settings-panel h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
        .settings-panel p.desc { color: var(--text-secondary); margin-bottom: 16px; font-size: 12px; }
        .field-group { margin-bottom: 16px; }
        .field-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
        .field-desc { display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 6px; }
        .field-input, .field-select { width: 100%; max-width: 400px; padding: 4px 8px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--input-border); outline: none; font-size: 13px; }
        .field-input:focus, .field-select:focus { border-color: var(--focus-border); }
        .field-input[type="checkbox"] { width: auto; }
        .field-number { width: 120px; }
        hr { border: none; border-top: 1px solid var(--border); margin: 16px 0; }
        #save-bar { display: none; position: sticky; bottom: 0; background: var(--bg); border-top: 1px solid var(--border); padding: 8px 16px; gap: 8px; align-items: center; flex-shrink: 0; }
        #save-bar.visible { display: flex; }
        #save-bar .save-status { flex: 1; font-size: 12px; color: var(--text-secondary); }
        .btn { padding: 4px 12px; border: none; cursor: pointer; font-size: 13px; }
        .btn-primary { background: var(--btn-bg); color: var(--btn-fg); }
        .btn-primary:hover { background: var(--btn-hover); }
        .btn-secondary { background: var(--btn-secondary); color: var(--text); }
        .btn-secondary:hover { background: var(--btn-secondary-hover); }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .error-msg { color: #f48771; font-size: 12px; padding: 4px 0; }
        .success-msg { color: #89d185; font-size: 12px; padding: 4px 0; }
        #file-links { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); }
        .file-link { display: block; padding: 4px 0; color: var(--btn-bg); cursor: pointer; font-size: 12px; }
        .file-link:hover { text-decoration: underline; }
        .inline-checkbox { display: flex; align-items: center; gap: 8px; }
        .inline-checkbox input { width: auto; }
        .inline-checkbox label { cursor: pointer; }
        .tag { display: inline-block; padding: 1px 6px; font-size: 11px; border-radius: 3px; background: var(--badge-bg); color: var(--badge-fg); }
        .device-list { margin-bottom: 12px; }
        .device-preview-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; margin-bottom: 4px; font-size: 12px; }
        .device-preview-icon { font-size: 14px; }
        .device-preview-name { flex: 1; font-weight: 500; }
        .device-preview-addr { color: var(--text-secondary); }
        .device-preview-user { color: var(--text-secondary); }
        .device-json-editor { width: 100%; max-width: 600px; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--input-border); padding: 8px; font-family: monospace; font-size: 12px; outline: none; resize: vertical; }
        .device-json-editor:focus { border-color: var(--focus-border); }
        .device-btn-row { display: flex; gap: 8px; margin-top: 8px; }
    </style>
</head>
<body>
    <div id="header">
        <h1>⚙ KCode 设置</h1>
        <div id="header-actions">
            <span id="dirty-indicator" class="tag" style="display:none;">未保存</span>
            <button class="btn btn-secondary" id="btn-import">导入</button>
            <button class="btn btn-secondary" id="btn-export">导出</button>
        </div>
    </div>
    <div id="content">
        <div id="tabs">
            <button class="tab-btn active" data-tab="agent">Agent</button>
            <button class="tab-btn" data-tab="provider">Provider</button>
            <button class="tab-btn" data-tab="log">ACP Log</button>
            <button class="tab-btn" data-tab="github">GitHub</button>
            <button class="tab-btn" data-tab="device">设备</button>
            <button class="tab-btn" data-tab="about">关于</button>
        </div>
        <div id="panels"></div>
    </div>
    <div id="save-bar">
        <span class="save-status">有未保存的更改</span>
        <button class="btn btn-secondary" id="btn-discard">放弃</button>
        <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 64; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
