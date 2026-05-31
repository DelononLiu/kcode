// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderMarkdown, escapeHtml } from '../markdownRenderer';

describe('escapeHtml', () => {
    it('escapes & < >', () => {
        expect(escapeHtml('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d');
    });

    it('passes through plain text', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });
});

describe('renderMarkdown', () => {
    it('renders bold text', () => {
        const html = renderMarkdown('**bold**');
        expect(html).toContain('<strong>bold</strong>');
    });

    it('renders code blocks with highlight.js', () => {
        const html = renderMarkdown('```ts\nconst x = 1;\n```');
        expect(html).toContain('hljs');
        expect(html).toContain('code-block-wrapper');
    });

    it('renders inline code', () => {
        const html = renderMarkdown('use `code` inline');
        expect(html).toContain('<code>');
    });

    it('renders paragraphs', () => {
        const html = renderMarkdown('line1\n\nline2');
        expect(html).toContain('<p>line1</p>');
    });

    it('handles empty string', () => {
        expect(renderMarkdown('')).toBe('');
    });
});
