import { describe, it, expect } from 'vitest';
import { AppState } from '../state';

describe('AppState', () => {
    it('初始 activeTaskId 为 null', () => {
        expect(AppState.activeTaskId).toBeNull();
    });

    it('初始状态字符串为空', () => {
        expect(AppState.activeTaskStatus).toBe('');
        expect(AppState.activeTaskType).toBe('');
        expect(AppState.activeTaskPhase).toBe('');
    });

    it('初始 acpLogEnabled 为 false', () => {
        expect(AppState.acpLogEnabled).toBe(false);
        expect(AppState.acpLogEntries).toEqual([]);
        expect(AppState.acpLogMaxGlobal).toBe(5000);
        expect(AppState.acpLogMaxTask).toBe(2000);
    });

    it('初始 reviewChangesMap 为空 Map', () => {
        expect(AppState.reviewChangesMap).toBeInstanceOf(Map);
        expect(AppState.reviewChangesMap.size).toBe(0);
    });

    it('初始 categoryDefs 为空数组', () => {
        expect(AppState.categoryDefs).toEqual([]);
        expect(AppState.selectedCategory).toBeNull();
        expect(AppState.selectedSubType).toBeNull();
    });
});
