export {};

const vscode = (window as any).vscode;

let activeTaskId: string | null = null;
let activeTaskPhase: string = '';
let activeTaskStatus: string = '';
let activeTaskGoal: string = '';
let activeTaskTitle: string = '';
let lastTaskInfo: any = {};
let lastReviewChanges: any[] = [];
let cardActiveTools: { toolCallId: string; title: string; kind: string; status: string; output?: string }[] = [];

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function phaseLabel(phase: string): string {
    const labels: Record<string, string> = { demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收' };
    return labels[phase] || phase;
}

function cardConfirmButtons(phase: string, status: string): string {
    if (status === 'cancelled' || status === 'completed') return '';
    type BtnDef = { label: string; action: string };
    const btns: Record<string, BtnDef[]> = {
        goal: [{ label: '✅ 确认目标', action: 'confirmGoalFromHeader' }],
        plan: [{ label: '📋 确认计划', action: 'confirmPlan' }],
        execute: [{ label: '⚡ 确认完成', action: 'confirmExecuteDone' }],
    };
    const phaseBtns = btns[phase];
    if (!phaseBtns) return '';
    let html = '<div class="card-section card-actions">';
    for (const btn of phaseBtns) {
        html += `<button class="card-action-btn primary" data-action="${btn.action}" data-taskid="${activeTaskId}">${btn.label}</button>`;
    }
    html += '</div>';
    return html;
}

function cardLinkButton(action: string, taskId: string | null, label: string, extra?: string): string {
    return `<button class="card-link-btn" data-action="${action}" data-taskid="${taskId || ''}" ${extra || ''}>${label}</button>`;
}

function renderCards() {
    const info = lastTaskInfo || {};
    const phase = activeTaskPhase || info.phase || '';
    const status = activeTaskStatus || info.status || '';
    const goal = activeTaskGoal || info.goal || '';
    const planSteps: any[] = info.planSteps || [];
    const confirmedItems: string[] = info.confirmedItems || [];
    const pendingItems: string[] = info.pendingItems || [];
    const terminalLogCount: number = info.terminalLogCount || 0;
    const planVersion: number = info.planVersion || 1;
    const versionLabel = phase === 'review' || status === 'completed' ? 'V' + planVersion + ' 🔒' : 'V' + planVersion;
    const riskItems: string[] = info.riskItems || [];
    const boundaryItems: string[] = info.boundaryItems || [];
    const filePathsFromTools: string[] = info.filePathsFromTools || [];
    const reviewFileList = lastReviewChanges && lastReviewChanges.length > 0
        ? lastReviewChanges.map((ch: any) => ch.filePath).filter(Boolean)
        : [];
    const fileList = [...new Set([...filePathsFromTools, ...reviewFileList])];

    const card1 = document.getElementById('card-1-body');
    if (card1) {
        const subEl = card1.closest('.card-container')?.querySelector('.card-header-sub');
        if (subEl) subEl.textContent = versionLabel;
        if (['demand', 'goal'].includes(phase) && !goal) {
            card1.innerHTML = '<div class="card-empty">等待 AI 生成目标方案...</div>';
        } else if (goal || confirmedItems.length > 0) {
            let html = '';
            if (goal) html += `<div class="card-section"><div class="card-section-title">🎯 目标</div><div class="card-goal-text">${escapeHtml(goal)}</div></div>`;
            if (confirmedItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">✓ 已确认共识</div>`;
                html += confirmedItems.map((item: string) => `<div class="card-confirmed-item">✅ ${escapeHtml(item)}</div>`).join('');
                html += `</div>`;
            }
            if (riskItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title risk-title">⚠️ 风险项</div>`;
                for (const item of riskItems) {
                    html += `<div class="card-risk-badge medium">${escapeHtml(item)}</div>`;
                }
                html += `</div>`;
            }
            if (boundaryItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🚧 边界约束</div>`;
                for (const item of boundaryItems) {
                    html += `<div class="card-boundary-item">${escapeHtml(item)}</div>`;
                }
                html += `</div>`;
            }
            if (['plan', 'execute', 'self_verify', 'review'].includes(phase) && planSteps.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">📋 计划步骤</div>`;
                const done = planSteps.filter((s: any) => s.status === 'completed').length;
                html += `<div class="card-plan-progress">${done}/${planSteps.length} 完成`;
                if (planSteps.length > 0) {
                    const pct = Math.round((done / planSteps.length) * 100);
                    html += ` <span class="card-plan-bar"><span class="card-plan-fill" style="width:${pct}%"></span></span>`;
                }
                html += `</div>`;
                planSteps.forEach((s: any) => {
                    html += `<div class="card-plan-step"><span class="card-plan-status">${s.status === 'completed' ? '✅' : '⬜'}</span> ${escapeHtml(s.content)}</div>`;
                });
                html += `</div>`;
            }
            if (fileList.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">📝 变更文件</div>`;
                for (const fp of fileList) {
                    const ext = fp ? fp.split('.').pop() || '' : '';
                    const icon = ['ts', 'tsx', 'js', 'jsx'].includes(ext) ? '📄' : ext === 'json' ? '📋' : '📄';
                    html += `<div class="card-file-item">${icon} ${escapeHtml(fp || '')}</div>`;
                }
                html += `</div>`;
            }
            html += cardConfirmButtons(phase, status);
            card1.innerHTML = html;
        } else {
            card1.innerHTML = '<div class="card-empty">等待 AI 生成方案...</div>';
        }
    }

    const card2 = document.getElementById('card-2-body');
    if (card2) {
        const subEl = card2.closest('.card-container')?.querySelector('.card-header-sub');
        const isActive = ['execute', 'self_verify', 'review'].includes(phase);
        if (subEl) subEl.textContent = isActive ? phaseLabel(phase) : '等待中';
        if (isActive && planSteps.length > 0) {
            let html = '';
            const done = planSteps.filter((s: any) => s.status === 'completed').length;
            const pct = planSteps.length > 0 ? Math.round((done / planSteps.length) * 100) : 0;
            html += `<div class="card-section"><div class="card-section-title">⚡ 执行进度</div>`;
            html += `<div class="card-progress-row"><span class="card-progress-bar"><span class="card-progress-fill" style="width:${pct}%"></span></span><span class="card-progress-label">${done}/${planSteps.length}</span></div></div>`;

            if (cardActiveTools.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🔧 当前工具</div>`;
                for (const tool of cardActiveTools) {
                    const icon = tool.kind === 'bash' || tool.kind === 'command' ? '💻' : tool.kind === 'read' ? '📖' : tool.kind === 'write' ? '✏️' : tool.kind === 'thinking' ? '💭' : '🔧';
                    html += `<div class="card-tool-item"><span class="card-tool-status ${tool.status}"></span>${icon} ${escapeHtml(tool.title || '')}`;
                    if (tool.status === 'running') html += ' <span class="card-tool-spinner"></span>';
                    if (tool.output) html += `<div class="card-tool-preview">${escapeHtml(tool.output.substring(0, 200))}</div>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }

            const buildTools = cardActiveTools.filter((t: any) =>
                /build|test|npm (run )?(build|test)|npx (tsc|vitest|jest)|make/i.test(t.title || '')
            );
            if (buildTools.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🏗️ 构建/测试</div>`;
                for (const bt of buildTools) {
                    const ok = bt.status === 'completed' && !/error|fail/i.test(bt.output || '');
                    html += `<div class="card-build-item ${ok ? 'pass' : bt.status === 'running' ? 'running' : 'fail'}">`;
                    html += ok ? '✅' : bt.status === 'running' ? '🔄' : '❌';
                    html += ` ${escapeHtml(bt.title || '')}</div>`;
                }
                html += `</div>`;
            }

            if (phase === 'self_verify') {
                html += `<div class="card-section"><div class="card-section-title">🔍 自验报告</div>`;
                html += `<div class="card-self-verify-report">`;
                html += `<div class="card-sv-header">AI 正在对执行结果进行自我审查...</div>`;
                const svTools = cardActiveTools.filter((t: any) => t.kind === 'thinking' || /verify|check|review/i.test(t.title || ''));
                if (svTools.length > 0) {
                    for (const sv of svTools) {
                        html += `<div class="card-sv-item">💭 ${escapeHtml(sv.title || '')}</div>`;
                        if (sv.output) html += `<div class="card-sv-preview">${escapeHtml(sv.output.substring(0, 300))}</div>`;
                    }
                } else {
                    html += `<div class="card-sv-hint">等待自验完成...</div>`;
                }
                html += `</div></div>`;
            }

            if (terminalLogCount > 0) {
                html += `<div class="card-section"><div class="card-section-title collapsible-header" onclick="this.classList.toggle('collapsed');this.nextElementSibling.classList.toggle('collapsed')">💻 终端日志 <span class="card-count-badge">${terminalLogCount}</span></div>`;
                html += `<div class="card-collapsible-body">`;
                html += `<div class="card-terminal-hint">终端日志共 ${terminalLogCount} 条记录。<br>${cardLinkButton('openTerminalReplay', activeTaskId, '📋 查看完整日志')}</div>`;
                html += `</div></div>`;
            }

            card2.innerHTML = html;
        } else if (phase === 'execute' && planSteps.length === 0) {
            card2.innerHTML = '<div class="card-empty">等待 AI 开始执行...</div>';
        } else {
            card2.innerHTML = '<div class="card-empty">等待进入执行阶段...</div>';
        }
    }

    const card3 = document.getElementById('card-3-body');
    if (card3) {
        const subEl = card3.closest('.card-container')?.querySelector('.card-header-sub');
        if (subEl) subEl.textContent = status === 'completed' ? '✅ 已完成' : phase === 'review' ? '🔍 待验收' : '等待中';
        let html = '';
        if (status === 'completed') {
            html += `<div class="card-section"><div class="card-section-title">🎉 任务已完成</div>`;
            html += `<div style="font-size:12px;color:#5a9d6b;padding:8px 0">该任务已验收通过并完成。</div></div>`;
            card3.innerHTML = html;
        } else if (phase === 'review') {
            html += `<div class="card-section"><div class="card-section-title">📄 变更文件</div>`;
            if (lastReviewChanges.length > 0) {
                for (const ch of lastReviewChanges) {
                    const ext = ch.filePath ? ch.filePath.split('.').pop() || '' : '';
                    const icon = ext === 'ts' || ext === 'tsx' ? '📝' : ext === 'css' ? '🎨' : ext === 'json' ? '📋' : '📄';
                    html += `<div class="card-review-file" data-action="openNativeDiff" data-filepath="${escapeHtml(ch.filePath || '')}">${icon} ${escapeHtml(ch.filePath || '')}</div>`;
                }
            } else {
                html += `<div class="card-empty">本次任务无文件变更</div>`;
            }
            html += `</div>`;
            html += `<div class="card-section"><div class="card-section-title">👤 人工验证指引</div>`;
            html += `<ul class="card-verify-steps">`;
            html += `<li class="card-verify-step">1. 检查执行结果是否符合预期</li>`;
            html += `<li class="card-verify-step">2. 如有变更文件，点击上方文件查看 diff</li>`;
            html += `<li class="card-verify-step">3. 确认无误后点击「验收通过」，否则「驳回」</li>`;
            html += `</ul></div>`;
            html += `<div class="card-section"><div style="display:flex;gap:6px;flex-wrap:wrap">`;
            html += `<button class="card-action-btn primary" data-action="approveReview" data-taskid="${activeTaskId}">✅ 验收通过</button>`;
            html += `<button class="card-action-btn secondary" data-action="showRejectPresets" data-taskid="${activeTaskId}">↩️ 驳回</button>`;
            html += `</div></div>`;
            card3.innerHTML = html;
            _fileChangesMap = new Map(lastReviewChanges.map((ch: any) => [ch.filePath, { original: ch.original, modified: ch.modified }]));
        } else {
            html += '<div class="card-empty">等待进入验收阶段...</div>';
            card3.innerHTML = html;
        }
    }
}


function initCardComments() {
    document.querySelectorAll('.card-comment-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardIdx = (e.currentTarget as HTMLElement).dataset.card;
            const section = document.getElementById(`card-comment-${cardIdx}`);
            if (section) {
                section.classList.toggle('hidden');
                if (!section.classList.contains('hidden')) {
                    const input = document.getElementById(`card-comment-input-${cardIdx}`) as HTMLInputElement;
                    input?.focus();
                }
            }
        });
    });
    document.querySelectorAll('.card-comment-send').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardIdx = (e.currentTarget as HTMLElement).dataset.card;
            const input = document.getElementById(`card-comment-input-${cardIdx}`) as HTMLInputElement;
            if (!input || !input.value.trim()) return;
            const text = input.value.trim();
            input.value = '';
            (window as any).vscode?.postMessage({ type: 'sendCardComment', cardIndex: parseInt(cardIdx || '1'), text, taskId: activeTaskId });
            const list = document.getElementById(`card-comment-list-${cardIdx}`);
            if (list) {
                const item = document.createElement('div');
                item.className = 'card-comment-item';
                item.innerHTML = `<div class="card-comment-meta"><span class="card-comment-author">You</span><span class="card-comment-time">刚刚</span></div><div class="card-comment-text">${escapeHtml(text)}</div>`;
                list.appendChild(item);
                list.scrollTop = list.scrollHeight;
            }
            updateCardCommentCount(parseInt(cardIdx || '1'));
        });
    });
    document.querySelectorAll('.card-comment-input').forEach(input => {
        input.addEventListener('keydown', (e: Event) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' && !ke.shiftKey) {
                e.preventDefault();
                const cardIdx = (e.currentTarget as HTMLElement).id.replace('card-comment-input-', '');
                const btn = document.querySelector(`.card-comment-send[data-card="${cardIdx}"]`) as HTMLButtonElement;
                btn?.click();
            }
        });
    });

    const cardView = document.getElementById('card-view');
    if (cardView) {
        cardView.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const actionBtn = target.closest('[data-action]') as HTMLElement;
            if (!actionBtn) return;
            const action = actionBtn.dataset.action;
            const taskId = actionBtn.dataset.taskid || activeTaskId;

            switch (action) {
                case 'confirmPlan':
                case 'confirmGoalFromHeader':
                case 'confirmExecuteDone':
                case 'approveReview':
                    vscode.postMessage({ type: action, taskId });
                    break;
                case 'openTerminalReplay':
                    vscode.postMessage({ type: 'openTerminalReplay', taskId });
                    break;
                case 'openNativeDiff': {
                    const fp = actionBtn.dataset.filepath || '';
                    const ch = _fileChangesMap.get(fp);
                    if (ch) {
                        vscode.postMessage({ type: 'showDiff', original: ch.original, modified: ch.modified });
                    } else if ((window as any).showDiff) {
                        (window as any).showDiff('', '');
                    }
                    break;
                }
                case 'rejectReview': {
                    const reason = actionBtn.dataset.reason || '用户驳回';
                    vscode.postMessage({ type: 'rejectReview', taskId, reason });
                    break;
                }
                case 'showRejectPresets': {
                    const taskId2 = actionBtn.dataset.taskid || activeTaskId;
                    let presets = document.getElementById(`card-reject-presets-${taskId2}`);
                    if (!presets) {
                        presets = createRejectPresets(taskId2!);
                        const section = actionBtn.closest('.card-section');
                        if (section && section.parentNode) {
                            section.parentNode.insertBefore(presets, section.nextSibling);
                        }
                    }
                    presets.classList.toggle('hidden');
                    break;
                }
                case 'showRejectInput': {
                    const custom = document.getElementById(`card-reject-custom-${taskId}`);
                    if (custom) custom.classList.remove('hidden');
                    break;
                }
                case 'sendReject': {
                    const ta = document.getElementById(`card-reject-text-${taskId}`) as HTMLTextAreaElement;
                    const reason = ta?.value?.trim() || '用户驳回';
                    vscode.postMessage({ type: 'rejectReview', taskId, reason });
                    break;
                }
            }
        });
    }
}

function createRejectPresets(taskId: string): HTMLElement {
    const div = document.createElement('div');
    div.id = `card-reject-presets-${taskId}`;
    div.className = 'card-reject-presets hidden';
    const rejectReasons = ['代码质量不达标','未处理边界情况','缺少单元测试','与需求不符','存在安全隐患','性能问题'];
    let html = '<div class="card-reject-preset-title">选择驳回理由：</div>';
    for (const reason of rejectReasons) {
        html += `<button class="card-reject-preset-btn" data-action="rejectReview" data-taskid="${escapeHtml(taskId)}" data-reason="${escapeHtml(reason)}">${reason}</button>`;
    }
    html += `<button class="card-reject-preset-btn custom" data-action="showRejectInput" data-taskid="${escapeHtml(taskId)}">✏️ 自定义输入...</button>`;
    html += `<div id="card-reject-custom-${escapeHtml(taskId)}" class="hidden" style="margin-top:4px">`;
    html += `<textarea id="card-reject-text-${escapeHtml(taskId)}" class="card-reject-textarea" placeholder="输入驳回原因..." rows="2"></textarea>`;
    html += `<button class="card-action-btn secondary" data-action="sendReject" data-taskid="${escapeHtml(taskId)}">确认驳回</button>`;
    html += `</div>`;
    div.innerHTML = html;
    return div;
}

function loadCardComments(messages: any[]) {
    for (let ci = 1; ci <= 3; ci++) {
        const list = document.getElementById(`card-comment-list-${ci}`);
        if (!list) continue;
        list.innerHTML = '';
        const cardComments = messages.filter((m: any) => m.type === 'card_comment');
        const relevant = cardComments.filter((m: any) => {
            try { const d = JSON.parse(m.content); return d.cardIndex === ci; } catch { return false; }
        });
        for (const cm of relevant) {
            let data: any = {};
            try { data = JSON.parse(cm.content); } catch { continue; }
            const item = document.createElement('div');
            item.className = 'card-comment-item';
            const ts = cm.timestamp ? formatTimestamp(cm.timestamp) : '';
            item.innerHTML = `<div class="card-comment-meta"><span class="card-comment-author">${escapeHtml(data.author || '用户')}</span><span class="card-comment-time">${ts}</span></div><div class="card-comment-text">${escapeHtml(data.text || '')}</div>`;
            list.appendChild(item);
        }
        updateCardCommentCount(ci);
    }
}

function updateCardCommentCount(cardIndex: number) {
    const list = document.getElementById(`card-comment-list-${cardIndex}`);
    const countEl = document.querySelector(`.card-comment-toggle[data-card="${cardIndex}"] .card-comment-count`);
    const toggle = document.querySelector(`.card-comment-toggle[data-card="${cardIndex}"]`);
    if (list && countEl) {
        const count = list.children.length;
        countEl.textContent = String(count);
        if (toggle) toggle.classList.toggle('has-comments', count > 0);
    }
}

let _fileChangesMap: Map<string, { original: string; modified: string }> = new Map();

function showCardView() {
    const cardView = document.getElementById('card-view');
    if (cardView) cardView.classList.add('visible');
    const chatBody = document.getElementById('chat-body');
    if (chatBody) chatBody.classList.add('hidden');
    const gutter = document.getElementById('node-timeline-gutter');
    if (gutter) gutter.classList.add('hidden');
}

function hideCardView() {
    const cardView = document.getElementById('card-view');
    if (cardView) cardView.classList.remove('visible');
    const chatBody = document.getElementById('chat-body');
    if (chatBody) chatBody.classList.remove('hidden');
}

// Expose for app.ts in card mode
(window as any).__cardApp = {
    updateInfo(info: any) {
        activeTaskId = info.taskId || null;
        activeTaskPhase = info.phase || '';
        activeTaskStatus = info.status || '';
        activeTaskGoal = info.goal || '';
        activeTaskTitle = info.title || '';
        lastTaskInfo = info;
    },
    updateReview(changes: any[]) {
        lastReviewChanges = changes;
    },
    setActiveTools(tools: any[]) {
        cardActiveTools = tools;
    },
    showCardView,
    hideCardView,
    renderCards,
    loadCardComments,
    initCardComments,
};
