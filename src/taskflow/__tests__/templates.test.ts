import { describe, it, expect } from 'vitest';
import { getCategories, getCategory, getTemplate } from '../templates';

describe('templates', () => {
    it('getCategories returns all 4 categories', () => {
        const cats = getCategories();
        expect(cats).toHaveLength(4);
        const keys = cats.map(c => c.key);
        expect(keys).toContain('requirement_dev');
        expect(keys).toContain('problem_analysis');
        expect(keys).toContain('performance_opt');
        expect(keys).toContain('defect_analysis');
    });

    it('getCategory returns correct category', () => {
        const cat = getCategory('requirement_dev');
        expect(cat).toBeDefined();
        expect(cat!.label).toBe('需求开发');
        expect(cat!.subTypes.feature_dev).toBeDefined();
        expect(cat!.subTypes.feature_dev.label).toBe('新增功能开发');
    });

    it('getCategory returns undefined for invalid key', () => {
        expect(getCategory('nonexistent' as never)).toBeUndefined();
    });

    it('getTemplate returns correct template', () => {
        const tmpl = getTemplate('requirement_dev', 'feature_dev');
        expect(tmpl).toBeDefined();
        expect(tmpl!.label).toBe('新增功能开发');
        expect(tmpl!.inputFields).toHaveLength(3);
        expect(tmpl!.acceptanceCriteria!.length).toBeGreaterThan(0);
    });

    it('getTemplate returns undefined for invalid subType', () => {
        const tmpl = getTemplate('requirement_dev', 'nonexistent');
        expect(tmpl).toBeUndefined();
    });

    it('getTemplate returns undefined for invalid category', () => {
        const tmpl = getTemplate('nonexistent' as never, 'feature_dev');
        expect(tmpl).toBeUndefined();
    });
});
