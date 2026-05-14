import { describe, it, expect } from 'vitest';
import { extractPhaseSection } from '../externalPrompts';

describe('extractPhaseSection', () => {
    it('提取匹配 phase 标签的内容', () => {
        const content = '<plan>\n计划必须包含测试策略\n</plan>';
        expect(extractPhaseSection(content, 'plan')).toBe('计划必须包含测试策略');
    });

    it('不匹配的 phase 返回空字符串', () => {
        const content = '<plan>内容</plan>';
        expect(extractPhaseSection(content, 'execute')).toBe('');
    });

    it('处理多行内容', () => {
        const content = '<execute>\n步骤1\n步骤2\n</execute>';
        expect(extractPhaseSection(content, 'execute')).toBe('步骤1\n步骤2');
    });

    it('多个 phase 只提取目标 phase', () => {
        const content = '<plan>计划内容</plan>\n\n<execute>执行内容</execute>';
        expect(extractPhaseSection(content, 'execute')).toBe('执行内容');
    });

    it('无标签的空内容返回空字符串', () => {
        expect(extractPhaseSection('', 'plan')).toBe('');
    });

    it('不闭合标签返回空字符串', () => {
        const content = '<plan>未闭合内容';
        expect(extractPhaseSection(content, 'plan')).toBe('');
    });
});
