import { G } from './state';
import { getChatMessages, getChatScroll } from './domContainers';

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

export const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];

const STAGE_LABELS: Record<string, string> = {
    demand: '需求提取', goal: '目标确定', plan: '计划确定',
    execute: '执行修改', self_verify: '自验结果', review: '确认验收',
};

let expandedPhaseGroups = new Set<string>();

export function foldPhase(phase: string): void {
    const container = getChatMessages();
    if (!container) return;

    const group = container.querySelector(`.tv4-phase-group[data-phase="${phase}"]`) as HTMLElement | null;
    if (!group || group.classList.contains('folded')) return;

    const elements = Array.from(group.children) as HTMLElement[];
    const chatMsgs = elements.filter(e => e.classList.contains('chat-msg'));
    if (chatMsgs.length < 2) return;

    const tlEntries = group.querySelectorAll('.tl-entry');
    let thinkingCount = 0, toolCount = 0;
    tlEntries.forEach(entry => {
        const kind = (entry as HTMLElement).dataset.tlKind;
        if (kind === 'thinking') thinkingCount++;
        else if (kind) toolCount++;
    });

    let tsMin = Infinity, tsMax = -Infinity;
    for (const msg of chatMsgs) {
        const ts = (msg as HTMLElement).dataset.ts;
        if (ts) {
            const n = parseInt(ts, 10);
            if (n > 0 && n < tsMin) tsMin = n;
            if (n > tsMax) tsMax = n;
        }
    }
    const elapsed = tsMax > tsMin ? Math.round((tsMax - tsMin) / 1000) : 0;

    const parts: string[] = [];
    if (thinkingCount > 0) parts.push(`经过 ${thinkingCount}轮思考`);
    if (toolCount > 0) parts.push(`调用 ${toolCount}个工具`);
    if (elapsed > 0) parts.push(`用时 ${elapsed}秒`);

    const toggle = document.createElement('div');
    toggle.className = 'tv4-pg-toggle';

    const count = chatMsgs.length;

    toggle.innerHTML = '<span class="tv4-pg-icon">▶</span> '
        + STAGE_LABELS[phase]
        + ' <span class="tv4-pg-count">' + count + '条</span>'
        + (parts.length > 0 ? ' — <span class="tv4-pg-summary">' + parts.join('，') + '</span>' : '');

    toggle.addEventListener('click', () => {
        const grp = toggle.parentElement as HTMLElement;
        const isCollapsed = grp.dataset.collapsed !== 'false';
        grp.dataset.collapsed = isCollapsed ? 'false' : 'true';
        const iconEl = toggle.querySelector('.tv4-pg-icon') as HTMLElement;
        if (iconEl) iconEl.textContent = isCollapsed ? '▼' : '▶';
        if (isCollapsed) expandedPhaseGroups.add(phase);
        else expandedPhaseGroups.delete(phase);
    });

    const body = document.createElement('div');
    body.className = 'tv4-pg-body';

    for (let i = 0; i < chatMsgs.length - 1; i++) {
        body.appendChild(chatMsgs[i]);
    }

    group.insertBefore(toggle, group.firstChild);
    group.insertBefore(body, toggle.nextSibling);
    group.classList.add('folded');
    group.dataset.collapsed = 'true';

    const lastMsg = chatMsgs[chatMsgs.length - 1];
    if (lastMsg.parentNode === group) {
        group.parentNode?.insertBefore(lastMsg, group.nextSibling);
    }
}

export function groupPhases(): void {
    return;
    /*
    const container = getChatMessages();
    if (!container || !document.querySelector('#task-view') || document.getElementById('task-view')?.style.display === 'none') return;

    const elements = Array.from(container.children) as HTMLElement[];
    if (elements.length === 0) return;

    let indicator: HTMLElement | null = null;
    const phaseMap = new Map<string, HTMLElement[]>();
    const rootMessages: HTMLElement[] = [];

    for (const el of elements) {
        if (el.id === 'working-indicator') { indicator = el; continue; }
        if (el.classList.contains('tv4-phase-group')) continue;

        const phase = el.dataset.phase;
        if (phase && STAGE_ORDER.includes(phase)) {
            if (!phaseMap.has(phase)) phaseMap.set(phase, []);
            phaseMap.get(phase)!.push(el);
        } else {
            rootMessages.push(el);
        }
    }

    container.innerHTML = '';

    for (const msg of rootMessages) container.appendChild(msg);

    for (const phase of STAGE_ORDER) {
        const msgs = phaseMap.get(phase);
        if (!msgs || msgs.length === 0) continue;

        const isCurrent = phase === G.activeTaskPhase && G.activeTaskStatus !== 'completed' && G.activeTaskStatus !== 'cancelled';
        const isPast = STAGE_ORDER.indexOf(phase) < STAGE_ORDER.indexOf(G.activeTaskPhase) || G.activeTaskStatus === 'completed';

        const userExpanded = expandedPhaseGroups.has(phase);
        const collapsed = (isPast && !userExpanded) ? true : false;

        const group = document.createElement('div');
        group.className = 'tv4-phase-group';
        group.dataset.phase = phase;
        group.dataset.collapsed = collapsed ? 'true' : 'false';

        const toggle = document.createElement('div');
        toggle.className = 'tv4-pg-toggle';

        const processCount = msgs.length;
        const summaryMsg = msgs[msgs.length - 1];
        const summaryText = summaryMsg?.querySelector('.msg-card-header-text, .msg-card-actions, .msg-bubble')?.textContent?.trim().substring(0, 20) || '';
        toggle.innerHTML = '<span class="tv4-pg-icon">' + (collapsed ? '▶' : '▼') + '</span> '
            + STAGE_LABELS[phase]
            + (isCurrent ? ' — 进行中' : '')
            + ' <span class="tv4-pg-count">' + processCount + '条</span>'
            + (summaryText ? ' <span class="tv4-pg-summary">' + escapeHtml(summaryText) + '</span>' : '');

        toggle.addEventListener('click', () => {
            const grp = toggle.parentElement as HTMLElement;
            const isCollapsed = grp.dataset.collapsed !== 'false';
            grp.dataset.collapsed = isCollapsed ? 'false' : 'true';
            const iconEl = toggle.querySelector('.tv4-pg-icon') as HTMLElement;
            if (iconEl) iconEl.textContent = isCollapsed ? '▼' : '▶';
            if (isCollapsed) expandedPhaseGroups.add(phase);
            else expandedPhaseGroups.delete(phase);
        });

        const body = document.createElement('div');
        body.className = 'tv4-pg-body';

        // All messages except the last one → collapsible body
        for (let i = 0; i < msgs.length - 1; i++) {
            body.appendChild(msgs[i]);
        }

        group.appendChild(toggle);
        group.appendChild(body);
        container.appendChild(group);

        // Last message (summary card) → always visible after the collapsible body
        container.appendChild(summaryMsg);
    }

    if (indicator) container.appendChild(indicator);

    const scrollEl = getChatScroll();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    */
}

export function initPhaseView(): void {
    const scrollEl = document.querySelector('#task-view #tv4-scroll');
    if (!scrollEl) return;

    scrollEl.addEventListener('click', (e) => {
        const toolMsg = (e.target as HTMLElement).closest('.chat-msg.tool') as HTMLElement;
        if (!toolMsg) return;
        if ((e.target as HTMLElement).closest('a, button, input, textarea')) return;
        toolMsg.classList.toggle('expanded');
    });
}

export function updatePhaseBadge(phase: string): void {
    const count = document.getElementById('tv4-phase-count');
    if (count) {
        const idx = STAGE_ORDER.indexOf(phase);
        count.textContent = (idx >= 0 ? idx + 1 : 0) + '/6';
    }
}

export function resetPhaseState(): void {
    expandedPhaseGroups.clear();
}
