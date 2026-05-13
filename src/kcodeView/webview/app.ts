import { marked } from 'marked';
import hljs from 'highlight.js';
import { AppState, type FileChange } from './state';

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
    initNodePanel();

    // Dashboard collapsible sections
    document.querySelectorAll('.dp-section-header.dp-collapsible').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = (header as HTMLElement).dataset.target;
            const body = document.getElementById(targetId!);
            const arrow = header.querySelector('.dp-arrow');
            if (body && arrow) {
                body.classList.toggle('hidden');
                arrow.classList.toggle('collapsed');
            }
        });
    });

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
                activeTaskType = message.taskType || '';
                renderAcpLog();
                if (message.reviewChanges && message.reviewChanges.length > 0) {
                    reviewChangesMap.set(message.taskId, message.reviewChanges);
                }
    lastAcceptanceCriteria = message.acceptanceCriteria || null;
    if (message.reviewChanges || message.acceptanceCriteria) {
        acceptanceCheckedState.delete(message.taskId);
    }
    renderMessages(message.messages);
                break;
            case 'showDashboard':
                renderDashboardPanel(message.allTasks);
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
                initCategoryChips();
                break;
            case 'startTemplateFlow':
                renderCategorySelection();
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
    if (indicator && !indicator.classList.contains('hidden') && indicator.parentElement === container) {
        container.insertBefore(el, indicator);
    } else {
        container.appendChild(el);
    }
    updateLastMsgConvertBtn();
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
let activeTaskType: string = '';
let activeTaskPhase: string = '';
let categoryDefs: any[] = [];
let selectedCategory: string | null = null;
let selectedSubType: string | null = null;
let lastAcceptanceCriteria: string[] | null = null;
const acceptanceCheckedState: Map<string, boolean[]> = new Map();
let taskHooks: Record<string, string[]> = {};
let workspaceHooks: Record<string, string[]> = {};

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

            const acpLogBtn = document.getElementById('acp-log-btn');
            if (tabName !== 'acplog') {
                acpLogBtn?.classList.remove('active');
            }
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

        const msg: any = { type: 'sendMessage', text, taskId: activeTaskId };
        if (selectedCategory) {
            msg.category = selectedCategory;
            selectedCategory = null;
            const bar = document.getElementById('input-category-bar');
            if (bar) bar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
        }
        vscode.postMessage(msg);
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

    const btnNewTask = document.getElementById('btn-new-task');
    btnNewTask?.addEventListener('click', () => {
        vscode.postMessage({ type: 'newTask' });
    });

    const btnDashboard = document.getElementById('btn-dashboard');
    btnDashboard?.addEventListener('click', () => {
        vscode.postMessage({ type: 'openDashboard' });
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

        const hooksToolbarBtn = document.getElementById('hooks-toolbar-btn');
        hooksToolbarBtn?.addEventListener('click', () => {
            const isOpen = !hooksEditor.classList.contains('hidden');
            hooksEditor.classList.toggle('hidden');
            if (!isOpen) {
                renderHooksEditor();
            }
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

function handlePendingQueueUpdate(count: number, items: { text: string }[]) {
    const bar = document.getElementById('queue-bar');
    const summary = document.getElementById('queue-summary');
    const toggle = document.getElementById('queue-toggle');
    const clearBtn = document.getElementById('queue-clear-all');
    const list = document.getElementById('queue-list');
    if (!bar || !summary || !toggle || !clearBtn || !list) return;

    if (count === 0) {
        bar.classList.add('hidden');
        return;
    }

    bar.classList.remove('hidden');
    summary.textContent = `⏳ 排队中 (${count} 条)`;

    let expanded = false;
    toggle.textContent = '展开';
    toggle.onclick = () => {
        expanded = !expanded;
        toggle.textContent = expanded ? '收起' : '展开';
        list.classList.toggle('hidden', !expanded);
    };

    clearBtn.onclick = () => {
        vscode.postMessage({ type: 'clearPendingQueue' });
    };

    list.classList.add('hidden');
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

function addSystemMessage(content: string) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-msg system';
    el.innerHTML = `<div class="msg-bubble system">${content}</div>`;
    container.appendChild(el);
    updateLastMsgConvertBtn();
    container.scrollTop = container.scrollHeight;
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

function renderDashboardPanel(allTasks: any[]) {
    const scrollContainer = document.getElementById('chat-scroll');
    const dashboardPanel = document.getElementById('dashboard-panel');
    if (!scrollContainer || !dashboardPanel) return;

    scrollContainer.classList.add('chat-empty');
    document.getElementById('chat-header')?.style.setProperty('display', 'none');
    document.getElementById('chat-body')?.classList.remove('showing-categories');

    dashboardPanel.classList.remove('hidden');

    const inReview = allTasks.filter((t: any) => t.status === 'in_review');
    const active = allTasks.filter((t: any) => t.status === 'active');
    const completed = allTasks.filter((t: any) => t.status === 'completed').slice(0, 10);

    const renderSection = (sectionId: string, listId: string, tasks: any[]) => {
        const section = document.getElementById(sectionId);
        const list = document.getElementById(listId);
        if (!section || !list) return;
        section.style.display = tasks.length > 0 ? '' : 'none';
        list.innerHTML = '';
        for (const task of tasks) {
            const item = createDashboardPanelItem(task);
            list.appendChild(item);
        }
    };

    renderSection('dashboard-review-section', 'dashboard-review-list', inReview);
    renderSection('dashboard-active-section', 'dashboard-active-list', active);
    renderSection('dashboard-completed-section', 'dashboard-completed-list', completed);

    const emptyEl = document.getElementById('dashboard-empty-msg');
    if (emptyEl) {
        emptyEl.style.display = allTasks.length === 0 ? '' : 'none';
    }
}

function createDashboardPanelItem(task: any): HTMLElement {
    const item = document.createElement('div');
    item.className = 'dp-item';
    item.addEventListener('click', () => {
        vscode.postMessage({ type: 'selectTask', taskId: task.id });
    });

    const icon = document.createElement('span');
    icon.className = 'dp-item-icon';
    switch (task.status) {
        case 'in_review': icon.textContent = '🟡'; break;
        case 'active': icon.textContent = '🟢'; break;
        case 'completed': icon.textContent = '✅'; break;
        default: icon.textContent = '⚪'; break;
    }
    item.appendChild(icon);

    const title = document.createElement('span');
    title.className = 'dp-item-title';
    title.textContent = task.title || '未命名任务';
    item.appendChild(title);

    const typeEl = document.createElement('span');
    typeEl.className = 'dp-item-type';
    typeEl.textContent = task.type === 'chat' ? '💬' : '📝';
    item.appendChild(typeEl);

    const time = document.createElement('span');
    time.className = 'dp-item-time';
    const now = Date.now();
    const diff = now - task.createdAt;
    if (diff < 3600000) {
        time.textContent = Math.round(diff / 60000) + 'm';
    } else if (diff < 86400000) {
        time.textContent = Math.round(diff / 3600000) + 'h';
    } else {
        time.textContent = Math.round(diff / 86400000) + 'd';
    }
    item.appendChild(time);

    return item;
}

function renderMessages(messages: any[]) {
    activeToolCallElements.clear();
    const container = document.getElementById('chat-messages');
    const scrollContainer = document.getElementById('chat-scroll');
    if (!container || !scrollContainer) return;

    const existingIndicator = document.getElementById('working-indicator');
    const dashboardPanel = document.getElementById('dashboard-panel');
    if (dashboardPanel) dashboardPanel.classList.add('hidden');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) (placeholder as HTMLElement).style.display = '';

    container.innerHTML = '';
    if (existingIndicator) container.appendChild(existingIndicator);

    const inputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!messages || messages.length === 0) {
        scrollContainer.classList.remove('chat-empty');
        document.getElementById('chat-header')?.style.removeProperty('display');
        document.getElementById('chat-body')?.classList.remove('showing-categories');
        container.innerHTML = '<div class="chat-placeholder">输入需求，开始与 AI 对话</div>';
        initCategoryChips();
        if (existingIndicator) container.appendChild(existingIndicator);
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

    for (let i = 0; i < messages.length; i++) {
        addMessageElement(messages[i], changedFilesMap.get(i));
    }

    updateLastMsgConvertBtn();

    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

function updateLastMsgConvertBtn() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const existingBtn = document.getElementById('chat-convert-btn');
    if (activeTaskType !== 'chat') {
        existingBtn?.remove();
        return;
    }
    const msgs = container.querySelectorAll('.chat-msg');
    if (msgs.length === 0) {
        existingBtn?.remove();
        return;
    }
    const lastMsg = msgs[msgs.length - 1];
    const row = lastMsg.querySelector('.msg-row');
    if (!row) {
        existingBtn?.remove();
        return;
    }
    if (existingBtn && row.contains(existingBtn)) return;
    existingBtn?.remove();
    const btn = document.createElement('button');
    btn.id = 'chat-convert-btn';
    btn.className = 'convert-msg-btn';
    btn.textContent = '转为任务';
    btn.title = '将对话转为正式任务';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'convertToTask', taskId: activeTaskId });
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
    categoryDefs = [];

    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (input) input.placeholder = '提出后续修改要求';
}

function initCategoryChips() {
    const bar = document.getElementById('input-category-bar');
    if (!bar) return;
    if (!categoryDefs || categoryDefs.length === 0) return;
    bar.innerHTML = '';
    for (const cat of categoryDefs) {
        const chip = document.createElement('span');
        chip.className = 'category-chip';
        chip.dataset.cat = cat.key;
        chip.textContent = `${cat.icon} ${cat.label}`;
        chip.addEventListener('click', () => {
            if (selectedCategory === cat.key) {
                selectedCategory = null;
                bar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            } else {
                selectedCategory = cat.key;
                bar.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
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
    const titleEl = document.querySelector('.task-info-title');
    if (titleEl) titleEl.textContent = info.title || '选择任务开始对话';

    const badge = document.getElementById('task-status-badge');
    const sep = document.getElementById('task-info-sep');
    if (badge && sep) {
        const hasStatus = !!info.status && info.status !== 'pending' && info.title;
        badge.classList.toggle('hidden', !hasStatus);
        sep.classList.toggle('hidden', !hasStatus);
        if (hasStatus) {
            const statusMap: Record<string, string> = {
                pending: 'Pending',
                active: 'Active',
                in_review: 'In Review',
                completed: 'Completed',
                cancelled: 'Cancelled'
            };
            const label = statusMap[info.status] || info.status;
            badge.textContent = label;
            badge.className = 'task-status-badge';
            badge.classList.add('status-' + info.status);
        }
    }

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

    const goalRow = document.getElementById('task-info-goal');
    const goalText = document.getElementById('goal-header-text');
    if (goalRow && goalText) {
        const hasGoal = info.taskType === 'task' && info.goal && info.status !== 'cancelled' && info.status !== 'completed';
        goalRow.classList.toggle('hidden', !hasGoal);
        const summary = (info.goal || '').split('\n')[0].replace(/[*_#`>\[\]]/g, '').trim();
        goalText.textContent = summary || '目标';
        if (hasGoal) {
            const scrollContainer = document.getElementById('chat-scroll');
            if (scrollContainer) {
                scrollContainer.classList.remove('chat-empty');
            }
        }
    }

    // Phase badge + phase confirm buttons
    const phaseRow = document.getElementById('task-info-phase');
    const phaseBadge = document.getElementById('task-phase-badge');
    const goalConfirmBtn = document.getElementById('goal-confirm-btn');
    const planConfirmBtn = document.getElementById('plan-confirm-btn');
    const executeConfirmBtn = document.getElementById('execute-confirm-btn');
    if (phaseRow && phaseBadge) {
        const hasPhase = info.taskType === 'task' && info.phase && info.status !== 'cancelled' && info.status !== 'completed';
        phaseRow.classList.toggle('hidden', !hasPhase);
        if (hasPhase) {
            const phaseLetters: Record<string, string> = {
                demand: 'D', goal: 'T', plan: 'P', execute: 'E', self_verify: 'V', review: 'C'
            };
            const letter = phaseLetters[info.phase] || '';
            phaseBadge.textContent = `${letter} ${info.phaseLabel || info.phase}`;
        }
        if (goalConfirmBtn) {
            const isGoalPhase = info.taskType === 'task' && info.phase === 'goal' && info.status !== 'cancelled' && info.status !== 'completed';
            goalConfirmBtn.classList.toggle('hidden', !isGoalPhase);
        }
        if (planConfirmBtn) {
            const isPlanPhase = info.taskType === 'task' && info.phase === 'plan' && info.status !== 'cancelled' && info.status !== 'completed';
            planConfirmBtn.classList.toggle('hidden', !isPlanPhase);
        }
        if (executeConfirmBtn) {
            const isExecutePhase = info.taskType === 'task' && info.phase === 'execute' && info.status !== 'cancelled' && info.status !== 'completed';
            executeConfirmBtn.classList.toggle('hidden', !isExecutePhase);
        }
    }

    // Confirmed items
    const itemsRow = document.getElementById('task-info-items');
    if (itemsRow) {
        const confirmed = info.confirmedItems || [];
        const pending = info.pendingItems || [];
        const hasItems = info.taskType === 'task' && (confirmed.length > 0 || pending.length > 0);
        itemsRow.classList.toggle('hidden', !hasItems);
        if (hasItems) {
            const confirmedEl = document.getElementById('confirmed-items');
            const pendingEl = document.getElementById('pending-items');
            if (confirmedEl) {
                if (confirmed.length > 0) {
                    confirmedEl.innerHTML = '<span class="items-label">共识</span>' +
                        confirmed.map((item: string) => `<span class="confirmed-tag">${escapeHtml(item)}</span>`).join('');
                } else {
                    confirmedEl.innerHTML = '';
                }
            }
            if (pendingEl) {
                if (pending.length > 0) {
                    pendingEl.innerHTML = '<span class="items-label">待定</span>' +
                        pending.map((item: string) => `<span class="pending-tag">${escapeHtml(item)}</span>`).join('');
                } else {
                    pendingEl.innerHTML = '';
                }
            }
            itemsRow.classList.remove('hidden');
        }
    }

    // Store hooks data
    if (info.hooks) {
        taskHooks = info.hooks;
    }
    if (info.workspaceHooks) {
        workspaceHooks = info.workspaceHooks;
    }

    // Hooks count indicator
    const hooksCount = document.getElementById('hooks-count');
    if (hooksCount) {
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

    // Plan steps + execution progress
    const planRow = document.getElementById('task-info-plan');
    if (planRow) {
        const steps = info.planSteps || [];
        const hasSteps = info.taskType === 'task' && info.phase === 'execute' && steps.length > 0;
        planRow.classList.toggle('hidden', !hasSteps);
        if (hasSteps) {
            const stepsEl = document.getElementById('plan-steps');
            if (stepsEl) {
                const statusEmoji: Record<string, string> = {
                    pending: '○', active: '◉', completed: '✓'
                };
                const total = steps.length;
                const done = steps.filter((s: any) => s.status === 'completed').length;
                const activeIdx = steps.findIndex((s: any) => s.status === 'active');
                const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
                stepsEl.innerHTML =
                    `<div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${progressPct}%"></div></div>` +
                    `<div class="plan-progress-label">${done}/${total} 步骤完成</div>` +
                    steps.map((step: any, i: number) => {
                        const emoji = statusEmoji[step.status] || '○';
                        const activeClass = i === activeIdx ? ' step-active' : '';
                        return `<div class="plan-step-item${activeClass}"><span class="step-status status-${step.status}">${emoji}</span><span class="step-content">${escapeHtml(step.content)}</span></div>`;
                    }).join('');
            }
            planRow.classList.remove('hidden');
        }
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
    rawData?: any;
    copyable?: boolean;
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

function removeGoalConfirmationCard() {
    document.querySelectorAll('.msg-card').forEach(el => el.remove());
}

function handleShowPlanProposal(message: any) {
    const planSteps = message.planSteps || [];
    if (planSteps.length === 0) return;

    hideWorkingIndicator();

    const container = document.getElementById('chat-messages')!;
    const scrollContainer = document.getElementById('chat-scroll')!;

    const existing = container.querySelector('.plan-confirmation-card');
    if (existing) return;

    const msgDiv = createCardMessageElement(message.taskId);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const stepsHtml = planSteps.map((step: any, i: number) => {
        const statusIcon = step.status === 'completed' ? '✅' : step.status === 'active' ? '🔄' : '○';
        return `<div class="plan-step-line"><span class="plan-step-status">${statusIcon}</span><span>${escapeHtml(step.content)}</span></div>`;
    }).join('');

    const card = createCard({
        headerHtml: '📋 计划方案',
        bodyHtml: `<div class="plan-steps-body">${stepsHtml}</div>`,
        defaultCollapsed: false,
        borderColor: '#4a8bb5',
        headerBg: '#1e2d3d',
        headerColor: '#e0e0e0',
        rawData: message
    });
    card.classList.add('plan-confirmation-card');

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认计划 ✓';
    confirmBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✅ 已确认，开始执行...';
        actionsDiv.appendChild(statusEl);
        vscode.postMessage({ type: 'confirmPlan', taskId: message.taskId });
    });

    const reviseBtn = document.createElement('button');
    reviseBtn.className = 'msg-card-btn secondary';
    reviseBtn.textContent = '调整建议 ↩';
    reviseBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '↩️ 已驳回调整';
        actionsDiv.appendChild(statusEl);
        vscode.postMessage({ type: 'rejectPlan', taskId: message.taskId });
    });

    actionsDiv.appendChild(confirmBtn);
    actionsDiv.appendChild(reviseBtn);
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

function extractContentFromXml(output: string): string {
    const m = output.match(/<content>([\s\S]*?)<\/content>/);
    return m ? m[1].trim() : output;
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
    const status = msg.status || '';

    const kindIcon = getToolKindIcon(kind);
    const headerHtml = kindIcon + escapeHtml(formatToolTitle(kind, title));

    if (kind === 'thinking') {
        const card = createCard({
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

    const card = createCard({
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
        wrap.appendChild(dot);
        dotsEl.appendChild(wrap);

        if (i < nodes.length - 1) {
            const seg = document.createElement('div');
            seg.className = 'tl-line-segment';
            const color = getNodeSegmentColor(node.status);
            for (let d = 0; d < 7; d++) {
                const dot = document.createElement('div');
                dot.className = 'tl-line-dot';
                dot.style.background = color;
                seg.appendChild(dot);
            }
            dotsEl.appendChild(seg);
        }
    }
}

function getNodeSegmentColor(status: string): string {
    switch (status) {
        case 'completed': return '#2ea043';
        case 'active': return '#1f7bc4';
        case 'pending': return 'rgba(255,255,255,.25)';
        case 'cancelled': return '#e06060';
        default: return 'rgba(255,255,255,.15)';
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

    const gutter = document.getElementById('node-timeline-gutter');
    const collapseBtn = document.getElementById('tl-collapse-btn');
    if (gutter && collapseBtn) {
        const stored = sessionStorage.getItem('kcode_tl_collapsed');
        if (stored === '1') {
            gutter.classList.add('collapsed');
            collapseBtn.textContent = '▶';
        }
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            gutter.classList.toggle('collapsed');
            const isCollapsed = gutter.classList.contains('collapsed');
            collapseBtn.textContent = isCollapsed ? '▶' : '◀';
            sessionStorage.setItem('kcode_tl_collapsed', isCollapsed ? '1' : '0');
        });
    }
}

(window as any).addMessage = addMessage;
(window as any).renderMarkdown = renderMarkdown;
(window as any).renderMessages = renderMessages;
