import * as vscode from 'vscode';
import { getWebviewContent } from './templates/knowledgeHtml';
import type { TaskStore } from '../store/TaskStore';

export class KnowledgePanel {
    static readonly viewType = 'kcode.knowledgePanel';

    private panel: vscode.WebviewPanel;
    private store: TaskStore;
    private onDisposeCallback?: () => void;

    constructor(context: vscode.ExtensionContext, store: TaskStore, focusEntryId?: string) {
        this.store = store;

        this.panel = vscode.window.createWebviewPanel(
            KnowledgePanel.viewType,
            '知识库',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'out'),
                ]
            }
        );
        this.panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'kcode.png');

        this.panel.webview.html = getWebviewContent(this.panel.webview, context.extensionUri);

        this.panel.webview.onDidReceiveMessage((msg: any) => {
            if (msg.type === 'ready') {
                this._sendData(focusEntryId);
            }
        }, null, context.subscriptions);

        this.panel.onDidDispose(() => {
            this.onDisposeCallback?.();
        });
    }

    private _sendData(focusId?: string) {
        const allEntries = this.store.getAllKnowledgeEntries();
        this.panel.webview.postMessage({
            type: 'updateKnowledgeList',
            entries: allEntries,
            focusId: focusId || undefined,
        });
    }

    refresh(focusEntryId?: string) {
        this._sendData(focusEntryId);
    }

    reveal() {
        this.panel.reveal();
    }

    focusEntry(entryId: string) {
        this.reveal();
        this._sendData(entryId);
    }

    onDidDispose(callback: () => void) {
        this.onDisposeCallback = callback;
    }

    dispose() {
        this.panel.dispose();
    }
}
