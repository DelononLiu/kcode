import { describe, it, expect } from 'vitest';
import { getInlineStyles } from '../chatPanelCss';

describe('getInlineStyles', () => {
    it('返回非空 CSS 字符串', () => {
        const css = getInlineStyles();
        expect(css).toBeTruthy();
        expect(typeof css).toBe('string');
        expect(css.length).toBeGreaterThan(100);
    });

    it('包含关键布局类名', () => {
        const css = getInlineStyles();
        expect(css).toContain('chat-area');
        expect(css).toContain('chat-messages');
        expect(css).toContain('chat-header');
        expect(css).toContain('msg-card');
    });

    it('包含 CSS 变量定义', () => {
        const css = getInlineStyles();
        expect(css).toContain('--card-radius');
        expect(css).toContain('--tool-color-bash');
        expect(css).toContain('--tool-color-read');
    });
});
