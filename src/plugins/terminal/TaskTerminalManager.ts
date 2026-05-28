import * as vscode from 'vscode';
import { taskLogStore } from '../../store/TaskLogStore';
import type { TerminalLogEntry } from '../../types';

export class TaskTerminalManager {
    private _terminals = new Map<string, vscode.Terminal>();

    openReplay(taskId: string, taskTitle: string): void {
        const existing = this._terminals.get(taskId);
        if (existing) {
            existing.show();
            return;
        }

        const logs = taskLogStore.getTerminalLog(taskId);
        if (logs.length === 0) {
            vscode.window.showInformationMessage(`任务「${taskTitle}」暂无终端日志`);
            return;
        }

        let cancelled = false;
        const writeEmitter = new vscode.EventEmitter<string>();

        const pseudoterminal: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                writeEmitter.fire(`\x1b[33m⚡ 终端历史重放 — ${taskTitle}\x1b[0m\r\n`);
                writeEmitter.fire(`\x1b[2m共 ${logs.length} 条命令记录\x1b[0m\r\n\r\n`);
                this._replaySequence(logs, writeEmitter, taskId, taskTitle, 0, () => cancelled);
            },
            close: () => {
                cancelled = true;
                this._terminals.delete(taskId);
            },
            handleInput: () => {
                // read-only, ignore input
            },
        };

        const terminal = vscode.window.createTerminal({
            name: `📜 ${taskTitle} (重放)`,
            pty: pseudoterminal,
        });

        this._terminals.set(taskId, terminal);
        terminal.show();
    }

    private _replaySequence(
        logs: TerminalLogEntry[],
        writeEmitter: vscode.EventEmitter<string>,
        taskId: string,
        taskTitle: string,
        idx: number,
        isCancelled: () => boolean,
    ): void {
        if (isCancelled()) return;

        if (idx >= logs.length) {
            writeEmitter.fire(`\r\n\x1b[32m✅ 重放完成 (${logs.length}/${logs.length})\x1b[0m\r\n`);
            writeEmitter.fire(`\x1b[2m💡 终端为只读重放，如需重新执行请创建新任务\x1b[0m\r\n`);
            return;
        }

        const entry = logs[idx];
        const dir = entry.cwd || '~';
        const header = `\x1b[36m[${idx + 1}/${logs.length}] $ ${entry.command}\x1b[0m\r\n`;
        const cwdLine = `\x1b[2m  📂 ${dir}\x1b[0m\r\n`;
        writeEmitter.fire(header);
        writeEmitter.fire(cwdLine);

        const outputLines = entry.output.split('\n');
        let lineIdx = 0;
        const writeNextLine = () => {
            if (isCancelled()) return;
            if (lineIdx >= outputLines.length) {
                const exitColor = entry.exitCode === 0 ? '32' : '31';
                writeEmitter.fire(`\x1b[${exitColor}m➜ 退出码: ${entry.exitCode}\x1b[0m\r\n\r\n`);
                setTimeout(() => this._replaySequence(logs, writeEmitter, taskId, taskTitle, idx + 1, isCancelled), 300);
                return;
            }
            writeEmitter.fire(outputLines[lineIdx] + '\r\n');
            lineIdx++;
            setTimeout(writeNextLine, 10);
        };
        writeNextLine();
    }

    hasLogs(taskId: string): boolean {
        return taskLogStore.getTerminalLog(taskId).length > 0;
    }

    getLogCount(taskId: string): number {
        return taskLogStore.getTerminalLog(taskId).length;
    }

    dispose(): void {
        for (const [, terminal] of this._terminals) {
            try { terminal.dispose(); } catch { /* ignore */ }
        }
        this._terminals.clear();
    }
}
