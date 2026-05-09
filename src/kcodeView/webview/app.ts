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

function renderMarkdown(text: string): string {
    const result = marked.parse(text);
    return typeof result === 'string' ? result : '';
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

document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    initTabs();
    initChat();
    initMessageHandler();
});

function initMessageHandler() {
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'loadMessages':
                hideWorkingIndicator();
                streamMessageEl = null;
                activeTaskId = message.taskId;
                activeTaskStatus = message.taskStatus || '';
                renderMessages(message.messages);
                break;
            case 'showFilePreview':
                if ((window as any).showPreview) {
                    (window as any).showPreview(message.filePath, message.content);
                    activateTab('preview');
                }
                break;
            case 'showDiff':
                if ((window as any).showDiff) {
                    (window as any).showDiff(message.original, message.modified);
                    activateTab('diff');
                }
                break;
            case 'deviceConnect':
                if ((window as any).connectToDevice) {
                    (window as any).connectToDevice(message.host, message.port, message.connectionType);
                    activateTab('device');
                }
                break;
            case 'agentStreamUpdate':
                handleAgentStreamUpdate(message.text);
                break;
            case 'agentStatus':
                handleAgentStatus(message.status, message.message);
                break;
            case 'focusInput':
                const inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
                if (inputEl) inputEl.focus();
                break;
            case 'addUserMessage':
                addUserMessage(message.content);
                showAgentThinking();
                break;
            case 'updateTaskInfo':
                updateTaskInfo(message);
                break;
            case 'flashInput':
                flashInput();
                break;
            case 'toggleRightPanel':
                const rp = document.getElementById('right-panel');
                if (rp) {
                    rp.classList.toggle('hidden');
                    if (!rp.classList.contains('hidden')) {
                        activateTab('preview');
                    }
                }
                break;
            case 'showGoalConfirmation':
                showGoalConfirmationCard(message);
                break;
            case 'showReviewRequest':
                handleShowReviewRequest(message);
                break;
            case 'toolCallUpdate':
                handleToolCallUpdate(message);
                break;
            case 'generationState':
                handleGenerationState(message.isGenerating);
                break;
        }
    });
}

let streamMessageEl: HTMLElement | null = null;

function appendToChatMessages(el: Element) {
    const container = document.getElementById('chat-messages')!;
    const indicator = document.getElementById('working-indicator');
    if (indicator && !indicator.classList.contains('hidden') && indicator.parentElement === container) {
        container.insertBefore(el, indicator);
    } else {
        container.appendChild(el);
    }
}

function handleAgentStreamUpdate(text: string) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    if (!streamMessageEl) {
        hideWorkingIndicator();

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg agent';

        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = 'Agent';
        msgDiv.appendChild(sender);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        msgDiv.appendChild(bubble);

        appendToChatMessages(msgDiv);
        streamMessageEl = bubble;
    }

    latestStreamText = text;
    if (!streamRenderPending) {
        streamRenderPending = true;
        setTimeout(() => {
            streamRenderPending = false;
            if (streamMessageEl) {
                streamMessageEl.innerHTML = renderMarkdown(latestStreamText);
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }, 50);
    }
}

let latestStreamText = '';
let streamRenderPending = false;

function handleAgentStatus(status: string, message: string) {
    const statusDot = document.getElementById('agent-status-dot');
    if (statusDot) {
        statusDot.className = 'status-dot ' + (status === 'connected' ? 'online' : 'offline');
        statusDot.title = message;
    }
}

(window as any).__resetStream = () => {
    streamMessageEl = null;
};

function activateTab(tabName: string) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.classList.add('active');
}

const activeToolCallElements: Map<string, HTMLElement> = new Map();

let activeTaskId: string | null = null;
let activeTaskStatus: string = '';

function initLayout() {
    const container = document.getElementById('container')!;
    const splitter2 = document.getElementById('splitter-2')!;
    const rightPanel = document.getElementById('right-panel')!;
    const sidebar = document.getElementById('sidebar')!;

    let activeSplitter: HTMLElement | null = null;

    function onMouseDown(e: MouseEvent, splitter: HTMLElement) {
        activeSplitter = splitter;
        splitter.classList.add('active');
        e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
        if (!activeSplitter) return;

        const containerRect = container.getBoundingClientRect();

        if (activeSplitter === splitter2) {
            let newWidth = containerRect.right - e.clientX;
            newWidth = Math.max(200, Math.min(600, newWidth));
            rightPanel.style.width = `${newWidth}px`;
        }
    }

    function onMouseUp() {
        if (activeSplitter) {
            activeSplitter.classList.remove('active');
            activeSplitter = null;
        }
    }

    splitter2.addEventListener('mousedown', (e) => onMouseDown(e, splitter2));
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    const closeBtn = document.getElementById('right-panel-close')!;
    closeBtn.addEventListener('click', () => {
        rightPanel.classList.toggle('hidden');
    });
}

function initInstructionToggle() {
    const toggle = document.querySelector('.instruction-toggle');
    toggle?.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
    });
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('disabled')) return;
            const tabName = (btn as HTMLElement).dataset.tab;

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            btn.classList.add('active');
            const content = document.getElementById(`tab-${tabName}`);
            if (content) content.classList.add('active');
        });
    });
}

function initChat() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) return;

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.focus();

        vscode.postMessage({ type: 'sendMessage', text, taskId: activeTaskId });
    }

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    const sendBtn = document.getElementById('send-btn');
    sendBtn?.addEventListener('click', sendMessage);

    const stopBtn = document.getElementById('stop-btn');
    stopBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'stopGeneration', taskId: activeTaskId });
    });

    const settingsBtn = document.querySelector('.settings-btn');
    settingsBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
    });
}

function handleGenerationState(isGenerating: boolean) {
    const sendBtn = document.getElementById('send-btn');
    const stopBtn = document.getElementById('stop-btn');
    if (!sendBtn || !stopBtn) return;

    if (isGenerating) {
        sendBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
    } else {
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
    }
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    if (d.toDateString() === now.toDateString()) {
        return `${hh}:${mm}`;
    }
    const mon = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${mon}/${dd} ${hh}:${mm}`;
}

function addUserMessage(content: string) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.innerHTML = 'You <span class="msg-timestamp">' + formatTimestamp(Date.now()) + '</span>';
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = content;
    msgDiv.appendChild(bubble);

    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function showAgentThinking() {
    const indicator = document.getElementById('working-indicator');
    if (!indicator) return;
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container || !scrollContainer) return;

    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    indicator.classList.remove('hidden');
    const textEl = indicator.querySelector('.working-text') as HTMLElement;
    if (textEl) textEl.textContent = '思考中';
    if (indicator.parentElement === container) {
        container.appendChild(indicator);
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function addMessage(role: 'user' | 'agent', content: string) {
    if (role === 'user') {
        addUserMessage(content);
        return;
    }

    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'Agent';
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const rendered = renderMarkdown(content);

    bubble.innerHTML = rendered;
    msgDiv.appendChild(bubble);

    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function collectChangedFiles(messages: any[], startIdx: number): string[] {
    const files: string[] = [];
    for (let i = startIdx; i < messages.length; i++) {
        const m = messages[i];
        if (m.role !== 'tool') break;
        if (m.type === 'tool_call') {
            try {
                const info = JSON.parse(m.content);
                if (info.kind === 'write' || info.kind === 'edit') {
                    files.push(info.title);
                }
            } catch {}
        }
    }
    return files;
}

function renderMessages(messages: any[]) {
    activeToolCallElements.clear();
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container || !scrollContainer) return;

    const existingIndicator = document.getElementById('working-indicator');

    container.innerHTML = '';
    if (existingIndicator) container.appendChild(existingIndicator);

    const inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!messages || messages.length === 0) {
        scrollContainer.classList.add('chat-empty');
        container.innerHTML = '<div class="chat-placeholder">输入需求，开始与 AI 对话</div>';
        if (existingIndicator) container.appendChild(existingIndicator);
        if (inputEl) inputEl.placeholder = '输入需求，开始与 AI 对话';
        focusChatInput();
        return;
    }

    scrollContainer.classList.remove('chat-empty');
    if (inputEl) inputEl.placeholder = '提出后续修改要求';

    const changedFilesMap = new Map<number, string[]>();
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'agent' && !msg.type) {
            const files = collectChangedFiles(messages, i + 1);
            if (files.length > 0) {
                changedFilesMap.set(i, files);
            }
        }
    }

    for (let i = 0; i < messages.length; i++) {
        addMessageElement(messages[i], changedFilesMap.get(i));
    }
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    focusChatInput();
}

function focusChatInput() {
    const el = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (el) el.focus();
}

function addMessageElement(msg: any, changedFiles?: string[]) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const role = msg.role;
    const content = msg.content;

    if (msg.type === 'goal_confirmation' || msg.type === 'goal_confirmed') {
        const msgDiv = createCardMessageElement();
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const bodyText = content.replace(/^📋 任务目标确认\n\n/, '');
        const isConfirmed = msg.type === 'goal_confirmed';
        const card = createCard({
            headerHtml: '📋 任务目标确认',
            bodyMarkdown: bodyText,
            defaultCollapsed: false,
            borderColor: '#3c3c3c',
            headerBg: '#2d2d2d',
            headerColor: '#e0e0e0'
        });
        if (isConfirmed) {
            updateCardToStatus(card, '✅ 已确认');
        }
        bubble.appendChild(card);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'review_request' || msg.type === 'review_approved' || msg.type === 'review_rejected') {
        const msgDiv = createCardMessageElement();
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const taskId = msg.taskId;

        const isPending = msg.type === 'review_request';
        const statusText = msg.type === 'review_approved' ? '✅ 已验收通过' :
                           msg.type === 'review_rejected' ? '↩️ 已驳回' : '';
        const card = createCard({
            headerHtml: '✅ AI 已完成任务',
            bodyMarkdown: content,
            defaultCollapsed: false,
            borderColor: '#4ec9b0',
            headerBg: '#1e3a2f',
            headerColor: '#4ec9b0',
            actions: isPending ? [
                {
                    text: '验收通过 ✓',
                    className: 'primary',
                    onClick: (e: MouseEvent) => {
                        const target = e.currentTarget as HTMLElement;
                        updateCardToStatus(findParentCard(target)!, '✅ 已验收通过');
                        vscode.postMessage({ type: 'approveReview', taskId });
                    }
                },
                {
                    text: '驳回 ↩',
                    className: 'secondary',
                    onClick: (e: MouseEvent) => {
                        const target = e.currentTarget as HTMLElement;
                        updateCardToStatus(findParentCard(target)!, '↩️ 已驳回');
                        vscode.postMessage({ type: 'rejectReview', taskId });
                    }
                }
            ] : undefined
        });
        if (statusText) {
            updateCardToStatus(card, statusText);
        }
        bubble.appendChild(card);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'stop_message') {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg agent stop-message';
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = content;
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (role === 'tool') {
        let toolInfo: any;
        try {
            toolInfo = JSON.parse(content);
        } catch {
            toolInfo = { title: content, kind: '', status: '', output: '' };
        }
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble tool-bubble';
        msgDiv.appendChild(bubble);

        renderToolBubbleContent(bubble, toolInfo);

        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    const ts = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
    sender.innerHTML = (role === 'user' ? 'You' : 'Agent') + (ts ? ' <span class="msg-timestamp">' + ts + '</span>' : '');
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = renderMarkdown(content);

    if (role === 'agent' && changedFiles && changedFiles.length > 0) {
        const summary = document.createElement('div');
        summary.className = 'agent-diff-summary';
        summary.innerHTML = '📄 <strong>变更文件</strong> (' + changedFiles.length + '):<br>' +
            changedFiles.map(f => '&nbsp;&nbsp;📝 ' + escapeHtml(f)).join('<br>');
        bubble.appendChild(summary);
    }

    msgDiv.appendChild(bubble);

    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function updateTaskInfo(info: any) {
    activeTaskStatus = info.status || '';
    const titleEl = document.querySelector('.task-info-title');
    if (titleEl) titleEl.textContent = info.title || '选择任务开始对话';

    const createdEl = document.getElementById('task-info-created');
    if (createdEl && info.createdAt) {
        const d = new Date(info.createdAt);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        createdEl.textContent = `创建 ${hh}:${mm}`;
    }

    const reviewEl = document.getElementById('task-info-review');
    if (reviewEl) {
        reviewEl.textContent = `待验收 ${info.pendingReviewFiles || 0} 个文件`;
    }
}

function flashInput() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    wrapper.classList.remove('input-flash');
    void (wrapper as HTMLElement).offsetWidth;
    wrapper.classList.add('input-flash');
}

interface CardAction {
    text: string;
    className: string;
    onClick: (e: MouseEvent) => void;
}

function createCard(config: {
    headerHtml: string;
    bodyHtml?: string;
    bodyMarkdown?: string;
    defaultCollapsed?: boolean;
    actions?: CardAction[];
    borderColor?: string;
    headerBg?: string;
    headerColor?: string;
    bodyClassName?: string;
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

    const toggle = document.createElement('span');
    toggle.className = 'msg-card-toggle';
    toggle.textContent = config.defaultCollapsed ? '▶' : '▼';
    header.appendChild(toggle);

    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'msg-card-body';
    if (config.bodyClassName) body.classList.add(config.bodyClassName);
    if (config.defaultCollapsed) body.classList.add('collapsed');

    if (config.bodyHtml) {
        body.innerHTML = config.bodyHtml;
    } else if (config.bodyMarkdown) {
        body.innerHTML = renderMarkdown(config.bodyMarkdown);
    }

    card.appendChild(body);

    header.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.msg-card-btn, .code-copy-btn')) return;
        body.classList.toggle('collapsed');
        toggle.textContent = body.classList.contains('collapsed') ? '▶' : '▼';
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

function createCardMessageElement(taskId?: string): HTMLElement {
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

interface FileChange {
    filePath: string;
    original: string;
    modified: string;
}

const reviewChangesMap: Map<string, FileChange[]> = new Map();

function handleShowReviewRequest(message: any) {
    reviewChangesMap.set(message.taskId, message.changes || []);

    const cards = document.querySelectorAll('.msg-card');
    const reviewCard = cards[cards.length - 1] as HTMLElement;
    if (!reviewCard) return;

    const changes = message.changes as FileChange[];
    if (!changes || changes.length === 0) return;

    const body = reviewCard.querySelector('.msg-card-body');
    if (!body) return;

    const existing = body.querySelector('.review-changes');
    if (existing) existing.remove();

    const list = document.createElement('div');
    list.className = 'review-changes';

    const label = document.createElement('div');
    label.className = 'review-changes-label';
    label.textContent = `📄 变更文件 (${changes.length})`;
    list.appendChild(label);

    for (const change of changes) {
        const item = document.createElement('div');
        item.className = 'review-changes-item';
        item.textContent = `📝 ${change.filePath}`;
        item.addEventListener('click', () => {
            (window as any).showDiff(change.original, change.modified);
            const rightPanel = document.getElementById('right-panel');
            if (rightPanel) rightPanel.classList.remove('hidden');
            activateTab('diff');
        });
        list.appendChild(item);
    }

    body.appendChild(list);
}

function updateCardToStatus(card: HTMLElement, statusText: string) {
    const actions = card.querySelector('.msg-card-actions');
    if (actions) {
        actions.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = statusText;
        actions.appendChild(statusEl);
    }
}

function findParentCard(el: HTMLElement): HTMLElement | null {
    return el.closest('.msg-card') as HTMLElement;
}

function showGoalConfirmationCard(info: any) {
    hideWorkingIndicator();
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;

    if (streamMessageEl) {
        const bubbleParent = streamMessageEl.closest('.chat-msg');
        if (bubbleParent) bubbleParent.remove();
        streamMessageEl = null;
    }

    removeGoalConfirmationCard();

    const msgDiv = createCardMessageElement(info.taskId);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: '📋 任务目标确认',
        bodyMarkdown: info.goal,
        defaultCollapsed: false,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
        actions: [
            {
                text: '确认目标 ✓',
                className: 'primary',
                onClick: (e: MouseEvent) => {
                    const target = e.currentTarget as HTMLElement;
                    updateCardToStatus(findParentCard(target)!, '✅ 已确认');
                    vscode.postMessage({ type: 'confirmGoal', taskId: info.taskId, originalRequest: info.originalRequest });
                }
            },
            {
                text: '修改需求 ↩',
                className: 'secondary',
                onClick: (e: MouseEvent) => {
                    const target = e.currentTarget as HTMLElement;
                    updateCardToStatus(findParentCard(target)!, '↩️ 已修改需求');
                    vscode.postMessage({ type: 'reviseGoal', taskId: info.taskId });
                }
            },
            {
                text: '取消 ✕',
                className: 'cancel',
                onClick: (e: MouseEvent) => {
                    const target = e.currentTarget as HTMLElement;
                    updateCardToStatus(findParentCard(target)!, '✕ 已取消任务');
                    vscode.postMessage({ type: 'cancelTask', taskId: info.taskId });
                }
            }
        ]
    });

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function removeGoalConfirmationCard() {
    document.querySelectorAll('.msg-card').forEach(el => el.remove());
}

function handleToolCallUpdate(msg: any) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    let toolEl = activeToolCallElements.get(msg.toolCallId);

    if (!toolEl) {
        toolEl = createToolMessageElement(msg);
        appendToChatMessages(toolEl);
        activeToolCallElements.set(msg.toolCallId, toolEl);
    } else {
        updateToolMessageElement(toolEl, msg);
    }

    updateWorkingIndicator(msg);

    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function createToolMessageElement(msg: any): HTMLElement {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble tool-bubble';
    msgDiv.appendChild(bubble);

    renderToolBubbleContent(bubble, msg);

    return msgDiv;
}

function updateToolMessageElement(el: HTMLElement, msg: any) {
    const bubble = el.querySelector('.msg-bubble');
    if (!bubble) return;
    bubble.innerHTML = '';
    renderToolBubbleContent(bubble as HTMLElement, msg);
}

function renderToolBubbleContent(bubble: HTMLElement, msg: any) {
    const kind = msg.kind || '';
    const title = msg.title || '';
    const status = msg.status || 'pending';
    const content = msg.content || msg.output || '';

    const isRunning = status === 'running' || status === 'pending';

    let statusHtml: string;
    if (isRunning) {
        statusHtml = '<span class="tool-spinner"></span>';
    } else if (status === 'completed') {
        statusHtml = '✅';
    } else if (status === 'error' || status === 'failed') {
        statusHtml = '❌';
    } else {
        statusHtml = '⏳';
    }

    const kindIcon = getToolKindIcon(kind);
    const headerHtml = statusHtml + ' ' + kindIcon + escapeHtml(title);

    if (kind === 'thinking') {
        const card = createCard({
            headerHtml,
            defaultCollapsed: false,
            bodyClassName: 'tool-thinking'
        });
        bubble.appendChild(card);
        return;
    }

    let bodyHtml = '';
    if (content) {
        let preClass = 'tool-body-content';
        if (kind === 'bash' || kind === 'command' || kind === 'terminal') preClass += ' tool-bash-output';
        else if (kind === 'write' || kind === 'edit') preClass += ' tool-body-diff';
        bodyHtml = '<pre class="' + preClass + '">' + escapeHtml(content) + '</pre>';
    }

    let bodyClassName = '';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal') bodyClassName = 'tool-body-bash';

    const isDefaultCollapsed = kind === 'thinking' ? false : !isRunning;

    const card = createCard({
        headerHtml,
        bodyHtml: bodyHtml || undefined,
        defaultCollapsed: isDefaultCollapsed,
        bodyClassName: bodyClassName || undefined
    });
    bubble.appendChild(card);
}

function getToolKindIcon(kind: string): string {
    switch (kind) {
        case 'bash':
        case 'command':
        case 'terminal':
            return '<span class="tool-kind-icon">$</span> ';
        case 'read':
            return '<span class="tool-kind-icon">📖</span> ';
        case 'write':
        case 'edit':
            return '<span class="tool-kind-icon">✏️</span> ';
        case 'glob':
            return '<span class="tool-kind-icon">🔍</span> ';
        case 'grep':
        case 'search':
            return '<span class="tool-kind-icon">🔎</span> ';
        case 'thinking':
            return '<span class="tool-kind-icon">💭</span> ';
        default:
            return '';
    }
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateWorkingIndicator(msg: any) {
    const indicator = document.getElementById('working-indicator');
    if (!indicator || indicator.classList.contains('hidden')) return;
    const textEl = indicator.querySelector('.working-text') as HTMLElement;
    if (!textEl) return;
    const status = msg.status || 'pending';
    const isRunning = status === 'running' || status === 'pending';
    if (isRunning && msg.title) {
        textEl.textContent = msg.title;
    } else if (!isRunning) {
        textEl.textContent = '思考中';
    }
}

function hideWorkingIndicator() {
    const indicator = document.getElementById('working-indicator');
    if (indicator) indicator.classList.add('hidden');
}

(window as any).addMessage = addMessage;
(window as any).renderMarkdown = renderMarkdown;
(window as any).renderMessages = renderMessages;
