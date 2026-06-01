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

const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'self_verify', 'review'];

const STAGE_LABELS: Record<string, string> = {
    demand: '需求提取', goal: '目标确定', plan: '计划确定',
    execute: '执行修改', self_verify: '自验结果', review: '确认验收',
};

let expandedPhaseGroups = new Set<string>();

export function groupPhases(): void {
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

        const group = document.createElement('div');
        group.className = 'tv4-phase-group';
        group.dataset.phase = phase;

        const isCurrent = phase === G.activeTaskPhase && G.activeTaskStatus !== 'completed' && G.activeTaskStatus !== 'cancelled';
        const isPast = STAGE_ORDER.indexOf(phase) < STAGE_ORDER.indexOf(G.activeTaskPhase) || G.activeTaskStatus === 'completed';

        const toggle = document.createElement('div');
        toggle.className = 'tv4-pg-toggle';

        if (isCurrent && !isPast) {
            group.dataset.collapsed = 'false';
            toggle.innerHTML = '<span class="tv4-pg-icon">▼</span> 阶段 · ' + STAGE_LABELS[phase] + ' — 进行中';
        } else {
            const userExpanded = expandedPhaseGroups.has(phase);
            group.dataset.collapsed = userExpanded ? 'false' : 'true';
            const icon = userExpanded ? '▼' : '▶';
            toggle.innerHTML = '<span class="tv4-pg-icon">' + icon + '</span> 已折叠阶段 · ' + STAGE_LABELS[phase] + ' (' + msgs.length + '条)';
        }

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
        for (const msg of msgs) body.appendChild(msg);

        group.appendChild(toggle);
        group.appendChild(body);
        container.appendChild(group);
    }

    if (indicator) container.appendChild(indicator);

    const scrollEl = getChatScroll();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
}

export function initPhaseView(): void {
    const scrollEl = document.querySelector('#task-view #tv4-scroll');
    if (!scrollEl) return;

    scrollEl.addEventListener('click', (e) => {
        const toolMsg = (e.target as HTMLElement).closest('.chat-msg.tool') as HTMLElement;
        if (!toolMsg) return;
        if ((e.target as HTMLElement).closest('a, button, input, textarea, .msg-card-header, .tl-entry-header')) return;
        const wasExpanded = toolMsg.classList.contains('expanded');
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
