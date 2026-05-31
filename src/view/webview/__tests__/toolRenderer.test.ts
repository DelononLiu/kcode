// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G } from '../state';
import { getToolKindIcon, formatToolTitle, extractContentFromXml, renderToolBubbleContent } from '../toolRenderer';

function setup() {
    G.vscode = { postMessage: vi.fn() } as any;
    G.activeTaskId = 'task_test';
}

describe('getToolKindIcon', () => {
    it('returns $ icon for bash/command/terminal', () => {
        expect(getToolKindIcon('bash')).toContain('tool-kind-icon');
        expect(getToolKindIcon('bash')).toContain('$');
        expect(getToolKindIcon('command')).toContain('$');
        expect(getToolKindIcon('terminal')).toContain('$');
    });

    it('returns specific SVG for read (file icon)', () => {
        expect(getToolKindIcon('read')).toContain('<svg');
        expect(getToolKindIcon('read')).toContain('M10.5 1H3.5');
    });

    it('returns specific SVG for write/edit (pencil icon)', () => {
        expect(getToolKindIcon('write')).toContain('<svg');
        expect(getToolKindIcon('write')).toContain('M13.5 2.5l-1-1');
        expect(getToolKindIcon('edit')).toContain('<svg');
        expect(getToolKindIcon('edit')).toContain('M13.5 2.5l-1-1');
    });

    it('returns specific SVG for glob (folder icon)', () => {
        expect(getToolKindIcon('glob')).toContain('<svg');
        expect(getToolKindIcon('glob')).toContain('M14 4.5l-.5-.5h-5');
    });

    it('returns specific SVG for grep/search (magnifier icon)', () => {
        expect(getToolKindIcon('grep')).toContain('<svg');
        expect(getToolKindIcon('grep')).toContain('M11.5 10.5l3.5 3.5-1 1');
        expect(getToolKindIcon('search')).toContain('<svg');
        expect(getToolKindIcon('search')).toContain('M11.5 10.5l3.5 3.5-1 1');
    });

    it('returns specific SVG for thinking (bulb icon)', () => {
        expect(getToolKindIcon('thinking')).toContain('<svg');
        expect(getToolKindIcon('thinking')).toContain('M8 1a5');
    });

    it('returns empty for unknown', () => {
        expect(getToolKindIcon('unknown')).toBe('');
    });
});

describe('formatToolTitle', () => {
    it('formats read kind', () => {
        const html = formatToolTitle('read', 'file.ts');
        expect(html).toContain('tool-title-label');
        expect(html).toContain('读取');
        expect(html).toContain('tool-title-detail');
        expect(html).toContain('file.ts');
    });

    it('formats thinking kind without detail', () => {
        const html = formatToolTitle('thinking', '思考中');
        expect(html).toContain('思考');
        expect(html).not.toContain('tool-title-detail');
    });
});

describe('extractContentFromXml', () => {
    it('extracts content from <content> tags', () => {
        expect(extractContentFromXml('<content>hello</content>')).toBe('hello');
    });

    it('returns original if no <content> tags', () => {
        expect(extractContentFromXml('plain text')).toBe('plain text');
    });
});

describe('renderToolBubbleContent', () => {
    beforeEach(setup);

    function createBubble() {
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble tool-bubble';
        return bubble;
    }

    it('renders thinking card', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, { kind: 'thinking', title: '思考中', content: '思考内容', status: 'completed' });
        const card = bubble.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        expect((card as HTMLElement).dataset.toolKind).toBe('thinking');
        expect(bubble.textContent).toContain('思考');
    });

    it('renders bash command card', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, { kind: 'bash', title: 'ls -la', content: 'file1\nfile2', status: 'completed' });
        const card = bubble.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        expect((card as HTMLElement).dataset.toolKind).toBe('bash');
        expect(bubble.textContent).toContain('ls -la');
    });

    it('renders write card', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, { kind: 'write', title: 'src/file.ts', content: '<content>written</content>', status: 'completed' });
        const card = bubble.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        expect((card as HTMLElement).dataset.toolKind).toBe('write');
        const pre = card.querySelector('pre')!;
        expect(pre.textContent).toBe('written');
    });

    it('renders read card', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, { kind: 'read', title: 'file.ts', content: '<content>file content</content>', status: 'completed' });
        const card = bubble.querySelector('.msg-card')!;
        expect(card.querySelector('pre')?.textContent).toBe('file content');
    });

    it('renders todowrite as todo card with checkboxes', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, {
            kind: 'todowrite', title: '待办',
            content: '[{"content":"任务1","status":"pending"},{"content":"任务2","status":"completed"}]',
            status: 'completed', toolCallId: 't1',
        });
        const card = bubble.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
        const inputs = card.querySelectorAll('.todo-checkbox');
        expect(inputs.length).toBe(2);
    });

    it('handles missing content gracefully', () => {
        const bubble = createBubble();
        renderToolBubbleContent(bubble, { kind: 'bash', title: 'cmd', status: 'completed' });
        const card = bubble.querySelector('.msg-card')!;
        expect(card).toBeTruthy();
    });
});
