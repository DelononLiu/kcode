import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
}));

import { KCodeClient } from '../callbacks';

describe('KCodeClient', () => {
    let client: KCodeClient;

    beforeEach(() => {
        vi.clearAllMocks();
        client = new KCodeClient('/workspace');
    });

    describe('setSessionHandler / removeSessionHandler', () => {
        it('set/remove round-trip', () => {
            const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
            client.setSessionHandler('s1', handler);
            client.removeSessionHandler('s1');
            const msg: any = {
                sessionId: 's1',
                update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } },
            };
            client.sessionUpdate(msg);
            expect(handler.onText).not.toHaveBeenCalled();
        });
    });

    describe('setCurrentSession', () => {
        it('初始化 session 的变更列表', () => {
            client.setCurrentSession('s1');
            expect(client.getSessionChanges('s1')).toEqual([]);
        });

        it('重复调用不覆盖已有变更', () => {
            client.setCurrentSession('s1');
            client.getSessionChanges('s1').push({ filePath: 'a.ts', original: '', modified: 'b' });
            client.setCurrentSession('s1');
            expect(client.getSessionChanges('s1')).toHaveLength(1);
        });
    });

    describe('awaitSessionIdle', () => {
        it('无更新时立即返回', async () => {
            await expect(client.awaitSessionIdle('s1')).resolves.not.toThrow();
        });
    });

    describe('requestPermission', () => {
        it('auto-accept 第一个选项', async () => {
            const result = await client.requestPermission({
                sessionId: 's1',
                permissions: [],
                options: [{ optionId: 'allow', label: 'Allow' }],
            } as any);
            expect((result.outcome as any).outcome).toBe('selected');
            expect((result.outcome as any).optionId).toBe('allow');
        });
    });

    describe('sessionUpdate', () => {
        it('agent_message_chunk 触发 onText', async () => {
            const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn() };
            client.setSessionHandler('s1', handler);
            await client.sessionUpdate({
                sessionId: 's1',
                update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hello' } },
            } as any);
            expect(handler.onText).toHaveBeenCalledWith('hello');
        });

        it('tool_call 触发 onToolCall', async () => {
            const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn(), onToolCall: vi.fn() };
            client.setSessionHandler('s1', handler);
            await client.sessionUpdate({
                sessionId: 's1',
                update: { sessionUpdate: 'tool_call', toolCallId: 'tc1', kind: 'bash' },
            } as any);
            expect(handler.onToolCall).toHaveBeenCalledWith('tc1', expect.any(String), 'bash', 'pending');
        });

        it('plan 触发 onPlan', async () => {
            const handler = { onText: vi.fn(), onError: vi.fn(), onDone: vi.fn(), onPlan: vi.fn() };
            client.setSessionHandler('s1', handler);
            const entries = [{ content: 'step1', priority: 'high', status: 'pending' }];
            await client.sessionUpdate({
                sessionId: 's1',
                update: { sessionUpdate: 'plan', entries },
            } as any);
            expect(handler.onPlan).toHaveBeenCalledWith(entries);
        });
    });

    describe('writeTextFile', () => {
        it('新文件写入记录变更（original 为空）', async () => {
            (fs.readFileSync as any).mockImplementation(() => { throw new Error('not found'); });
            client.setCurrentSession('s1');
            await client.writeTextFile({ path: '/workspace/new.ts', content: 'code' } as any);
            expect(fs.writeFileSync).toHaveBeenCalledWith('/workspace/new.ts', 'code', 'utf-8');
            const changes = client.getSessionChanges('s1');
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({ filePath: '/workspace/new.ts', original: '', modified: 'code' });
        });

        it('修改文件记录变更', async () => {
            (fs.readFileSync as any).mockReturnValue('old');
            client.setCurrentSession('s1');
            await client.writeTextFile({ path: '/workspace/a.ts', content: 'new' } as any);
            const changes = client.getSessionChanges('s1');
            expect(changes).toHaveLength(1);
            expect(changes[0]).toEqual({ filePath: '/workspace/a.ts', original: 'old', modified: 'new' });
        });

        it('内容相同不记录变更', async () => {
            (fs.readFileSync as any).mockReturnValue('same');
            client.setCurrentSession('s1');
            await client.writeTextFile({ path: '/workspace/a.ts', content: 'same' } as any);
            expect(client.getSessionChanges('s1')).toEqual([]);
        });
    });

    describe('readTextFile', () => {
        it('读取文件内容', async () => {
            (fs.readFileSync as any).mockReturnValue('file content');
            const result = await client.readTextFile({ path: '/workspace/a.ts' } as any);
            expect(result.content).toBe('file content');
        });
    });

    describe('resolvePath', () => {
        it('绝对路径不做处理', () => {
            expect((client as any).resolvePath('/abs/path.ts')).toBe('/abs/path.ts');
        });

        it('相对路径拼接 workspaceRoot', () => {
            expect((client as any).resolvePath('rel/path.ts')).toBe('/workspace/rel/path.ts');
        });
    });
});
