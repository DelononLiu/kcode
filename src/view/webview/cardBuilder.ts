import { renderMarkdown, escapeHtml } from './markdownRenderer';

export interface CardAction {
    text: string;
    className: string;
    onClick: (e: MouseEvent) => void;
}

export function createCopyButton(text: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'copy-msg-btn';
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
    btn.title = '复制内容';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            const orig = btn.innerHTML;
            btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });
    });
    return btn;
}

export function createCard(config: {
    headerHtml: string;
    bodyHtml?: string;
    bodyMarkdown?: string;
    defaultCollapsed?: boolean;
    actions?: CardAction[];
    borderColor?: string;
    headerBg?: string;
    headerColor?: string;
    bodyClassName?: string;
    rawData?: any;
    copyable?: boolean;
    onExpand?: (expanded: boolean) => void;
}): HTMLElement {
    const card = document.createElement('div');
    card.className = 'msg-card';
    if (config.borderColor) card.style.borderColor = config.borderColor;

    const header = document.createElement('div');
    header.className = 'msg-card-header';
    if (config.headerBg) header.style.background = config.headerBg;
    if (config.headerColor) header.style.color = config.headerColor;

    const headerSpan = document.createElement('span');
    headerSpan.className = 'msg-card-header-text';
    headerSpan.innerHTML = config.headerHtml;
    header.appendChild(headerSpan);

    if (config.rawData !== undefined) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'card-copy-raw-btn';
        copyBtn.title = '复制原始内容';
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const raw = typeof config.rawData === 'string' ? config.rawData : JSON.stringify(config.rawData, null, 2);
            navigator.clipboard.writeText(raw).then(() => {
                const orig = copyBtn.textContent;
                copyBtn.textContent = '✅';
                setTimeout(() => { copyBtn.textContent = orig; }, 1500);
            });
        });
        header.appendChild(copyBtn);
    }

    if (config.copyable) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'card-copy-btn';
        copyBtn.title = '复制内容';
        const copySvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.innerHTML = copySvg;
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const body = card.querySelector('.msg-card-body');
            const text = body?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
                const orig = copyBtn.innerHTML;
                copyBtn.innerHTML = '✅';
                setTimeout(() => { copyBtn.innerHTML = orig; }, 1500);
            });
        });
        header.appendChild(copyBtn);
    }

    const toggle = document.createElement('span');
    toggle.className = 'msg-card-toggle' + (config.defaultCollapsed ? ' collapsed' : '');
    toggle.innerHTML = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    header.appendChild(toggle);
    header.setAttribute('aria-expanded', config.defaultCollapsed ? 'false' : 'true');

    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'msg-card-body';
    if (config.bodyClassName) {
        body.className += ' ' + config.bodyClassName;
    }
    if (config.defaultCollapsed) body.classList.add('collapsed');

    if (config.bodyHtml) {
        body.innerHTML = config.bodyHtml;
    } else if (config.bodyMarkdown) {
        body.innerHTML = renderMarkdown(config.bodyMarkdown);
    }
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });

    card.appendChild(body);

    header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.msg-card-btn, .code-copy-btn')) return;
        const collapsed = body.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        if (config.onExpand) config.onExpand(!collapsed);
    });

    if (config.actions && config.actions.length > 0) {
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'msg-card-actions';
        for (const action of config.actions) {
            const btn = document.createElement('button');
            btn.className = `msg-card-btn ${action.className}`;
            btn.textContent = action.text;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                action.onClick(e);
            });
            actionsDiv.appendChild(btn);
        }
        card.appendChild(actionsDiv);
    }

    return card;
}

export function createCardMessageElement(taskId?: string): HTMLElement {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg agent';

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'Agent';
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble card-bubble';
    if (taskId) bubble.dataset.taskId = taskId;
    msgDiv.appendChild(bubble);

    return msgDiv;
}
