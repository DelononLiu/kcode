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

    it('contains V4 layout classes', () => {
        const css = getInlineStyles();
        expect(css).toContain('tv4-init');
        expect(css).toContain('tv4-panel');
        expect(css).toContain('tv4-scroll');
        expect(css).toContain('tv4-header');
        expect(css).toContain('tv4-phase-group');
        expect(css).toContain('chat-messages');
    });

    it('contains V4 design tokens', () => {
        const css = getInlineStyles();
        expect(css).toContain('--bg-deep');
        expect(css).toContain('--bg-panel');
        expect(css).toContain('--accent');
        expect(css).toContain('--border');
        expect(css).toContain('--text-main');
    });

    it('contains V4 phase group and tool collapse styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('tv4-phase-group');
        expect(css).toContain('tv4-pg-toggle');
        expect(css).toContain('tv4-pg-body');
        expect(css).toContain('chat-msg.tool');
        expect(css).toContain('tv4-input-area');
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

    it('chat header and body are hidden when chat-scroll is empty via :has()', () => {
        const css = getInlineStyles();
        expect(css).toContain('#chat-area:has(#chat-scroll.chat-empty) #chat-header{display:none}');
        expect(css).toContain('#chat-area:has(#chat-scroll.chat-empty) #chat-body{display:none}');
    });

    it('.copy-msg-btn is hidden by default (opacity:0)', () => {
        const css = getInlineStyles();
        expect(css).toContain('.copy-msg-btn{opacity:0');
    });

    it('.chat-msg:hover reveals .copy-msg-btn (opacity:1)', () => {
        const css = getInlineStyles();
        expect(css).toContain('.chat-msg:hover .copy-msg-btn{opacity:1}');
    });

    it('.convert-msg-btn is hidden by default (opacity:0)', () => {
        const css = getInlineStyles();
        expect(css).toContain('.convert-msg-btn{opacity:0');
    });

    it('.convert-task-btn is hidden by default (opacity:0)', () => {
        const css = getInlineStyles();
        expect(css).toContain('.convert-task-btn{opacity:0');
    });

    it('contains .msg-row layout rule', () => {
        const css = getInlineStyles();
        expect(css).toContain('.msg-row{display:flex');
    });

    it('.chat-msg.user has text-align:right for right-aligned user messages', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '.chat-msg.user');
        expect(rule).not.toBeNull();
        expect(rule).toContain('text-align:right');
    });

    it('.chat-msg.agent .msg-row has justify-content:flex-start', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '.chat-msg.agent .msg-row');
        expect(rule).not.toBeNull();
        expect(rule).toContain('justify-content:flex-start');
    });

    it('contains tool-kind color accent rules', () => {
        const css = getInlineStyles();
        expect(css).toContain('[data-tool-kind="bash"]');
        expect(css).toContain('[data-tool-kind="read"]');
        expect(css).toContain('[data-tool-kind="write"]');
        expect(css).toContain('[data-tool-kind="thinking"]');
    });

    it('contains timeline node status variants', () => {
        const css = getInlineStyles();
        expect(css).toContain('.tl-node.status-completed');
        expect(css).toContain('.tl-node.status-active');
        expect(css).toContain('.tl-node.status-pending');
        expect(css).toContain('.tl-node.status-cancelled');
    });

    it('contains task-status-badge color variants', () => {
        const css = getInlineStyles();
        expect(css).toContain('.task-status-badge.status-pending');
        expect(css).toContain('.task-status-badge.status-active');
        expect(css).toContain('.task-status-badge.status-completed');
    });

    it('contains unified diff styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.unified-diff');
        expect(css).toContain('.diff-hunk-header');
        expect(css).toContain('.diff-line.diff-add');
        expect(css).toContain('.diff-line.diff-del');
    });

    it('contains plan editing styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.plan-edit-label');
        expect(css).toContain('.plan-edit-goal-input');
        expect(css).toContain('.plan-edit-step-row');
        expect(css).toContain('.goal-edit-textarea');
    });

    it('contains todo card styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.todo-list');
        expect(css).toContain('.todo-item');
        expect(css).toContain('.todo-checkbox');
        expect(css).toContain('.todo-progress');
    });

    it('contains review/criteria styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.review-changes-item.selected');
        expect(css).toContain('.review-criteria');
        expect(css).toContain('.criteria-checkbox');
    });

    it('contains template flow styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.template-flow-wrapper');
        expect(css).toContain('.template-flow-select');
        expect(css).toContain('.form-field-group');
        expect(css).toContain('.start-task-btn');
    });

    it('contains ACP log entry styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.acp-log-entry.send');
        expect(css).toContain('.acp-log-entry.recv');
        expect(css).toContain('.acp-log-dir');
        expect(css).toContain('.acp-log-time');
    });

    it('contains hooks editor detailed styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.hooks-phase-row');
        expect(css).toContain('.hooks-phase-detail');
        expect(css).toContain('.hooks-phase-detail.open');
        expect(css).toContain('.hooks-task-textarea');
        expect(css).toContain('.hooks-save-btn');
    });

    it('contains demo card info and env styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.demo-card-info');
        expect(css).toContain('.demo-card-env-header');
        expect(css).toContain('.demo-card-env-body');
        expect(css).toContain('.demo-card-status-row');
    });

    it('contains card copy-raw button style', () => {
        const css = getInlineStyles();
        expect(css).toContain('.card-copy-raw-btn');
    });

    it('contains tool spinner animation', () => {
        const css = getInlineStyles();
        expect(css).toContain('.tool-spinner');
        expect(css).toContain('@keyframes tool-spin');
    });

    it('contains thinking dots animation', () => {
        const css = getInlineStyles();
        expect(css).toContain('.thinking-dots');
        expect(css).toContain('@keyframes dot-bounce');
    });

    it('.chat-msg.stop-message has centered bubble', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '.chat-msg.stop-message .msg-bubble');
        expect(rule).not.toBeNull();
        expect(rule).toContain('text-align:center');
    });

    it('contains device extended styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.device-status-err');
        expect(css).toContain('.device-output-line.cmd');
        expect(css).toContain('.device-output-line.stdout');
    });

    it('.tab.disabled has cursor:default', () => {
        const css = getInlineStyles();
        const rule = findRule(css, '.tab.disabled');
        expect(rule).not.toBeNull();
        expect(rule).toContain('cursor:default');
    });

    it('contains hljs syntax highlighting colors', () => {
        const css = getInlineStyles();
        expect(css).toContain('.hljs{color:');
        expect(css).toContain('.hljs-keyword');
        expect(css).toContain('.hljs-string');
        expect(css).toContain('.hljs-comment');
        expect(css).toContain('.hljs-function');
    });

    it('contains card tool-header detail styles', () => {
        const css = getInlineStyles();
        expect(css).toContain('.tool-title-label');
        expect(css).toContain('.tool-title-detail');
    });

    it('.msg-card-header[aria-expanded="true"] has border-bottom', () => {
        const css = getInlineStyles();
        expect(css).toContain('.msg-card-header[aria-expanded="true"]{border-bottom:');
    });
});
