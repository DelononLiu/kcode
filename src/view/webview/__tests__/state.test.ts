import { describe, it, expect } from 'vitest';
import { G } from '../state';

describe('G', () => {
    it('初始 activeTaskId 为 null', () => {
        expect(G.activeTaskId).toBeNull();
    });

    it('初始状态字符串为空', () => {
        expect(G.activeTaskStatus).toBe('');
        expect(G.activeTaskType).toBe('');
        expect(G.activeTaskPhase).toBe('');
    });

    it('初始 acpLogEnabled 为 false', () => {
        expect(G.acpLogEnabled).toBe(false);
        expect(G.acpLogEntries).toEqual([]);
        expect(G.acpLogMaxGlobal).toBe(5000);
        expect(G.acpLogMaxTask).toBe(2000);
    });


});
