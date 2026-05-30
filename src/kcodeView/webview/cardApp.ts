export {};

const vscode = (window as any).vscode;

let activeTaskId: string | null = null;
let activeTaskPhase: string = '';
let activeTaskStatus: string = '';
let activeTaskGoal: string = '';
let lastTaskInfo: any = {};
let lastReviewChanges: any[] = [];
let cardActiveTools: { toolCallId: string; title: string; kind: string; status: string; output?: string }[] = [];
let _fileChangesMap: Map<string, { original: string; modified: string }> = new Map();

const PHASE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function phaseIndex(p: string): number { return PHASE_ORDER.indexOf(p); }

function getStepStates() {
    const info = lastTaskInfo || {};
    const phase = activeTaskPhase || info.phase || '';
    const status = activeTaskStatus || info.status || '';
    const pi = phaseIndex(phase);
    const d1 = status === 'completed' || pi > 1, a1 = !d1 && pi <= 1;
    const d2 = status === 'completed' || pi > 4, a2 = !d2 && pi >= 3 && pi <= 4;
    const d3 = status === 'completed', a3 = !d3 && pi === 5;
    return { steps: [{ d: d1, a: a1 }, { d: d2, a: a2 }, { d: d3, a: a3 }], phase, status, pi };
}

function renderBreadcrumbs() {
    const { steps } = getStepStates();
    const segCls = ['seg-waiting', 'seg-waiting', 'seg-waiting'];
    const sepCls = ['sep-waiting', 'sep-waiting'];
    for (let i = 0; i < 3; i++) {
        const s = steps[i];
        segCls[i] = s.d ? 'seg-done' : s.a ? 'seg-active' : 'seg-waiting';
        if (i < 2) sepCls[i] = s.d ? 'sep-done' : s.a ? 'sep-active' : 'sep-waiting';
    }

    for (let i = 0; i < 3; i++) {
        const seg = document.getElementById(`cseg-${i + 1}`);
        if (seg) seg.className = `cseg ${segCls[i]}`;
    }
    for (let i = 0; i < 2; i++) {
        const sep = document.getElementById(`csep-${i + 1}`);
        if (sep) sep.className = `csep ${sepCls[i]}`;
    }

    const ds = document.getElementById('cdot-s');
    const de = document.getElementById('cdot-e');
    if (ds) ds.className = steps[0].d ? 'cdot dot-done' : steps[0].a ? 'cdot dot-active' : 'cdot';
    if (de) de.className = steps[2].d ? 'cdot dot-done' : steps[2].a ? 'cdot dot-active' : 'cdot';

    const lines = [
        { id: 'cl-1', cls: steps[0].d ? 'ln-done' : steps[0].a ? 'ln-active' : '' },         // ●→目标
        { id: 'cl-2', cls: steps[0].d ? 'ln-done' : '' },                                    // 目标→▶
        { id: 'cl-3', cls: steps[1].d ? 'ln-done' : steps[1].a ? 'ln-active' : '' },         // ▶→执行
        { id: 'cl-4', cls: steps[1].d ? 'ln-done' : '' },                                    // 执行→▶
        { id: 'cl-5', cls: steps[2].d ? 'ln-done' : steps[2].a ? 'ln-active' : '' },         // ▶→验收
        { id: 'cl-6', cls: steps[2].d ? 'ln-done' : '' },                                    // 验收→●
    ];
    for (const l of lines) {
        const el = document.getElementById(l.id);
        if (el) { el.className = 'cline'; if (l.cls) el.classList.add(l.cls); }
    }
}

function renderColumns() {
    const { steps, phase, status } = getStepStates();
    for (let i = 0; i < 3; i++) {
        const col = document.getElementById(i === 0 ? 'col-plan' : i === 1 ? 'col-exec' : 'col-review');
        if (!col) continue;
        col.classList.remove('col-active', 'col-done', 'col-waiting');
        col.classList.add(steps[i].d ? 'col-done' : steps[i].a ? 'col-active' : 'col-waiting');
    }

    const info = lastTaskInfo || {};
    const goal = activeTaskGoal || info.goal || '';
    const planSteps: any[] = info.planSteps || [];
    const confirmedItems: string[] = info.confirmedItems || [];
    const terminalLogCount: number = info.terminalLogCount || 0;
    const riskItems: string[] = info.riskItems || [];
    const boundaryItems: string[] = info.boundaryItems || [];
    const acceptanceItems: any[] = info.acceptanceItems || [];
    const planDone = planSteps.filter((s: any) => s.status === 'completed').length;
    const planTotal = planSteps.length;

    renderCol1(goal, confirmedItems, riskItems, boundaryItems, phase, status);
    renderCol2(planSteps, planDone, planTotal, phase, status, terminalLogCount);
    renderCol3(acceptanceItems, phase, status);
}

function renderCol1(goal: string, confirmed: string[], risks: string[], boundaries: string[], phase: string, status: string) {
    const el = document.getElementById('col-body-1'); if (!el) return;
    let html = '';
    if (goal) html += cs('🎯 目标', `<div class="col-goal">${escapeHtml(goal)}</div>`);
    if (confirmed.length > 0) html += cs('✓ 共识', confirmed.map(i => `<div class="col-confirmed">✅ ${escapeHtml(i)}</div>`).join(''));
    if (risks.length > 0) html += cs('⚠️ 风险', risks.map(i => `<span class="col-risk medium">${escapeHtml(i)}</span>`).join(' '));
    if (boundaries.length > 0) html += cs('🚧 边界', boundaries.map(i => `<div class="col-boundary">${escapeHtml(i)}</div>`).join(''));
    if (status === 'completed') html += `<div class="col-done-block"><div class="col-done-icon">🎉</div><div class="col-done-text">已完成</div></div>`;
    else if (['demand', 'goal'].includes(phase) && !goal) { if (!html) html = `<div class="col-empty">等待 AI 生成目标方案...</div>`; }
    html += _btns(phase, status);
    el.innerHTML = html || `<div class="col-empty">等待确认目标...</div>`;
}

function renderCol2(planSteps: any[], planDone: number, planTotal: number, phase: string, status: string, terminalLogCount: number) {
    const el = document.getElementById('col-body-2'); if (!el) return;
    let html = '';
    const hasStarted = ['execute', 'self_verify', 'review'].includes(phase);

    if (planSteps.length > 0) {
        const pct = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;
        let s = `<div class="col-progress">${planDone}/${planTotal} <span class="col-progress-bar"><span class="col-progress-fill" style="width:${pct}%"></span></span></div>`;
        for (const st of planSteps) {
            const d = st.status === 'completed';
            s += `<div class="col-list-item${d ? ' done' : ''}"><span class="col-list-status">${d ? '✅' : st.status === 'active' ? '⏳' : '⬜'}</span>${escapeHtml(st.content)}</div>`;
        }
        html += cs('📋 步骤进度', s);
    } else if (hasStarted) html += `<div class="col-empty">等待 AI 开始执行...</div>`;
    else html += `<div class="col-empty">等待进入执行阶段...</div>`;

    if (cardActiveTools.length > 0) {
        let t = '';
        for (const tool of cardActiveTools) {
            const icon = tool.kind === 'bash' || tool.kind === 'command' ? '💻' : tool.kind === 'read' ? '📖' : tool.kind === 'write' ? '✏️' : tool.kind === 'thinking' ? '💭' : '🔧';
            t += `<div class="col-tool"><span class="col-tool-dot ${tool.status}"></span>${icon} ${escapeHtml(tool.title || '')}`;
            if (tool.status === 'running') t += ' <span class="col-tool-spinner"></span>';
            if (tool.output) t += `<div class="col-tool-preview">${escapeHtml(tool.output.substring(0, 150))}</div>`;
            t += `</div>`;
        }
        html += cs('🔧 工具', t);
    }

    const bt = cardActiveTools.filter(t => /build|test|npm (run )?(build|test)|npx (tsc|vitest|jest)|make/i.test(t.title || ''));
    if (bt.length > 0) {
        html += cs('🏗️ 构建', bt.map(t => {
            const ok = t.status === 'completed' && !/error|fail/i.test(t.output || '');
            return `<div class="col-build ${ok ? 'pass' : t.status === 'running' ? 'running' : 'fail'}">${ok ? '✅' : t.status === 'running' ? '🔄' : '❌'} ${escapeHtml(t.title || '')}</div>`;
        }).join(''));
    }

    if (phase === 'self_verify') {
        let sv = `<div class="col-sv">`;
        const svTools = cardActiveTools.filter(t => t.kind === 'thinking' || /verify|check|review/i.test(t.title || ''));
        sv += svTools.length > 0
            ? svTools.map(t => `<div class="col-sv-item">💭 ${escapeHtml(t.title || '')}${t.output ? `<div class="col-sv-pre">${escapeHtml(t.output.substring(0, 200))}</div>` : ''}</div>`).join('')
            : `<div class="col-empty">自验中...</div>`;
        sv += `</div>`;
        html += cs('🔍 自验', sv);
    }

    if (terminalLogCount > 0) html += cs('💻 日志', `<span class="col-terminal" data-action="openTerminalReplay" data-taskid="${activeTaskId}">📋 ${terminalLogCount} 条</span>`);
    html += _btns(phase, status);
    el.innerHTML = html;
}

function renderCol3(acceptanceItems: any[], phase: string, status: string) {
    const el = document.getElementById('col-body-3'); if (!el) return;
    let html = '';
    if (status === 'completed') { el.innerHTML = `<div class="col-done-block"><div class="col-done-icon">🎉</div><div class="col-done-text">验收通过</div></div>`; return; }
    if (phase !== 'review') { el.innerHTML = `<div class="col-empty">等待验收阶段...</div>`; return; }

    if (acceptanceItems.length > 0) {
        let a = '';
        const tagMap: Record<string, string> = { file: '📄', test: '🧪', doc: '📋' };
        for (const item of acceptanceItems) {
            const icon = tagMap[item.type] || '📄';
            a += `<div class="col-accept-item"><span class="col-list-status">⬜</span>${icon} ${escapeHtml(item.description || '')}` + (item.type ? `<span class="col-accept-tag">${item.type}</span>` : '') + `</div>`;
        }
        html += cs('📄 验收产物', a);
    }

    if (lastReviewChanges.length > 0) {
        html += cs('📝 变更文件', lastReviewChanges.map(ch => {
            const ext = ch.filePath ? ch.filePath.split('.').pop() || '' : '';
            const icon = ext === 'ts' || ext === 'tsx' ? '📝' : ext === 'css' ? '🎨' : ext === 'json' ? '📋' : '📄';
            return `<div class="col-file" data-action="openNativeDiff" data-filepath="${escapeHtml(ch.filePath || '')}">${icon} ${escapeHtml(ch.filePath || '')}</div>`;
        }).join(''));
        _fileChangesMap = new Map(lastReviewChanges.map(ch => [ch.filePath, { original: ch.original, modified: ch.modified }]));
    }

    html += cs('👤 指引', `<ul class="col-verify"><li>检查产物是否符合预期</li><li>逐条验收上方清单</li><li>确认后点通过，否则驳回</li></ul>`);
    html += `<div class="col-actions"><button class="col-btn primary" data-action="approveReview" data-taskid="${activeTaskId}">✅ 通过</button><button class="col-btn secondary" data-action="showRejectPresets" data-taskid="${activeTaskId}">↩️ 驳回</button></div>`;
    el.innerHTML = html;
}

function cs(title: string, content: string): string { return `<div class="col-section"><div class="col-section-title">${title}</div>${content}</div>`; }

function _btns(phase: string, status: string): string {
    if (status === 'cancelled' || status === 'completed') return '';
    const map: Record<string, { label: string; action: string }[]> = {
        goal: [{ label: '✅ 确认目标', action: 'confirmGoalFromHeader' }],
        plan: [{ label: '📋 确认计划', action: 'confirmPlan' }],
        execute: [{ label: '⚡ 确认完成', action: 'confirmExecuteDone' }],
    };
    const btns = map[phase]; if (!btns) return '';
    return `<div class="col-actions">` + btns.map(b => `<button class="col-btn primary" data-action="${b.action}" data-taskid="${activeTaskId}">${b.label}</button>`).join('') + `</div>`;
}

function renderCards() { renderBreadcrumbs(); renderColumns(); }

function initCardEvents() {
    const cardView = document.getElementById('card-view'); if (!cardView) return;
    cardView.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const actionBtn = target.closest('[data-action]') as HTMLElement; if (!actionBtn) return;
        const action = actionBtn.dataset.action, taskId = actionBtn.dataset.taskid || activeTaskId;
        switch (action) {
            case 'confirmPlan': case 'confirmGoalFromHeader': case 'confirmExecuteDone': case 'approveReview': vscode.postMessage({ type: action, taskId }); break;
            case 'openTerminalReplay': vscode.postMessage({ type: 'openTerminalReplay', taskId }); break;
            case 'openNativeDiff': { const fp = actionBtn.dataset.filepath || ''; const ch = _fileChangesMap.get(fp); if (ch) vscode.postMessage({ type: 'showDiff', original: ch.original, modified: ch.modified }); break; }
            case 'rejectReview': vscode.postMessage({ type: 'rejectReview', taskId, reason: actionBtn.dataset.reason || '用户驳回' }); break;
            case 'showRejectPresets': { const id = actionBtn.dataset.taskid || activeTaskId; let p = document.getElementById(`kc-reject-${id}`); if (!p) { p = _createReject(id!); actionBtn.parentElement?.after(p); } p.classList.toggle('hidden'); break; }
            case 'showRejectInput': { const c = document.getElementById(`kc-custom-${taskId}`); if (c) c.classList.remove('hidden'); break; }
            case 'sendReject': { const ta = document.getElementById(`kc-text-${taskId}`) as HTMLTextAreaElement; vscode.postMessage({ type: 'rejectReview', taskId, reason: ta?.value?.trim() || '用户驳回' }); break; }
        }
    });
}

function _createReject(taskId: string): HTMLElement {
    const div = document.createElement('div'); div.id = `kc-reject-${taskId}`; div.className = 'col-reject hidden';
    const reasons = ['代码质量不达标', '未处理边界情况', '缺少单元测试', '与需求不符', '存在安全隐患', '性能问题'];
    let html = '<div class="col-reject-title">驳回理由：</div>';
    for (const r of reasons) html += `<button class="col-reject-btn" data-action="rejectReview" data-taskid="${escapeHtml(taskId)}" data-reason="${escapeHtml(r)}">${r}</button>`;
    html += `<button class="col-reject-btn custom" data-action="showRejectInput" data-taskid="${escapeHtml(taskId)}">✏️ 自定义</button>`;
    html += `<div id="kc-custom-${escapeHtml(taskId)}" class="hidden" style="margin-top:4px">`;
    html += `<textarea id="kc-text-${escapeHtml(taskId)}" class="col-reject-ta" placeholder="输入原因..." rows="2"></textarea>`;
    html += `<div class="col-actions"><button class="col-btn secondary" data-action="sendReject" data-taskid="${escapeHtml(taskId)}">确认</button></div></div>`;
    div.innerHTML = html; return div;
}

function loadCardComments(_: any[]) {}
function showCardView() { const el = document.getElementById('card-view'); if (el) el.classList.add('visible'); const c = document.getElementById('chat-body'); if (c) c.classList.add('hidden'); const g = document.getElementById('node-timeline-gutter'); if (g) g.classList.add('hidden'); }
function hideCardView() { const el = document.getElementById('card-view'); if (el) el.classList.remove('visible'); const c = document.getElementById('chat-body'); if (c) c.classList.remove('hidden'); const g = document.getElementById('node-timeline-gutter'); if (g) g.classList.remove('hidden'); }

const TYPE_LABELS: Record<string, string> = {
    requirement_dev: '需求开发',
    code_review: '代码评审',
    problem_analysis: '问题分析',
    defect_analysis: '缺陷分析',
    log_analysis: '日志分析',
    task: '任务',
};

function updateHeader(title: string, status: string, category: string, goal: string) {
    const titleEl = document.getElementById('card-header-title');
    if (titleEl) titleEl.textContent = title || '选择任务开始对话';

    const statusBadge = document.getElementById('card-status-badge');
    if (statusBadge) {
        const hasStatus = !!status && status !== 'pending';
        statusBadge.classList.toggle('hidden', !hasStatus);
        if (hasStatus) {
            const statusMap: Record<string, string> = {
                pending: 'Pending', active: 'Active', in_review: 'In Review',
                completed: 'Completed', cancelled: 'Cancelled',
            };
            statusBadge.textContent = statusMap[status] || status;
            statusBadge.className = 'task-status-badge';
            statusBadge.classList.add('status-' + status);
        }
    }

    const typeBadge = document.getElementById('card-type-badge');
    if (typeBadge) {
        const label = TYPE_LABELS[category];
        if (label) {
            typeBadge.textContent = label;
            typeBadge.classList.remove('hidden');
        } else {
            typeBadge.classList.add('hidden');
        }
    }

    const goalEl = document.getElementById('card-goal-text');
    if (goalEl) goalEl.textContent = goal || '';
}

(window as any).__cardApp = {
    updateInfo(info: any) { activeTaskId = info.taskId || null; activeTaskPhase = info.phase || ''; activeTaskStatus = info.status || ''; activeTaskGoal = info.goal || ''; lastTaskInfo = info; },
    updateReview(changes: any[]) { lastReviewChanges = changes; },
    setActiveTools(tools: any[]) { cardActiveTools = tools; },
    showCardView, hideCardView, renderCards, loadCardComments, initCardEvents,
    updateHeader,
};
