import { G } from './state';
import { showAgentThinking, hideWorkingIndicator, escapeHtml, renderMarkdown, appendToChatMessages } from './messageRenderer';
import { activateTab } from './messageRenderer';
import { getChatScroll } from './domContainers';

const AUTO_GROW_CHAT_MAX = 300;

function autoGrowChat(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    el.style.height = Math.min(scrollH, AUTO_GROW_CHAT_MAX) + 'px';
    el.style.overflowY = scrollH > AUTO_GROW_CHAT_MAX ? 'auto' : 'hidden';
}

export function initNavButtons() {
    const scrollContainer = getChatScroll();
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

export function sendMessageFromInput() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    autoGrowChat(input);
    input.focus();
    if (text.startsWith('/')) {
        G.vscode.postMessage({ type: 'slashCommand', text, taskId: G.activeTaskId });
        return;
    }
    if (G.activeTaskType === 'assistant' || !G.activeTaskId) {
        G.vscode.postMessage({ type: 'sendAssistantMessage', text });
        return;
    }
    const msg: any = { type: 'sendMessage', text, taskId: G.activeTaskId };
    G.vscode.postMessage(msg);
}

export function initChat() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const initInput = document.getElementById('tv4-init-input') as HTMLInputElement;
                if (initInput && document.getElementById('tv4-init')?.style.display !== 'none') {
                }
            }
        });
        return;
    }

    input.addEventListener('keydown', (e) => {
        if (G._slashMenuEl && e.key === 'Escape') { hideSlashMenu(); return; }
        if (G._slashMenuEl && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const active = G._slashMenuEl.querySelector('.slash-menu-item.hover') as HTMLElement;
            if (active) { active.click(); hideSlashMenu(); return; }
        }
        if (G._slashMenuEl && e.key === 'ArrowDown') { e.preventDefault(); moveSlashSel(1); return; }
        if (G._slashMenuEl && e.key === 'ArrowUp') { e.preventDefault(); moveSlashSel(-1); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessageFromInput();
        }
    });

    const sendBtn = document.getElementById('send-btn');
    sendBtn?.addEventListener('click', sendMessageFromInput);

    const stopBtn = document.getElementById('stop-btn');
    stopBtn?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'stopGeneration', taskId: G.activeTaskId });
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
                        G.vscode.postMessage({ type: 'addImage', file: file.name, data: e.target?.result });
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
                        G.vscode.postMessage({ type: 'addAttachment', file: file.name, data: e.target?.result });
                    };
                    reader.readAsDataURL(file);
                }
            }
        });
        fileInput.click();
    });

    input.addEventListener('input', () => {
        const val = input.value;
        autoGrowChat(input);
        if (val.startsWith('/') && !val.includes(' ')) {
            const query = val.slice(1).toLowerCase();
            const matched = !query ? G.slashCommands : G.slashCommands.filter(c => c.name.toLowerCase().replace(/^\//, '').startsWith(query) || c.name.toLowerCase().startsWith('/' + query));
            if (matched.length > 0) {
                showSlashMenu(matched);
                return;
            }
        }
        hideSlashMenu();
    });

    document.addEventListener('click', (e) => {
        if (G._slashMenuEl && !G._slashMenuEl.contains(e.target as Node) && e.target !== input) {
            hideSlashMenu();
        }
    });

    const scrollContainer = getChatScroll();
    if (scrollContainer) {
        scrollContainer.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) G._userScrolledUp = true;
        });
        scrollContainer.addEventListener('scroll', () => {
            if (G._programmaticScroll) return;
            const atBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 16;
            G._userScrolledUp = !atBottom;
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
        G.vscode.postMessage({ type: 'extractKnowledge', taskId: G.activeTaskId });
    });

    const btnExportWiki = document.getElementById('op-export-btn');
    btnExportWiki?.addEventListener('click', () => {
        const taskId = (btnExportWiki as HTMLElement).dataset.taskId;
        if (taskId) {
            G.vscode.postMessage({ type: 'exportToWiki', taskId });
        }
    });

    const btnTerminal = document.getElementById('btn-terminal');
    btnTerminal?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'openTerminal' });
    });

    const btnImportIssue = document.getElementById('btn-import-issue');
    btnImportIssue?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'importGitHubIssue' });
    });

    const acpLogEnable = document.getElementById('acp-log-enable') as HTMLInputElement;
    acpLogEnable?.addEventListener('change', () => {
        G.acpLogEnabled = acpLogEnable.checked;
        G.vscode.postMessage({ type: 'toggleAcpLog', enabled: G.acpLogEnabled });
        if (!G.acpLogEnabled) {
            G.acpLogEntries = [];
            (window as any).renderAcpLog?.();
        }
    });

    const acpLogClear = document.getElementById('acp-log-clear');
    acpLogClear?.addEventListener('click', () => {
        G.acpLogEntries = [];
        (window as any).renderAcpLog?.();
    });

    const goalConfirmBtn = document.getElementById('goal-confirm-btn');
    goalConfirmBtn?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'confirmGoalFromHeader', taskId: G.activeTaskId });
    });

    const planConfirmBtn = document.getElementById('plan-confirm-btn');
    planConfirmBtn?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'confirmPlan', taskId: G.activeTaskId });
    });

    const executeConfirmBtn = document.getElementById('execute-confirm-btn');
    executeConfirmBtn?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'confirmExecuteDone', taskId: G.activeTaskId });
    });

    const hooksEditBtn = document.getElementById('hooks-edit-btn');
    const hooksEditor = document.getElementById('hooks-editor');
    const hooksPhasesList = document.getElementById('hooks-phases-list');
    const hooksCloseBtn = document.getElementById('hooks-close-btn');

    if (hooksEditBtn && hooksEditor && hooksPhasesList && hooksCloseBtn) {
        const phaseLabels: Record<string, string> = {
        };
        const phaseOrder = ['goal', 'plan', 'execute', 'self_verify', 'review'];

        const hList = hooksPhasesList;
        function renderHooksEditor() {
            hList.innerHTML = '';
            const openPhase = hList.dataset.openPhase || '';

            for (const phase of phaseOrder) {
                const label = phaseLabels[phase] || phase;
                const wsCmds = G.workspaceHooks[phase] || [];
                const taskCmds = G.taskHooks[phase] || [];
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
                        G.vscode.postMessage({ type: 'updateHooks', taskId: G.activeTaskId, phase, commands });
                        if (commands.length > 0) {
                            G.taskHooks[phase] = commands;
                        } else {
                            delete G.taskHooks[phase];
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

    const termReplayBtn = document.getElementById('terminal-replay-btn');
    termReplayBtn?.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'openTerminalReplay', taskId: G.activeTaskId });
    });
}

export function handleGenerationState(isGenerating: boolean) {
    void toggleBtn('send-btn', 'stop-btn', isGenerating);
    void toggleBtn('tv4-send-btn', 'tv4-stop-btn', isGenerating);
}

function toggleBtn(sendId: string, stopId: string, isGenerating: boolean) {
    const sendBtn = document.getElementById(sendId);
    const stopBtn = document.getElementById(stopId);
    if (sendBtn && stopBtn) {
        if (isGenerating) { sendBtn.classList.add('hidden'); stopBtn.classList.remove('hidden'); }
        else { sendBtn.classList.remove('hidden'); stopBtn.classList.add('hidden'); }
    }
}

export function handlePendingQueueUpdate(count: number, items: { text: string }[]) {
    const bar = document.getElementById('queue-bar');
    const summary = document.getElementById('queue-summary');
    const toggle = document.getElementById('queue-toggle');
    const clearBtn = document.getElementById('queue-clear-all');
    const list = document.getElementById('queue-list');
    if (!bar || !summary || !toggle || !clearBtn || !list) return;

    if (count === 0) {
        bar.classList.add('hidden');
        G._queueExpanded = false;
        return;
    }

    bar.classList.remove('hidden');
    summary.textContent = `⏳ 排队中 (${count} 条)`;

    toggle.textContent = G._queueExpanded ? '收起' : '展开';
    toggle.onclick = () => {
        G._queueExpanded = list.classList.contains('hidden');
        toggle.textContent = G._queueExpanded ? '收起' : '展开';
        list.classList.toggle('hidden', G._queueExpanded);
    };

    clearBtn.onclick = () => {
        G._queueExpanded = false;
        G.vscode.postMessage({ type: 'clearPendingQueue' });
    };

    list.classList.toggle('hidden', !G._queueExpanded);
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
            G.vscode.postMessage({ type: 'cancelQueuedMessage', index: i });
        };
        item.appendChild(cancelBtn);

        list.appendChild(item);
    }
}

export function getCaretPos(textarea: HTMLTextAreaElement): { x: number; y: number } {
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

export function showSlashMenu(commands: { name: string; description: string }[], inputEl?: HTMLTextAreaElement) {
    hideSlashMenu();
    const input = inputEl || document.getElementById('chat-input') as HTMLTextAreaElement;
    if (!input) return;
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
    G._slashMenuEl = menu;
    G._slashSelIdx = 0;
}

export function hideSlashMenu() {
    if (G._slashMenuEl) {
        G._slashMenuEl.remove();
        G._slashMenuEl = null;
    }
    G._slashSelIdx = -1;
}

export function moveSlashSel(dir: number) {
    if (!G._slashMenuEl) return;
    const items = G._slashMenuEl.querySelectorAll('.slash-menu-item');
    items.forEach(el => el.classList.remove('hover'));
    G._slashSelIdx = Math.max(0, Math.min(items.length - 1, G._slashSelIdx + dir));
    items[G._slashSelIdx]?.classList.add('hover');
}

export function focusChatInput() {
    const el = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (el) el.focus();
}

/** 为任意输入框绑定 slash 菜单：输入 / 弹出命令列表，Enter 选择，Esc 关闭 */
export function bindSlashToInput(input: HTMLTextAreaElement, onSend: (text: string) => void) {
    input.addEventListener('input', () => {
        const val = input.value;
        if (val.startsWith('/') && !val.includes(' ')) {
            const query = val.slice(1).toLowerCase();
            const matched = !query ? G.slashCommands : G.slashCommands.filter(
                c => c.name.toLowerCase().replace(/^\//, '').startsWith(query) || c.name.toLowerCase().startsWith('/' + query)
            );
            if (matched.length > 0) {
                showSlashMenu(matched, input);
                return;
            }
        }
        hideSlashMenu();
    });

    input.addEventListener('keydown', (e) => {
        if (G._slashMenuEl && e.key === 'Escape') { hideSlashMenu(); return; }
        if (G._slashMenuEl && e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const active = G._slashMenuEl.querySelector('.slash-menu-item.hover') as HTMLElement;
            if (active) { active.click(); hideSlashMenu(); return; }
        }
        if (G._slashMenuEl && e.key === 'ArrowDown') { e.preventDefault(); moveSlashSel(1); return; }
        if (G._slashMenuEl && e.key === 'ArrowUp') { e.preventDefault(); moveSlashSel(-1); return; }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();
            if (text) onSend(text);
        }
    });

    document.addEventListener('click', (e) => {
        if (G._slashMenuEl && !G._slashMenuEl.contains(e.target as Node) && e.target !== input) {
            hideSlashMenu();
        }
    });
}
