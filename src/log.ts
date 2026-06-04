import * as vscode from 'vscode';

let _channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
    if (!_channel) {
        _channel = vscode.window.createOutputChannel('KCode');
    }
    return _channel;
}

export function log(tag: string, message: string, alsoConsole = true): void {
    const line = `[${new Date().toLocaleTimeString()}] [${tag}] ${message}`;
    if (alsoConsole) console.log(line);
    try {
        getChannel().appendLine(line);
    } catch {}
}
