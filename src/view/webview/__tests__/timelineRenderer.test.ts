// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { G } from '../state';
import { getTlKind, forceTitle, getTlIcon, getTlColor, createTimelineEntry, createMergedTimelineEntry, initTlFilterBar } from '../timelineRenderer';

describe('getTlKind', () => {
    const cases: [string, string][] = [
        ['thinking', 'thinking'],
        ['read', 'file'],
        ['write', 'file'],
        ['edit', 'file'],
        ['todowrite', 'file'],
        ['todo', 'file'],
        ['bash', 'command'],
        ['command', 'command'],
        ['terminal', 'command'],
        ['grep', 'search'],
        ['search', 'search'],
        ['glob', 'search'],
        ['device', 'device'],
        ['unknown', 'command'],
    ];
    for (const [input, expected] of cases) {
        it(`${input} → ${expected}`, () => {
            expect(getTlKind(input)).toBe(expected);
        });
    }
});

describe('forceTitle', () => {
    it('returns 思考 for thinking kind', () => {
        expect(forceTitle('thinking', 'any title')).toBe('思考');
    });

    it('returns original title for other kinds', () => {
        expect(forceTitle('read', '读取文件')).toBe('读取文件');
    });
});

describe('getTlIcon', () => {
    it('returns thinking icon', () => {
        expect(getTlIcon('thinking')).toBe('💭');
    });

    it('returns read icon', () => {
        expect(getTlIcon('read')).toBe('📖');
    });

    it('returns write/edit icon', () => {
        expect(getTlIcon('write')).toBe('✏️');
        expect(getTlIcon('edit')).toBe('✏️');
    });

    it('returns command icon', () => {
        expect(getTlIcon('bash')).toBe('💻');
    });

    it('returns search icon', () => {
        expect(getTlIcon('grep')).toBe('🔍');
    });

    it('returns device icon', () => {
        expect(getTlIcon('device')).toBe('🔧');
    });

    it('returns command icon for unknown kind (defaults to command)', () => {
        expect(getTlIcon('unknown')).toBe('💻');
    });
});

describe('getTlColor', () => {
    it('maps each tlKind to correct color', () => {
        expect(getTlColor('thinking')).toBe('#888');
        expect(getTlColor('read')).toBe('#4a8bb5');
        expect(getTlColor('bash')).toBe('#5a9d6b');
        expect(getTlColor('grep')).toBe('#8b5cf6');
        expect(getTlColor('device')).toBe('#e6b422');
    });

    it('returns command color for unknown (defaults to command)', () => {
        expect(getTlColor('unknown')).toBe('#5a9d6b');
    });
});

describe('createTimelineEntry', () => {
    beforeEach(() => {
        G.activeTaskId = 'task_test';
    });

    it('creates tl-entry with correct dataset', () => {
        const entry = createTimelineEntry({ kind: 'read', title: '读取文件', content: 'file content', status: 'completed' });
        expect(entry.className).toBe('tl-entry');
        expect(entry.dataset.tlKind).toBe('file');
    });

    it('renders header with icon and title', () => {
        const entry = createTimelineEntry({ kind: 'bash', title: 'npm install', content: 'installing...', status: 'completed' });
        const header = entry.querySelector('.tl-entry-header')!;
        expect(header).toBeTruthy();
        expect(header.querySelector('.tl-entry-icon')?.textContent).toBe('💻');
        expect(header.querySelector('.tl-entry-title')?.textContent).toBe('npm install');
    });

    it('renders file body as pre element', () => {
        const entry = createTimelineEntry({ kind: 'write', title: '写入文件', content: 'diff content', status: 'completed' });
        const body = entry.querySelector('.tl-entry-body')!;
        const pre = body.querySelector('pre');
        expect(pre).toBeTruthy();
        expect(pre?.textContent).toBe('diff content');
    });

    it('renders bash body with wrapping div', () => {
        const entry = createTimelineEntry({ kind: 'bash', title: 'run', content: 'output text', status: 'completed' });
        const wrap = entry.querySelector('.tl-body-bash')!;
        expect(wrap).toBeTruthy();
        expect(wrap.querySelector('pre')?.textContent).toBe('output text');
    });

    it('collapsed by default for running status', () => {
        const entry = createTimelineEntry({ kind: 'bash', title: 'run', content: 'output', status: 'running' });
        expect(entry.querySelector('.tl-entry-body')?.className).not.toContain('open');
    });

    it('collapsed by default for failed status', () => {
        const entry = createTimelineEntry({ kind: 'bash', title: 'run', content: 'error', status: 'failed' });
        expect(entry.querySelector('.tl-entry-body')?.className).not.toContain('open');
    });

    it('thinking entry is open by default with preview', () => {
        const entry = createTimelineEntry({ kind: 'thinking', title: '思考中', content: '第一行\n第二行', status: 'completed' });
        const preview = entry.querySelector('.tl-thinking-preview')!;
        expect(preview).toBeTruthy();
        expect(preview.textContent).toBe('第一行');
        expect(entry.querySelector('.tl-entry-body')?.className).toContain('open');
    });

    it('single-line thinking is open by default', () => {
        const entry = createTimelineEntry({ kind: 'thinking', title: '快速思考', content: '简短结论', status: 'completed' });
        expect(entry.querySelector('.tl-entry-body')?.className).toContain('open');
        expect(entry.querySelector('.tl-thinking-preview')?.textContent).toBe('简短结论');
    });
});

describe('createMergedTimelineEntry', () => {
    it('renders merged thinking + tools entry', () => {
        const entry = createMergedTimelineEntry(
            { title: '分析', content: '第一行\n第二行' },
            [{ kind: 'read', title: '读取文件', content: 'file text' }],
        );
        expect(entry.className).toContain('tl-merged');
        const titleHtml = entry.querySelector('.tl-entry-title')?.innerHTML;
        expect(titleHtml).toContain('思考');
        expect(titleHtml).toContain('📖');
        expect(titleHtml).toContain('读取文件');
    });

    it('renders tool output in body', () => {
        const entry = createMergedTimelineEntry(
            { title: '分析', content: '思考内容' },
            [{ kind: 'bash', title: 'run', content: 'bash output' }],
        );
        const body = entry.querySelector('.tl-entry-body')!;
        expect(body.textContent).toContain('bash output');
    });

    it('collapsed by default for running tools', () => {
        const entry = createMergedTimelineEntry(
            { title: '分析', content: '思考' },
            [{ kind: 'bash', title: 'run', content: 'output', status: 'running' }],
        );
        expect(entry.querySelector('.tl-entry-body')?.className).not.toContain('open');
    });
});

describe('initTlFilterBar', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="tl-filter-bar">
                <button class="tl-filter-btn active" data-tl-filter="all">全部</button>
                <button class="tl-filter-btn" data-tl-filter="file">文件</button>
            </div>
            <div class="tl-entry" data-tl-kind="file"></div>
            <div class="tl-entry" data-tl-kind="command"></div>
        `;
    });

    it('filters entries when button clicked', () => {
        initTlFilterBar();
        const fileBtn = document.querySelector('[data-tl-filter="file"]') as HTMLElement;
        fileBtn.click();

        const entries = document.querySelectorAll('.tl-entry');
        expect(entries[0].className).not.toContain('hidden');
        expect(entries[1].className).toContain('hidden');
    });

    it('shows all entries when all filter clicked', () => {
        initTlFilterBar();
        const fileBtn = document.querySelector('[data-tl-filter="file"]') as HTMLElement;
        fileBtn.click();

        const allBtn = document.querySelector('[data-tl-filter="all"]') as HTMLElement;
        allBtn.click();

        const entries = document.querySelectorAll('.tl-entry');
        expect(entries[0].className).not.toContain('hidden');
        expect(entries[1].className).not.toContain('hidden');
    });
});
