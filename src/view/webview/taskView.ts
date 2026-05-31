function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

import { getChatScroll } from './domContainers';

export function showTaskView(asControlPanel: boolean = false): void {
    const assistantView = document.getElementById('assistant-view');
    const taskView = document.getElementById('task-view');
    if (assistantView) assistantView.style.display = 'none';
    if (taskView) taskView.style.display = 'block';
    const headerSub = document.getElementById('chat-header-sub');
    if (headerSub) headerSub.classList.remove('hidden');
    const headerAssistant = document.getElementById('chat-header-row-assistant');
    if (headerAssistant) headerAssistant.classList.add('hidden');
    const headerRow3 = document.getElementById('chat-header-row3');
    if (headerRow3) headerRow3.classList.remove('hidden');

    const initScreen = document.getElementById('init-screen');
    const controlPanel = document.getElementById('control-panel');
    if (asControlPanel) {
        if (initScreen) initScreen.style.display = 'none';
        if (controlPanel) controlPanel.classList.add('activated');
    } else {
        if (initScreen) { initScreen.style.display = ''; initScreen.style.opacity = '1'; initScreen.style.transform = ''; }
        if (controlPanel) controlPanel.classList.remove('activated');
    }
}

export function toggleTaskRow(header: HTMLElement): void {
    const row = header.parentElement as HTMLElement;
    if (!row) return;
    row.classList.toggle('expanded');
}
(window as any).toggleTaskRow = toggleTaskRow;

const STAGE_ORDER = ['demand', 'goal', 'plan', 'execute', 'verify', 'review'];

export function updateRailAndStages(phase: string, status: string): void {
    const idx = STAGE_ORDER.indexOf(phase);
    const statusIdx = status === 'completed' ? 6 : status === 'cancelled' ? -1 : idx >= 0 ? idx : -1;

    document.querySelectorAll('.stage-node').forEach((el, i) => {
        el.classList.toggle('done', i < statusIdx);
        el.classList.toggle('active', i === statusIdx && status !== 'completed' && status !== 'cancelled');
    });

    const track = document.getElementById('rail-track-active');
    if (track && statusIdx > 0) {
        track.style.height = Math.min((40 + statusIdx * (26 + 38)), (40 + STAGE_ORDER.length * 26 + (STAGE_ORDER.length - 1) * 38)) + 'px';
    } else if (track && statusIdx === 0) {
        track.style.height = '40px'; track.style.opacity = '0.3';
    } else if (track) {
        track.style.height = '0';
    }

    document.querySelectorAll('.task-row').forEach((el) => {
        const si = STAGE_ORDER.indexOf((el as HTMLElement).dataset.stage || '');
        const iconBox = el.querySelector('.status-icon-box') as HTMLElement;
        if (!iconBox) return;
        if (si < statusIdx) {
            iconBox.className = 'status-icon-box success';
            iconBox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04d361" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (si === statusIdx && status !== 'completed' && status !== 'cancelled') {
            iconBox.className = 'status-icon-box running';
            iconBox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04d361" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
            el.classList.add('expanded');
        } else {
            iconBox.className = 'status-icon-box pending';
            iconBox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>';
        }
    });

    const phaseCount = document.getElementById('header-phase-count');
    if (phaseCount) phaseCount.textContent = `${Math.max(0, statusIdx)}/6`;

    if (phase) {
        const durEl = document.getElementById(`dur-${phase}`);
        if (durEl) durEl.textContent = '▶';
    }

    if (phase === 'execute' || status === 'active') {
        ['exec-warning', 'exec-terminal', 'exec-controls', 'exec-intervention'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }
}

export function getNodeLetter(type: string): string {
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

export function getNodeLabel(type: string): string {
    switch (type) {
        case 'demand': return '需求';
        case 'goal': return '目标';
        case 'plan': return '计划';
        case 'execute': return '执行';
        case 'self_verify': return '自验';
        case 'review': return '验收';
        default: return type;
    }
}

export function getNodeSegmentColor(status: string): string {
    switch (status) {
        case 'completed': return '#1e7a32';
        case 'active': return '#1a5f9e';
        case 'pending': return 'rgba(26,95,158,.3)';
        case 'cancelled': return '#a04040';
        default: return 'rgba(255,255,255,.1)';
    }
}

export function handleNodePanelUpdate(nodes: any[], taskType: string): void {
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

        const label = document.createElement('span');
        label.className = 'tl-label';
        let labelText = getNodeLabel(node.type);
        if (node.type === 'execute' && node.iteration > 0) {
            labelText += ` ${node.iteration}${node.maxIteration ? '/' + node.maxIteration : ''}`;
        }
        label.textContent = labelText;
        dot.appendChild(label);

        wrap.appendChild(dot);
        dotsEl.appendChild(wrap);

        if (i < nodes.length - 1) {
            const seg = document.createElement('div');
            seg.className = 'tl-line-segment';
            const color = getNodeSegmentColor(node.status);
            for (let d = 0; d < 7; d++) {
                const lineDot = document.createElement('div');
                lineDot.className = 'tl-line-dot';
                lineDot.style.background = color;
                seg.appendChild(lineDot);
            }
            dotsEl.appendChild(seg);
        }
    }
}

export function scrollToMessage(msgId: string): void {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement;
    if (!el) return;
    const scrollContainer = getChatScroll();
    if (!scrollContainer) return;
    const offset = el.getBoundingClientRect().top - scrollContainer.getBoundingClientRect().top + scrollContainer.scrollTop - 16;
    scrollContainer.scrollTo({ top: offset, behavior: 'smooth' });
    el.classList.remove('msg-highlight');
    void el.offsetWidth;
    el.classList.add('msg-highlight');
}

export function initNodePanel(): void {
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
}
