import { G, type FileChange } from './state';
import { showAssistantView, initAgentSelector, initModelSelector, truncateModel } from './assistantView';
import { showTaskView, toggleTaskRow, updateRailAndStages, updateMonitorTower, handleNodePanelUpdate, initNodePanel } from './taskView';
import { initChat, initNavButtons, handleGenerationState, handlePendingQueueUpdate, sendMessageFromInput } from './chatInteraction';
import { initTemplateChips, renderCategorySelection, focusChatInput } from './templateFlow';
import { initPluginManager, renderPluginList } from './pluginRegistry';
import { initTlFilterBar, renderMarkdown, addMessage, renderMessages, hideWorkingIndicator, escapeHtml, appendToChatMessages, activateTab, handleAgentStreamUpdate, handleAgentStatus, handleToolCallUpdate, addSystemMessage, addUserMessage, handleKnowledgeExtract, __resetStream, showAgentThinking, updateTaskInfo } from './messageRenderer';
import { handleDemoCardUpdate, showGoalConfirmationCard, handleShowPlanProposal, handleRemovePlanProposal, handleShowReviewRequest, reviewChangesMap } from './flowCards';

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

// ===== V3 Layout =====

function initV3Layout() {
    const initInput = document.getElementById('initial-task-input') as HTMLInputElement;
    if (initInput) {
        initInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && initInput.value.trim()) {
                const taskText = initInput.value;
                const nameEl = document.getElementById('task-board-task-name');
                if (nameEl) nameEl.textContent = taskText;
                if (G.activeTaskId) {
                    G.vscode.postMessage({ type: 'sendMessage', text: taskText, taskId: G.activeTaskId });
                } else {
                    G.vscode.postMessage({ type: 'newTaskWithText', text: taskText });
                }
                showTaskView(true);
            }
        });
    }

    const newTaskBtn = document.getElementById('header-new-task');
    if (newTaskBtn) newTaskBtn.addEventListener('click', () => G.vscode.postMessage({ type: 'newTask' }));

    const inlineInput = document.getElementById('inline-intervention-input') as HTMLInputElement;
    if (inlineInput) {
        inlineInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && inlineInput.value.trim()) {
                const text = inlineInput.value;
                inlineInput.value = '';
                if (G.activeTaskId && !G.activeTaskType?.startsWith('assistant')) {
                    G.vscode.postMessage({ type: 'sendMessage', text, taskId: G.activeTaskId });
                }
            }
        });
    }

    const timeTravelBtn = document.getElementById('btn-time-travel');
    if (timeTravelBtn) timeTravelBtn.addEventListener('click', () => {
        if (G.activeTaskId) G.vscode.postMessage({ type: 'stopGeneration', taskId: G.activeTaskId });
    });

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => {
        if (G.activeTaskId) G.vscode.postMessage({ type: 'stopGeneration', taskId: G.activeTaskId });
    });

    const capsuleModel = document.getElementById('header-model-capsule');
    if (capsuleModel) capsuleModel.addEventListener('click', () => {
        const agentBtn = document.getElementById('agent-dropdown-btn');
        if (agentBtn) agentBtn.click();
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
                G.activeTaskId = message.taskId;
                G.activeTaskStatus = message.taskStatus || '';
                G.activeTaskType = message.taskType || '';

                if (message.taskType === 'assistant') {
                    const tb = document.getElementById('task-board-task-name');
                    if (tb) tb.textContent = '🤖 小助手';
                    showAssistantView();
                    renderMessages(message.messages || []);
                    break;
                }
                if (message.taskId) {
                    const tb = document.getElementById('task-board-task-name');
                    if (tb) tb.textContent = message.title || '任务';
                    showTaskView(true);
                    updateRailAndStages(message.taskPhase || message.phase || '', message.taskStatus || message.status || '');
                }

                renderAcpLog();
                if (message.reviewChanges && message.reviewChanges.length > 0) {
                    reviewChangesMap.set(message.taskId, message.reviewChanges);
                    lastReviewChanges = message.reviewChanges;
                    (window as any).updateOutputPanel?.({}, message.reviewChanges);
                } else {
                    lastReviewChanges = [];
                }
                G.lastAcceptanceCriteria = message.acceptanceCriteria || null;
                if (message.reviewChanges || message.acceptanceCriteria) {
                    G.acceptanceCheckedState.delete(message.taskId);
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
                handleAgentStatus(message.status, message.message, message.agentName || '', message.modelName || '');
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
                    const tb2 = document.getElementById('task-board-task-name');
                    if (tb2) tb2.textContent = '🤖 小助手';
                    break;
                }
                const tb3 = document.getElementById('task-board-task-name');
                if (tb3 && message.title) tb3.textContent = message.title;
                updateTaskInfo(message);
                updateRailAndStages(message.phase || '', message.status || '');
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
                G.slashCommands = message.commands || [];
                break;
            case 'updateNodePanel':
                handleNodePanelUpdate(message.nodes, message.taskType);
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
            case 'setViewMode':
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
                (window as any).updateOutputPanel?.(message.taskInfo || {}, message.changes || []);
                updateMonitorTower(message.taskInfo || {}, message.changes || []);
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
                }
                break;
            case 'setInputPlaceholder':
                {
                    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
                    if (input) input.placeholder = message.text || '提出后续修改要求';
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
    if (!wrapper) return;
    wrapper.classList.remove('input-flash');
    void (wrapper as HTMLElement).offsetWidth;
    wrapper.classList.add('input-flash');
}

// ===== DOMContentLoaded =====

document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    initTabs();
    initChat();
    initMessageHandler();
    initNodePanel();
    initNavButtons();
    initTlFilterBar();
    initPluginManager();
    (window as any).initOutputPanel?.();
    initV3Layout();

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
