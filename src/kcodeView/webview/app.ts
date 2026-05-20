import { marked } from 'marked';
import hljs from 'highlight.js';
import { AppState, type FileChange } from './state';

declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();
(window as any).__vscode = vscode;

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
    initNodePanel();
    initNavButtons();
    initTlFilterBar();
    (window as any).initOutputPanel?.();

    const dataEl = document.getElementById('__panelData');
    if (dataEl) {
        const agents = JSON.parse(dataEl.dataset.availableAgents || '[]');
        if (agents.length > 0) {
            initAgentSelector(agents);
        }
    }
    initTemplateChips();

    (window as any).__openNativeDiff = (original: string, modified: string, filePath: string) => {
        vscode.postMessage({ type: 'openNativeDiff', original, modified, filePath });
    };
});

function initNavButtons() {
    const scrollContainer = document.getElementById('chat-scroll');
    const navBtns = document.getElementById('chat-nav-btns');
    const topBtn = document.getElementById('nav-top-btn') as HTMLButtonElement;
    const prevBtn = document.getElementById('nav-prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('nav-next-btn') as HTMLButtonElement;
    const bottomBtn = document.getElementById('nav-bottom-btn') as HTMLButtonElement;
    if (!scrollContainer || !navBtns || !topBtn || !prevBtn || !nextBtn || !bottomBtn) return;

    let currentIdx = -1;

    function update() {
        const sc = scrollContainer!;
        const nb = navBtns!;
        const userMsgs = sc.querySelectorAll('.chat-msg.user');
        const hasUserMsgs = userMsgs.length > 0;
        const atTop = sc.scrollTop < 48;
        const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 48;

        if (hasUserMsgs && !atBottom) {
            nb.classList.remove('hidden');
        } else {
            nb.classList.add('hidden');
            return;
        }

        topBtn.disabled = atTop;
        prevBtn.disabled = currentIdx <= 0;
        nextBtn.disabled = currentIdx >= userMsgs.length - 1 || currentIdx < 0;
        bottomBtn.disabled = atBottom;

        currentIdx = -1;
        const scrollCenter = sc.scrollTop + sc.clientHeight / 2;
        userMsgs.forEach((el, i) => {
            const top = (el as HTMLElement).offsetTop;
            if (top <= scrollCenter) currentIdx = i;
        });

        prevBtn.disabled = currentIdx <= 0;
        nextBtn.disabled = currentIdx >= userMsgs.length - 1 || currentIdx < 0;
    }

    topBtn.addEventListener('click', () => {
        scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', () => {
        const userMsgs = scrollContainer.querySelectorAll('.chat-msg.user');
        if (userMsgs.length === 0) return;
        const targetIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        (userMsgs[targetIdx] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    nextBtn.addEventListener('click', () => {
        const userMsgs = scrollContainer.querySelectorAll('.chat-msg.user');
        if (userMsgs.length === 0) return;
        if (currentIdx >= 0 && currentIdx < userMsgs.length - 1) {
            (userMsgs[currentIdx + 1] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }
    });

    bottomBtn.addEventListener('click', () => {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
    });

    scrollContainer.addEventListener('scroll', update);

    const observer = new MutationObserver(() => update());
    observer.observe(scrollContainer, { childList: true, subtree: true });

    update();
}

function initMessageHandler() {
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'loadMessages':
                hideWorkingIndicator();
                streamMessageEl = null;
                activeTaskId = message.taskId;
                activeTaskStatus = message.taskStatus || '';
                activeTaskType = message.taskType || '';

                if (message.taskType === 'assistant') {
                    const header = document.getElementById('chat-header');
                    if (header) header.style.removeProperty('display');
                    showHeaderRow('row1', true);
                    showHeaderRow('sub', true);
                    showHeaderRow('row2', false);
                    showHeaderRow('row3', false);
                    const titleEl = document.querySelector('.task-info-title');
                    if (titleEl) titleEl.textContent = '🤖 小助手';
                    const statusBadge = document.getElementById('task-status-badge');
                    if (statusBadge) statusBadge.classList.add('hidden');
                    const subEl = document.getElementById('task-info-created');
                    if (subEl) subEl.textContent = '专业陪聊 · 答疑解惑 · 出谋划策 · 代码评审 · 技术调研 · 问题分析';
                    const sep = document.getElementById('task-info-sep');
                    if (sep) sep.classList.add('hidden');
                    const reviewEl = document.getElementById('task-info-review');
                    if (reviewEl) reviewEl.classList.add('hidden');
                    const gutter = document.getElementById('node-timeline-gutter');
                    if (gutter) gutter.classList.add('hidden');
                    const outputPanel = document.getElementById('right-output-panel');
                    if (outputPanel) outputPanel.style.display = 'none';
                    const extractBtn = document.getElementById('btn-knowledge-extract');
                    if (extractBtn) extractBtn.classList.add('hidden');
                    renderMessages(message.messages || []);
                    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
                    if (input) input.placeholder = '与小助手对话...';
                    break;
                }

                renderAcpLog();
                const gutter = document.getElementById('node-timeline-gutter');
                if (gutter) gutter.classList.remove('hidden');
                // Restore UI elements for task mode
                const outPanel = document.getElementById('right-output-panel');
                if (outPanel) outPanel.style.display = '';
                const extractBtn = document.getElementById('btn-knowledge-extract');
                if (extractBtn) extractBtn.classList.remove('hidden');
                if (message.reviewChanges && message.reviewChanges.length > 0) {
                    reviewChangesMap.set(message.taskId, message.reviewChanges);
                    (window as any).updateOutputPanel?.({}, message.reviewChanges);
                }
    lastAcceptanceCriteria = message.acceptanceCriteria || null;
    if (message.reviewChanges || message.acceptanceCriteria) {
        acceptanceCheckedState.delete(message.taskId);
    }
    renderMessages(message.messages);
                break;
            case 'showDiff':
                if ((window as any).showDiff) {
                    (window as any).showDiff(message.original, message.modified);
                    activateTab('diff');
                }
                break;
            case 'agentStreamUpdate':
                handleAgentStreamUpdate(message.text);
                break;
            case 'agentStatus':
                handleAgentStatus(message.status, message.message, message.agentName || '');
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
                if (message.taskType === 'assistant') {
                    activeTaskStatus = '';
                    activeTaskPhase = '';
                    const chatHeader = document.getElementById('chat-header');
                    if (chatHeader) chatHeader.style.removeProperty('display');
                    showHeaderRow('row1', true);
                    showHeaderRow('sub', true);
                    showHeaderRow('row2', false);
                    showHeaderRow('row3', false);
                    const titleEl = document.querySelector('.task-info-title');
                    if (titleEl) titleEl.textContent = '🤖 小助手';
                    const statusBadge = document.getElementById('task-status-badge');
                    if (statusBadge) statusBadge.classList.add('hidden');
                    const subEl = document.getElementById('task-info-created');
                    if (subEl) subEl.textContent = '专业陪聊 · 答疑解惑 · 出谋划策 · 代码评审 · 技术调研 · 问题分析';
                    const sep = document.getElementById('task-info-sep');
                    if (sep) sep.classList.add('hidden');
                    const reviewEl = document.getElementById('task-info-review');
                    if (reviewEl) reviewEl.classList.add('hidden');
                    const gutter = document.getElementById('node-timeline-gutter');
                    if (gutter) gutter.classList.add('hidden');
                    const outPanel = document.getElementById('right-output-panel');
                    if (outPanel) outPanel.style.display = 'none';
                    const extractBtn2 = document.getElementById('btn-knowledge-extract');
                    if (extractBtn2) extractBtn2.classList.add('hidden');
                    break;
                }
                // Show knowledge extract button for task mode
                const extractBtn2 = document.getElementById('btn-knowledge-extract');
                if (extractBtn2) extractBtn2.classList.remove('hidden');
                // Restore task mode UI elements (was hidden by assistant)
                const ch = document.getElementById('chat-header');
                if (ch) ch.style.removeProperty('display');
                const op = document.getElementById('right-output-panel');
                if (op) op.style.removeProperty('display');
                updateTaskInfo(message);
                break;
            case 'flashInput':
                flashInput();
                break;
            case 'toggleRightPanel':
                const rp = document.getElementById('right-panel');
                if (rp) {
                    rp.classList.toggle('hidden');
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
            case 'pendingQueueUpdate':
                handlePendingQueueUpdate(message.count, message.items || []);
                break;
            case 'showPlanProposal':
                handleShowPlanProposal(message);
                break;
            case 'removePlanProposal':
                handleRemovePlanProposal();
                break;
            case 'addSystemMessage':
                addSystemMessage(message.content);
                break;
            case 'slashCommandList':
                slashCommands = message.commands || [];
                break;
            case 'updateNodePanel':
                handleNodePanelUpdate(message.nodes, message.taskType);
                break;
            case 'acpLogEntry':
                handleAcpLogEntry(message);
                break;
            case 'acpLogState':
                acpLogEnabled = message.enabled;
                acpLogMaxGlobal = message.maxGlobal ?? 5000;
                acpLogMaxTask = message.maxTask ?? 2000;
                const cb = document.getElementById('acp-log-enable') as HTMLInputElement;
                if (cb) cb.checked = message.enabled;
                if (!message.enabled) {
                    acpLogEntries = [];
                    renderAcpLog();
                }
                break;
            case 'updateCategoryDefs':
                categoryDefs = message.categories;
                initTemplateChips();
                break;
            case 'startTemplateFlow':
                renderCategorySelection();
                break;
            case 'updateOutputPanel':
                (window as any).updateOutputPanel?.(message.taskInfo || {}, message.changes || []);
                break;
            case 'agentList':
                initAgentSelector(message.agents || []);
                break;
            case 'knowledgeExtract':
                handleKnowledgeExtract(message.entries || []);
                break;
            case 'wikiExported':
                {
                    const fileName = message.fileName || '';
                    const filePath = message.filePath || '';
                    addSystemMessage(`📤 **已导出 Wiki 文档**\n\n文件: \`.kcode/wiki/${fileName}\`\n\n> 可打开文件查看完整内容`);
                    const btnExport = document.getElementById('op-export-btn');
                    if (btnExport) btnExport.classList.add('hidden');
                }
                break;
            case 'deviceConnected':
                (window as any).handleDeviceConnected?.(message.config);
                break;
            case 'deviceOutput':
                (window as any).handleDeviceOutput?.(message.data);
                break;
            case 'deviceStatus':
                (window as any).handleDeviceStatus?.(message.status, message.message);
                break;
            case 'savedDevices':
                (window as any).handleSavedDevices?.(message.devices || []);
                break;
        }
    });
}

let acpLogEnabled = false;
let acpLogEntries: { direction: string; text: string; timestamp: number; taskId: string }[] = [];
let acpLogMaxGlobal = 5000;
let acpLogMaxTask = 2000;

function getAcpLogEntries() {
    return activeTaskId ? acpLogEntries.filter(e => e.taskId === activeTaskId) : [];
}

function handleAcpLogEntry(msg: any) {
    if (!acpLogEnabled) return;
    const taskId = msg.taskId || activeTaskId || '';
    acpLogEntries.push({ direction: msg.direction, text: msg.text, timestamp: msg.timestamp, taskId });
    if (acpLogEntries.length > acpLogMaxGlobal) {
        acpLogEntries = acpLogEntries.slice(-acpLogMaxGlobal);
    }
    const taskEntries = acpLogEntries.filter(e => e.taskId === taskId);
    if (taskEntries.length > acpLogMaxTask) {
        const toDelete = taskEntries.length - acpLogMaxTask;
        let deleted = 0;
        acpLogEntries = acpLogEntries.filter(e => {
            if (deleted >= toDelete) return true;
            if (e.taskId !== taskId) return true;
            deleted++;
            return false;
        });
    }
    renderAcpLog();
}

function renderAcpLog() {
    const content = document.getElementById('acp-log-content');
    if (!content) return;
    const entries = getAcpLogEntries();
    const html = entries.map(e => {
        const dir = e.direction === 'send' ? '→' : '←';
        const cls = e.direction === 'send' ? 'send' : 'recv';
        const time = new Date(e.timestamp).toLocaleTimeString();
        return `<div class="acp-log-entry ${cls}"><span class="acp-log-time">${time}</span><span class="acp-log-dir">${dir}</span><span class="acp-log-text">${escapeHtml(e.text)}</span></div>`;
    }).join('');
    content.innerHTML = html;
    content.scrollTop = content.scrollHeight;
}

let streamMessageEl: HTMLElement | null = null;

function appendToChatMessages(el: Element) {
    const container = document.getElementById('chat-messages')!;
    const indicator = document.getElementById('working-indicator');
    if (indicator && indicator.parentElement === container) {
        container.insertBefore(el, indicator);
    } else {
        container.appendChild(el);
    }
    updateLastMsgConvertBtn();
}

function handleAgentStreamUpdate(text: string) {
    resetTabGroup();
    flushMerge();
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    if (!streamMessageEl) {
        _userScrolledUp = false;
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
                if (!_userScrolledUp) {
                    _programmaticScroll = true;
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    requestAnimationFrame(() => { _programmaticScroll = false; });
                }
            }
        }, 50);
    }
}

let latestStreamText = '';
let streamRenderPending = false;
let _userScrolledUp = false;
let _programmaticScroll = false;

let _agentSelectorInited = false;

function initAgentSelector(agents: { label: string; type: string }[]) {
    const btn = document.getElementById('agent-dropdown-btn');
    const label = document.getElementById('agent-dropdown-label');
    const list = document.getElementById('agent-dropdown-list');
    if (!btn || !label || !list) return;

    list.innerHTML = '';
    for (const agent of agents) {
        const item = document.createElement('li');
        item.className = 'agent-dropdown-item';
        item.dataset.value = agent.type;
        item.textContent = agent.label;
        item.addEventListener('click', () => {
            label.textContent = agent.label;
            list.classList.add('hidden');
            vscode.postMessage({ type: 'switchAgent', label: agent.type });
        });
        list.appendChild(item);
    }

    // measure to match button min-width with dropdown list content width
    const origDisplay = list.style.display;
    const origClass = list.classList.contains('hidden');
    list.classList.remove('hidden');
    list.style.display = 'block';
    list.style.visibility = 'hidden';
    const listWidth = list.offsetWidth;
    list.style.display = origDisplay || '';
    list.style.visibility = '';
    if (origClass) list.classList.add('hidden');
    if (listWidth > 0) {
        btn.style.minWidth = listWidth + 'px';
    }

    if (_agentSelectorInited) return;
    _agentSelectorInited = true;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = list.classList.contains('hidden');
        if (!wasHidden) {
            list.classList.add('hidden');
            return;
        }
        list.classList.remove('hidden');
        const anchor = (btn.closest('.agent-dropdown') || btn) as HTMLElement;
        const rect = anchor.getBoundingClientRect();
        list.style.left = rect.left + 'px';
        list.style.bottom = 'auto';
        list.style.maxHeight = (window.innerHeight - rect.bottom - 12) + 'px';
        list.style.top = (rect.bottom + 2) + 'px';
        const belowSpace = window.innerHeight - rect.bottom - 12;
        const listHeight = list.scrollHeight;
        if (listHeight > belowSpace && rect.top > listHeight + 12) {
            list.style.top = 'auto';
            list.style.maxHeight = (rect.top - 12) + 'px';
            list.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
        }
    });

    document.addEventListener('click', () => {
        list.classList.add('hidden');
    });
}

function handleAgentStatus(status: string, message: string, agentName: string) {
    const statusDot = document.getElementById('agent-status-dot');
    if (statusDot) {
        statusDot.className = 'status-dot ' + (status === 'connected' ? 'online' : 'offline');
        statusDot.title = message;
    }
    const label = document.getElementById('agent-dropdown-label');
    const list = document.getElementById('agent-dropdown-list');
    if (!label || !list) return;
    if (status === 'connected') {
        const activeItem = list.querySelector(`.agent-dropdown-item[data-value="${agentName}"]`);
        label.textContent = (activeItem?.textContent) || agentName;
        list.querySelectorAll('.agent-dropdown-item').forEach(el => {
            el.classList.toggle('active', (el as HTMLElement).dataset.value === agentName);
        });
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

let _tabGroup: { elems: Map<string, any>; element: HTMLElement } | null = null;
function resetTabGroup() { _tabGroup = null; }

let _mergeState: { thinkingId: string; thinkingTitle: string; thinkingBody: string; tools: any[] } | null = null;

function flushMerge() {
    if (!_mergeState) return;
    const { thinkingTitle, thinkingBody, tools } = _mergeState;
    if (tools.length > 0) {
        const mergedEntry = createMergedTimelineEntry({ title: thinkingTitle, content: thinkingBody }, tools);
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

let activeTaskId: string | null = null;
let activeTaskStatus: string = '';
let activeTaskType: string = '';
let activeTaskPhase: string = '';
let categoryDefs: any[] = [];
let selectedCategory: string | null = null;
let selectedSubType: string | null = null;
let lastAcceptanceCriteria: string[] | null = null;
const acceptanceCheckedState: Map<string, boolean[]> = new Map();
let taskHooks: Record<string, string[]> = {};
let workspaceHooks: Record<string, string[]> = {};
let slashCommands: { name: string; description: string }[] = [];

function initLayout() {
    const rightPanel = document.getElementById('right-panel')!;

    const closeBtn = document.getElementById('right-panel-close')!;
    closeBtn.addEventListener('click', () => {
        rightPanel.classList.toggle('hidden');
        const acpLogBtn = document.getElementById('acp-log-btn');
        acpLogBtn?.classList.remove('active');
    });

}

function initInstructionToggle() {
    const toggle = document.querySelector('.instruction-toggle');
    toggle?.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
    });
}

let _deviceTabInited = false;

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

            const rp = document.getElementById('right-panel');
            if (rp?.classList.contains('hidden')) {
                rp.classList.remove('hidden');
            }

            if (tabName === 'device') {
                (window as any).initDeviceTab?.();
            }

            const acpLogBtn = document.getElementById('acp-log-btn');
            if (tabName !== 'acplog') {
                acpLogBtn?.classList.remove('active');
            }
        });
    });
}

function sendMessageFromInput() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.focus();
    if (text.startsWith('/')) {
        vscode.postMessage({ type: 'slashCommand', text, taskId: activeTaskId });
        return;
    }
    if (activeTaskType === 'assistant' || !activeTaskId) {
        vscode.postMessage({ type: 'sendAssistantMessage', text });
        return;
    }
    const msg: any = { type: 'sendMessage', text, taskId: activeTaskId };
    if (selectedCategory) {
        msg.category = selectedCategory;
        selectedCategory = null;
    }
    vscode.postMessage(msg);
}

function initChat() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) return;

    input.addEventListener('keydown', (e) => {
        if (_slashMenuEl && e.key === 'Escape') { hideSlashMenu(); return; }
        if (_slashMenuEl && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const active = _slashMenuEl.querySelector('.slash-menu-item.hover') as HTMLElement;
            if (active) { active.click(); hideSlashMenu(); return; }
        }
        if (_slashMenuEl && e.key === 'ArrowDown') { e.preventDefault(); moveSlashSel(1); return; }
        if (_slashMenuEl && e.key === 'ArrowUp') { e.preventDefault(); moveSlashSel(-1); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageFromInput();
        }
    });

    const sendBtn = document.getElementById('send-btn');
    sendBtn?.addEventListener('click', sendMessageFromInput);

    const stopBtn = document.getElementById('stop-btn');
    stopBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'stopGeneration', taskId: activeTaskId });
    });

    const imageBtn = document.querySelector('.image-btn');
    imageBtn?.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.multiple = true;
        fileInput.addEventListener('change', () => {
            if (fileInput.files) {
                for (let i = 0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        vscode.postMessage({ type: 'addImage', file: file.name, data: e.target?.result });
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
        fileInput.click();
    });

    const attachBtn = document.querySelector('.attach-btn');
    attachBtn?.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.addEventListener('change', () => {
            if (fileInput.files) {
                for (let i = 0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        vscode.postMessage({ type: 'addAttachment', file: file.name, data: e.target?.result });
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
        fileInput.click();
    });

    input.addEventListener('input', () => {
        const val = input.value;
        if (val.startsWith('/') && !val.includes(' ')) {
            const query = val.slice(1).toLowerCase();
            const matched = !query ? slashCommands : slashCommands.filter(c => c.name.toLowerCase().replace(/^\//, '').startsWith(query) || c.name.toLowerCase().startsWith('/' + query));
            if (matched.length > 0) {
                showSlashMenu(matched);
                return;
            }
        }
        hideSlashMenu();
    });

    document.addEventListener('click', (e) => {
        if (_slashMenuEl && !_slashMenuEl.contains(e.target as Node) && e.target !== input) {
            hideSlashMenu();
        }
    });

    const scrollContainer = document.getElementById('chat-scroll');
    if (scrollContainer) {
        scrollContainer.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) _userScrolledUp = true;
        });
        scrollContainer.addEventListener('scroll', () => {
            if (_programmaticScroll) return;
            const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 16;
            _userScrolledUp = !atBottom;
        });
    }

    const acpLogBtn = document.getElementById('acp-log-btn');
    acpLogBtn?.addEventListener('click', () => {
        const rp = document.getElementById('right-panel');
        if (!rp) return;
        const acpTab = document.querySelector('.tab[data-tab="acplog"]');
        if (!rp.classList.contains('hidden') && acpTab?.classList.contains('active')) {
            rp.classList.add('hidden');
            acpLogBtn.classList.remove('active');
        } else {
            rp.classList.remove('hidden');
            activateTab('acplog');
            acpLogBtn.classList.add('active');
        }
    });

    const btnKnowledgeExtract = document.getElementById('btn-knowledge-extract');
    btnKnowledgeExtract?.addEventListener('click', () => {
        vscode.postMessage({ type: 'extractKnowledge', taskId: activeTaskId });
    });

    const btnExportWiki = document.getElementById('op-export-btn');
    btnExportWiki?.addEventListener('click', () => {
        const taskId = (btnExportWiki as HTMLElement).dataset.taskId;
        if (taskId) {
            vscode.postMessage({ type: 'exportToWiki', taskId });
        }
    });

    const btnTerminal = document.getElementById('btn-terminal');
    btnTerminal?.addEventListener('click', () => {
        vscode.postMessage({ type: 'openTerminal' });
    });



    const acpLogEnable = document.getElementById('acp-log-enable') as HTMLInputElement;
    acpLogEnable?.addEventListener('change', () => {
        acpLogEnabled = acpLogEnable.checked;
        vscode.postMessage({ type: 'toggleAcpLog', enabled: acpLogEnabled });
        if (!acpLogEnabled) {
            acpLogEntries = [];
            renderAcpLog();
        }
    });

    const acpLogClear = document.getElementById('acp-log-clear');
    acpLogClear?.addEventListener('click', () => {
        acpLogEntries = [];
        renderAcpLog();
    });

    const goalConfirmBtn = document.getElementById('goal-confirm-btn');
    goalConfirmBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'confirmGoalFromHeader', taskId: activeTaskId });
    });

    const planConfirmBtn = document.getElementById('plan-confirm-btn');
    planConfirmBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'confirmPlan', taskId: activeTaskId });
    });

    const executeConfirmBtn = document.getElementById('execute-confirm-btn');
    executeConfirmBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'confirmExecuteDone', taskId: activeTaskId });
    });

    const hooksEditBtn = document.getElementById('hooks-edit-btn');
    const hooksEditor = document.getElementById('hooks-editor');
    const hooksPhasesList = document.getElementById('hooks-phases-list');
    const hooksCloseBtn = document.getElementById('hooks-close-btn');

    if (hooksEditBtn && hooksEditor && hooksPhasesList && hooksCloseBtn) {
        const phaseLabels: Record<string, string> = {
            demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收'
        };
        const phaseOrder = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];

        const hList = hooksPhasesList;
        function renderHooksEditor() {
            hList.innerHTML = '';
            const openPhase = hList.dataset.openPhase || '';

            for (const phase of phaseOrder) {
                const label = phaseLabels[phase] || phase;
                const wsCmds = workspaceHooks[phase] || [];
                const taskCmds = taskHooks[phase] || [];
                const total = wsCmds.length + taskCmds.length;
                const isOpen = openPhase === phase;

                const row = document.createElement('div');
                row.className = 'hooks-phase-row' + (isOpen ? ' active' : '');

                const labelSpan = document.createElement('span');
                labelSpan.className = 'hooks-phase-label';
                labelSpan.textContent = label;
                row.appendChild(labelSpan);

                const summary = document.createElement('span');
                summary.className = 'hooks-phase-summary' + (total > 0 ? ' has-any' : '');
                const parts: string[] = [];
                if (wsCmds.length > 0) parts.push(`📋${wsCmds.length}`);
                if (taskCmds.length > 0) parts.push(`⚙️${taskCmds.length}`);
                summary.textContent = total > 0 ? parts.join(' · ') : '无';
                row.appendChild(summary);

                const expand = document.createElement('span');
                expand.className = 'hooks-phase-expand';
                expand.textContent = isOpen ? '▲' : '▼';
                row.appendChild(expand);

                row.addEventListener('click', () => {
                    hList.dataset.openPhase = isOpen ? '' : phase;
                    renderHooksEditor();
                });

                hList.appendChild(row);

                if (isOpen) {
                    const detail = document.createElement('div');
                    detail.className = 'hooks-phase-detail open';

                    if (wsCmds.length > 0) {
                        const wsLabel = document.createElement('div');
                        wsLabel.className = 'hooks-ws-label';
                        wsLabel.textContent = '📋 项目全局命令（AGENTS.md）';
                        detail.appendChild(wsLabel);
                        for (const cmd of wsCmds) {
                            const item = document.createElement('div');
                            item.className = 'hooks-ws-item';
                            item.textContent = '• ' + cmd;
                            detail.appendChild(item);
                        }
                    }

                    const taskLabel = document.createElement('div');
                    taskLabel.className = 'hooks-task-label';
                    taskLabel.textContent = '⚙️ 任务级命令';
                    detail.appendChild(taskLabel);

                    const textarea = document.createElement('textarea');
                    textarea.className = 'hooks-task-textarea';
                    textarea.placeholder = '每行一条命令，注入当前阶段提示词';
                    textarea.value = taskCmds.join('\n');
                    detail.appendChild(textarea);

                    const actions = document.createElement('div');
                    actions.className = 'hooks-detail-actions';

                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'hooks-save-btn';
                    saveBtn.textContent = '保存';
                    saveBtn.addEventListener('click', () => {
                        const raw = textarea.value.trim();
                        const commands = raw ? raw.split('\n').map(l => l.trim()).filter(Boolean) : [];
                        vscode.postMessage({ type: 'updateHooks', taskId: activeTaskId, phase, commands });
                        // Update local cache
                        if (commands.length > 0) {
                            taskHooks[phase] = commands;
                        } else {
                            delete taskHooks[phase];
                        }
                        renderHooksEditor();
                    });
                    actions.appendChild(saveBtn);

                    detail.appendChild(actions);
                    hList.appendChild(detail);
                }
            }
        }

        hooksEditBtn.addEventListener('click', () => {
            const isOpen = !hooksEditor.classList.contains('hidden');
            hooksEditor.classList.toggle('hidden');
            if (!isOpen) {
                renderHooksEditor();
            }
        });

        hooksCloseBtn.addEventListener('click', () => {
            hooksEditor.classList.add('hidden');
        });
    }

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

let _queueExpanded = false;

function handlePendingQueueUpdate(count: number, items: { text: string }[]) {
    const bar = document.getElementById('queue-bar');
    const summary = document.getElementById('queue-summary');
    const toggle = document.getElementById('queue-toggle');
    const clearBtn = document.getElementById('queue-clear-all');
    const list = document.getElementById('queue-list');
    if (!bar || !summary || !toggle || !clearBtn || !list) return;

    if (count === 0) {
        bar.classList.add('hidden');
        _queueExpanded = false;
        return;
    }

    bar.classList.remove('hidden');
    summary.textContent = `⏳ 排队中 (${count} 条)`;

    toggle.textContent = _queueExpanded ? '收起' : '展开';
    toggle.onclick = () => {
        _queueExpanded = list.classList.contains('hidden');
        toggle.textContent = _queueExpanded ? '收起' : '展开';
        list.classList.toggle('hidden', _queueExpanded);
    };

    clearBtn.onclick = () => {
        _queueExpanded = false;
        vscode.postMessage({ type: 'clearPendingQueue' });
    };

    list.classList.toggle('hidden', !_queueExpanded);
    list.innerHTML = '';
    for (let i = 0; i < items.length; i++) {
        const item = document.createElement('div');
        item.className = 'queue-item';

        const num = document.createElement('span');
        num.className = 'queue-item-num';
        num.textContent = String(i + 1) + '.';
        item.appendChild(num);

        const text = document.createElement('span');
        text.className = 'queue-item-text';
        text.textContent = items[i].text;
        item.appendChild(text);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'queue-item-cancel';
        cancelBtn.textContent = '✕';
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            vscode.postMessage({ type: 'cancelQueuedMessage', index: i });
        };
        item.appendChild(cancelBtn);

        list.appendChild(item);
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

function handleKnowledgeExtract(entries: any[]) {
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

function addSystemMessage(content: string) {
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

let _slashMenuEl: HTMLElement | null = null;
let _slashSelIdx = -1;

function getCaretPos(textarea: HTMLTextAreaElement): { x: number; y: number } {
    const pos = textarea.selectionStart;
    const style = getComputedStyle(textarea);
    const mirror = document.createElement('div');
    mirror.style.cssText = `position:fixed;top:0;left:-9999px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:break-word;font:${style.font};fontSize:${style.fontSize};padding:${style.padding};lineHeight:${style.lineHeight};letterSpacing:${style.letterSpacing};border:${style.border}`;
    mirror.style.width = textarea.clientWidth + 'px';
    const text = textarea.value.substring(0, pos);
    mirror.textContent = text;
    const span = document.createElement('span');
    span.textContent = '\u200B';
    mirror.appendChild(span);
    document.body.appendChild(mirror);
    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);
    const taRect = textarea.getBoundingClientRect();
    return { x: taRect.left + spanRect.left - mirrorRect.left, y: taRect.top + spanRect.top - mirrorRect.top };
}

function showSlashMenu(commands: { name: string; description: string }[]) {
    hideSlashMenu();
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    const caret = getCaretPos(input);
    const menu = document.createElement('div');
    menu.className = 'slash-context-menu';
    menu.style.left = caret.x + 'px';
    menu.style.top = (caret.y - 4) + 'px';

    commands.forEach((cmd, i) => {
        const item = document.createElement('div');
        item.className = 'slash-menu-item';
        if (i === 0) item.classList.add('hover');
        item.innerHTML = `<span class="slash-context-name">${cmd.name}</span><span class="slash-context-desc">${cmd.description}</span>`;
        item.addEventListener('click', () => {
            input.value = cmd.name + ' ';
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            hideSlashMenu();
        });
        menu.appendChild(item);
    });

    input.parentElement?.appendChild(menu);
    const mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth) menu.style.left = (window.innerWidth - mr.width - 8) + 'px';
    if (mr.bottom > window.innerHeight) menu.style.top = (caret.y - mr.height - 8) + 'px';
    _slashMenuEl = menu;
    _slashSelIdx = 0;
}

function hideSlashMenu() {
    if (_slashMenuEl) {
        _slashMenuEl.remove();
        _slashMenuEl = null;
    }
    _slashSelIdx = -1;
}

function moveSlashSel(dir: number) {
    if (!_slashMenuEl) return;
    const items = _slashMenuEl.querySelectorAll('.slash-menu-item');
    items.forEach(el => el.classList.remove('hover'));
    _slashSelIdx = Math.max(0, Math.min(items.length - 1, _slashSelIdx + dir));
    items[_slashSelIdx]?.classList.add('hover');
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



function _getToolKindFromMsg(msg: any): string {
    if (msg.role === 'tool' && msg.type === 'tool_call') {
        try { return JSON.parse(msg.content).kind || ''; }
        catch { return ''; }
    }
    return '';
}

function _isTodoArray(text: string): boolean {
    try {
        const arr = JSON.parse(text.trim());
        return Array.isArray(arr) && arr.length > 0 && arr.every((item: any) =>
            item && typeof item.content === 'string' && typeof item.status === 'string'
        );
    } catch {
        return false;
    }
}

function renderMessages(messages: any[]) {
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
                        const mergedEntry = createMergedTimelineEntry({ title: pendingThinking.title || '思考', content: pendingThinking.output || pendingThinking.content || '' }, mergedTools);
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
                const mergedEntry = createMergedTimelineEntry({ title: pendingThinking.title || '思考', content: pendingThinking.output || pendingThinking.content || '' }, mergedTools);
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg tool';
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.appendChild(mergedEntry);
                msgDiv.appendChild(bubble);
                appendToChatMessages(msgDiv);
                hasTlEntries = true;
            } else if (pendingThinking && mergedTools.length === 0) {
                const entry = createTimelineEntry({ toolCallId: '', kind: 'thinking', title: pendingThinking.title || '思考', status: 'completed', content: pendingThinking.output || pendingThinking.content || '' });
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

function updateLastMsgConvertBtn() {
    if (activeTaskType !== 'assistant') return;
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
        vscode.postMessage({ type: 'convertAssistantToTask' });
    });
    row.appendChild(btn);
}

function getCategoryDef(catKey: string): any {
    return categoryDefs.find((c: any) => c.key === catKey);
}

function getTemplateDef(catKey: string, subKey: string): any {
    const cat = getCategoryDef(catKey);
    return cat?.subTypes?.[subKey];
}

function renderCategorySelection() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const scrollContainer = document.getElementById('chat-scroll');
    if (scrollContainer) scrollContainer.classList.remove('chat-empty');
    container.innerHTML = '';
    const chatHeader = document.getElementById('chat-header');
    if (chatHeader) chatHeader.style.display = 'none';
    document.getElementById('chat-body')?.classList.add('showing-categories');

    const wrapper = document.createElement('div');
    wrapper.className = 'template-flow-wrapper';

    const titleLine = document.createElement('div');
    titleLine.className = 'template-flow-title';
    titleLine.textContent = '📋 按模板新建任务';
    wrapper.appendChild(titleLine);

    const selCat = document.createElement('select');
    selCat.className = 'template-flow-select';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = '— 选择任务大类 —';
    opt0.disabled = true;
    selCat.appendChild(opt0);
    for (const cat of categoryDefs) {
        const opt = document.createElement('option');
        opt.value = cat.key;
        opt.textContent = `${cat.icon} ${cat.label}`;
        selCat.appendChild(opt);
    }
    if (selectedCategory) selCat.value = selectedCategory;
    wrapper.appendChild(selCat);

    const selSub = document.createElement('select');
    selSub.className = 'template-flow-select';
    const subOpt0 = document.createElement('option');
    subOpt0.value = '';
    subOpt0.textContent = selectedCategory ? '— 选择任务子类 —' : '— 请先选择大类 —';
    subOpt0.disabled = true;
    selSub.appendChild(subOpt0);
    if (selectedCategory) {
        selSub.disabled = false;
        for (const [key, st] of Object.entries(getCategoryDef(selectedCategory)?.subTypes || {})) {
            const t = st as any;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = `${t.icon} ${t.label}`;
            selSub.appendChild(opt);
        }
        if (selectedSubType) selSub.value = selectedSubType;
    } else {
        selSub.disabled = true;
    }
    wrapper.appendChild(selSub);

    const selectorChanged = () => {
        selectedCategory = selCat.value || null;
        selectedSubType = selSub.value || null;
        renderCategorySelection();
    };
    selCat.addEventListener('change', () => {
        selectedSubType = null;
        selSub.value = '';
        selectorChanged();
    });
    selSub.addEventListener('change', selectorChanged);

    container.appendChild(wrapper);

    if (!selectedCategory || !selectedSubType) return;

    const cat = getCategoryDef(selectedCategory);
    const template = cat?.subTypes?.[selectedSubType];
    if (!template) return;

    const form = document.createElement('div');
    form.className = 'template-form';

    const templateDesc = document.createElement('div');
    templateDesc.className = 'template-flow-desc';
    templateDesc.textContent = template.inputPlaceholder || '';
    form.appendChild(templateDesc);

    const formFields: Record<string, string> = {};

    for (const field of (template.inputFields || [])) {
        const fieldGroup = document.createElement('div');
        fieldGroup.className = 'form-field-group';

        const label = document.createElement('label');
        label.className = 'form-field-label';
        label.textContent = field.label;
        if (field.required) {
            const req = document.createElement('span');
            req.className = 'form-field-required';
            req.textContent = ' *';
            label.appendChild(req);
        }
        fieldGroup.appendChild(label);

        let input: HTMLInputElement | HTMLTextAreaElement;
        if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.className = 'form-field-textarea';
            input.rows = 3;
        } else {
            input = document.createElement('input');
            input.className = 'form-field-input';
            input.type = 'text';
        }
        input.placeholder = field.placeholder;
        input.dataset.fieldKey = field.key;
        input.addEventListener('input', () => {
            formFields[field.key] = input.value;
        });

        fieldGroup.appendChild(input);
        form.appendChild(fieldGroup);
    }

    const notesField = document.createElement('div');
    notesField.className = 'form-field-group';
    const notesLabel = document.createElement('label');
    notesLabel.className = 'form-field-label';
    notesLabel.textContent = '补充说明（可选）';
    notesField.appendChild(notesLabel);
    const notesInput = document.createElement('textarea');
    notesInput.className = 'form-field-textarea';
    notesInput.rows = 2;
    notesInput.placeholder = '额外的说明和上下文...';
    notesField.appendChild(notesInput);
    form.appendChild(notesField);

    container.appendChild(form);

    const btnRow = document.createElement('div');
    btnRow.className = 'form-btn-row';

    const startBtn = document.createElement('button');
    startBtn.className = 'start-task-btn';
    startBtn.textContent = '开始任务';
    startBtn.addEventListener('click', () => {
        startTaskFromForm(template, formFields, notesInput.value);
    });

    btnRow.appendChild(startBtn);
    container.appendChild(btnRow);
}

function startTaskFromForm(template: any, formFields: Record<string, string>, notes: string) {
    const parts: string[] = [];
    for (const field of (template.inputFields || [])) {
        const val = formFields[field.key] || '';
        if (val.trim()) {
            parts.push(`${field.label}：${val.trim()}`);
        }
    }
    if (notes.trim()) {
        parts.push(`补充说明：${notes.trim()}`);
    }
    const text = parts.join('\n\n');

    vscode.postMessage({
        type: 'sendMessage',
        text,
        taskId: activeTaskId,
        category: selectedCategory,
        subType: selectedSubType
    });

    selectedCategory = null;
    selectedSubType = null;

    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) input.placeholder = '提出后续修改要求';
}

function initTemplateChips() {
    const bar = document.getElementById('input-template-bar');
    if (!bar || !categoryDefs || categoryDefs.length === 0) return;
    bar.innerHTML = '';
    for (const cat of categoryDefs) {
        const chip = document.createElement('span');
        chip.className = 'template-chip' + (selectedCategory === cat.key ? ' active' : '');
        chip.innerHTML = `<span class="tmpl-icon">${cat.icon}</span> ${cat.label}`;
        chip.addEventListener('click', () => {
            if (selectedCategory === cat.key) {
                selectedCategory = null;
                bar.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
            } else {
                selectedCategory = cat.key;
                selectedSubType = null;
                bar.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            }
        });
        bar.appendChild(chip);
    }
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

        if (lastAcceptanceCriteria && lastAcceptanceCriteria.length > 0) {
            const body = card.querySelector('.msg-card-body');
            if (body) {
                const criteriaEl = document.createElement('div');
                criteriaEl.className = 'review-criteria';
                const label = document.createElement('div');
                label.className = 'review-criteria-label';
                label.textContent = '📋 验收清单（勾选通过的项）';
                criteriaEl.appendChild(label);

                if (!acceptanceCheckedState.has(taskId)) {
                    acceptanceCheckedState.set(taskId, lastAcceptanceCriteria.map(() => false));
                }
                const checkedState = acceptanceCheckedState.get(taskId)!;

                for (let ci = 0; ci < lastAcceptanceCriteria.length; ci++) {
                    const c = lastAcceptanceCriteria[ci];
                    const item = document.createElement('label');
                    item.className = 'review-criteria-item';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'criteria-checkbox';
                    cb.checked = checkedState[ci];
                    cb.addEventListener('change', () => {
                        checkedState[ci] = cb.checked;
                        acceptanceCheckedState.set(taskId, checkedState);
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
                vscode.postMessage({ type: 'approveReview', taskId });
            });
            actionsDiv.appendChild(approveBtn);

            const partialBtn = document.createElement('button');
            partialBtn.className = 'msg-card-btn secondary';
            partialBtn.textContent = '逐条通过';
            partialBtn.id = 'partial-approve-btn';
            partialBtn.style.display = 'none';
            partialBtn.addEventListener('click', () => {
                const checkedArr = acceptanceCheckedState.get(taskId);
                if (!checkedArr) return;
                const passed = lastAcceptanceCriteria?.filter((_, i) => checkedArr[i]) || [];
                const failed = lastAcceptanceCriteria?.filter((_, i) => !checkedArr[i]) || [];
                actionsDiv.innerHTML = '';
                const status = document.createElement('div');
                status.className = 'msg-card-status';
                status.textContent = `✅ 部分通过（${passed.length}/${(lastAcceptanceCriteria || []).length}）`;
                actionsDiv.appendChild(status);
                vscode.postMessage({ type: 'partialApproveReview', taskId, passed, failed });
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
                const checkedArr = acceptanceCheckedState.get(taskId);
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
    activeTaskPhase = info.phase || '';
    activeTaskTitle = info.title || '';

    // Row 1: Title + status badge
    const titleEl = document.querySelector('.task-info-title');
    if (titleEl) titleEl.textContent = info.title || '选择任务开始对话';

    const badge = document.getElementById('task-status-badge');
    if (badge) {
        const hasStatus = !!info.status && info.status !== 'pending' && info.title;
        badge.classList.toggle('hidden', !hasStatus);
        if (hasStatus) {
            const statusMap: Record<string, string> = {
                pending: 'Pending', active: 'Active', in_review: 'In Review',
                completed: 'Completed', cancelled: 'Cancelled'
            };
            badge.textContent = statusMap[info.status] || info.status;
            badge.className = 'task-status-badge';
            badge.classList.add('status-' + info.status);
        }
    }

    // Sub row: created + review info
    const createdEl = document.getElementById('task-info-created');
    const sep = document.getElementById('task-info-sep');
    const reviewEl = document.getElementById('task-info-review');
    if (createdEl && info.createdAt) {
        const d = new Date(info.createdAt);
        createdEl.textContent = `创建 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (reviewEl) {
        const hasFiles = (info.pendingReviewFiles || 0) > 0;
        reviewEl.textContent = hasFiles ? `待验收 ${info.pendingReviewFiles} 个文件` : '';
        if (sep) sep.classList.toggle('hidden', !hasFiles);
    }

    // Row 2: Goal + confirmed tags
    const row2 = document.getElementById('chat-header-row2');
    const goalText = document.getElementById('goal-header-text');
    const confirmTags = document.getElementById('confirmed-tags');
    if (row2 && goalText && confirmTags) {
        const hasGoal = info.taskType === 'task' && info.goal && info.status !== 'cancelled' && info.status !== 'completed';
        row2.classList.toggle('hidden', !hasGoal);
        if (hasGoal) {
            goalText.textContent = (info.goal || '').split('\n')[0].replace(/[*_#`>\[\]]/g, '').trim() || '目标';
            const confirmed = info.confirmedItems || [];
            confirmTags.innerHTML = confirmed.map((item: string) =>
                `<span class="confirmed-tag">${escapeHtml(item)}</span>`
            ).join('');
        }
    }

    // Row 3: Phase badge + desc + confirm buttons + progress
    const row3 = document.getElementById('chat-header-row3');
    const phaseBadge = document.getElementById('task-phase-badge');
    const phaseDesc = document.getElementById('phase-desc');
    const goalConfirmBtn = document.getElementById('goal-confirm-btn');
    const planConfirmBtn = document.getElementById('plan-confirm-btn');
    const executeConfirmBtn = document.getElementById('execute-confirm-btn');
    const progHeader = document.getElementById('plan-progress-header');
    const progFill = document.getElementById('header-progress-fill');
    const progLabel = document.getElementById('header-progress-label');

    if (row3 && phaseBadge && phaseDesc) {
        const hasPhase = info.taskType === 'task' && info.phase && info.status !== 'cancelled' && info.status !== 'completed';
        row3.classList.toggle('hidden', !hasPhase);
        if (hasPhase) {
            const phaseLabels: Record<string, string> = {
                demand: 'D 需求', goal: 'T 目标', plan: 'P 计划',
                execute: 'E 执行', self_verify: 'V 自验', review: 'C 验收'
            };
            const phaseDescs: Record<string, string> = {
                demand: '收集需求，明确目标', goal: '确认任务目标',
                plan: '制定执行计划', execute: '执行实现',
                self_verify: 'AI 自验代码', review: '最终验收'
            };
            phaseBadge.textContent = phaseLabels[info.phase] || info.phase;
            phaseDesc.textContent = phaseDescs[info.phase] || '';
        }
        if (goalConfirmBtn) {
            goalConfirmBtn.classList.toggle('hidden', !(info.taskType === 'task' && info.phase === 'goal' && info.status !== 'cancelled' && info.status !== 'completed'));
        }
        if (planConfirmBtn) {
            planConfirmBtn.classList.toggle('hidden', !(info.taskType === 'task' && info.phase === 'plan' && info.status !== 'cancelled' && info.status !== 'completed'));
        }
        if (executeConfirmBtn) {
            executeConfirmBtn.classList.toggle('hidden', !(info.taskType === 'task' && info.phase === 'execute' && info.status !== 'cancelled' && info.status !== 'completed'));
        }

        // Progress bar in header
        const steps = info.planSteps || [];
        const hasSteps = info.taskType === 'task' && info.phase === 'execute' && steps.length > 0;
        if (progHeader && progFill && progLabel) {
            progHeader.classList.toggle('hidden', !hasSteps);
            if (hasSteps) {
                const done = steps.filter((s: any) => s.status === 'completed').length;
                const pct = Math.round((done / steps.length) * 100);
                progFill.style.width = pct + '%';
                progLabel.textContent = `${done}/${steps.length}`;
            }
        }
    }

    // Hooks count
    const hooksCount = document.getElementById('hooks-count');
    if (hooksCount) {
        if (info.hooks) taskHooks = info.hooks;
        if (info.workspaceHooks) workspaceHooks = info.workspaceHooks;
        const phase = info.phase || '';
        const wsCount = (info.workspaceHooks?.[phase] || []).length;
        const taskCount = (info.hooks?.[phase] || []).length;
        const total = wsCount + taskCount;
        if (total > 0 && info.taskType === 'task' && info.status !== 'cancelled' && info.status !== 'completed') {
            const parts: string[] = [];
            if (wsCount > 0) parts.push(`📋${wsCount}`);
            if (taskCount > 0) parts.push(`⚙️${taskCount}`);
            hooksCount.textContent = parts.join(' · ');
            hooksCount.className = 'hooks-count' + (wsCount > 0 ? ' has-workspace' : '') + (taskCount > 0 ? ' has-task' : '');
        } else {
            hooksCount.classList.add('hidden');
        }
    }

    // Update left panel + output panel
    (window as any).renderProcessPanel?.(info, []);
    (window as any).updateOutputPanel?.(info, []);
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

function _parseTodoStr(text: string): { items: any[]; done: number; total: number } {
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

function _todoHeaderHtml(done: number, total: number): string {
    return `✅ 待办清单 <span class="todo-header-progress">${done}/${total}</span>`;
}

function renderTodoCard(msg: any): HTMLElement {
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
        vscode.postMessage({ type: 'updateTodoItem', taskId: msg.taskId, msgId, itemId, checked });
    });

    return card;
}

function buildTodoBodyHtml(output: string, toolCallId: string, taskId: string): string {
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

function createReviewChangesElement(changes: FileChange[], taskId: string): HTMLElement {
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

    return list;
}

function attachReviewChanges(message: any) {
    selectedReviewFileIdx = null;
    const changes = message.reviewChanges as FileChange[];
    if (!changes || changes.length === 0) return;
    reviewChangesMap.set(message.taskId, changes);

    const lastReviewMsg = document.querySelector('#chat-messages > .chat-msg.agent:last-of-type') as HTMLElement;
    if (!lastReviewMsg) return;

    const existing = lastReviewMsg.querySelector('.review-changes');
    if (existing) existing.remove();

    const list = createReviewChangesElement(changes, message.taskId);

    const cardBody = lastReviewMsg.querySelector('.msg-card-body');
    const actionsEl = lastReviewMsg.querySelector('.msg-card-actions, .msg-card-status');
    if (cardBody) {
        cardBody.appendChild(list);
    } else if (actionsEl) {
        lastReviewMsg.insertBefore(list, actionsEl);
    } else {
        lastReviewMsg.appendChild(list);
    }
}

function handleShowReviewRequest(message: any) {
    attachReviewChanges({ ...message, reviewChanges: message.changes });
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
    const msgDiv = btn.closest('.chat-msg.agent') as HTMLElement;
    if (!msgDiv) return;

    const actions = msgDiv.querySelector('.msg-card-actions') as HTMLElement;
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
        actions.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = reason ? `↩️ 已驳回: ${reason}` : '↩️ 已驳回';
        actions.appendChild(statusEl);
        vscode.postMessage({ type: 'rejectReview', taskId, reason });
    });

    cancelBtn.addEventListener('click', () => {
        actions.innerHTML = '';
        const approveBtn = document.createElement('button');
        approveBtn.className = 'msg-card-btn primary';
        approveBtn.textContent = '验收通过 ✓';
        approveBtn.addEventListener('click', () => {
            actions.innerHTML = '';
            const status = document.createElement('div');
            status.className = 'msg-card-status';
            status.textContent = '✅ 已验收通过';
            actions.appendChild(status);
            vscode.postMessage({ type: 'approveReview', taskId });
        });

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'msg-card-btn secondary';
        rejectBtn.textContent = '驳回 ↩';
        rejectBtn.addEventListener('click', () => {
            showRejectInput(rejectBtn, taskId);
        });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
    });

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    area.appendChild(textarea);
    area.appendChild(btnRow);
    actions.appendChild(area);
}

function updateAcceptanceButtons(taskId: string) {
    const card = document.querySelector(`.msg-card[data-review-task-id="${taskId}"]`) as any;
    if (card?.__updateAcceptanceButtons) {
        card.__updateAcceptanceButtons();
    }
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

    let currentGoal = info.goal;

    function enterEditMode(targetCard: HTMLElement) {
        const body = targetCard.querySelector('.msg-card-body') as HTMLElement;
        const actionsDiv = targetCard.querySelector('.msg-card-actions') as HTMLElement;
        if (!body || !actionsDiv) return;

        const textarea = document.createElement('textarea');
        textarea.className = 'goal-edit-textarea';
        textarea.value = currentGoal;
        textarea.rows = 6;

        const saveEdit = () => {
            const newGoal = textarea.value.trim();
            if (!newGoal) return;
            currentGoal = newGoal;
            vscode.postMessage({ type: 'confirmGoalWithEdit', taskId: info.taskId, goal: newGoal, originalRequest: info.originalRequest });
            updateCardToStatus(targetCard, '✅ 已确认');
        };

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveEdit();
            }
            if (e.key === 'Escape') {
                exitEditMode(targetCard);
            }
        });

        body.innerHTML = '';
        body.appendChild(textarea);

        actionsDiv.innerHTML = '';
        const saveBtn = document.createElement('button');
        saveBtn.className = 'msg-card-btn primary';
        saveBtn.textContent = '保存修改 ✓';
        saveBtn.addEventListener('click', (e) => { e.stopPropagation(); saveEdit(); });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'msg-card-btn secondary';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exitEditMode(targetCard);
        });

        actionsDiv.appendChild(saveBtn);
        actionsDiv.appendChild(cancelBtn);

        setTimeout(() => textarea.focus(), 0);
    }

    function exitEditMode(targetCard: HTMLElement) {
        const body = targetCard.querySelector('.msg-card-body') as HTMLElement;
        const actionsDiv = targetCard.querySelector('.msg-card-actions') as HTMLElement;
        if (!body || !actionsDiv) return;

        body.innerHTML = renderMarkdown(currentGoal as string);
        body.classList.remove('collapsed');

        actionsDiv.innerHTML = '';
        addConfirmationActions(actionsDiv);
    }

    function addConfirmationActions(actionsDiv: HTMLElement) {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'msg-card-btn primary';
        confirmBtn.textContent = '确认目标 ✓';
        confirmBtn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            updateCardToStatus(findParentCard(target)!, '✅ 已确认');
            vscode.postMessage({ type: 'confirmGoal', taskId: info.taskId, originalRequest: info.originalRequest });
        });

        const reviseBtn = document.createElement('button');
        reviseBtn.className = 'msg-card-btn secondary';
        reviseBtn.textContent = '修改需求 ↩';
        reviseBtn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const card = findParentCard(target);
            if (card) enterEditMode(card);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'msg-card-btn cancel';
        cancelBtn.textContent = '取消 ✕';
        cancelBtn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            updateCardToStatus(findParentCard(target)!, '✕ 已取消任务');
            vscode.postMessage({ type: 'cancelTask', taskId: info.taskId });
        });

        actionsDiv.appendChild(confirmBtn);
        actionsDiv.appendChild(reviseBtn);
        actionsDiv.appendChild(cancelBtn);
    }

    const card = createCard({
        headerHtml: '📋 任务目标确认',
        bodyMarkdown: currentGoal,
        defaultCollapsed: false,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
        actions: undefined,
        rawData: info
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';
    addConfirmationActions(actionsDiv);
    card.appendChild(actionsDiv);

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function showHeaderRow(row: string, show: boolean) {
    const map: Record<string, string> = { row1: 'chat-header-row1', sub: 'chat-header-sub', row2: 'chat-header-row2', row3: 'chat-header-row3' };
    const el = document.getElementById(map[row]);
    if (el) el.classList.toggle('hidden', !show);
}

function removeGoalConfirmationCard() {
    document.querySelectorAll('.msg-card').forEach(el => el.remove());
}

function handleShowPlanProposal(message: any) {
    const planSteps = message.planSteps || [];
    if (planSteps.length === 0) return;

    hideWorkingIndicator();

    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;

    let currentGoal = message.goal || '';
    let currentSteps = planSteps.map((s: any) => ({ content: s.content, status: s.status }));
    let dirty = false;

    function buildGoalHtml() {
        return currentGoal
            ? `<div class="plan-goal-section"><div class="plan-goal-header">🎯 目标</div><div class="plan-goal-body">${escapeHtml(currentGoal)}</div></div>`
            : '';
    }

    function buildStepsHtml() {
        return currentSteps.map((step: any, i: number) => {
            const statusIcon = step.status === 'completed' ? '✅' : step.status === 'active' ? '🔄' : '○';
            return `<div class="plan-step-line"><span class="plan-step-status">${statusIcon}</span><span>${escapeHtml(step.content)}</span></div>`;
        }).join('');
    }

    const msgDiv = createCardMessageElement(message.taskId);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    function renderCard() {
        const bodyHtml = `${buildGoalHtml()}<div class="plan-steps-body">${buildStepsHtml()}</div>`;
        const existingBody = card.querySelector('.msg-card-body');
        if (existingBody) existingBody.innerHTML = bodyHtml;
    }

    function switchToEditMode() {
        card.querySelector('.plan-confirm-actions')?.remove();

        const body = card.querySelector('.msg-card-body') as HTMLElement;
        body.innerHTML = '';

        const goalLabel = document.createElement('div');
        goalLabel.className = 'plan-edit-label';
        goalLabel.textContent = '🎯 目标';

        const goalInput = document.createElement('textarea');
        goalInput.className = 'plan-edit-goal-input';
        goalInput.value = currentGoal;
        goalInput.rows = 3;

        const stepsLabel = document.createElement('div');
        stepsLabel.className = 'plan-edit-label';
        stepsLabel.textContent = '📋 计划步骤';

        const stepsContainer = document.createElement('div');
        stepsContainer.className = 'plan-edit-steps';

        function renderStepInputs() {
            stepsContainer.innerHTML = '';
            currentSteps.forEach((step: any, i: number) => {
                const row = document.createElement('div');
                row.className = 'plan-edit-step-row';

                const input = document.createElement('input');
                input.className = 'plan-edit-step-input';
                input.value = step.content;
                input.placeholder = `步骤 ${i + 1}`;
                input.addEventListener('input', () => { currentSteps[i].content = input.value; });

                const removeBtn = document.createElement('button');
                removeBtn.className = 'plan-edit-step-remove';
                removeBtn.textContent = '✕';
                removeBtn.addEventListener('click', () => {
                    currentSteps.splice(i, 1);
                    renderStepInputs();
                });

                row.appendChild(input);
                row.appendChild(removeBtn);
                stepsContainer.appendChild(row);
            });
        }

        renderStepInputs();

        const addBtn = document.createElement('button');
        addBtn.className = 'plan-edit-add-step';
        addBtn.textContent = '+ 添加步骤';
        addBtn.addEventListener('click', () => {
            currentSteps.push({ content: '', status: 'pending' });
            renderStepInputs();
            stepsContainer.scrollTop = stepsContainer.scrollHeight;
        });

        const editActions = document.createElement('div');
        editActions.className = 'plan-edit-actions';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'msg-card-btn primary';
        saveBtn.textContent = '保存 ✓';
        saveBtn.addEventListener('click', () => {
            currentGoal = goalInput.value.trim();
            currentSteps = currentSteps.filter((s: any) => s.content.trim());
            dirty = true;
            renderCard();
            editActions.remove();
            card.appendChild(actionsDiv);
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'msg-card-btn secondary';
        cancelBtn.textContent = '取消';
        cancelBtn.addEventListener('click', () => {
            currentGoal = message.goal || '';
            currentSteps = planSteps.map((s: any) => ({ content: s.content, status: s.status }));
            dirty = false;
            renderCard();
            editActions.remove();
            card.appendChild(actionsDiv);
        });

        editActions.appendChild(saveBtn);
        editActions.appendChild(cancelBtn);

        body.appendChild(goalLabel);
        body.appendChild(goalInput);
        body.appendChild(stepsLabel);
        body.appendChild(stepsContainer);
        body.appendChild(addBtn);
        body.appendChild(editActions);
    }

    const card = createCard({
        headerHtml: '📋 计划方案',
        bodyHtml: `${buildGoalHtml()}<div class="plan-steps-body">${buildStepsHtml()}</div>`,
        defaultCollapsed: false,
        borderColor: '#4a8bb5',
        headerBg: '#1e2d3d',
        headerColor: '#e0e0e0',
        rawData: message
    });
    card.classList.add('plan-confirmation-card');

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions plan-confirm-actions';

    function handleConfirm() {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✅ 已确认，开始执行...';
        actionsDiv.appendChild(statusEl);
        if (dirty) {
            vscode.postMessage({ type: 'confirmPlanWithEdit', taskId: message.taskId, goal: currentGoal, steps: currentSteps });
        } else {
            vscode.postMessage({ type: 'confirmPlan', taskId: message.taskId });
        }
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认计划 ✓';
    confirmBtn.addEventListener('click', handleConfirm);

    const editBtn = document.createElement('button');
    editBtn.className = 'msg-card-btn secondary';
    editBtn.textContent = '修改 ✏️';
    editBtn.addEventListener('click', () => switchToEditMode());

    actionsDiv.appendChild(confirmBtn);
    actionsDiv.appendChild(editBtn);
    card.appendChild(actionsDiv);

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function handleRemovePlanProposal() {
    document.querySelectorAll('.plan-confirmation-card').forEach(el => {
        const msgDiv = el.closest('.chat-msg');
        if (msgDiv) msgDiv.remove();
    });
}

function getTlKind(kind: string): string {
    if (kind === 'thinking') return 'thinking';
    if (kind === 'read' || kind === 'write' || kind === 'edit' || kind === 'todowrite' || kind === 'todo') return 'file';
    if (kind === 'bash' || kind === 'command' || kind === 'terminal') return 'command';
    if (kind === 'grep' || kind === 'search' || kind === 'glob') return 'search';
    if (kind === 'device') return 'device';
    return 'command';
}

function getTlIcon(kind: string): string {
    const k = getTlKind(kind);
    if (k === 'thinking') return '💭';
    if (k === 'file') return kind === 'read' ? '📖' : kind === 'write' || kind === 'edit' ? '✏️' : '📄';
    if (k === 'command') return '💻';
    if (k === 'search') return '🔍';
    if (k === 'device') return '🔧';
    return '⚙️';
}

function getTlColor(kind: string): string {
    const map: Record<string, string> = { thinking: '#888', file: '#4a8bb5', command: '#5a9d6b', search: '#8b5cf6', device: '#e6b422' };
    return map[getTlKind(kind)] || '#666';
}

function createTimelineEntry(msg: any): HTMLElement {
    const kind = msg.kind || '';
    const title = msg.title || '';
    const output = msg.content || msg.output || '';
    const status = msg.status || 'completed';
    const tlKind = getTlKind(kind);
    const icon = getTlIcon(kind);
    const color = getTlColor(kind);
    const taskId = msg.taskId || activeTaskId || '';

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

    const statusEl = document.createElement('span');
    statusEl.className = 'tl-entry-status';
    if (status === 'running' || status === 'pending') {
        statusEl.className += ' running';
        statusEl.textContent = '🔄 运行中';
    } else if (status === 'failed' || status === 'error') {
        statusEl.className += ' fail';
        statusEl.textContent = '❌';
    } else {
        statusEl.className += ' ok';
    }

    const expandEl = document.createElement('span');
    expandEl.className = 'tl-entry-expand';
    expandEl.textContent = '▶';

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

    const autoExpand = status === 'running' || status === 'pending' || status === 'failed' || status === 'error';
    if (output && autoExpand) {
        body.classList.add('open');
        expandEl.classList.add('open');
    }

    header.appendChild(iconEl);
    header.appendChild(titleEl);
    if (statusEl.textContent) header.appendChild(statusEl);
    header.appendChild(expandEl);

    header.addEventListener('click', () => {
        body.classList.toggle('open');
        expandEl.classList.toggle('open');
    });

    main.appendChild(header);
    main.appendChild(body);
    entry.appendChild(bar);
    entry.appendChild(main);

    return entry;
}

function createMergedTimelineEntry(thinkingMsg: any, tools: any[]): HTMLElement {
    const firstTool = tools[0] || {};
    const kind = firstTool.kind || '';
    const status = firstTool.status || 'completed';
    const tlKind = getTlKind(kind);
    const color = getTlColor(kind);
    const toolOutputs = tools.map(t => t.content || t.output || '').filter(Boolean).join('\n');
    const statuses = tools.map(t => t.status || 'completed');
    const hasRunning = statuses.some(s => s === 'running' || s === 'pending');
    const hasFailed = statuses.some(s => s === 'failed' || s === 'error');

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
    const thinkText = (thinkingMsg.title || '思考').substring(0, 20);
    let titleHtml = `<span style="color:#888;font-style:italic">${escapeHtml(thinkText)}</span>`;
    for (const t of tools) {
        const tIcon = getTlIcon(t.kind || '');
        const tTitle = escapeHtml(t.title || '');
        titleHtml += ` <span class="tl-arrow">→</span> ${tIcon} ${tTitle}`;
    }
    titleEl.innerHTML = titleHtml;

    const statusEl = document.createElement('span');
    statusEl.className = 'tl-entry-status';
    if (hasRunning) {
        statusEl.className += ' running';
        statusEl.textContent = '🔄 运行中';
    } else if (hasFailed) {
        statusEl.className += ' fail';
        statusEl.textContent = '❌';
    } else {
        statusEl.className += ' ok';
    }

    const expandEl = document.createElement('span');
    expandEl.className = 'tl-entry-expand';
    expandEl.textContent = '▶';

    const body = document.createElement('div');
    body.className = 'tl-entry-body';

    const thinkingOutput = thinkingMsg.content || '';
    if (thinkingOutput) {
        const thinkingPre = document.createElement('pre');
        thinkingPre.className = 'tl-body-thinking';
        thinkingPre.textContent = thinkingOutput;
        body.appendChild(thinkingPre);
    }
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

    const autoExpand = status === 'running' || status === 'pending' || status === 'failed' || status === 'error';
    if (autoExpand) {
        body.classList.add('open');
        expandEl.classList.add('open');
    }

    header.appendChild(iconEl);
    header.appendChild(titleEl);
    if (statusEl.textContent) header.appendChild(statusEl);
    header.appendChild(expandEl);

    header.addEventListener('click', () => {
        body.classList.toggle('open');
        expandEl.classList.toggle('open');
    });

    main.appendChild(header);
    main.appendChild(body);
    entry.appendChild(bar);
    entry.appendChild(main);

    return entry;
}

function handleToolCallUpdate(msg: any) {
    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const toolId = msg.toolCallId;
    const kind = msg.kind || '';
    const rawContent = msg.content || msg.output || '';

    // todowrite — keep as interactive card
    if (kind === 'todowrite' || _isTodoArray(rawContent)) {
        flushMerge();
        _tabGroup = null;
        if (activeToolCallElements.has(toolId)) {
            const existingEl = activeToolCallElements.get(toolId)!;
            const raw = msg.content || msg.output || '';
            const body = existingEl.querySelector('.msg-card-body');
            if (body && raw) body.innerHTML = buildTodoBodyHtml(raw, toolId, msg.taskId || activeTaskId || '');
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
                taskId: msg.taskId || activeTaskId || '',
            });
            appendToChatMessages(msgDiv);
            activeToolCallElements.set(toolId, msgDiv);
        }
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    // Thinking entry — save for merge with subsequent tools
    if (kind === 'thinking') {
        flushMerge();
        const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
        if (existingEntry) {
            const body = existingEntry.querySelector('.tl-entry-body pre');
            if (body) body.textContent = msg.content || msg.output || '';
            if (msg.status === 'completed') {
                const statusEl = existingEntry.querySelector('.tl-entry-status');
                if (statusEl) { statusEl.className = 'tl-entry-status ok'; statusEl.textContent = ''; }
            }
        } else {
            const entry = createTimelineEntry({
                toolCallId: toolId, kind, title: msg.title || '',
                status: msg.status || '', content: msg.content || msg.output || '',
                taskId: msg.taskId || activeTaskId || '',
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
                : (msg.title || '思考'),
            thinkingBody: msg.content || msg.output || '',
            tools: [],
        };
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    // Non-thinking tool — merge with pending thinking, or add to ongoing merge
    if (_mergeState) {
        const toolInfo = { kind, title: msg.title || '', content: msg.content || msg.output || '', status: msg.status || '' };
        // If this is an update to an existing tool in the merge, update in place
        const existingIdx = _mergeState.tools.findIndex(t => t.toolId === toolId);
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
            // New tool — add to merge list
            _mergeState.tools.push({ toolId, ...toolInfo });
            // Remove standalone thinking entry
            const thinkingEntry = document.querySelector(`.tl-entry[data-tl-id="${_mergeState.thinkingId}"]`);
            if (thinkingEntry) {
                const thinkingMsgDiv = thinkingEntry.closest('.chat-msg');
                if (thinkingMsgDiv) thinkingMsgDiv.remove();
            }
            // Remove any existing partial merge entry
            const existingMerge = document.querySelector('.tl-entry.tl-merged');
            if (existingMerge) {
                const msgDiv = existingMerge.closest('.chat-msg');
                if (msgDiv) msgDiv.remove();
            }
            // Create full merge entry with all tools
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

    // Timeline entry for all other tools (no merge)
    const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
    if (existingEntry) {
        // Update existing entry
        const statusEl = existingEntry.querySelector('.tl-entry-status');
        if (statusEl) {
            if (msg.status === 'running' || msg.status === 'pending') {
                statusEl.className = 'tl-entry-status running';
                statusEl.textContent = '🔄 运行中';
            } else if (msg.status === 'failed' || msg.status === 'error') {
                statusEl.className = 'tl-entry-status fail';
                statusEl.textContent = '❌';
            } else {
                statusEl.className = 'tl-entry-status ok';
                statusEl.textContent = '';
            }
        }
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
            taskId: msg.taskId || activeTaskId || '',
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

function showTlFilterBar() {
    const bar = document.getElementById('tl-filter-bar');
    if (bar) bar.classList.remove('hidden');
}

function initTlFilterBar() {
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



function extractContentFromXml(output: string): string {
    const m = output.match(/<content>([\s\S]*?)<\/content>/);
    return m ? m[1].trim() : output;
}

function formatToolTitle(kind: string, title: string): string {
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

function renderToolBubbleContent(bubble: HTMLElement, msg: any) {
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
        const todoHtml = buildTodoBodyHtml(content, msg.toolCallId || '', msg.taskId || activeTaskId || '');
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
            vscode.postMessage({ type: 'updateTodoItem', taskId: msg.taskId || activeTaskId, msgId: 'tool_' + (msg.toolCallId || ''), itemId, checked });
        });
        bubble.appendChild(card);
        return;
    }

    if (kind === 'thinking') {
        const card = makeCard({
            headerHtml,
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

function getNodeLetter(type: string): string {
    switch (type) {
        case 'demand': return 'D';
        case 'goal': return 'T';
        case 'plan': return 'P';
        case 'execute': return 'E';
        case 'self_verify': return 'V';
        case 'review': return 'C';
        default: return '●';
    }
}

function getNodeLabel(type: string): string {
    switch (type) {
        case 'demand': return '需求';
        case 'goal': return '目标';
        case 'plan': return '计划';
        case 'execute': return '执行';
        case 'self_verify': return '自验';
        case 'review': return '验收';
        default: return type;
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
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        const wrap = document.createElement('div');
        wrap.className = 'tl-node-wrap';

        const dot = document.createElement('div');
        dot.className = `tl-node status-${node.status}`;
        dot.title = `${node.label}`;
        if (node.messageId) {
            dot.dataset.msgId = node.messageId;
        }

        const emoji = document.createElement('span');
        emoji.className = 'tl-emoji';
        emoji.textContent = getNodeLetter(node.type);
        dot.appendChild(emoji);

        const label = document.createElement('span');
        label.className = 'tl-label';
        label.textContent = getNodeLabel(node.type);
        dot.appendChild(label);

        wrap.appendChild(dot);
        dotsEl.appendChild(wrap);

        if (i < nodes.length - 1) {
            const seg = document.createElement('div');
            seg.className = 'tl-line-segment';
            const color = getNodeSegmentColor(node.status);
            for (let d = 0; d < 7; d++) {
                const lineDot = document.createElement('div');
                lineDot.className = 'tl-line-dot';
                lineDot.style.background = color;
                seg.appendChild(lineDot);
            }
            dotsEl.appendChild(seg);
        }
    }
}

function getNodeSegmentColor(status: string): string {
    switch (status) {
        case 'completed': return '#1e7a32';
        case 'active': return '#1a5f9e';
        case 'pending': return 'rgba(26,95,158,.3)';
        case 'cancelled': return '#a04040';
        default: return 'rgba(255,255,255,.1)';
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

let activeTaskTitle: string = '';

(window as any).addMessage = addMessage;
(window as any).renderMarkdown = renderMarkdown;
(window as any).renderMessages = renderMessages;
