import { G, type FileChange } from './state';
import { renderMarkdown, createCard, createCardMessageElement, escapeHtml, hideWorkingIndicator, appendToChatMessages, activateTab } from './messageRenderer';
import { getChatScroll, getChatMessages } from './domContainers';

export const _demoCards: Map<string, HTMLElement> = new Map();

export function handleDemoCardUpdate(msg: any) {
    const { cardId, action } = msg;
    if (action === 'create') {
        const card = renderDemoCard(msg);
        _demoCards.set(cardId, card);
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';
        msgDiv.dataset.demoCardId = cardId;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble tool-bubble';
        bubble.appendChild(card);
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
        const scrollContainer = getChatScroll();
        if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    const existing = _demoCards.get(cardId);
    if (!existing) return;

    if (action === 'appendOutput' && msg.output) {
        const outputArea = existing.querySelector('.demo-card-output');
        if (outputArea) {
            const lines = msg.output.split('\n').filter((l: string) => l.length > 0);
            for (const line of lines) {
                const cls = line.startsWith('\x1b[31m') ? 'stderr' : 'stdout';
                const text = line.replace(/\x1b\[[0-9;]*m/g, '');
                outputArea.innerHTML += `<div class="demo-card-output-line ${cls}">${escapeHtml(text)}</div>`;
            }
            outputArea.scrollTop = outputArea.scrollHeight;
        }
    }

    if (action === 'updateStatus' && msg.status) {
        const badge = existing.querySelector('.demo-card-status-badge');
        if (badge) {
            const statusMap: Record<string, string> = { running: '⏳ 运行中', completed: '✅ 已完成', failed: '❌ 失败' };
            badge.className = 'demo-card-status-badge ' + msg.status;
            badge.textContent = statusMap[msg.status] || msg.status;
        }
        const rerunBtn = existing.querySelector('.demo-card-btn.primary') as HTMLButtonElement;
        const stopBtn = existing.querySelector('.demo-card-btn.danger') as HTMLButtonElement;
        if (rerunBtn) rerunBtn.disabled = false;
        if (stopBtn) stopBtn.style.display = 'none';
    }

    if (action === 'setEnvMeta' && msg.envMeta) {
        const body = existing.querySelector('.demo-card-env-body');
        if (body) {
            body.innerHTML = Object.entries(msg.envMeta).map(([k, v]) =>
                `<div class="demo-card-env-row"><span class="demo-card-env-key">${escapeHtml(k)}</span><span class="demo-card-env-val">${escapeHtml(String(v))}</span></div>`
            ).join('');
        }
    }
}

export function renderDemoCard(msg: any): HTMLElement {
    const card = document.createElement('div');
    card.className = 'msg-card';
    card.style.borderColor = '#4a6b8b';

    const header = document.createElement('div');
    header.className = 'msg-card-header';
    header.style.borderLeftColor = '#4a6b8b';
    header.innerHTML = '<span class="msg-card-header-text"><span style="font-size:13px">▶</span> Demo 运行结果</span>';
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'msg-card-body demo-card';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'demo-card-section demo-card-info';
    infoDiv.innerHTML = `
        <span class="demo-card-info-key">Demo 名称:</span><span class="demo-card-info-value">${escapeHtml(msg.name || '')}</span>
        <span class="demo-card-info-key">执行命令:</span><span class="demo-card-info-value">${escapeHtml(msg.command || '')}</span>
        <span class="demo-card-info-key">运行设备:</span><span class="demo-card-info-value">${escapeHtml(msg.device || '')}</span>
    `;
    body.appendChild(infoDiv);

    const envSection = document.createElement('div');
    envSection.className = 'demo-card-section';
    const envHeader = document.createElement('div');
    envHeader.className = 'demo-card-env-header';
    envHeader.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg> 环境信息';
    const envBody = document.createElement('div');
    envBody.className = 'demo-card-env-body collapsed';
    if (msg.envMeta) {
        envBody.innerHTML = Object.entries(msg.envMeta).map(([k, v]) =>
            `<div class="demo-card-env-row"><span class="demo-card-env-key">${escapeHtml(k)}</span><span class="demo-card-env-val">${escapeHtml(String(v))}</span></div>`
        ).join('');
    }
    envHeader.addEventListener('click', () => {
        envHeader.classList.toggle('collapsed');
        envBody.classList.toggle('collapsed');
    });
    envSection.appendChild(envHeader);
    envSection.appendChild(envBody);
    body.appendChild(envSection);

    const statusRow = document.createElement('div');
    statusRow.className = 'demo-card-section demo-card-status-row';
    const badge = document.createElement('span');
    badge.className = 'demo-card-status-badge ' + (msg.status || 'running');
    const statusMap: Record<string, string> = { running: '⏳ 运行中', completed: '✅ 已完成', failed: '❌ 失败' };
    badge.textContent = statusMap[msg.status] || '⏳ 运行中';
    statusRow.appendChild(badge);
    body.appendChild(statusRow);

    const outputDiv = document.createElement('div');
    outputDiv.className = 'demo-card-output';
    if (msg.output) {
        const lines = msg.output.split('\n').filter((l: string) => l.length > 0);
        for (const line of lines) {
            const cls = line.startsWith('\x1b[31m') ? 'stderr' : 'stdout';
            const text = line.replace(/\x1b\[[0-9;]*m/g, '');
            outputDiv.innerHTML += `<div class="demo-card-output-line ${cls}">${escapeHtml(text)}</div>`;
        }
    }
    body.appendChild(outputDiv);

    const footer = document.createElement('div');
    footer.className = 'demo-card-section demo-card-footer';

    const viewLogBtn = document.createElement('button');
    viewLogBtn.className = 'demo-card-btn';
    viewLogBtn.textContent = '📋 查看日志';
    viewLogBtn.addEventListener('click', () => {
        const outputText = outputDiv.textContent || '';
        navigator.clipboard.writeText(outputText).then(() => {
            const orig = viewLogBtn.textContent;
            viewLogBtn.textContent = '✅ 已复制';
            setTimeout(() => { viewLogBtn.textContent = orig; }, 1500);
        });
    });
    footer.appendChild(viewLogBtn);

    const rerunBtn = document.createElement('button');
    rerunBtn.className = 'demo-card-btn primary';
    rerunBtn.textContent = '🔄 重新运行';
    rerunBtn.disabled = msg.status === 'running';
    rerunBtn.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'demoRerun', cardId: msg.cardId, taskId: msg.taskId, name: msg.name, command: msg.command, device: msg.device, envMeta: msg.envMeta });
    });
    footer.appendChild(rerunBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'demo-card-btn danger';
    stopBtn.textContent = '✕ 终止';
    stopBtn.style.display = msg.status === 'running' ? '' : 'none';
    stopBtn.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'demoStop', cardId: msg.cardId, taskId: msg.taskId });
    });
    footer.appendChild(stopBtn);

    body.appendChild(footer);
    card.appendChild(body);

    return card;
}

export function getChangeType(original: string, modified: string): { icon: string; label: string } {
    if (!original) return { icon: '📄', label: '新建' };
    if (!modified) return { icon: '🗑️', label: '删除' };
    return { icon: '📝', label: '修改' };
}

export function getChangeSummary(original: string, modified: string): string {
    if (!original) return '新建文件';
    if (!modified) return '删除文件';
    const oLines = original.split('\n').filter(l => l.trim());
    const mLines = modified.split('\n').filter(l => l.trim());
    const added = mLines.length - oLines.length;
    const changed = Math.abs(added);
    return added >= 0 ? `+${added} 行` : `${added} 行`;
}

export let reviewChangesMap: Map<string, FileChange[]> = new Map();
export let selectedReviewFileIdx: number | null = null;

export function createReviewChangesElement(changes: FileChange[], taskId: string): HTMLElement {
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
            G.vscode.postMessage({
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

export function attachReviewChanges(message: any) {
    selectedReviewFileIdx = null;
    const changes = message.reviewChanges as FileChange[];
    if (!changes || changes.length === 0) return;
    reviewChangesMap.set(message.taskId, changes);

    const lastReviewMsg = getChatMessages()?.querySelector('.chat-msg.agent:last-of-type') as HTMLElement;
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

export function handleShowReviewRequest(message: any) {
    attachReviewChanges({ ...message, reviewChanges: message.changes });
}

export function toggleReviewFileSelection(change: FileChange, item: HTMLElement, idx: number) {
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

export function showRejectInput(btn: HTMLElement, taskId: string) {
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
        G.vscode.postMessage({ type: 'rejectReview', taskId, reason });
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
            G.vscode.postMessage({ type: 'approveReview', taskId });
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

export function updateAcceptanceButtons(taskId: string) {
    const card = document.querySelector(`.msg-card[data-review-task-id="${taskId}"]`) as any;
    if (card?.__updateAcceptanceButtons) {
        card.__updateAcceptanceButtons();
    }
}

export function updateCardToStatus(card: HTMLElement, statusText: string) {
    const actions = card.querySelector('.msg-card-actions');
    if (actions) {
        actions.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = statusText;
        actions.appendChild(statusEl);
    }
}

export function findParentCard(el: HTMLElement): HTMLElement | null {
    return el.closest('.msg-card') as HTMLElement;
}

export function showGoalConfirmationCard(info: any) {
    hideWorkingIndicator();
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;

    if (G.streamMessageEl) {
        const bubbleParent = G.streamMessageEl.closest('.chat-msg');
        if (bubbleParent) bubbleParent.remove();
        G.streamMessageEl = null;
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
            G.vscode.postMessage({ type: 'confirmGoalWithEdit', taskId: info.taskId, goal: newGoal, originalRequest: info.originalRequest });
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
            G.vscode.postMessage({ type: 'confirmGoal', taskId: info.taskId, originalRequest: info.originalRequest });
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
            G.vscode.postMessage({ type: 'cancelTask', taskId: info.taskId });
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

    if (info.categoryLabel && info.subTypeLabel) {
        const badgeLine = document.createElement('div');
        badgeLine.className = 'goal-category-badge';
        badgeLine.textContent = `🏷️ ${info.categoryLabel} · ${info.subTypeLabel}`;
        const body = card.querySelector('.msg-card-body');
        if (body) {
            body.parentNode?.insertBefore(badgeLine, body);
        } else {
            card.insertBefore(badgeLine, card.firstChild);
        }
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';
    addConfirmationActions(actionsDiv);
    card.appendChild(actionsDiv);

    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function showHeaderRow(row: string, show: boolean) {
    const map: Record<string, string> = { row1: 'chat-header-row1', sub: 'chat-header-sub', row2: 'chat-header-row2', row3: 'chat-header-row3' };
    const el = document.getElementById(map[row]);
    if (el) el.classList.toggle('hidden', !show);
}

export function removeGoalConfirmationCard() {
    document.querySelectorAll('.msg-card').forEach(el => el.remove());
}

export function handleShowPlanProposal(message: any) {
    const planSteps = message.planSteps || [];
    if (planSteps.length === 0) return;

    hideWorkingIndicator();

    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;

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
            G.vscode.postMessage({ type: 'confirmPlanWithEdit', taskId: message.taskId, goal: currentGoal, steps: currentSteps });
        } else {
            G.vscode.postMessage({ type: 'confirmPlan', taskId: message.taskId });
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

export function handleRemovePlanProposal() {
    document.querySelectorAll('.plan-confirmation-card').forEach(el => {
        const msgDiv = el.closest('.chat-msg');
        if (msgDiv) msgDiv.remove();
    });
}

export function finalizeGoalMessage(taskId: string, goal: string, originalRequest: string, category?: string, subType?: string, categoryLabel?: string, subTypeLabel?: string) {
    hideWorkingIndicator();
    if (!G.streamMessageEl) {
        showGoalConfirmationCard({ taskId, goal, originalRequest, category, subType, categoryLabel, subTypeLabel });
        return;
    }
    const streamBubble = G.streamMessageEl;
    streamBubble.classList.remove('streaming');
    const msgEl = streamBubble.closest('.chat-msg') as HTMLElement;
    if (!msgEl) {
        showGoalConfirmationCard({ taskId, goal, originalRequest, category, subType, categoryLabel, subTypeLabel });
        G.streamMessageEl = null;
        return;
    }

    // If category was passed, add a badge
    if (categoryLabel && subTypeLabel) {
        const existingBadge = msgEl.querySelector('.goal-category-badge');
        if (!existingBadge) {
            const badge = document.createElement('div');
            badge.className = 'goal-category-badge';
            badge.textContent = `🏷️ ${categoryLabel} · ${subTypeLabel}`;
            msgEl.insertBefore(badge, msgEl.firstChild);
        }
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认目标 ✓';
    confirmBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✅ 已确认';
        actionsDiv.appendChild(statusEl);
        G.vscode.postMessage({ type: 'confirmGoal', taskId, originalRequest });
    });

    const reviseBtn = document.createElement('button');
    reviseBtn.className = 'msg-card-btn secondary';
    reviseBtn.textContent = '修改需求 ↩';
    reviseBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const body = streamBubble.querySelector('.msg-bubble-text, .msg-content');
        if (body) {
            const textarea = document.createElement('textarea');
            textarea.className = 'goal-edit-textarea';
            textarea.value = goal;
            textarea.rows = 6;
            body.innerHTML = '';
            body.appendChild(textarea);
            textarea.focus();
            const saveBtn = document.createElement('button');
            saveBtn.className = 'msg-card-btn primary';
            saveBtn.textContent = '保存修改 ✓';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'msg-card-btn secondary';
            cancelBtn.textContent = '取消';
            const editRow = document.createElement('div');
            editRow.style.cssText = 'display:flex;gap:8px;margin-top:8px';
            editRow.appendChild(saveBtn);
            editRow.appendChild(cancelBtn);
            body.appendChild(editRow);
            saveBtn.addEventListener('click', () => {
                const newGoal = textarea.value.trim();
                if (newGoal) {
                    G.vscode.postMessage({ type: 'confirmGoalWithEdit', taskId, goal: newGoal, originalRequest });
                    actionsDiv.innerHTML = '';
                    const se = document.createElement('div');
                    se.className = 'msg-card-status';
                    se.textContent = '✅ 已确认';
                    actionsDiv.appendChild(se);
                }
            });
            cancelBtn.addEventListener('click', () => {
                body.innerHTML = renderMarkdown(goal);
            });
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'msg-card-btn cancel';
    cancelBtn.textContent = '取消 ✕';
    cancelBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✕ 已取消任务';
        actionsDiv.appendChild(statusEl);
        G.vscode.postMessage({ type: 'cancelTask', taskId });
    });

    actionsDiv.appendChild(confirmBtn);
    actionsDiv.appendChild(reviseBtn);
    actionsDiv.appendChild(cancelBtn);
    msgEl.appendChild(actionsDiv);

    const scrollContainer = getChatScroll();
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;
    G.streamMessageEl = null;
}

export function showExecuteConfirmation(taskId: string) {
    hideWorkingIndicator();
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;

    const msgDiv = createCardMessageElement(taskId);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: '⚡ 执行完成',
        bodyHtml: '<div style="padding:8px 0">AI 已完成执行，请确认后进入自验阶段。</div>',
        defaultCollapsed: false,
        borderColor: '#d4a84b',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
        rawData: { taskId }
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认完成，进入自验 ✓';
    confirmBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✅ 已确认，进入自验...';
        actionsDiv.appendChild(statusEl);
        G.vscode.postMessage({ type: 'confirmExecuteDone', taskId });
    });

    actionsDiv.appendChild(confirmBtn);
    card.appendChild(actionsDiv);
    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function showSelfVerifyConfirmation(taskId: string) {
    hideWorkingIndicator();
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;

    const msgDiv = createCardMessageElement(taskId);
    const bubble = msgDiv.querySelector('.msg-bubble')!;

    const card = createCard({
        headerHtml: '🔍 自验完成',
        bodyHtml: '<div style="padding:8px 0">AI 已完成自验，请确认后进入验收阶段。</div>',
        defaultCollapsed: false,
        borderColor: '#6b9e6b',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
        rawData: { taskId }
    });

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'msg-card-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'msg-card-btn primary';
    confirmBtn.textContent = '确认自验，进入验收 ✓';
    confirmBtn.addEventListener('click', () => {
        actionsDiv.innerHTML = '';
        const statusEl = document.createElement('div');
        statusEl.className = 'msg-card-status';
        statusEl.textContent = '✅ 已确认，进入验收...';
        actionsDiv.appendChild(statusEl);
        G.vscode.postMessage({ type: 'confirmSelfVerifyDone', taskId });
    });

    actionsDiv.appendChild(confirmBtn);
    card.appendChild(actionsDiv);
    bubble.appendChild(card);
    appendToChatMessages(msgDiv);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

// Window exports for cross-bundle compatibility and tests
(window as any).handleDemoCardUpdate = handleDemoCardUpdate;
(window as any).renderDemoCard = renderDemoCard;
(window as any).showRejectInput = showRejectInput;
(window as any).toggleReviewFileSelection = toggleReviewFileSelection;
(window as any).showExecuteConfirmation = showExecuteConfirmation;
(window as any).showSelfVerifyConfirmation = showSelfVerifyConfirmation;
