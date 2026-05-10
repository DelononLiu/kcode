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
    initGoalHeader();
    initNodePanel();

    (window as any).__openNativeDiff = (original: string, modified: string, filePath: string) => {
        vscode.postMessage({ type: 'openNativeDiff', original, modified, filePath });
    };
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
            case 'updateNodePanel':
                handleNodePanelUpdate(message.nodes, message.taskType);
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
    const rightPanel = document.getElementById('right-panel')!;

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

function createCopyButton(text: string): HTMLElement {
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
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
    msgDiv.appendChild(bubble);

    const row = document.createElement('div');
    row.className = 'msg-row';
    row.appendChild(createCopyButton(content));
    msgDiv.appendChild(row);

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
        msgDiv.dataset.msgId = msg.id;
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
        const taskId = msg.taskId;
        const msgDiv = createCardMessageElement(taskId);
        msgDiv.dataset.msgId = msg.id;
        const bubble = msgDiv.querySelector('.msg-bubble')!;

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
                        showRejectInput(e.currentTarget as HTMLElement, taskId);
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
        msgDiv.dataset.msgId = msg.id;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.textContent = content;
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'goal_updated') {
        const msgDiv = createCardMessageElement();
        msgDiv.dataset.msgId = msg.id;
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const card = createCard({
            headerHtml: '🎯 目标已更新',
            bodyMarkdown: content.replace(/^🎯 目标已更新\n\n/, ''),
            defaultCollapsed: true,
            borderColor: '#4ec9b0',
            headerBg: '#1a2e2a',
            headerColor: '#4ec9b0'
        });
        bubble.appendChild(card);
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
        msgDiv.dataset.msgId = msg.id;

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
    msgDiv.dataset.msgId = msg.id;

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

    const row = document.createElement('div');
    row.className = 'msg-row';
    row.appendChild(createCopyButton(content));
    msgDiv.appendChild(row);

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

    const goalHeader = document.getElementById('goal-header');
    const goalText = document.getElementById('goal-header-text');
    if (goalHeader && goalText) {
        const hasGoal = info.taskType === 'task' && info.goal && info.status !== 'cancelled' && info.status !== 'completed';
        goalHeader.classList.toggle('hidden', !hasGoal);
        goalText.textContent = info.goal || '';
        showGoalViewMode();
    }
}

let goalOriginalText = '';

function showGoalViewMode() {
    const view = document.getElementById('goal-header-view');
    const edit = document.getElementById('goal-header-edit');
    if (view) view.classList.remove('hidden');
    if (edit) edit.classList.add('hidden');
}

function showGoalEditMode() {
    const view = document.getElementById('goal-header-view');
    const edit = document.getElementById('goal-header-edit');
    const input = document.getElementById('goal-edit-input') as HTMLTextAreaElement;
    const text = document.getElementById('goal-header-text');
    if (view) view.classList.add('hidden');
    if (edit) edit.classList.remove('hidden');
    if (input && text) {
        goalOriginalText = text.textContent || '';
        input.value = goalOriginalText;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
}

function initGoalHeader() {
    const editBtn = document.getElementById('goal-edit-btn');
    const saveBtn = document.getElementById('goal-save-btn');
    const cancelBtn = document.getElementById('goal-cancel-btn');
    const input = document.getElementById('goal-edit-input') as HTMLTextAreaElement;

    editBtn?.addEventListener('click', showGoalEditMode);
    cancelBtn?.addEventListener('click', showGoalViewMode);

    saveBtn?.addEventListener('click', () => {
        if (!input) return;
        const newGoal = input.value.trim();
        if (!newGoal || newGoal === goalOriginalText) {
            showGoalViewMode();
            return;
        }
        vscode.postMessage({ type: 'updateGoal', taskId: activeTaskId, goal: newGoal });
    });

    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveBtn?.click();
        }
        if (e.key === 'Escape') {
            showGoalViewMode();
        }
    });
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
let selectedReviewFileIdx: number | null = null;

function getChangeType(original: string, modified: string): { icon: string; label: string } {
    if (!original) return { icon: '📄', label: '新建' };
    if (!modified) return { icon: '🗑️', label: '删除' };
    return { icon: '📝', label: '修改' };
}

function getChangeSummary(original: string, modified: string): string {
    if (!original) return '新建文件';
    if (!modified) return '删除文件';
    const oLines = original.split('\n').filter(l => l.trim());
    const mLines = modified.split('\n').filter(l => l.trim());
    const added = mLines.length - oLines.length;
    const changed = Math.abs(added);
    return added >= 0 ? `+${added} 行` : `${added} 行`;
}

function handleShowReviewRequest(message: any) {
    selectedReviewFileIdx = null;
    reviewChangesMap.set(message.taskId, message.changes || []);

    const reviewCard = document.querySelector(`.msg-bubble.card-bubble[data-taskid="${message.taskId}"] .msg-card`) as HTMLElement
        || document.querySelector('#chat-messages > .chat-msg.agent:last-child .msg-card') as HTMLElement;
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

    for (let idx = 0; idx < changes.length; idx++) {
        const change = changes[idx];
        const type = getChangeType(change.original, change.modified);
        const summary = getChangeSummary(change.original, change.modified);

        const item = document.createElement('div');
        item.className = 'review-changes-item';
        item.dataset.filePath = change.filePath;
        item.dataset.idx = String(idx);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'review-changes-icon';
        iconSpan.textContent = type.icon;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'review-changes-name';
        nameSpan.textContent = change.filePath;

        const typeLabel = document.createElement('span');
        typeLabel.className = 'review-changes-type';
        typeLabel.textContent = type.label;

        const summarySpan = document.createElement('span');
        summarySpan.className = 'review-changes-summary';
        summarySpan.textContent = summary;

        const openBtn = document.createElement('span');
        openBtn.className = 'review-changes-open';
        openBtn.textContent = '⇱';
        openBtn.title = '在 VS Code 中打开对比';
        openBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            vscode.postMessage({
                type: 'openNativeDiff',
                original: change.original,
                modified: change.modified,
                filePath: change.filePath
            });
        });

        item.appendChild(iconSpan);
        item.appendChild(nameSpan);
        item.appendChild(typeLabel);
        item.appendChild(summarySpan);
        item.appendChild(openBtn);

        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).classList.contains('review-changes-open')) return;
            toggleReviewFileSelection(change, item, idx);
        });

        list.appendChild(item);
    }

    body.appendChild(list);
}

function toggleReviewFileSelection(change: FileChange, item: HTMLElement, idx: number) {
    const rp = document.getElementById('right-panel');
    if (!rp) return;

    if (selectedReviewFileIdx === idx) {
        selectedReviewFileIdx = null;
        item.classList.remove('selected');
        rp.classList.add('hidden');
        return;
    }

    document.querySelectorAll('.review-changes-item.selected').forEach(el => el.classList.remove('selected'));

    selectedReviewFileIdx = idx;
    item.classList.add('selected');
    rp.classList.remove('hidden');

    (window as any).showDiffWithFile?.(change.original, change.modified, change.filePath);
    activateTab('diff');
}

function showRejectInput(btn: HTMLElement, taskId: string) {
    const card = findParentCard(btn);
    if (!card) return;

    const actions = card.querySelector('.msg-card-actions');
    if (!actions) return;

    const existing = actions.querySelector('.reject-input-area');
    if (existing) return;

    actions.innerHTML = '';

    const area = document.createElement('div');
    area.className = 'reject-input-area';

    const textarea = document.createElement('textarea');
    textarea.className = 'reject-input';
    textarea.placeholder = '驳回原因（可选）...';
    textarea.rows = 2;

    const btnRow = document.createElement('div');
    btnRow.className = 'reject-btn-row';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认驳回';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'msg-card-btn secondary';
    cancelBtn.textContent = '取消';

    confirmBtn.addEventListener('click', () => {
        const reason = textarea.value.trim();
        updateCardToStatus(card, reason ? `↩️ 已驳回: ${reason}` : '↩️ 已驳回');
        vscode.postMessage({ type: 'rejectReview', taskId, reason });
    });

    cancelBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'rejectReview', taskId });
    });

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    area.appendChild(textarea);
    area.appendChild(btnRow);
    actions.appendChild(area);

    textarea.focus();
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

function formatToolTitle(kind: string, title: string): string {
    switch (kind) {
        case 'read': return '读取 ' + title;
        case 'write': return '写入 ' + title;
        case 'edit': return '修改 ' + title;
        case 'bash':
        case 'command':
        case 'terminal': return title;
        case 'grep':
        case 'search': return '搜索 ' + title;
        case 'glob': return '查找 ' + title;
        case 'thinking': return '推理';
        default: return title;
    }
}

function renderToolBubbleContent(bubble: HTMLElement, msg: any) {
    const kind = msg.kind || '';
    const title = msg.title || '';
    const content = msg.content || msg.output || '';

    const kindIcon = getToolKindIcon(kind);
    const headerHtml = kindIcon + escapeHtml(formatToolTitle(kind, title));

    if (kind === 'thinking') {
        const card = createCard({
            headerHtml,
            bodyHtml: content ? '<pre class="tool-body-content" style="white-space:pre-wrap;font-size:12.5px;color:#9aa">' + escapeHtml(content) + '</pre>' : undefined,
            defaultCollapsed: false,
            bodyClassName: 'tool-card-body tool-thinking'
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

    let bodyClassName = 'tool-card-body';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal') bodyClassName += ' tool-body-bash';

    const isDefaultCollapsed = false;

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

function getNodeEmoji(type: string): string {
    switch (type) {
        case 'demand': return '📝';
        case 'goal': return '🎯';
        case 'plan': return '📋';
        case 'execute': return '⚡';
        case 'review': return '✅';
        default: return '●';
    }
}

function handleNodePanelUpdate(nodes: any[], taskType: string) {
    const gutter = document.getElementById('node-timeline-gutter');
    const dotsEl = document.getElementById('tl-dots');
    if (!gutter || !dotsEl) return;

    const hasNodes = taskType === 'task' && nodes.length > 0;
    gutter.classList.toggle('hidden', !hasNodes);

    if (!hasNodes) {
        dotsEl.innerHTML = '';
        return;
    }

    dotsEl.innerHTML = '';
    for (const node of nodes) {
        const wrap = document.createElement('div');
        wrap.className = 'tl-node-wrap';

        const dot = document.createElement('div');
        dot.className = `tl-node status-${node.status}`;
        dot.title = `${getNodeEmoji(node.type)} ${node.label}`;
        if (node.messageId) {
            dot.dataset.msgId = node.messageId;
        }

        const emoji = document.createElement('span');
        emoji.className = 'tl-emoji';
        emoji.textContent = getNodeEmoji(node.type);
        dot.appendChild(emoji);
        wrap.appendChild(dot);
        dotsEl.appendChild(wrap);
    }
}

function scrollToMessage(msgId: string) {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement;
    if (!el) return;
    const scrollContainer = document.getElementById('chat-scroll');
    if (!scrollContainer) return;
    const offset = el.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - 16;
    scrollContainer.scrollTo({ top: offset, behavior: 'smooth' });
    el.classList.remove('msg-highlight');
    void el.offsetWidth;
    el.classList.add('msg-highlight');
}

function initNodePanel() {
    const dotsEl = document.getElementById('tl-dots');
    if (!dotsEl) return;
    dotsEl.addEventListener('click', (e) => {
        const node = (e.target as HTMLElement).closest('.tl-node') as HTMLElement;
        if (!node) return;
        if (node.classList.contains('status-pending')) return;
        const msgId = node.dataset.msgId;
        if (msgId) {
            scrollToMessage(msgId);
        }
    });
}

(window as any).addMessage = addMessage;
(window as any).renderMarkdown = renderMarkdown;
(window as any).renderMessages = renderMessages;
