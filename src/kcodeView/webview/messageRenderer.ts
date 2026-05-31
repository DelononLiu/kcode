import { truncateModel } from './assistantView';
import { G, type FileChange } from './state';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { initTemplateChips } from './templateFlow';
import { reviewChangesMap, createReviewChangesElement, updateAcceptanceButtons, showRejectInput } from './flowCards';

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

export function __resetStream() {
    G.streamMessageEl = null;
}

export function activateTab(tabName: string) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.classList.add('active');
}

export function formatTimestamp(ts: number): string {
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

export function addUserMessage(content: string) {
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

export function showAgentThinking() {
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

export function handleKnowledgeExtract(entries: any[]) {
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container || !scrollContainer || entries.length === 0) return;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();
    const typeIcons: Record<string, string> = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' };
    const headerIcon = '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 4l.5-.5h3.5L7 4.5h6.5l.5.5v9l-.5.5h-11l-.5-.5V4zm1 1v8h10V6H7l-1-1H3z"/></svg></span>';
    let bodyHtml = '<div style="padding:2px 0"><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid var(--border-weak,rgba(255,255,255,.1))"><th style="padding:4px 6px;text-align:left;color:var(--text-weak,#888)">类型</th><th style="padding:4px 6px;text-align:left;color:var(--text-weak,#888)">标题</th><th style="padding:4px 6px;text-align:left;color:var(--text-weak,#888)">标签</th></tr></thead><tbody>';
    for (const entry of entries) {
        const icon = typeIcons[entry.type] || '📌';
        const tags = (entry.tags || []).map((t: string) => `<span class="op-tag">${escapeHtml(t)}</span>`).join('');
        bodyHtml += `<tr style="border-bottom:1px solid rgba(255,255,255,.04)"><td style="padding:4px 6px">${icon}</td><td style="padding:4px 6px">${escapeHtml(entry.title)}</td><td style="padding:4px 6px">${tags}</td></tr>`;
    }
    bodyHtml += '</tbody></table></div>';
    const card = createCard({ headerHtml: headerIcon + '<span class="tool-title-label">知识萃取</span> <span class="todo-header-progress">' + entries.length + '条</span>', bodyHtml, defaultCollapsed: false });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg tool';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.appendChild(card);
    msgDiv.appendChild(bubble);
    appendToChatMessages(msgDiv);
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function addSystemMessage(content: string) {
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.innerHTML = `<div class="msg-bubble system">${content}</div>`;
    container.appendChild(el);
    updateLastMsgConvertBtn();
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function addMessage(role: 'user' | 'agent', content: string) {
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

export function collectChangedFiles(messages: any[], startIdx: number): string[] {
    const files: string[] = [];
    for (let i = startIdx; i < messages.length; i++) {
        const m = messages[i];
        if (m.role !== 'tool') continue;
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

export function _getToolKindFromMsg(msg: any): string {
    if (msg.role === 'tool' && msg.type === 'tool_call') {
        try { return JSON.parse(msg.content).kind || ''; }
        catch { return ''; }
    }
    return '';
}

export function _isTodoArray(text: string): boolean {
    try {
        const arr = JSON.parse(text.trim());
        return Array.isArray(arr) && arr.length > 0 && arr.every((item: any) =>
            item && typeof item.content === 'string' && typeof item.status === 'string'
        );
    } catch {
        return false;
    }
}

export function renderMessages(messages: any[]) {
    resetTabGroup();
    _mergeState = null;
    activeToolCallElements.clear();
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container || !scrollContainer) return;

    const existingIndicator = document.getElementById('working-indicator');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) (placeholder as HTMLElement).style.display = '';

    container.innerHTML = '';
    if (existingIndicator) container.appendChild(existingIndicator);

    const inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!messages || messages.length === 0) {
        scrollContainer.classList.remove('chat-empty');
        document.getElementById('chat-header')?.style.removeProperty('display');
        document.getElementById('chat-body')?.classList.remove('showing-categories');
        initTemplateChips();
        if (inputEl) inputEl.placeholder = '输入需求，开始与 AI 对话';
        return;
    }

    scrollContainer.classList.remove('chat-empty');
    document.getElementById('chat-body')?.classList.remove('showing-categories');
    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) chatHeader.style.display = '';
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

    const messageGroups: { type: 'single' | 'tool-group'; msgs: any[]; indices: number[] }[] = [];
    function _isToolTodo(msg: any): boolean {
        const kind = _getToolKindFromMsg(msg);
        if (kind === 'todowrite') return true;
        try {
            const info = JSON.parse(msg.content);
            return _isTodoArray(info.output || '');
        } catch { return false; }
    }
    for (let mi = 0; mi < messages.length; mi++) {
        if (messages[mi].role === 'tool' && messages[mi].type === 'tool_call') {
            if (_isToolTodo(messages[mi])) {
                messageGroups.push({ type: 'single', msgs: [messages[mi]], indices: [mi] });
                continue;
            }
            const groupMsgs = [messages[mi]];
            const groupIndices = [mi];
            while (mi + 1 < messages.length && messages[mi + 1].role === 'tool' && messages[mi + 1].type === 'tool_call') {
                if (_isToolTodo(messages[mi + 1])) break;
                mi++;
                groupMsgs.push(messages[mi]);
                groupIndices.push(mi);
            }
            messageGroups.push({ type: 'tool-group', msgs: groupMsgs, indices: groupIndices });
        } else {
            messageGroups.push({ type: 'single', msgs: [messages[mi]], indices: [mi] });
        }
    }

    let hasTlEntries = false;
    for (const group of messageGroups) {
        if (group.type === 'tool-group' && group.msgs.length > 0) {
            let pendingThinking: any = null;
            let mergedTools: any[] = [];
            for (const msg of group.msgs) {
                let info: any;
                try { info = JSON.parse(msg.content); } catch { continue; }
                if (info.kind === 'todowrite' || _isToolTodo(msg)) {
                    addMessageElement(msg, changedFilesMap.get(msg.id));
                    continue;
                }
                if (info.kind === 'thinking') {
                    if (mergedTools.length > 0 && pendingThinking) {
                        const mergedEntry = createMergedTimelineEntry({ title: forceTitle('thinking', pendingThinking.title || '思考'), content: pendingThinking.output || pendingThinking.content || '' }, mergedTools);
                        const msgDiv = document.createElement('div');
                        msgDiv.className = 'chat-msg tool';
                        const bubble = document.createElement('div');
                        bubble.className = 'msg-bubble';
                        bubble.appendChild(mergedEntry);
                        msgDiv.appendChild(bubble);
                        appendToChatMessages(msgDiv);
                        hasTlEntries = true;
                    }
                    pendingThinking = info;
                    mergedTools = [];
                    continue;
                }
                if (pendingThinking) {
                    mergedTools.push({ toolCallId: info.toolCallId || '', kind: info.kind || '', title: info.title || '', status: info.status || 'completed', content: info.output || info.content || '', taskId: msg.taskId });
                } else {
                    const entry = createTimelineEntry({ toolCallId: info.toolCallId || '', kind: info.kind || '', title: info.title || '', status: info.status || 'completed', content: info.output || info.content || '', taskId: msg.taskId });
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'chat-msg tool';
                    const bubble = document.createElement('div');
                    bubble.className = 'msg-bubble';
                    bubble.appendChild(entry);
                    msgDiv.appendChild(bubble);
                    appendToChatMessages(msgDiv);
                    hasTlEntries = true;
                }
            }
            if (pendingThinking && mergedTools.length > 0) {
                const mergedEntry = createMergedTimelineEntry({ title: forceTitle('thinking', pendingThinking.title || '思考'), content: pendingThinking.output || pendingThinking.content || '' }, mergedTools);
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg tool';
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.appendChild(mergedEntry);
                msgDiv.appendChild(bubble);
                appendToChatMessages(msgDiv);
                hasTlEntries = true;
            } else if (pendingThinking && mergedTools.length === 0) {
                const entry = createTimelineEntry({ toolCallId: '', kind: 'thinking', title: forceTitle('thinking', pendingThinking.title || '思考'), status: 'completed', content: pendingThinking.output || pendingThinking.content || '' });
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg tool';
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.appendChild(entry);
                msgDiv.appendChild(bubble);
                appendToChatMessages(msgDiv);
                hasTlEntries = true;
            }
        } else {
            addMessageElement(group.msgs[0], changedFilesMap.get(group.indices[0]));
        }
    }
    if (hasTlEntries) showTlFilterBar();

    updateLastMsgConvertBtn();

    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function updateLastMsgConvertBtn() {
    if (G.activeTaskType !== 'assistant') return;
    const messages = document.getElementById('chat-messages');
    if (!messages) return;
    const agentMsgs = messages.querySelectorAll('.chat-msg.agent');
    if (agentMsgs.length === 0) return;

    messages.querySelectorAll('.convert-task-btn').forEach(el => el.remove());
    const lastAgent = agentMsgs[agentMsgs.length - 1] as HTMLElement;
    const row = lastAgent.querySelector('.msg-row') as HTMLElement;
    if (!row) return;
    const btn = document.createElement('button');
    btn.className = 'convert-task-btn';
    btn.title = '将当前对话转为正式任务';
    btn.textContent = '转为任务';
    btn.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'convertAssistantToTask' });
    });
    row.appendChild(btn);
}

export function addMessageElement(msg: any, changedFiles?: string[]) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const role = msg.role;
    const content = msg.content;

    // goal_confirmed 不渲染独立卡片，计划卡片已包含目标
    if (msg.type === 'goal_confirmation') {
        const msgDiv = createCardMessageElement(msg.taskId);
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const bodyText = content.replace(/^📋 任务目标确认\n\n/, '');
        const isConfirmed = msg.type === 'goal_confirmed';

        const card = createCard({
            headerHtml: '🎯 任务目标',
            bodyMarkdown: bodyText,
            rawData: msg,
            defaultCollapsed: false,
            borderColor: '#3c3c3c',
            headerBg: '#2d2d2d',
            headerColor: '#e0e0e0',
        });

        if (isConfirmed) {
            const statusEl = document.createElement('div');
            statusEl.className = 'msg-card-status';
            statusEl.textContent = '✅ 已确认';
            card.appendChild(statusEl);
        }

        bubble.appendChild(card);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'plan_proposal' || msg.type === 'plan_confirmed') {
        const msgDiv = createCardMessageElement(msg.taskId);
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const bodyText = content.replace(/^📋 计划方案\n\n/, '');
        const isConfirmed = msg.type === 'plan_confirmed';

        const card = createCard({
            headerHtml: '📋 计划方案',
            bodyHtml: bodyText ? bodyText.split('\n').map((line: string) => `<div class="plan-step-line">${line}</div>`).join('') : '',
            rawData: msg,
            defaultCollapsed: false,
            borderColor: '#4a8bb5',
            headerBg: '#1e2d3d',
            headerColor: '#e0e0e0',
        });

        if (isConfirmed) {
            const statusEl = document.createElement('div');
            statusEl.className = 'msg-card-status';
            statusEl.textContent = '✅ 已确认';
            card.appendChild(statusEl);
        }

        bubble.appendChild(card);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'review_request' || msg.type === 'review_approved' || msg.type === 'review_rejected') {
        const taskId = msg.taskId;
        const msgDiv = createCardMessageElement(taskId);
        const bubble = msgDiv.querySelector('.msg-bubble')!;

        const card = createCard({
            headerHtml: '✅ 验收',
            bodyMarkdown: content,
            rawData: msg,
            defaultCollapsed: false,
            borderColor: '#2a5a2a',
            headerBg: '#1a3a1a',
            headerColor: '#e0e0e0',
        });
        card.dataset.reviewTaskId = taskId;

        const changes = reviewChangesMap.get(taskId);
        if (changes && changes.length > 0) {
            const list = createReviewChangesElement(changes, taskId);
            const body = card.querySelector('.msg-card-body');
            if (body) body.appendChild(list);
        }

        if (G.lastAcceptanceCriteria && G.lastAcceptanceCriteria.length > 0) {
            const body = card.querySelector('.msg-card-body');
            if (body) {
                const criteriaEl = document.createElement('div');
                criteriaEl.className = 'review-criteria';
                const label = document.createElement('div');
                label.className = 'review-criteria-label';
                label.textContent = '📋 验收清单（勾选通过的项）';
                criteriaEl.appendChild(label);

                if (!G.acceptanceCheckedState.has(taskId)) {
                    G.acceptanceCheckedState.set(taskId, G.lastAcceptanceCriteria.map(() => false));
                }
                const checkedState = G.acceptanceCheckedState.get(taskId)!;

                for (let ci = 0; ci < G.lastAcceptanceCriteria.length; ci++) {
                    const c = G.lastAcceptanceCriteria[ci];
                    const item = document.createElement('label');
                    item.className = 'review-criteria-item';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'criteria-checkbox';
                    cb.checked = checkedState[ci];
                    cb.addEventListener('change', () => {
                        checkedState[ci] = cb.checked;
                        G.acceptanceCheckedState.set(taskId, checkedState);
                        updateAcceptanceButtons(taskId);
                    });
                    item.appendChild(cb);
                    item.append(document.createTextNode(' ' + c));
                    criteriaEl.appendChild(item);
                }
                body.appendChild(criteriaEl);
            }
        }

        const isPending = msg.type === 'review_request';
        if (isPending) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'msg-card-actions';

            const approveBtn = document.createElement('button');
            approveBtn.className = 'msg-card-btn primary';
            approveBtn.textContent = '验收通过 ✓';
            approveBtn.addEventListener('click', () => {
                actionsDiv.innerHTML = '';
                const status = document.createElement('div');
                status.className = 'msg-card-status';
                status.textContent = '✅ 已验收通过';
                actionsDiv.appendChild(status);
                G.vscode.postMessage({ type: 'approveReview', taskId });
            });
            actionsDiv.appendChild(approveBtn);

            const partialBtn = document.createElement('button');
            partialBtn.className = 'msg-card-btn secondary';
            partialBtn.textContent = '逐条通过';
            partialBtn.id = 'partial-approve-btn';
            partialBtn.style.display = 'none';
            partialBtn.addEventListener('click', () => {
                const checkedArr = G.acceptanceCheckedState.get(taskId);
                if (!checkedArr) return;
                const passed = G.lastAcceptanceCriteria?.filter((_, i) => checkedArr[i]) || [];
                const failed = G.lastAcceptanceCriteria?.filter((_, i) => !checkedArr[i]) || [];
                actionsDiv.innerHTML = '';
                const status = document.createElement('div');
                status.className = 'msg-card-status';
                status.textContent = `✅ 部分通过（${passed.length}/${(G.lastAcceptanceCriteria || []).length}）`;
                actionsDiv.appendChild(status);
                G.vscode.postMessage({ type: 'partialApproveReview', taskId, passed, failed });
            });
            actionsDiv.appendChild(partialBtn);

            const rejectBtn = document.createElement('button');
            rejectBtn.className = 'msg-card-btn secondary';
            rejectBtn.textContent = '驳回 ↩';
            rejectBtn.addEventListener('click', () => {
                showRejectInput(rejectBtn, taskId);
            });
            actionsDiv.appendChild(rejectBtn);

            (card as any).__updateAcceptanceButtons = () => {
                const checkedArr = G.acceptanceCheckedState.get(taskId);
                if (!checkedArr) return;
                const hasChecked = checkedArr.some(Boolean);
                partialBtn.style.display = hasChecked ? '' : 'none';
            };
            (card as any).__updateAcceptanceButtons();

            card.appendChild(actionsDiv);
        } else {
            const statusText = msg.type === 'review_approved' ? '✅ 已验收通过' : '↩️ 已驳回';
            const statusEl = document.createElement('div');
            statusEl.className = 'msg-card-status';
            statusEl.textContent = statusText;
            card.appendChild(statusEl);
        }

        bubble.appendChild(card);
        appendToChatMessages(msgDiv);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (msg.type === 'todo') {
        const msgDiv = createCardMessageElement(msg.taskId);
        const bubble = msgDiv.querySelector('.msg-bubble')!;
        const card = renderTodoCard(msg);
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

    // Plugin message renderer hook (P28-06)
    const pluginRenderer = (window as any).pluginRegistry?.resolveMessageRenderer(msg.type);
    if (pluginRenderer) {
        const el = pluginRenderer(msg);
        if (el) {
            appendToChatMessages(el);
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            return;
        }
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

export function updateTaskInfo(info: any) {
    G.activeTaskStatus = info.status || '';
    G.activeTaskPhase = info.phase || '';
    G.activeTaskTitle = info.title || '';
    G.activeTaskGoal = info.goal || '';

    // V3: Update header status pill
    const statusPill = document.getElementById('header-status-pill');
    if (statusPill) {
        const statusText = document.getElementById('header-status-text');
        if (statusText) {
            const statusMap: Record<string, string> = {
                pending: '待确认', active: '任务攻坚中', in_review: '待验收',
                completed: '已完成', cancelled: '已取消'
            };
            statusText.textContent = statusMap[info.status] || '任务攻坚中';
        }
    }

    // V3: Update header mode capsule
    if (info.category) {
        const modeCapsule = document.getElementById('header-mode-capsule');
        if (modeCapsule) modeCapsule.textContent = info.category;
    }

    // Update output panel (legacy)
    (window as any).updateOutputPanel?.(info, []);
}

export function flashInput() {
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

export function _parseTodoStr(text: string): { items: any[]; done: number; total: number } {
    let items: any[] = [];
    const titleMatch = text.match(/<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/);
    if (titleMatch) {
        try { items = JSON.parse(titleMatch[1]); } catch {}
    } else if (text.trim().startsWith('[')) {
        try { items = JSON.parse(text.trim()); } catch {}
    }
    items = items.map((item: any, idx: number) => ({
        id: String(idx),
        content: String(item.content || ''),
        status: item.status === 'completed' ? 'completed' : 'pending',
    }));
    const done = items.filter((i: any) => i.status === 'completed').length;
    return { items, done, total: items.length };
}

export function _todoHeaderHtml(done: number, total: number): string {
    return `✅ 待办清单 <span class="todo-header-progress">${done}/${total}</span>`;
}

export function renderTodoCard(msg: any): HTMLElement {
    let items: any[];
    try {
        items = JSON.parse(msg.content || '[]');
    } catch {
        items = [];
    }
    items = items.map((item: any, idx: number) => ({
        id: String(idx),
        content: String(item.content || ''),
        status: item.status === 'completed' ? 'completed' : 'pending',
    }));
    const done = items.filter((i: any) => i.status === 'completed').length;
    const total = items.length;

    const bodyHtml = items.map((item: any) => {
        const isDone = item.status === 'completed';
        return `<label class="todo-item"><input type="checkbox" class="todo-checkbox" data-msg-id="${msg.id}" data-item-id="${item.id}" ${isDone ? 'checked' : ''}><span class="todo-item-text${isDone ? ' todo-done' : ''}">${escapeHtml(item.content)}</span></label>`;
    }).join('');

    const card = createCard({
        headerHtml: _todoHeaderHtml(done, total),
        bodyHtml: `<div class="todo-list">${bodyHtml}</div>`,
        rawData: msg,
        defaultCollapsed: false,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    card.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.classList.contains('todo-checkbox')) return;
        const msgId = target.dataset.msgId;
        const itemId = target.dataset.itemId;
        const checked = target.checked;
        G.vscode.postMessage({ type: 'updateTodoItem', taskId: msg.taskId, msgId, itemId, checked });
    });

    return card;
}

export function buildTodoBodyHtml(output: string, toolCallId: string, taskId: string): string {
    const { items } = _parseTodoStr(output);
    if (items.length === 0) {
        return '<div class="op-empty">无待办项</div>';
    }
    const itemsHtml = items.map((item: any) => {
        const d = item.status === 'completed';
        return `<label class="todo-item"><input type="checkbox" class="todo-checkbox" data-msg-id="tool_${toolCallId}" data-item-id="${item.id}" ${d ? 'checked' : ''}><span class="todo-item-text${d ? ' todo-done' : ''}">${escapeHtml(item.content)}</span></label>`;
    }).join('');
    return `<div class="todo-list">${itemsHtml}</div>`;
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

    const autoExpand = status === 'running' || status === 'pending' || status === 'failed' || status === 'error'
        || (tlKind === 'thinking' && output && !output.includes('\n'));
    if (output && autoExpand) body.classList.add('open');

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

    if (tlKind === 'thinking' && output && !output.includes('\n')) {
        body.classList.add('open');
        if (preview) preview.classList.add('hidden');
    }

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

    if (status === 'running' || status === 'pending' || status === 'failed' || status === 'error') {
        body.classList.add('open');
    }

    header.appendChild(iconEl);
    header.appendChild(titleEl);

    const togglers: (() => void)[] = [];

    header.addEventListener('click', () => togglers.forEach(fn => fn()));

    main.appendChild(header);

    // Thinking preview — first line, click to toggle tool output body
    const thinkingOutput = thinkingMsg.content || '';
    const hasOneLine = thinkingOutput && !thinkingOutput.includes('\n');
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

    if (hasOneLine) {
        body.classList.add('open');
        if (preview) preview.classList.add('hidden');
    }

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
        case 'bash': label = '命令'; detail = title; break;
        case 'command': label = '命令'; detail = title; break;
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
            defaultCollapsed: !!hasMultipleLines,
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
        if (kind === 'bash' || kind === 'command' || kind === 'terminal') preClass += ' tool-bash-output';
        else if (kind === 'write' || kind === 'edit') preClass += ' tool-body-diff';
        bodyHtml = '<pre class="' + preClass + '">' + escapeHtml(displayContent) + '</pre>';
    }

    let bodyClassName = 'tool-card-body';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal') bodyClassName += ' tool-body-bash';

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

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function updateWorkingIndicator(msg: any) {
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

export function hideWorkingIndicator() {
    const indicator = document.getElementById('working-indicator');
    if (indicator) indicator.classList.add('hidden');
}

// streamMessageEl is in G

export function appendToChatMessages(el: Element) {
    const container = document.getElementById('chat-messages')!;
    const indicator = document.getElementById('working-indicator');
    if (indicator && indicator.parentElement === container) {
        container.insertBefore(el, indicator);
    } else {
        container.appendChild(el);
    }
    updateLastMsgConvertBtn();
}

export function handleAgentStreamUpdate(text: string) {
    resetTabGroup();
    flushMerge();
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    if (!G.streamMessageEl) {
        G._userScrolledUp = false;
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
        G.streamMessageEl = bubble;
    }

    latestStreamText = text;
    if (!streamRenderPending) {
        streamRenderPending = true;
        setTimeout(() => {
            streamRenderPending = false;
            if (G.streamMessageEl) {
                G.streamMessageEl.innerHTML = renderMarkdown(latestStreamText);
                if (!G._userScrolledUp) {
                    G._programmaticScroll = true;
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    requestAnimationFrame(() => { G._programmaticScroll = false; });
                }
            }
        }, 50);
    }
}

let latestStreamText = '';
let streamRenderPending = false;

export function handleAgentStatus(status: string, message: string, agentName: string, modelName?: string) {
    const statusDot = document.getElementById('agent-status-dot');
    if (statusDot) {
        statusDot.className = 'status-dot ' + (status === 'connected' ? 'online' : 'offline');
        statusDot.title = message;
    }
    const headerDot = document.getElementById('header-agent-dot');
    if (headerDot) {
        headerDot.className = 'agent-dot ' + (status === 'connected' ? 'online' : 'offline');
        headerDot.title = message;
    }
    const label = document.getElementById('agent-dropdown-label');
    const list = document.getElementById('agent-dropdown-list');
    const modelLabel = document.getElementById('model-dropdown-label');
    if (!label || !list) return;
    if (status === 'connected') {
        const activeItem = list.querySelector(`.agent-dropdown-item[data-value="${agentName}"]`) as HTMLElement;
        const displayName = activeItem?.querySelector('.agent-name')?.textContent || agentName;
        label.textContent = displayName;
        list.querySelectorAll('.agent-dropdown-item').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.value === agentName);
        });
        if (modelLabel && modelName) {
            modelLabel.textContent = truncateModel(modelName);
            modelLabel.title = modelName;
        }
        if (modelName) {
            G.activeModelName = modelName;
            const modelBadge = document.getElementById('task-model-badge');
            if (modelBadge && G.activeTaskType === 'assistant') {
                modelBadge.textContent = modelName;
                modelBadge.classList.remove('hidden');
            }
        }
    }
}

(window as any).__resetStream = __resetStream;

const activeToolCallElements: Map<string, HTMLElement> = new Map();

let _tabGroup: { elems: Map<string, any>; element: HTMLElement } | null = null;
export function resetTabGroup() { _tabGroup = null; }

let _mergeState: { thinkingId: string; thinkingTitle: string; thinkingBody: string; tools: any[] } | null = null;

export function flushMerge() {
    if (!_mergeState) return;
    const { thinkingTitle, thinkingBody, tools } = _mergeState;
    if (tools.length > 0) {
        const mergedEntry = createMergedTimelineEntry({ title: thinkingTitle, content: thinkingBody }, tools);
        const existingMerge = document.querySelector('.tl-entry.tl-merged');
        if (existingMerge) {
            const msgDiv = existingMerge.closest('.chat-msg');
            if (msgDiv) msgDiv.remove();
        }
        const thinkingEntry = document.querySelector(`.tl-entry[data-tl-id="${_mergeState.thinkingId}"]`);
        if (thinkingEntry) {
            const thinkingMsgDiv = thinkingEntry.closest('.chat-msg');
            if (thinkingMsgDiv) thinkingMsgDiv.remove();
        }
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(mergedEntry);
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
    }
    _mergeState = null;
}

export function handleToolCallUpdate(msg: any) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const toolId = msg.toolCallId;
    const kind = msg.kind || '';
    const rawContent = msg.content || msg.output || '';

    if (kind === 'todowrite' || _isTodoArray(rawContent)) {
        flushMerge();
        _tabGroup = null;
        if (activeToolCallElements.has(toolId)) {
            const existingEl = activeToolCallElements.get(toolId)!;
            const raw = msg.content || msg.output || '';
            const body = existingEl.querySelector('.msg-card-body');
            if (body && raw) body.innerHTML = buildTodoBodyHtml(raw, toolId, msg.taskId || G.activeTaskId || '');
            const header = existingEl.querySelector('.msg-card-header-text');
            if (header) {
                const { done, total } = _parseTodoStr(raw);
                const svg = '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 5h12v2H2V7zm0 5h8v2H2v-2z"/></svg></span>';
                header.innerHTML = svg + '<span class="tool-title-label">待办清单</span> <span class="todo-header-progress">' + done + '/' + total + '</span>';
            }
        } else {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            msgDiv.dataset.msgId = 'tool_' + toolId;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble tool-bubble';
            msgDiv.appendChild(bubble);
            renderToolBubbleContent(bubble, {
                toolCallId: toolId, kind: 'todowrite', title: msg.title || '待办清单',
                status: msg.status || 'running', content: msg.content || msg.output || '',
                taskId: msg.taskId || G.activeTaskId || '',
            });
            appendToChatMessages(msgDiv);
            activeToolCallElements.set(toolId, msgDiv);
        }
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (kind === 'thinking') {
        const preMergeThinkingId = _mergeState?.thinkingId;
        const preMergeHasTools = _mergeState && _mergeState.tools.length > 0;
        flushMerge();
        if (preMergeHasTools && preMergeThinkingId === toolId) {
            updateWorkingIndicator(msg);
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            return;
        }
        const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
        if (existingEntry) {
            const bodyPre = existingEntry.querySelector('.tl-entry-body pre');
            if (bodyPre) bodyPre.textContent = msg.content || msg.output || '';
            const content = msg.content || msg.output || '';
            const tlBody = existingEntry.querySelector('.tl-entry-body');
            const preview = existingEntry.querySelector('.tl-thinking-preview') as HTMLElement | null;
            if (content && !content.includes('\n')) {
                if (tlBody) tlBody.classList.add('open');
                if (preview) preview.classList.add('hidden');
            } else if (content) {
                if (tlBody) tlBody.classList.remove('open');
                if (preview) {
                    preview.classList.remove('hidden');
                    preview.textContent = content.split('\n')[0].trim();
                }
            }
        } else {
            const entry = createTimelineEntry({
                toolCallId: toolId, kind, title: msg.title || '',
                status: msg.status || '', content: msg.content || msg.output || '',
                taskId: msg.taskId || G.activeTaskId || '',
            });
            entry.dataset.tlId = toolId;
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            msgDiv.dataset.msgId = 'tool_' + toolId;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.appendChild(entry);
            msgDiv.appendChild(bubble);
            appendToChatMessages(msgDiv);
            showTlFilterBar();
        }
        _mergeState = {
            thinkingId: toolId,
            thinkingTitle: existingEntry
                ? (existingEntry.querySelector('.tl-entry-title')?.textContent || '思考')
                : forceTitle('thinking', msg.title || '思考'),
            thinkingBody: msg.content || msg.output || '',
            tools: [],
        };
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (_mergeState) {
        const toolInfo = { kind, title: msg.title || '', content: msg.content || msg.output || '', status: msg.status || '' };
        const existingIdx = _mergeState.tools.findIndex((t: any) => t.toolId === toolId);
        if (existingIdx >= 0) {
            _mergeState.tools[existingIdx] = { ..._mergeState.tools[existingIdx], ...toolInfo };
            const status = msg.status || '';
            if (status === 'running' || status === 'failed' || status === 'error') {
                const mergedEntry = createMergedTimelineEntry(
                    { title: _mergeState.thinkingTitle, content: _mergeState.thinkingBody },
                    _mergeState.tools
                );
                const existingMerge = document.querySelector('.tl-entry.tl-merged');
                if (existingMerge) {
                    const msgDiv = existingMerge.closest('.chat-msg');
                    if (msgDiv) msgDiv.remove();
                }
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg tool';
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.appendChild(mergedEntry);
                msgDiv.appendChild(bubble);
                appendToChatMessages(msgDiv);
            }
        } else {
            _mergeState.tools.push({ toolId, ...toolInfo });
            const thinkingEntry = document.querySelector(`.tl-entry[data-tl-id="${_mergeState.thinkingId}"]`);
            if (thinkingEntry) {
                const thinkingMsgDiv = thinkingEntry.closest('.chat-msg');
                if (thinkingMsgDiv) thinkingMsgDiv.remove();
            }
            const existingMerge = document.querySelector('.tl-entry.tl-merged');
            if (existingMerge) {
                const msgDiv = existingMerge.closest('.chat-msg');
                if (msgDiv) msgDiv.remove();
            }
            const mergedEntry = createMergedTimelineEntry(
                { title: _mergeState.thinkingTitle, content: _mergeState.thinkingBody },
                _mergeState.tools
            );
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.appendChild(mergedEntry);
            msgDiv.appendChild(bubble);
            appendToChatMessages(msgDiv);
        }
        showTlFilterBar();
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
    if (existingEntry) {
        const body = existingEntry.querySelector('.tl-entry-body');
        const newContent = msg.content || msg.output || '';
        if (body && newContent) {
            const pre = body.querySelector('pre');
            if (pre) pre.textContent = newContent;
            const autoExpand = msg.status === 'running' || msg.status === 'pending' || msg.status === 'failed' || msg.status === 'error';
            if (autoExpand && !body.classList.contains('open')) {
                body.classList.add('open');
                const expand = existingEntry.querySelector('.tl-entry-expand');
                if (expand) expand.classList.add('open');
            }
        }
    } else {
        const entry = createTimelineEntry({
            toolCallId: toolId, kind, title: msg.title || '',
            status: msg.status || '', content: msg.content || msg.output || '',
            taskId: msg.taskId || G.activeTaskId || '',
        });
        entry.dataset.tlId = toolId;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';
        msgDiv.dataset.msgId = 'tool_' + toolId;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(entry);
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
        showTlFilterBar();
    }

    updateWorkingIndicator(msg);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}
