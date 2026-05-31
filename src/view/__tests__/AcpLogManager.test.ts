import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AcpLogManager } from '../AcpLogManager';
import { MessageRouter } from '../MessageRouter';

describe('AcpLogManager', () => {
    let router: MessageRouter;
    let postSpy: any;

    beforeEach(() => {
        vi.useFakeTimers();
        router = new MessageRouter();
        postSpy = vi.fn();
        router.PostMessage = postSpy as any;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('disabled 时不发送日志', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = false;
        mgr.send('t1', 'send', 'hello');
        expect(postSpy).not.toHaveBeenCalled();
    });

    it('send 方向立即 postMessage', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.send('t1', 'send', 'log line');
        expect(postSpy).toHaveBeenCalledWith(
            expect.objectContaining({ direction: 'send', text: 'log line', taskId: 't1' })
        );
    });

    it('recv 方向缓冲行数据', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.send('t1', 'recv', 'line1\nline2\n');
        expect(postSpy).toHaveBeenCalledTimes(2);
        expect(postSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: 'line1' }));
        expect(postSpy).toHaveBeenNthCalledWith(2, expect.objectContaining({ text: 'line2' }));
    });

    it('recv 不完整行暂存到 buffer', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.send('t1', 'recv', 'incomplete_line');
        expect(postSpy).not.toHaveBeenCalled();
    });

    it('flush 发送剩余 buffer', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.send('t1', 'recv', 'buffered');
        postSpy.mockClear();
        mgr.flush('t1');
        expect(postSpy).toHaveBeenCalledWith(
            expect.objectContaining({ text: 'buffered', direction: 'recv' })
        );
    });

    it('flush 空 buffer 不发送', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.flush('t1');
        expect(postSpy).not.toHaveBeenCalled();
    });

    it('dispose 清除定时器', () => {
        const mgr = new AcpLogManager(router);
        mgr.enabled = true;
        mgr.send('t1', 'recv', 'data');
        postSpy.mockClear();
        mgr.dispose();
        vi.advanceTimersByTime(500);
        expect(postSpy).not.toHaveBeenCalled();
    });
});
