import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskLogStore } from '../TaskLogStore';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('TaskLogStore', () => {
    let store: TaskLogStore;
    let rootDir: string;

    beforeEach(() => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kcode-test-'));
        store = new TaskLogStore(rootDir);
    });

    afterEach(() => {
        try { fs.rmSync(rootDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    // ===== TerminalLog =====

    it('appendTerminal / getTerminalLog round-trip', () => {
        store.appendTerminal('task_1', {
            id: 't1', command: 'ls -la', output: 'total 0', cwd: '/tmp', exitCode: 0, timestamp: 1000,
        });
        const logs = store.getTerminalLog('task_1');
        expect(logs).toHaveLength(1);
        expect(logs[0].command).toBe('ls -la');
        expect(logs[0].output).toBe('total 0');
        expect(logs[0].cwd).toBe('/tmp');
        expect(logs[0].exitCode).toBe(0);
        expect(logs[0].timestamp).toBe(1000);
    });

    it('appendTerminal 追加多条保持顺序', () => {
        store.appendTerminal('task_1', { id: 'a', command: 'echo 1', output: '1', cwd: '/', exitCode: 0, timestamp: 1 });
        store.appendTerminal('task_1', { id: 'b', command: 'echo 2', output: '2', cwd: '/', exitCode: 0, timestamp: 2 });
        store.appendTerminal('task_1', { id: 'c', command: 'echo 3', output: '3', cwd: '/', exitCode: 0, timestamp: 3 });
        const logs = store.getTerminalLog('task_1');
        expect(logs).toHaveLength(3);
        expect(logs[0].command).toBe('echo 1');
        expect(logs[1].command).toBe('echo 2');
        expect(logs[2].command).toBe('echo 3');
    });

    it('getTerminalLog 无日志返回空数组', () => {
        expect(store.getTerminalLog('nonexistent')).toEqual([]);
    });

    // ===== MessageLog =====

    it('appendMessage / getMessageLog round-trip', () => {
        store.appendMessage('task_1', {
            id: 'm1', role: 'user', content: 'hello', timestamp: 1000,
        });
        const logs = store.getMessageLog('task_1');
        expect(logs).toHaveLength(1);
        expect(logs[0].role).toBe('user');
        expect(logs[0].content).toBe('hello');
    });

    it('appendMessage 包含可选 type 字段', () => {
        store.appendMessage('task_1', {
            id: 'm2', role: 'agent', type: 'goal_confirmation', content: '目标已确认', timestamp: 2000,
        });
        const logs = store.getMessageLog('task_1');
        expect(logs[0].type).toBe('goal_confirmation');
    });

    it('getMessageLog 无日志返回空数组', () => {
        expect(store.getMessageLog('nonexistent')).toEqual([]);
    });

    // ===== FileLog =====

    it('appendFile / getFileLog round-trip', () => {
        store.appendFile('task_1', {
            id: 'f1', filePath: 'src/main.ts', operation: 'modified', original: 'a', modified: 'b', timestamp: 1000,
        });
        const logs = store.getFileLog('task_1');
        expect(logs).toHaveLength(1);
        expect(logs[0].filePath).toBe('src/main.ts');
        expect(logs[0].operation).toBe('modified');
    });

    it('appendFile 支持三种 operation', () => {
        const now = Date.now();
        store.appendFile('task_1', { id: 'f1', filePath: 'new.ts', operation: 'added', original: '', modified: 'c', timestamp: now });
        store.appendFile('task_1', { id: 'f2', filePath: 'mod.ts', operation: 'modified', original: 'a', modified: 'b', timestamp: now });
        store.appendFile('task_1', { id: 'f3', filePath: 'del.ts', operation: 'deleted', original: 'c', modified: '', timestamp: now });
        const logs = store.getFileLog('task_1');
        expect(logs.map(l => l.operation).sort()).toEqual(['added', 'deleted', 'modified']);
    });

    it('getFileLog 无日志返回空数组', () => {
        expect(store.getFileLog('nonexistent')).toEqual([]);
    });

    // ===== Clear =====

    it('clear 删除三类日志文件', () => {
        const tid = 'task_1';
        store.appendTerminal(tid, { id: 't1', command: 'ls', output: '', cwd: '/', exitCode: 0, timestamp: 1 });
        store.appendMessage(tid, { id: 'm1', role: 'user', content: 'hi', timestamp: 1 });
        store.appendFile(tid, { id: 'f1', filePath: 'x.ts', operation: 'modified', original: 'a', modified: 'b', timestamp: 1 });

        expect(store.getTerminalLog(tid)).toHaveLength(1);
        expect(store.getMessageLog(tid)).toHaveLength(1);
        expect(store.getFileLog(tid)).toHaveLength(1);

        store.clear(tid);

        expect(store.getTerminalLog(tid)).toEqual([]);
        expect(store.getMessageLog(tid)).toEqual([]);
        expect(store.getFileLog(tid)).toEqual([]);

        const logDir = path.join(rootDir, 'logs', tid);
        expect(fs.existsSync(path.join(logDir, 'terminal.jsonl'))).toBe(false);
        expect(fs.existsSync(path.join(logDir, 'message.jsonl'))).toBe(false);
        expect(fs.existsSync(path.join(logDir, 'file.jsonl'))).toBe(false);
    });

    it('clear 对空 task 不抛异常', () => {
        expect(() => store.clear('nonexistent')).not.toThrow();
    });

    // ===== 多任务隔离 =====

    it('不同 taskId 的日志互相隔离', () => {
        store.appendTerminal('task_a', { id: 't1', command: 'echo a', output: 'a', cwd: '/', exitCode: 0, timestamp: 1 });
        store.appendTerminal('task_b', { id: 't2', command: 'echo b', output: 'b', cwd: '/', exitCode: 0, timestamp: 2 });
        store.appendMessage('task_a', { id: 'm1', role: 'user', content: 'from a', timestamp: 3 });

        expect(store.getTerminalLog('task_a')).toHaveLength(1);
        expect(store.getTerminalLog('task_b')).toHaveLength(1);
        expect(store.getMessageLog('task_a')).toHaveLength(1);
        expect(store.getMessageLog('task_b')).toEqual([]);

        const aDir = path.join(rootDir, 'logs', 'task_a');
        const bDir = path.join(rootDir, 'logs', 'task_b');
        expect(fs.existsSync(path.join(aDir, 'terminal.jsonl'))).toBe(true);
        expect(fs.existsSync(path.join(bDir, 'terminal.jsonl'))).toBe(true);
        expect(fs.existsSync(path.join(aDir, 'message.jsonl'))).toBe(true);
        expect(fs.existsSync(path.join(bDir, 'message.jsonl'))).toBe(false);
    });

    // ===== JSONL 格式验证 =====

    it('文件格式是逐行 JSON（JSONL）', () => {
        store.appendTerminal('task_1', { id: 't1', command: 'echo a', output: 'a', cwd: '/', exitCode: 0, timestamp: 1 });
        store.appendTerminal('task_1', { id: 't2', command: 'echo b', output: 'b', cwd: '/', exitCode: 0, timestamp: 2 });

        const filePath = path.join(rootDir, 'logs', 'task_1', 'terminal.jsonl');
        const raw = fs.readFileSync(filePath, 'utf-8');
        const lines = raw.split('\n').filter(l => l.trim());
        expect(lines).toHaveLength(2);

        for (const line of lines) {
            const parsed = JSON.parse(line);
            expect(parsed).toHaveProperty('id');
            expect(parsed).toHaveProperty('command');
            expect(parsed).toHaveProperty('output');
            expect(parsed).toHaveProperty('cwd');
            expect(parsed).toHaveProperty('exitCode');
            expect(parsed).toHaveProperty('timestamp');
        }
    });

    // ===== 大文本内容 =====

    it('处理包含换行的 output 内容', () => {
        const multiLine = 'line1\nline2\nline3\n';
        store.appendTerminal('task_1', {
            id: 't1', command: 'cat file', output: multiLine, cwd: '/', exitCode: 0, timestamp: 1,
        });
        const logs = store.getTerminalLog('task_1');
        expect(logs[0].output).toBe(multiLine);

        const filePath = path.join(rootDir, 'logs', 'task_1', 'terminal.jsonl');
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content.trim());
        expect(parsed.output).toBe(multiLine);
    });
});
