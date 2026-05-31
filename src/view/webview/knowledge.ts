import { marked } from 'marked';
import hljs from 'highlight.js';

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

marked.use({
    renderer: {
        code(token: { text: string; lang?: string }) {
            const lang = token.lang || '';
            let highlighted: string;
            try {
                if (lang && hljs.getLanguage(lang)) {
                    highlighted = hljs.highlight(token.text, { language: lang, ignoreIllegals: true }).value;
                } else {
                    highlighted = hljs.highlightAuto(token.text).value;
                }
            } catch {
                highlighted = token.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }
            const langLabel = lang ? `<span class="code-lang-label">${lang}</span>` : '';
            return `<div class="code-block-wrapper"><div class="code-block-header">${langLabel}<button class="code-copy-btn" data-code="${escapeAttr(token.text)}">复制</button></div><pre><code class="hljs">${highlighted}</code></pre></div>`;
        }
    },
    breaks: true,
    gfm: true,
});

function escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMarkdown(text: string): string {
    const result = marked.parse(text);
    return typeof result === 'string' ? result : '';
}

interface KnowledgeEntry {
    id: string;
    taskId: string;
    type: 'decision' | 'pitfall' | 'pattern' | 'code_snippet';
    title: string;
    content: string;
    tags: string[];
    createdAt: number;
    source?: string;
}

let allEntries: KnowledgeEntry[] = [];
let activeType: string = 'all';
let searchQuery: string = '';
let selectedId: string | null = null;

const typeLabels: Record<string, string> = {
    decision: '📐 决策',
    pitfall: '🐛 踩坑',
    pattern: '🔧 模式',
    code_snippet: '💻 代码段',
};

function init() {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
        searchQuery = searchInput.value.toLowerCase();
        renderList();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeType = (btn as HTMLElement).dataset.type || 'all';
            renderList();
        });
    });

    vscode.postMessage({ type: 'ready' });
}

function getFilteredEntries(): KnowledgeEntry[] {
    let entries = allEntries;
    if (activeType !== 'all') {
        entries = entries.filter(e => e.type === activeType);
    }
    if (searchQuery) {
        entries = entries.filter(e =>
            e.title.toLowerCase().includes(searchQuery) ||
            e.content.toLowerCase().includes(searchQuery) ||
            e.tags.some(t => t.toLowerCase().includes(searchQuery))
        );
    }
    return entries;
}

function renderList() {
    const list = document.getElementById('entry-list');
    const count = document.getElementById('entry-count');
    if (!list) return;

    const filtered = getFilteredEntries();

    if (count) {
        count.textContent = `共 ${filtered.length} 条`;
    }

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:24px;font-size:12px">暂无匹配的知识条目</div>';
        return;
    }

    list.innerHTML = filtered.map(e => {
        const typeIcon = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' }[e.type] || '📌';
        const time = new Date(e.createdAt).toLocaleDateString();
        return `<div class="knowledge-list-item${e.id === selectedId ? ' active' : ''}" data-id="${e.id}">
            <div class="kli-title"><span class="kli-type">${typeIcon}</span> ${escapeAttr(e.title)}</div>
            <div class="kli-tags">${e.tags.map(t => `<span class="kli-tag">#${escapeAttr(t)}</span>`).join('')}</div>
            <div class="kli-time">${time}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.knowledge-list-item').forEach(el => {
        el.addEventListener('click', () => {
            const id = (el as HTMLElement).dataset.id;
            if (id) selectEntry(id);
        });
    });

    if (selectedId) {
        const activeEl = list.querySelector(`[data-id="${selectedId}"]`);
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
    }
}

function selectEntry(id: string) {
    selectedId = id;
    const entry = allEntries.find(e => e.id === id);
    const detail = document.getElementById('detail-view');
    if (!detail || !entry) return;

    renderList();

    const typeIcon = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' }[entry.type] || '📌';
    const renderedContent = renderMarkdown(entry.content);
    const sourceHtml = entry.source
        ? `<div id="detail-source">📎 来源任务: ${escapeAttr(entry.source)}</div>`
        : '';

    detail.innerHTML = `<div class="detail-header">
        <div class="detail-title">${typeIcon} ${escapeAttr(entry.title)}</div>
        <div class="detail-meta">
            <span>${typeLabels[entry.type] || entry.type}</span>
            <span>·</span>
            <span>${new Date(entry.createdAt).toLocaleString()}</span>
            <div class="detail-tags">${entry.tags.map(t => `<span class="detail-tag">#${escapeAttr(t)}</span>`).join('')}</div>
        </div>
    </div>
    <div class="detail-content">${renderedContent}</div>
    ${sourceHtml}`;

    detail.querySelectorAll('.code-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.getAttribute('data-code') || '';
            navigator.clipboard.writeText(code).then(() => {
                const orig = btn.textContent;
                btn.textContent = '已复制!';
                setTimeout(() => { btn.textContent = orig; }, 1500);
            });
        });
    });
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'updateKnowledgeList':
            allEntries = msg.entries || [];
            renderList();
            if (msg.focusId) {
                selectEntry(msg.focusId);
            } else if (allEntries.length > 0) {
                selectEntry(allEntries[0].id);
            } else {
                document.getElementById('detail-view')!.innerHTML =
                    '<div class="empty-state"><span>📖</span><span>暂无知识条目</span></div>';
            }
            break;
    }
});

document.addEventListener('DOMContentLoaded', init);
