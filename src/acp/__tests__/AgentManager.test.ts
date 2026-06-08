import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { Writable, Readable, PassThrough } from 'stream';
import { AgentManager } from '../AgentManager';

vi.mock('vscode', () => ({
    window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
}));

vi.mock('../../env/NodeManager', () => ({
    getNodeBinDir: vi.fn().mockReturnValue(''),
    getNodeExePath: vi.fn().mockReturnValue(null),
    ensureNode: vi.fn().mockResolvedValue(null),
    needsManagedNode: vi.fn().mockResolvedValue(false),
}));

vi.mock('child_process', () => ({
    spawn: vi.fn(),
}));

function makeMockProcess() {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const proc: any = {
        stdin,
        stdout,
        stderr,
        killed: false,
        exitCode: null,
        kill: vi.fn((sig?: string) => {
            proc.killed = true;
            proc.emit('exit', null);
        }),
        on: vi.fn((event: string, cb: any) => {
            if (event === 'exit') proc._exitCb = cb;
            if (event === 'error') proc._errorCb = cb;
        }),
        emit: vi.fn((event: string, ...args: any[]) => {
            if (event === 'exit' && proc._exitCb) proc._exitCb(...args);
            if (event === 'error' && proc._errorCb) proc._errorCb(...args);
        }),
    };
    return proc;
}

describe('AgentManager', () => {
    let mgr: AgentManager;

    beforeEach(() => {
        mgr = new AgentManager();
        vi.clearAllMocks();
    });

    it('startAgent spawns child process', async () => {
        const mockProc = makeMockProcess();
        (spawn as any).mockReturnValue(mockProc);
        const result = await mgr.startAgent('node', ['script.js']);
        expect(spawn).toHaveBeenCalledWith('node', ['script.js'], expect.any(Object));
        expect(result.process).toBe(mockProc);
    });

    it('stopAgent kills process with SIGTERM', async () => {
        const mockProc = makeMockProcess();
        (spawn as any).mockReturnValue(mockProc);
        await mgr.startAgent('node', ['test.js']);
        mgr.stopAgent();
        expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('isRunning returns false when no process', () => {
        expect(mgr.isRunning()).toBe(false);
    });

    it('isRunning returns true when process is running', async () => {
        const mockProc = makeMockProcess();
        (spawn as any).mockReturnValue(mockProc);
        await mgr.startAgent('node', ['test.js']);
        expect(mgr.isRunning()).toBe(true);
    });

    it('startAgent stops previous process before starting new one', async () => {
        const proc1 = makeMockProcess();
        const proc2 = makeMockProcess();
        (spawn as any).mockReturnValueOnce(proc1).mockReturnValueOnce(proc2);
        await mgr.startAgent('node', ['a.js']);
        await mgr.startAgent('node', ['b.js']);
        expect(proc1.kill).toHaveBeenCalled();
    });
});
