import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TerminalLogEntry, MessageLogEntry, FileLogEntry } from '../types';

function defaultRoot(): string {
    return path.join(os.homedir(), '.kcode');
}

export class TaskLogStore {
    private _root: string;

    constructor(rootDir?: string) {
        this._root = rootDir || defaultRoot();
    }

    private _logsDir(taskId: string): string {
        const dir = path.join(this._root, 'logs', taskId);
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    private _appendJsonl(filePath: string, entry: Record<string, unknown>): void {
        fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');
    }

    private _readJsonl(filePath: string): string[] {
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        return content.split('\n').filter(l => l.trim().length > 0);
    }

    // ===== Terminal Log =====

    appendTerminal(taskId: string, entry: TerminalLogEntry): void {
        const filePath = path.join(this._logsDir(taskId), 'terminal.jsonl');
        this._appendJsonl(filePath, entry as unknown as Record<string, unknown>);
    }

    getTerminalLog(taskId: string): TerminalLogEntry[] {
        const filePath = path.join(this._logsDir(taskId), 'terminal.jsonl');
        const lines = this._readJsonl(filePath);
        return lines.map(l => { try { return JSON.parse(l) as TerminalLogEntry; } catch { return null; } }).filter((e): e is TerminalLogEntry => e !== null);
    }

    // ===== Message Log =====

    appendMessage(taskId: string, entry: MessageLogEntry): void {
        const filePath = path.join(this._logsDir(taskId), 'message.jsonl');
        this._appendJsonl(filePath, entry as unknown as Record<string, unknown>);
    }

    getMessageLog(taskId: string): MessageLogEntry[] {
        const filePath = path.join(this._logsDir(taskId), 'message.jsonl');
        const lines = this._readJsonl(filePath);
        return lines.map(l => { try { return JSON.parse(l) as MessageLogEntry; } catch { return null; } }).filter((e): e is MessageLogEntry => e !== null);
    }

    // ===== File Log =====

    appendFile(taskId: string, entry: FileLogEntry): void {
        const filePath = path.join(this._logsDir(taskId), 'file.jsonl');
        this._appendJsonl(filePath, entry as unknown as Record<string, unknown>);
    }

    getFileLog(taskId: string): FileLogEntry[] {
        const filePath = path.join(this._logsDir(taskId), 'file.jsonl');
        const lines = this._readJsonl(filePath);
        return lines.map(l => { try { return JSON.parse(l) as FileLogEntry; } catch { return null; } }).filter((e): e is FileLogEntry => e !== null);
    }

    // ===== Clear =====

    clear(taskId: string): void {
        const dir = this._logsDir(taskId);
        try {
            for (const file of ['terminal.jsonl', 'message.jsonl', 'file.jsonl']) {
                const fp = path.join(dir, file);
                if (fs.existsSync(fp)) fs.unlinkSync(fp);
            }
        } catch { /* ignore */ }
    }
}

export const taskLogStore = new TaskLogStore();
