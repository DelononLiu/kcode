import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';

const plugin: KCodePlugin = {
    id: 'kcode.diff',
    name: 'Diff Viewer',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.onMessage('showFileDiff', (msg: any) => {
            const router = api.getRouter();
            router.PostMessage({ type: 'showDiff', original: msg.original, modified: msg.modified });
        });

        api.onMessage('openNativeDiff', (msg: any) => {
            const { original, modified, filePath } = msg;
            const ext = path.extname(filePath) || '.txt';
            const baseName = path.basename(filePath, ext);
            const timestamp = Date.now();
            vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_original${ext}`)), Buffer.from(original));
            vscode.workspace.fs.writeFile(vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_modified${ext}`)), Buffer.from(modified));
            vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_original${ext}`)),
                vscode.Uri.file(path.join(os.tmpdir(), `kcode_${baseName}_${timestamp}_modified${ext}`)),
                `变更对比: ${baseName}${ext}`);
        });

        api.addOutputPanelTab('diff', '📄 代码', (taskInfo: any) => {
            return '<div class="op-empty">Diff plugin active</div>';
        });
    },

    deactivate() {},
};

export default plugin;
