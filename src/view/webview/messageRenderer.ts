import { G } from './state';
import { initTemplateChips } from './templateFlow';
import { reviewChangesMap, createReviewChangesElement, updateAcceptanceButtons, showRejectInput } from './flowCards';
import { renderMarkdown, escapeHtml } from './markdownRenderer';
import { createCard, createCardMessageElement, createCopyButton } from './cardBuilder';
import { createTimelineEntry, createMergedTimelineEntry, showTlFilterBar, forceTitle } from './timelineRenderer';
import { renderTodoCard, _parseTodoStr, _isTodoArray } from './todoRenderer';
import { renderToolBubbleContent } from './toolRenderer';
import { appendToChatMessages, updateLastMsgConvertBtn, resetTabGroup, clearMergeState, activeToolCallElements } from './chatStream';
import { getChatScroll, getChatMessages, getWorkingIndicator } from './domContainers';
import { groupPhases, foldPhase, STAGE_ORDER } from './taskView';

// ===== Remaining functions (message rendering) =====

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

export function addUserMessage(content: string) {
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    G._agentHeaderShown = false;

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

export function handleKnowledgeExtract(entries: any[]) {
    const container = getChatMessages();
    const scrollContainer = getChatScroll();
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
    const container = getChatMessages();
    const scrollContainer = getChatScroll();
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    if (G.activeTaskPhase) el.dataset.phase = G.activeTaskPhase;
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

    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;
    if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;

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

export function renderMessages(messages: any[]) {
    resetTabGroup();
    clearMergeState();
    activeToolCallElements.clear();
    const container = getChatMessages();
    const scrollContainer = getChatScroll();
    if (!container || !scrollContainer) return;

    const existingIndicator = getWorkingIndicator();
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
    if (inputEl) inputEl.placeholder = G.activeTaskType === 'assistant' ? '向小助手描述你的问题...' : '提出后续修改要求';

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
    let needAgentHeader = true;
    const isTaskView = !!document.querySelector('#task-view');
    for (const group of messageGroups) {
        const firstMsg = group.msgs[0];

        if (firstMsg.role === 'user') {
            addMessageElement(firstMsg, changedFilesMap.get(group.indices[0]));
            needAgentHeader = true;
            continue;
        }

        if (isTaskView && needAgentHeader) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'chat-msg agent-header';
            const msgPhase = firstMsg.phase || G.activeTaskPhase;
            if (msgPhase) headerDiv.dataset.phase = msgPhase;
            const hSender = document.createElement('div');
            hSender.className = 'msg-sender';
            hSender.textContent = 'Agent';
            headerDiv.appendChild(hSender);
            appendToChatMessages(headerDiv);
            needAgentHeader = false;
        }

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
    G._agentHeaderShown = !needAgentHeader;
    if (hasTlEntries) showTlFilterBar();

    updateLastMsgConvertBtn();

    const currentIdx = STAGE_ORDER.indexOf(G.activeTaskPhase);
    for (let i = 0; i < currentIdx; i++) {
        foldPhase(STAGE_ORDER[i]);
    }

    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;

    groupPhases();
}



export function addMessageElement(msg: any, changedFiles?: string[]) {
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const role = msg.role;
    const content = msg.content;

    if (msg.type === 'goal_confirmation') {
        const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
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
        const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
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
        const msgDiv = createCardMessageElement(taskId, msg.phase);
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
        const msgDiv = createCardMessageElement(msg.taskId, msg.phase);
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
        if (msg.phase) msgDiv.dataset.phase = msg.phase;

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
    if (role !== 'user' && msg.phase) {
        msgDiv.dataset.phase = msg.phase;
    }

    if (role === 'user') {
        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        const ts = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        sender.innerHTML = 'You' + (ts ? ' <span class="msg-timestamp">' + ts + '</span>' : '');
        msgDiv.appendChild(sender);
    }

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

    if (info.category) {
        const modeCapsule = document.getElementById('header-mode-capsule');
        if (modeCapsule) modeCapsule.textContent = info.category;
    }

    // Render demand card
    renderDemandCard(info);

    // Update stage badges
    updateStageBadges(info);

    (window as any).updateOutputPanel?.(info, []);
}

function renderDemandCard(info: any) {
    const confirmedItems: string[] = info.confirmedItems || [];
    const pendingItems: string[] = info.pendingItems || [];
    const originalRequest: string = info.originalRequest || '';

    // Original request block
    const origEl = document.getElementById('demand-original-request');
    const origText = document.getElementById('demand-original-text');
    if (origEl && origText) {
        if (originalRequest) {
            origEl.classList.remove('hidden');
            origText.textContent = originalRequest;
        } else {
            origEl.classList.add('hidden');
        }
    }

    // Empty hint
    const emptyHint = document.getElementById('demand-empty-hint');
    if (emptyHint) {
        emptyHint.style.display = (confirmedItems.length === 0 && pendingItems.length === 0) ? 'block' : 'none';
    }

    // Confirmed items
    const confirmedContainer = document.getElementById('demand-confirmed-list');
    if (confirmedContainer) {
        if (confirmedItems.length > 0) {
            confirmedContainer.innerHTML = '<div class="demand-list-label">已确认需求（' + confirmedItems.length + '）</div>'
                + confirmedItems.map((item: string) =>
                    '<div class="demand-item confirmed"><span class="demand-item-icon">✅</span><span class="demand-item-text">' + escapeHtml(item) + '</span></div>'
                ).join('');
        } else {
            confirmedContainer.innerHTML = '';
        }
    }

    // Pending items
    const pendingContainer = document.getElementById('demand-pending-list');
    if (pendingContainer) {
        if (pendingItems.length > 0) {
            pendingContainer.innerHTML = '<div class="demand-list-label">待确认需求（' + pendingItems.length + '）</div>'
                + pendingItems.map((item: string, idx: number) =>
                    '<div class="demand-item pending" data-idx="' + idx + '"><span class="demand-item-icon">◻️</span><span class="demand-item-text">' + escapeHtml(item) + '</span></div>'
                ).join('');
            // Click to confirm
            pendingContainer.querySelectorAll('.demand-item.pending').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
                    const taskId = G.activeTaskId;
                    if (taskId && G.vscode) {
                        G.vscode.postMessage({ type: 'confirmRequirement', taskId, index: idx });
                    }
                });
            });
        } else {
            pendingContainer.innerHTML = '';
        }
    }
}

export function updateStageBadges(info: any) {
    const confirmed = (info.confirmedItems || []).length;
    const pending = (info.pendingItems || []).length;
    const planSteps = info.planSteps || [];
    const doneSteps = planSteps.filter((s: any) => s.status === 'completed').length;
    const totalSteps = planSteps.length;

    // Demand badge
    const badgeDemand = document.getElementById('badge-demand');
    if (badgeDemand) {
        if (confirmed > 0 || pending > 0) {
            badgeDemand.textContent = '✓' + confirmed + ' 待' + pending;
        } else {
            badgeDemand.textContent = info.phase === 'demand' ? '待确认' : '';
        }
    }

    // Goal badge
    const badgeGoal = document.getElementById('badge-goal');
    if (badgeGoal) {
        badgeGoal.textContent = info.goal ? '🎯 已确认' : (info.phase === 'goal' ? '⏳ 待确认' : '');
    }

    // Plan badge
    const badgePlan = document.getElementById('badge-plan');
    if (badgePlan) {
        badgePlan.textContent = totalSteps > 0 ? doneSteps + '/' + totalSteps : '';
    }

    // Execute badge
    const badgeExec = document.getElementById('badge-execute');
    if (badgeExec) {
        const hasFiles = info.filePathsFromTools && info.filePathsFromTools.length > 0;
        badgeExec.textContent = hasFiles ? '📁' + info.filePathsFromTools.length : (info.executeFinished ? '✅ 完成' : '');
    }

    // Verify badge
    const badgeVerify = document.getElementById('badge-verify');
    if (badgeVerify) {
        const fi = info.flowIteration;
        const iter = fi?.state?.currentIteration || 0;
        badgeVerify.textContent = iter > 0 ? '迭代 ' + iter : '';
    }

    // Review badge
    const badgeReview = document.getElementById('badge-review');
    if (badgeReview) {
        const fileCount = info.pendingReviewFiles || 0;
        badgeReview.textContent = fileCount > 0 ? '📁' + fileCount + ' 待签' : '';
    }
}

export function flashInput() {
    const wrapper = document.querySelector('.input-wrapper');
    if (!wrapper) return;
    wrapper.classList.remove('input-flash');
    void (wrapper as HTMLElement).offsetWidth;
    wrapper.classList.add('input-flash');
}

// ===== Barrel re-exports =====

export { renderMarkdown, escapeHtml } from './markdownRenderer';
export { createCard, createCardMessageElement, createCopyButton } from './cardBuilder';
export type { CardAction } from './cardBuilder';
export { getTlKind, forceTitle, getTlIcon, getTlColor, createTimelineEntry, createMergedTimelineEntry, showTlFilterBar, initTlFilterBar } from './timelineRenderer';
export { renderTodoCard, buildTodoBodyHtml, _parseTodoStr, _todoHeaderHtml, _isTodoArray } from './todoRenderer';
export { renderToolBubbleContent, getToolKindIcon, formatToolTitle, extractContentFromXml } from './toolRenderer';
export { handleAgentStreamUpdate, handleAgentStatus, handleToolCallUpdate, flushMerge, appendToChatMessages, updateLastMsgConvertBtn, showAgentThinking, hideWorkingIndicator, updateWorkingIndicator, __resetStream, activeToolCallElements, resetTabGroup } from './chatStream';
