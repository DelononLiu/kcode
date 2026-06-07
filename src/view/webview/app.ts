import { G, type FileChange } from './state';
import { showAssistantView, initAgentSelector, initModelSelector, truncateModel } from './assistantView';
import { showTaskView } from './taskView';
import { initChat, initNavButtons, handleGenerationState, handlePendingQueueUpdate, sendMessageFromInput } from './chatInteraction';
import { initTemplateChips, renderCategorySelection, focusChatInput } from './templateFlow';
import { initPluginManager, renderPluginList } from './pluginRegistry';
import { initTlFilterBar, renderMarkdown, addMessage, renderMessages, hideWorkingIndicator, escapeHtml, appendToChatMessages, activateTab, handleAgentStreamUpdate, handleAgentStatus, handleToolCallUpdate, addSystemMessage, addUserMessage, handleKnowledgeExtract, __resetStream, showAgentThinking } from './messageRenderer';
import { handleDemoCardUpdate } from './demoCards';
import { initTaskV3 } from './taskv3/renderManager';
import { stateManager } from './taskv3/state';


declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();
G.vscode = vscode;
(window as any).vscode = vscode;
(window as any).__vscode = vscode;

// ===== ACP Log Management =====

function getAcpLogEntries() {
    return G.activeTaskId ? G.acpLogEntries.filter(e => e.taskId === G.activeTaskId) : [];
}

function handleAcpLogEntry(msg: any) {
    if (!G.acpLogEnabled) return;
    const taskId = msg.taskId || G.activeTaskId || '';
    G.acpLogEntries.push({ direction: msg.direction, text: msg.text, timestamp: msg.timestamp, taskId });
    if (G.acpLogEntries.length > G.acpLogMaxGlobal) {
        G.acpLogEntries = G.acpLogEntries.slice(-G.acpLogMaxGlobal);
    }
    const taskEntries = G.acpLogEntries.filter(e => e.taskId === taskId);
    if (taskEntries.length > G.acpLogMaxTask) {
        const toDelete = taskEntries.length - G.acpLogMaxTask;
        let deleted = 0;
        G.acpLogEntries = G.acpLogEntries.filter(e => {
            if (deleted >= toDelete) return true;
            if (e.taskId !== taskId) return true;
            deleted++;
            return false;
        });
    }
    renderAcpLog();
}

let lastReviewChanges: any[] = [];

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

(window as any).renderAcpLog = renderAcpLog;
(window as any).getAcpLogEntries = getAcpLogEntries;

// ===== Layout =====

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

// ===== V4 Layout =====

function initV4Layout() {
    const initInput = document.getElementById('tv4-init-input') as HTMLTextAreaElement;
    if (initInput) {
        const AUTO_GROW_MAX = 300;
        function autoGrow(el: HTMLTextAreaElement) {
            el.style.height = 'auto';
            const scrollH = el.scrollHeight;
            el.style.height = Math.min(scrollH, AUTO_GROW_MAX) + 'px';
            el.style.overflowY = scrollH > AUTO_GROW_MAX ? 'auto' : 'hidden';
        }
        initInput.addEventListener('input', () => autoGrow(initInput));
        initInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && initInput.value.trim()) {
                e.preventDefault();
                const taskText = initInput.value;
                const nameEl = document.getElementById('tv4-task-name');
                if (nameEl) nameEl.textContent = taskText;
                G.vscode.postMessage({ type: 'newTaskWithText', text: taskText });
                showTaskView(true);
            }
        });
    }

    // Example chips
    const chipsContainer = document.querySelector('.tv4-example-chips');
    if (chipsContainer) {
        chipsContainer.addEventListener('click', (e) => {
            const chip = (e.target as HTMLElement).closest('.tv4-example-chip') as HTMLElement;
            if (chip) {
                const text = chip.dataset.text;
                if (text) {
                    const nameEl = document.getElementById('tv4-task-name');
                    if (nameEl) nameEl.textContent = text;
                    G.vscode.postMessage({ type: 'newTaskWithText', text });
                    showTaskView(true);
                }
            }
        });
    }

    // Unified input
    const input = document.getElementById('tv4-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('tv4-send-btn');
    const stopBtn = document.getElementById('tv4-stop-btn');

    if (input && sendBtn) {
        const AUTO_GROW_MAX = 300;
        function autoGrowTv4(el: HTMLTextAreaElement) {
            el.style.height = 'auto';
            const scrollH = el.scrollHeight;
            el.style.height = Math.min(scrollH, AUTO_GROW_MAX) + 'px';
            el.style.overflowY = scrollH > AUTO_GROW_MAX ? 'auto' : 'hidden';
        }
        input.addEventListener('input', () => autoGrowTv4(input));

        sendBtn.addEventListener('click', () => {
            if (input.value.trim() && G.activeTaskId) {
                G.vscode.postMessage({ type: 'sendMessage', text: input.value.trim(), taskId: G.activeTaskId });
                input.value = '';
                autoGrowTv4(input);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.value.trim() && G.activeTaskId) {
                    G.vscode.postMessage({ type: 'sendMessage', text: input.value.trim(), taskId: G.activeTaskId });
                    input.value = '';
                    autoGrowTv4(input);
                }
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (G.activeTaskId) G.vscode.postMessage({ type: 'stopGeneration', taskId: G.activeTaskId });
        });
    }

    // Image / attach
    const tv4ImageBtn = document.querySelector('.tv4-image-btn');
    tv4ImageBtn?.addEventListener('click', () => {
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
                        G.vscode.postMessage({ type: 'addImage', file: file.name, data: e.target?.result });
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
        fileInput.click();
    });

    const tv4AttachBtn = document.querySelector('.tv4-attach-btn');
    tv4AttachBtn?.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.addEventListener('change', () => {
            if (fileInput.files) {
                for (let i = 0; i < fileInput.files.length; i++) {
                    const file = fileInput.files[i];
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        G.vscode.postMessage({ type: 'addAttachment', file: file.name, data: e.target?.result });
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
        fileInput.click();
    });

    // Near-input tools
    const tv4AcpLogBtn = document.getElementById('tv4-acp-log-btn');
    tv4AcpLogBtn?.addEventListener('click', () => {
        const rp = document.getElementById('right-panel');
        if (!rp) return;
        const acpTab = document.querySelector('.tab[data-tab="acplog"]');
        if (!rp.classList.contains('hidden') && acpTab?.classList.contains('active')) {
            rp.classList.add('hidden');
            tv4AcpLogBtn.classList.remove('active');
        } else {
            rp.classList.remove('hidden');
            activateTab('acplog');
            tv4AcpLogBtn.classList.add('active');
        }
    });

    const tv4BtnTerminal = document.getElementById('tv4-btn-terminal');
    tv4BtnTerminal?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'openTerminal' });
    });

    const tv4BtnKnowledgeExtract = document.getElementById('tv4-btn-knowledge-extract');
    tv4BtnKnowledgeExtract?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'extractKnowledge', taskId: G.activeTaskId });
    });
}

// ===== Message Router =====

function initMessageHandler() {
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'loadMessages':
                hideWorkingIndicator();
                G.streamMessageEl = null;
                G._agentHeaderShown = false;

                // Assistant mode: keep old rendering path
                if (message.taskType === 'assistant') {
                    G.activeTaskId = message.taskId;
                    G.activeTaskStatus = message.taskStatus || '';
                    G.activeTaskType = message.taskType || '';
                    showAssistantView();
                    renderMessages(message.messages || []);
                    break;
                }

                // Task mode: V2 handles via messages-sync
                // Only update G state for backward compat (widgets read G.activeTaskId etc.)
                G.activeTaskId = message.taskId;
                G.activeTaskStatus = message.taskStatus || '';
                G.activeTaskType = message.taskType || '';
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
                handleAgentStatus(message.status, message.message, message.agentName || '', message.modelName || '');
                break;
            case 'focusInput':
                const focusInputEl = document.getElementById('chat-input') as HTMLTextAreaElement;
                if (focusInputEl) focusInputEl.focus();
                const focusTv4Input = document.getElementById('tv4-input') as HTMLTextAreaElement;
                if (focusTv4Input) focusTv4Input.focus();
                break;
            case 'addUserMessage':
                addUserMessage(message.content);
                showAgentThinking();
                // 写入 v3 state.messages 确保 messages-sync 后 user 消息不丢
                {
                    const st = stateManager.snapshot();
                    const msgs = [...st.messages];
                    msgs.push({
                        id: 'user_' + Date.now(),
                        taskId: st.activeTaskId || '',
                        role: 'user',
                        content: message.content,
                        timestamp: Date.now(),
                    });
                    stateManager.patch({ messages: msgs });
                }
                break;
            case 'showGoalConfirmation':
            case 'finalizeGoalMessage':
            case 'showExecuteConfirmation':
            case 'showSelfVerifyConfirmation':
            case 'showReviewRequest':
            case 'showPlanProposal':
            case 'removePlanProposal':
            case 'updateTaskInfo':
            case 'updateNodePanel':
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
            case 'toolCallUpdate':
                handleToolCallUpdate(message);
                break;
            case 'generationState':
                handleGenerationState(message.isGenerating);
                break;
            case 'pendingQueueUpdate':
                handlePendingQueueUpdate(message.count, message.items || []);
                break;
            case 'addSystemMessage':
                addSystemMessage(message.content);
                break;
            case 'slashCommandList':
                G.slashCommands = message.commands || [];
                break;
            case 'acpLogEntry':
                handleAcpLogEntry(message);
                break;
            case 'acpLogState':
                G.acpLogEnabled = message.enabled;
                G.acpLogMaxGlobal = message.maxGlobal ?? 5000;
                G.acpLogMaxTask = message.maxTask ?? 2000;
                const cb = document.getElementById('acp-log-enable') as HTMLInputElement;
                if (cb) cb.checked = message.enabled;
                if (!message.enabled) {
                    G.acpLogEntries = [];
                    renderAcpLog();
                }
                break;
            case 'showNewTaskView':
                showTaskView(false);
                const newInput = document.getElementById('tv4-init-input') as HTMLTextAreaElement;
                if (newInput) { newInput.value = ''; newInput.focus(); }
                break;
            case 'toggleViewMode':
                break;
            case 'updateCategoryDefs':
                G.categoryDefs = message.categories;
                initTemplateChips();
                break;

            case 'startTemplateFlow':
                renderCategorySelection();
                break;

            case 'updateOutputPanel':
                break;
            case 'agentList':
                initAgentSelector(message.agents || []);
                break;
            case 'modelList':
                initModelSelector(message.models || []);
                break;
            case 'setInputPreset':
                {
                    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
                    if (input) input.value = message.text || '';
                    const tv4Input = document.getElementById('tv4-input') as HTMLTextAreaElement;
                    if (tv4Input) tv4Input.value = message.text || '';
                }
                break;
            case 'setInputPlaceholder':
                {
                    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
                    if (input) input.placeholder = message.text || '提出后续修改要求';
                    const tv4Input = document.getElementById('tv4-input') as HTMLTextAreaElement;
                    if (tv4Input) tv4Input.placeholder = message.text || '输入指令与 AI 协作...';
                }
                break;
            case 'setNarration':
                {
                    const el = document.getElementById('system-narration');
                    if (!el) break;
                    if (message.text) {
                        el.classList.remove('hidden');
                        el.innerHTML = '<span class="narration-dot"></span> ' + escapeHtml(message.text);
                    } else {
                        el.classList.add('hidden');
                        el.innerHTML = '';
                    }
                    const tv4El = document.getElementById('tv4-system-narration');
                    if (tv4El) {
                        if (message.text) {
                            tv4El.classList.remove('hidden');
                            tv4El.innerHTML = '<span class="narration-dot"></span> ' + escapeHtml(message.text);
                        } else {
                            tv4El.classList.add('hidden');
                            tv4El.innerHTML = '';
                        }
                    }
                }
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
            case 'demoCardUpdate':
                handleDemoCardUpdate(message);
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
            case 'pluginContributions':
                (window as any).pluginRegistry?.applyPluginContributions(message.contributions || []);
                break;
            case 'pluginList':
                renderPluginList(message.plugins || []);
                break;
        }
    });
}

function flashInput() {
    const wrapper = document.querySelector('.input-wrapper');
    if (wrapper) {
        wrapper.classList.remove('input-flash');
        void (wrapper as HTMLElement).offsetWidth;
        wrapper.classList.add('input-flash');
    }
    const tv4Wrapper = document.querySelector('.tv4-input-wrapper');
    if (tv4Wrapper) {
        tv4Wrapper.classList.remove('input-flash');
        void (tv4Wrapper as HTMLElement).offsetWidth;
        tv4Wrapper.classList.add('input-flash');
    }
}

// ===== DOMContentLoaded =====

document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    initTabs();
    initChat();
    initMessageHandler();
    initNavButtons();
    initPluginManager();
    initV4Layout();
    // initPhaseView();

    const dataEl = document.getElementById('__panelData');
    if (dataEl) {
        const agents = JSON.parse(dataEl.dataset.availableAgents || '[]');
        if (agents.length > 0) {
            initAgentSelector(agents);
        }
    }
    initTemplateChips();

    (window as any).__openNativeDiff = (original: string, modified: string, filePath: string) => {
        G.vscode.postMessage({ type: 'openNativeDiff', original, modified, filePath });
    };
});

// ===== Window Exports (cross-bundle compatibility) =====

(window as any).addMessage = addMessage;
(window as any).renderMarkdown = renderMarkdown;
(window as any).renderMessages = renderMessages;
(window as any).__resetStream = __resetStream;

initTaskV3();

