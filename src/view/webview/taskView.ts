import { G } from './state';
import { escapeHtml } from './markdownRenderer';

export function showTaskView(asControlPanel: boolean = false): void {
    const assistantView = document.getElementById('assistant-view');
    const taskView = document.getElementById('task-view');
    if (assistantView) assistantView.style.display = 'none';
    if (taskView) taskView.style.display = 'block';

    const initEl = document.getElementById('tv4-init');
    const panelEl = document.getElementById('tv4-panel');
    if (asControlPanel) {
        if (initEl) initEl.style.display = 'none';
        if (panelEl) panelEl.style.display = '';
    } else {
        if (initEl) initEl.style.display = '';
        if (panelEl) panelEl.style.display = 'none';
    }
}

const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];

const STAGE_ICONS: Record<string, string> = {
    demand: '📝',
    goal: '🎯',
    plan: '📜',
    execute: '✎',
    self_verify: '✅',
    review: '📦',
};

const STAGE_LABELS: Record<string, string> = {
    demand: '需求提取',
    goal: '目标确定',
    plan: '计划确定',
    execute: '执行修改',
    self_verify: '自验结果',
    review: '确认验收',
};

export function updateTaskInfo(info: any): void {
    G.activeTaskStatus = info.status || '';
    G.activeTaskPhase = info.phase || '';
    G.activeTaskTitle = info.title || '';
    G.activeTaskGoal = info.goal || '';

    const nameEl = document.getElementById('tv4-task-name');
    if (nameEl) nameEl.textContent = info.title || '任务';

    const statusEl = document.getElementById('tv4-status');
    if (statusEl) {
        const statusMap: Record<string, string> = { pending: '待确认', active: '执行中', in_review: '待验收', completed: '已完成', cancelled: '已取消' };
        statusEl.textContent = statusMap[info.status] || '待确认';
        statusEl.className = 'tv4-status-badge status-' + (info.status || 'pending');
    }

    const modelEl = document.getElementById('tv4-model');
    if (modelEl && info.modelName) {
        modelEl.textContent = '模型: ' + info.modelName;
    }

    const phaseCount = document.getElementById('tv4-phase-count');
    if (phaseCount) {
        const idx = STAGE_ORDER.indexOf(info.phase || '');
        phaseCount.textContent = (idx >= 0 ? idx + 1 : 0) + '/6';
    }

    renderTimeline(info);
}

export function renderTimeline(info?: any): void {
    const timeline = document.getElementById('tv4-timeline');
    const chatMessages = document.getElementById('chat-messages');
    if (!timeline) return;

    timeline.innerHTML = '';

    const msgs = chatMessages ? gatherMessages(chatMessages) : [];
    if (msgs.length === 0) return;

    const grouped = groupByPhase(msgs);
    const currentPhase = info?.phase || G.activeTaskPhase || '';
    const currentStatus = info?.status || G.activeTaskStatus || '';

    // User request
    const userMsgs = grouped.get('user') || [];
    if (userMsgs.length > 0) {
        const request = userMsgs[0];
        let reqText = '';
        try { const p = JSON.parse(request.content); reqText = p.output || p.content || ''; } catch { reqText = request.content; }
        if (reqText) {
            const div = document.createElement('div');
            div.className = 'tv4-user-request';
            div.innerHTML = '<div class="tv4-ur-label">👤 原始需求</div><div class="tv4-ur-text">' + escapeHtml(reqText) + '</div>';
            timeline.appendChild(div);
        }
    }

    // AI preamble
    const preamble = document.createElement('div');
    preamble.className = 'tv4-ai-preamble';
    preamble.innerHTML = '<span class="tv4-ai-label">🤖 AI</span> 已通过 6 阶段流水线安全处理：';
    timeline.appendChild(preamble);

    // Tree container
    const tree = document.createElement('div');
    tree.className = 'tv4-tree';

    let msIdx = 0;
    for (const phase of STAGE_ORDER) {
        const phaseMsgs = grouped.get(phase) || [];
        if (phaseMsgs.length === 0 && currentStatus === 'pending') continue;

        // Process section (before milestone)
        const hasProcess = phaseMsgs.length > 0;
        if (hasProcess) {
            const processRow = document.createElement('div');
            processRow.className = 'tv4-process';
            const toggle = document.createElement('div');
            toggle.className = 'tv4-process-toggle';
            toggle.innerHTML = '<span class="tv4-chevron">▶</span> ' + STAGE_ICONS[phase] + ' 阶段 ' + (STAGE_ORDER.indexOf(phase) + 1) + ' 过程详情';
            toggle.addEventListener('click', () => {
                toggle.classList.toggle('expanded');
                const body = processRow.querySelector('.tv4-process-body') as HTMLElement;
                if (body) body.classList.toggle('open');
            });

            const body = document.createElement('div');
            body.className = 'tv4-process-body';
            for (const msg of phaseMsgs) {
                const el = createMsgElement(msg);
                body.appendChild(el);
            }

            processRow.appendChild(toggle);
            processRow.appendChild(body);
            tree.appendChild(processRow);
        }

        // Milestone
        const ms = document.createElement('div');
        ms.className = 'tv4-milestone';
        ms.dataset.phase = phase;

        const isActive = phase === currentPhase && currentStatus !== 'completed' && currentStatus !== 'cancelled';
        const isDone = STAGE_ORDER.indexOf(phase) < STAGE_ORDER.indexOf(currentPhase) || currentStatus === 'completed';
        let dotClass = '';
        if (isDone) dotClass = ' done';
        else if (isActive) dotClass = '';
        else dotClass = '';

        ms.innerHTML = '<div class="tv4-ms-dot' + dotClass + '"></div>'
            + '<div class="tv4-ms-header"><span class="tv4-ms-icon">' + STAGE_ICONS[phase] + '</span>'
            + '<span class="tv4-ms-label">阶段 ' + (STAGE_ORDER.indexOf(phase) + 1) + ' 里程碑 [' + STAGE_LABELS[phase] + ']</span></div>';

        // Milestone body
        const body = document.createElement('div');
        body.className = 'tv4-ms-body';
        if (isDone || isActive) {
            const content = getMilestoneContent(phase, info);
            body.textContent = content || (isActive ? '进行中...' : '');
        } else {
            body.classList.add('pending');
            body.textContent = '等待中...';
        }
        ms.appendChild(body);
        tree.appendChild(ms);

        msIdx++;
    }

    timeline.appendChild(tree);
}

function getMilestoneContent(phase: string, info: any): string {
    if (!info) return '';
    switch (phase) {
        case 'demand':
            const items = info.confirmedItems || [];
            return items.length > 0 ? '锁定 ' + items.length + ' 项需求：\n' + items.map((s: string) => '· ' + s).join('\n') : '';
        case 'goal':
            return info.goal ? '目标：' + info.goal : '';
        case 'plan':
            const steps = info.planSteps || [];
            return steps.length > 0 ? steps.map((s: any, i: number) => (i + 1) + '. ' + s.content).join('\n') : '';
        case 'execute':
            const files = info.filePathsFromTools || [];
            return files.length > 0 ? '已更新 ' + files.length + ' 个文件：\n' + files.map((f: string) => '· ' + f).join('\n') : '执行中...';
        case 'self_verify':
            return info.verifyOutput || '';
        case 'review':
            const reviewFiles = info.pendingReviewFiles || 0;
            return reviewFiles > 0 ? reviewFiles + ' 个文件待验收' : '验收通过';
        default:
            return '';
    }
}

function groupByPhase(msgs: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const m of msgs) {
        const phase = m.dataset?.phase || (m.dataset?.phase === '' ? 'user' : '');
        let key = phase;
        if (!key || key === '') {
            if (m.classList?.contains('user')) key = 'user';
            else key = 'execute';
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
    }
    return map;
}

function gatherMessages(container: HTMLElement): HTMLElement[] {
    const result: HTMLElement[] = [];
    for (const el of container.children) {
        if (el.classList.contains('chat-msg') && !el.querySelector('#working-indicator')) {
            result.push(el as HTMLElement);
        }
    }
    return result;
}

function createMsgElement(msg: any): HTMLElement {
    const role = msg.classList?.contains('user') ? 'user' : (msg.classList?.contains('agent') ? 'agent' : 'tool');
    const content = msg.textContent || '';
    const div = document.createElement('div');
    div.className = 'tv4-process-info';
    const sender = role === 'user' ? '👤' : role === 'agent' ? '🤖' : '🔧';
    let text = content;
    if (text.length > 200) text = text.substring(0, 200) + '...';
    div.textContent = sender + ' ' + text;
    return div;
}

export function updatePhaseBadge(phase: string): void {
    const count = document.getElementById('tv4-phase-count');
    if (count) {
        const idx = STAGE_ORDER.indexOf(phase);
        count.textContent = (idx >= 0 ? idx + 1 : 0) + '/6';
    }
}
