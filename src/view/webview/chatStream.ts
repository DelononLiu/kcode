import { G } from './state';
import { truncateModel } from './assistantView';
import { escapeHtml, renderMarkdown } from './markdownRenderer';
import { createTimelineEntry, createMergedTimelineEntry, showTlFilterBar, forceTitle } from './timelineRenderer';
import { _isTodoArray, _parseTodoStr, buildTodoBodyHtml } from './todoRenderer';
import { renderToolBubbleContent } from './toolRenderer';
import { getChatScroll, getChatMessages, getWorkingIndicator } from './domContainers';

// ===== Module-level state =====

export const activeToolCallElements: Map<string, HTMLElement> = new Map();

let _tabGroup: { elems: Map<string, any>; element: HTMLElement } | null = null;

export function resetTabGroup() { _tabGroup = null; }

let _mergeState: { thinkingId: string; thinkingTitle: string; thinkingBody: string; tools: any[] } | null = null;

export function clearMergeState() { _mergeState = null; }

let latestStreamText = '';
let streamRenderPending = false;

// ===== Working indicator =====

export function __resetStream() {
    G.streamMessageEl = null;
}

export function showAgentThinking() {
    const indicator = getWorkingIndicator();
    if (!indicator) return;
    const container = getChatMessages();
    const scrollContainer = getChatScroll();
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

export function updateWorkingIndicator(msg: any) {
    const indicator = getWorkingIndicator();
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
    const indicator = getWorkingIndicator();
    if (indicator) indicator.classList.add('hidden');
}

// ===== Append to chat =====

export function updateLastMsgConvertBtn() {
    if (G.activeTaskType !== 'assistant') return;
    const messages = getChatMessages();
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
    btn.textContent = '🌿 转为任务';
    btn.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'convertAssistantToTask' });
    });
    row.appendChild(btn);
}

export function appendToChatMessages(el: Element) {
    const container = getChatMessages()!;
    const indicator = getWorkingIndicator();
    if (indicator && indicator.parentElement === container) {
        container.insertBefore(el, indicator);
    } else {
        container.appendChild(el);
    }
    updateLastMsgConvertBtn();
}

// ===== Stream handlers =====

export function handleAgentStreamUpdate(text: string) {
    resetTabGroup();
    flushMerge();
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    if (!G.streamMessageEl) {
        G._userScrolledUp = false;
        hideWorkingIndicator();

        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg agent';
        if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;

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

export function handleAgentStatus(status: string, message: string, agentName: string, modelName?: string) {
    const headerDot = document.getElementById('header-agent-dot');
    if (headerDot) {
        headerDot.className = 'agent-dot ' + (status === 'connected' ? 'online' : 'offline');
        headerDot.title = message;
    }
    if (modelName) {
        G.activeModelName = modelName;
        const modelBadge = document.getElementById('task-model-badge');
        if (modelBadge && G.activeTaskType === 'assistant') {
            modelBadge.textContent = modelName;
            modelBadge.classList.remove('hidden');
        }
    }
    if (status === 'connected') {
        const headerAgentName = document.getElementById('header-agent-name');
        if (headerAgentName) headerAgentName.textContent = agentName;
        const headerModelName = document.getElementById('header-model-name');
        if (headerModelName && modelName) {
            headerModelName.textContent = truncateModel(modelName);
            headerModelName.title = modelName;
        }
    }
}

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
        if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(mergedEntry);
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
    }
    _mergeState = null;
}

export function handleToolCallUpdate(msg: any) {
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
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
            if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
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
            if (content) {
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
            if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
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

(window as any).__resetStream = __resetStream;
