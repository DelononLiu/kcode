import { describe, it, expect } from 'vitest';
import { getCategories, getCategory } from '../templates';

describe('templates', () => {
    it('getCategories returns all 5 categories', () => {
        const cats = getCategories();
        expect(cats).toHaveLength(5);
        const keys = cats.map(c => c.key);
        expect(keys).toContain('requirement_dev');
        expect(keys).toContain('code_review');
        expect(keys).toContain('problem_analysis');
        expect(keys).toContain('defect_analysis');
        expect(keys).toContain('log_analysis');
    });

    it('getCategory returns correct category', () => {
        const cat = getCategory('requirement_dev');
        expect(cat).toBeDefined();
        expect(cat!.label).toBe('需求开发');
        expect(cat!.inputFields).toBeDefined();
        expect(cat!.acceptanceCriteria!.length).toBeGreaterThan(0);
    });

    it('getCategory returns undefined for invalid key', () => {
        expect(getCategory('nonexistent' as never)).toBeUndefined();
    });
});
