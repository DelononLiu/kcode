import { G } from './state';
import { escapeHtml } from './markdownRenderer';
import { createCard } from './cardBuilder';
import { _isTodoArray, _parseTodoStr, buildTodoBodyHtml } from './todoRenderer';

export function extractContentFromXml(output: string): string {
    const m = output.match(/<content>([\s\S]*?)<\/content>/);
    return m ? m[1].trim() : output;
}

export function formatToolTitle(kind: string, title: string): string {
    let label: string;
    let detail: string;
    switch (kind) {
        case 'read': label = '读取'; detail = title; break;
        case 'write': label = '写入'; detail = title; break;
        case 'edit': label = '修改'; detail = title; break;
        case 'bash':
        case 'command':
        case 'execute': label = '命令'; detail = title; break;
        case 'terminal': label = '终端'; detail = title; break;
        case 'grep':
        case 'search': label = '搜索'; detail = title; break;
        case 'glob': label = '查找'; detail = title; break;
        case 'thinking': label = '思考'; detail = ''; break;
        default: label = kind; detail = title; break;
    }
    if (detail) {
        return '<span class="tool-title-label">' + escapeHtml(label) + '</span> <span class="tool-title-detail">' + escapeHtml(detail) + '</span>';
    }
    return '<span class="tool-title-label">' + escapeHtml(label) + '</span>';
}

export function renderToolBubbleContent(bubble: HTMLElement, msg: any) {
    const kind = msg.kind || '';
    const title = msg.title || '';
    const content = msg.content || msg.output || '';
    const status = msg.status || '';

    const kindIcon = getToolKindIcon(kind);
    const headerHtml = kindIcon + formatToolTitle(kind, title);

    const makeCard = (config: any) => {
        const card = createCard({
            ...config,
        });
        card.setAttribute('data-tool-kind', kind);
        return card;
    };

    if (kind === 'todowrite' || _isTodoArray(content)) {
        const { done, total } = _parseTodoStr(content);
        const todoHtml = buildTodoBodyHtml(content, msg.toolCallId || '', msg.taskId || G.activeTaskId || '');
        const card = makeCard({
            headerHtml: '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 5h12v2H2V7zm0 5h8v2H2v-2z"/></svg></span><span class="tool-title-label">待办清单</span> <span class="todo-header-progress">' + done + '/' + total + '</span>',
            bodyHtml: todoHtml,
            defaultCollapsed: false,
            rawData: msg
        });
        card.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (!target.classList.contains('todo-checkbox')) return;
            const itemId = target.dataset.itemId;
            const checked = target.checked;
            G.vscode.postMessage({ type: 'updateTodoItem', taskId: msg.taskId || G.activeTaskId, msgId: 'tool_' + (msg.toolCallId || ''), itemId, checked });
        });
        bubble.appendChild(card);
        return;
    }

    if (kind === 'thinking') {
        const hasMultipleLines = content && content.includes('\n');
        const firstLine = hasMultipleLines ? content.split('\n')[0].trim() : '';
        const headerWithPreview = headerHtml + (firstLine ? ' <span class="tool-title-detail">' + escapeHtml(firstLine) + '</span>' : '');
        const card = makeCard({
            headerHtml: headerWithPreview,
            bodyHtml: content ? '<pre class="tool-body-content" style="white-space:pre-wrap">' + escapeHtml(content) + '</pre>' : undefined,
            defaultCollapsed: false,
            bodyClassName: 'tool-card-body tool-thinking',
            rawData: msg
        });
        bubble.appendChild(card);
        return;
    }

    const displayContent = (kind === 'read' || kind === 'write' || kind === 'edit') ? extractContentFromXml(content) : content;
    let bodyHtml = '';
    if (displayContent) {
        let preClass = 'tool-body-content';
        if (kind === 'bash' || kind === 'command' || kind === 'terminal' || kind === 'execute') preClass += ' tool-bash-output';
        else if (kind === 'write' || kind === 'edit') preClass += ' tool-body-diff';
        bodyHtml = '<pre class="' + preClass + '">' + escapeHtml(displayContent) + '</pre>';
    }

    let bodyClassName = 'tool-card-body';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal' || kind === 'execute') bodyClassName += ' tool-body-bash';

    const card = makeCard({
        headerHtml,
        bodyHtml: bodyHtml || undefined,
        defaultCollapsed: false,
        bodyClassName: bodyClassName || undefined,
        rawData: msg
    });
    bubble.appendChild(card);
}

export function getToolKindIcon(kind: string): string {
    switch (kind) {
        case 'bash':
        case 'command':
        case 'terminal':
        case 'execute':
            return '<span class="tool-kind-icon">$</span> ';
        case 'read':
            return '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10.5 1H3.5L3 1.5v13l.5.5h9l.5-.5V4.5L10.5 1zM10 2.2L12.8 5H10V2.2zM4 14V2h5v3.5l.5.5H12v8H4z"/></svg></span> ';
        case 'write':
        case 'edit':
            return '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 2.5l-1-1a.5.5 0 0 0-.7 0l-8 8L3 11l1.5-.5 8-8a.5.5 0 0 0 0-.7zM4.5 10.2l.3-.3 1.3 1.3-.3.3-1.6.5.3-1.5zm4.3-5.7L10.5 6 6.5 10 5 8.5l3.8-4z"/></svg></span> ';
        case 'glob':
            return '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.5l-.5-.5h-5L6.5 2h-4l-.5.5v11l.5.5h11l.5-.5V4.5zM2 3.5h3.7l1.8 2H14v1H2v-3zm0 9V8h12v4.5H2z"/></svg></span> ';
        case 'grep':
        case 'search':
            return '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M11.5 10.5l3.5 3.5-1 1-3.5-3.5a5.5 5.5 0 1 1 1-1zM6.5 1A5.5 5.5 0 1 0 6.5 12 5.5 5.5 0 0 0 6.5 1z"/></svg></span> ';
        case 'thinking':
            return '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a5 5 0 0 0-2 9.6V12l.5.5H9l.5-.5v-1.4A5 5 0 0 0 8 1zm1.5 10H6.5v-1h3v1zm0-1.5H6.5V8.4A4.5 4.5 0 0 1 8 2a4.5 4.5 0 0 1 1.5 6.4v1.1z"/></svg></span> ';
        default:
            return '';
    }
}
