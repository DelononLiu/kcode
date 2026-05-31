import { G } from './state';
import { escapeHtml } from './markdownRenderer';

export function getTlKind(kind: string): string {
    if (kind === 'thinking') return 'thinking';
    if (kind === 'read' || kind === 'write' || kind === 'edit' || kind === 'todowrite' || kind === 'todo') return 'file';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal') return 'command';
    if (kind === 'grep' || kind === 'search' || kind === 'glob') return 'search';
    if (kind === 'device') return 'device';
    return 'command';
}

export function forceTitle(kind: string, title: string): string {
    return kind === 'thinking' ? '思考' : title;
}

export function getTlIcon(kind: string): string {
    const k = getTlKind(kind);
    if (k === 'thinking') return '💭';
    if (k === 'file') return kind === 'read' ? '📖' : kind === 'write' || kind === 'edit' ? '✏️' : '📄';
    if (k === 'command') return '💻';
    if (k === 'search') return '🔍';
    if (k === 'device') return '🔧';
    return '⚙️';
}

export function getTlColor(kind: string): string {
    const map: Record<string, string> = { thinking: '#888', file: '#4a8bb5', command: '#5a9d6b', search: '#8b5cf6', device: '#e6b422' };
    return map[getTlKind(kind)] || '#666';
}

export function createTimelineEntry(msg: any): HTMLElement {
    const kind = msg.kind || '';
    const title = forceTitle(kind, msg.title || '');
    const output = msg.content || msg.output || '';
    const status = msg.status || 'completed';
    const tlKind = getTlKind(kind);
    const icon = getTlIcon(kind);
    const color = getTlColor(kind);
    const taskId = msg.taskId || G.activeTaskId || '';

    const entry = document.createElement('div');
    entry.className = 'tl-entry';
    entry.dataset.tlKind = tlKind;

    const bar = document.createElement('div');
    bar.className = 'tl-entry-bar';
    bar.style.background = color;

    const main = document.createElement('div');
    main.className = 'tl-entry-main';

    const header = document.createElement('div');
    header.className = 'tl-entry-header';

    const iconEl = document.createElement('span');
    iconEl.className = 'tl-entry-icon';
    iconEl.textContent = icon;

    const titleEl = document.createElement('span');
    titleEl.className = 'tl-entry-title' + (tlKind === 'command' ? ' mono' : '') + (tlKind === 'thinking' ? ' em' : '');
    titleEl.textContent = title;

    const body = document.createElement('div');
    body.className = 'tl-entry-body';

    if (output) {
        if (tlKind === 'file') {
            const isDiff = kind === 'write' || kind === 'edit';
            const pre = document.createElement('pre');
            if (isDiff) pre.className = 'tl-body-diff';
            pre.textContent = output;
            body.appendChild(pre);
        } else if (tlKind === 'command' || tlKind === 'device') {
            const wrap = document.createElement('div');
            wrap.className = 'tl-body-bash';
            const pre = document.createElement('pre');
            pre.textContent = output;
            wrap.appendChild(pre);
            body.appendChild(wrap);
        } else if (tlKind === 'thinking') {
            const pre = document.createElement('pre');
            pre.className = 'tl-body-thinking';
            pre.textContent = output;
            body.appendChild(pre);
        } else {
            const pre = document.createElement('pre');
            pre.textContent = output;
            body.appendChild(pre);
        }
    }



    header.appendChild(iconEl);
    header.appendChild(titleEl);

    const togglers: (() => void)[] = [];

    let preview: HTMLElement | null = null;
    if (tlKind === 'thinking' && output) {
        const lines = output.split('\n');
        const firstLine = lines[0].trim();
        if (firstLine && lines.length > 1) {
            preview = document.createElement('div');
            preview.className = 'tl-thinking-preview';
            preview.textContent = firstLine;
            preview.addEventListener('click', () => togglers.forEach(fn => fn()));
        }
    }

    function toggleBody() {
        if (preview) preview.classList.toggle('hidden');
        body.classList.toggle('open');
    }
    togglers.push(toggleBody);

    header.addEventListener('click', () => togglers.forEach(fn => fn()));

    main.appendChild(header);
    if (preview) main.appendChild(preview);
    main.appendChild(body);
    entry.appendChild(bar);
    entry.appendChild(main);

    return entry;
}

export function createMergedTimelineEntry(thinkingMsg: any, tools: any[]): HTMLElement {
    const firstTool = tools[0] || {};
    const kind = firstTool.kind || '';
    const status = firstTool.status || 'completed';
    const tlKind = getTlKind(kind);
    const color = getTlColor(kind);

    const entry = document.createElement('div');
    entry.className = 'tl-entry tl-merged';
    entry.dataset.tlKind = tlKind;

    const bar = document.createElement('div');
    bar.className = 'tl-entry-bar';
    bar.style.background = color;

    const main = document.createElement('div');
    main.className = 'tl-entry-main';

    const header = document.createElement('div');
    header.className = 'tl-entry-header';

    const iconEl = document.createElement('span');
    iconEl.className = 'tl-entry-icon';
    iconEl.textContent = '💭';

    const titleEl = document.createElement('span');
    titleEl.className = 'tl-entry-title';
    const thinkText = forceTitle('thinking', thinkingMsg.title || '思考').substring(0, 20);
    let titleHtml = `<span style="color:#888;font-style:italic">${escapeHtml(thinkText)}</span>`;
    for (const t of tools) {
        const tIcon = getTlIcon(t.kind || '');
        const tTitle = escapeHtml(t.title || '');
        titleHtml += ` <span class="tl-arrow">→</span> ${tIcon} ${tTitle}`;
    }
    titleEl.innerHTML = titleHtml;

    const body = document.createElement('div');
    body.className = 'tl-entry-body';

    for (const t of tools) {
        const tOutput = t.content || t.output || '';
        if (!tOutput) continue;
        const tKind = t.kind || '';
        const tTlKind = getTlKind(tKind);
        if (tTlKind === 'command') {
            const wrap = document.createElement('div');
            wrap.className = 'tl-body-bash';
            const pre = document.createElement('pre');
            pre.textContent = tOutput;
            wrap.appendChild(pre);
            body.appendChild(wrap);
        } else {
            const pre = document.createElement('pre');
            if (tKind === 'write' || tKind === 'edit') pre.className = 'tl-body-diff';
            pre.textContent = tOutput;
            body.appendChild(pre);
        }
    }

    header.appendChild(iconEl);
    header.appendChild(titleEl);

    const togglers: (() => void)[] = [];

    header.addEventListener('click', () => togglers.forEach(fn => fn()));

    main.appendChild(header);

    const thinkingOutput = thinkingMsg.content || '';
    let preview: HTMLElement | null = null;
    if (thinkingOutput) {
        const lines = thinkingOutput.split('\n');
        const firstLine = lines[0].trim();
        if (firstLine) {
            preview = document.createElement('div');
            preview.className = 'tl-thinking-preview';
            preview.textContent = firstLine;
            preview.addEventListener('click', () => togglers.forEach(fn => fn()));
            main.appendChild(preview);
        }
    }

    function toggleBody() {
        if (preview) preview.classList.toggle('hidden');
        body.classList.toggle('open');
    }
    togglers.push(toggleBody);

    main.appendChild(body);
    entry.appendChild(bar);
    entry.appendChild(main);

    return entry;
}

export function showTlFilterBar() {
    const bar = document.getElementById('tl-filter-bar');
    if (bar) bar.classList.remove('hidden');
}

export function initTlFilterBar() {
    const bar = document.getElementById('tl-filter-bar');
    if (!bar) return;
    bar.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.tl-filter-btn') as HTMLElement;
        if (!btn) return;
        bar.querySelectorAll('.tl-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.tlFilter || 'all';
        document.querySelectorAll('.tl-entry').forEach(el => {
            const kind = (el as HTMLElement).dataset.tlKind || '';
            el.classList.toggle('hidden', filter !== 'all' && kind !== filter);
        });
    });
}
