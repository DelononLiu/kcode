import { marked } from 'marked';
import hljs from 'highlight.js';

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
            const langClass = lang ? `language-${lang}` : '';
            const langLabel = lang ? `<span class="code-lang-label">${lang}</span>` : '';
            return `<div class="code-block-wrapper"><div class="code-block-header">${langLabel}<button class="code-copy-btn" data-code="${escapeAttr(token.text)}">复制</button></div><pre><code class="hljs ${langClass}">${highlighted}</code></pre></div>`;
        }
    },
    breaks: true,
    gfm: true,
});

function escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown(text: string): string {
    const result = marked.parse(text);
    return typeof result === 'string' ? result : '';
}

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('code-copy-btn')) {
        const code = target.getAttribute('data-code') || '';
        navigator.clipboard.writeText(code).then(() => {
            const orig = target.textContent;
            target.textContent = '已复制!';
            setTimeout(() => { target.textContent = orig; }, 1500);
        }).catch(() => {
            const pre = target.closest('.code-block-wrapper')?.querySelector('pre');
            if (pre) {
                const range = document.createRange();
                range.selectNode(pre);
                window.getSelection()?.removeAllRanges();
                window.getSelection()?.addRange(range);
                document.execCommand('copy');
                window.getSelection()?.removeAllRanges();
                const orig = target.textContent;
                target.textContent = '已复制!';
                setTimeout(() => { target.textContent = orig; }, 1500);
            }
        });
    }
});
