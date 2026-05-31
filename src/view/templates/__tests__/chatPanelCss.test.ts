import { describe, it, expect } from 'vitest';
import { getInlineStyles } from '../chatPanelCss';

function findRule(css: string, selector: string): string | null {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = css.match(new RegExp(`${escaped}\\{([^}]+)\\}`, 'i'));
    return m ? m[1] : null;
}

describe('getInlineStyles', () => {
    it('returns non-empty CSS string', () => {
        const css = getInlineStyles();
        expect(css).toBeTruthy();
        expect(typeof css).toBe('string');
        expect(css.length).toBeGreaterThan(100);
    });

    it('assistant-view is visible by default (no display:none)', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '#assistant-view');
        expect(rule).not.toBeNull();
        expect(rule).not.toContain('display:none');
    });

    it('task-view is hidden by default (display:none)', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '#task-view');
        expect(rule).not.toBeNull();
        expect(rule).toContain('display:none');
    });

    it('contains V3 layout classes', () => {
        const css = getInlineStyles();
        expect(css).toContain('init-space');
        expect(css).toContain('app-container');
        expect(css).toContain('sidebar-rail');
        expect(css).toContain('main-task-board');
        expect(css).toContain('monitor-tower');
        expect(css).toContain('task-row');
        expect(css).toContain('chat-messages');
    });

    it('contains V3 design tokens', () => {
        const css = getInlineStyles();
        expect(css).toContain('--bg-deep');
        expect(css).toContain('--bg-panel');
        expect(css).toContain('--accent');
        expect(css).toContain('--border');
        expect(css).toContain('--text-main');
    });

    it('contains stage and rail styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('stage-node');
        expect(css).toContain('rail-track');
        expect(css).toContain('rail-track-active');
        expect(css).toContain('task-header');
        expect(css).toContain('task-body');
    });

    it('contains monitor tower styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('monitor-tower');
        expect(css).toContain('tower-card');
        expect(css).toContain('panel-section-title');
        expect(css).toContain('diff-file-row');
        expect(css).toContain('wiki-incubator-box');
    });

    it('contains Demo card styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.demo-card');
        expect(css).toContain('.demo-card-output');
        expect(css).toContain('.demo-card-status-badge');
        expect(css).toContain('.demo-card-status-badge.running');
        expect(css).toContain('.demo-card-status-badge.completed');
        expect(css).toContain('.demo-card-status-badge.failed');
    });

    it('has global .hidden rule to hide elements', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '.hidden');
        expect(rule).not.toBeNull();
        expect(rule).toContain('display:none');
    });

    it('chat-scroll inside assistant-view is hidden when empty', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '#assistant-view #chat-scroll.chat-empty');
        expect(rule).not.toBeNull();
        expect(rule).toContain('display:none');
    });
});
