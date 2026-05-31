declare function acquireVsCodeApi(): any;

function getVscode(): any {
    return (window as any).vscode || (window as any).__vscode || acquireVsCodeApi();
}

export function showAssistantView(): void {
    const taskView = document.getElementById('task-view');
    const assistantView = document.getElementById('assistant-view');
    if (taskView) taskView.style.display = 'none';
    if (assistantView) assistantView.style.display = 'block';
    const titleEl = document.querySelector('.task-info-title');
    if (titleEl) titleEl.textContent = '🤖 KCode 小助手';
    const sloganEl = document.getElementById('chat-header-slogan');
    if (sloganEl) sloganEl.classList.remove('hidden');
    const headerSub = document.getElementById('chat-header-sub');
    if (headerSub) headerSub.classList.add('hidden');
    const headerRow3 = document.getElementById('chat-header-row3');
    if (headerRow3) headerRow3.classList.add('hidden');
    const headerAssistant = document.getElementById('chat-header-row-assistant');
    if (headerAssistant) headerAssistant.classList.remove('hidden');
}

let _agentSelectorInited = false;

export function initAgentSelector(agents: { label: string; type: string; model?: string }[]): void {
    const vscode = getVscode();
    const btn = document.getElementById('agent-dropdown-btn');
    const label = document.getElementById('agent-dropdown-label');
    const list = document.getElementById('agent-dropdown-list');
    if (!btn || !label || !list) return;

    list.innerHTML = '';
    for (const agent of agents) {
        const item = document.createElement('li');
        item.className = 'agent-dropdown-item';
        item.dataset.value = agent.type;
        const modelText = agent.model ? ` — ${agent.model}` : '';
        item.innerHTML = `<span class="agent-name">${agent.label}</span><span class="agent-model">${modelText}</span>`;
        item.addEventListener('click', () => {
            label.textContent = agent.label;
            list.classList.add('hidden');
            vscode.postMessage({ type: 'switchAgent', label: agent.type });
        });
        list.appendChild(item);
    }

    const origDisplay = list.style.display;
    const origClass = list.classList.contains('hidden');
    list.classList.remove('hidden');
    list.style.display = 'block';
    list.style.visibility = 'hidden';
    const listWidth = list.offsetWidth;
    list.style.display = origDisplay || '';
    list.style.visibility = '';
    if (origClass) list.classList.add('hidden');
    if (listWidth > 0) {
        btn.style.minWidth = listWidth + 'px';
    }

    if (_agentSelectorInited) return;
    _agentSelectorInited = true;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = list.classList.contains('hidden');
        if (!wasHidden) {
            list.classList.add('hidden');
            return;
        }
        list.classList.remove('hidden');
        const anchor = (btn.closest('.agent-dropdown') || btn) as HTMLElement;
        const rect = anchor.getBoundingClientRect();
        list.style.left = rect.left + 'px';
        list.style.bottom = 'auto';
        list.style.maxHeight = (window.innerHeight - rect.bottom - 12) + 'px';
        list.style.top = (rect.bottom + 2) + 'px';
        const belowSpace = window.innerHeight - rect.bottom - 12;
        const listHeight = list.scrollHeight;
        if (listHeight > belowSpace && rect.top > listHeight + 12) {
            list.style.top = 'auto';
            list.style.maxHeight = (rect.top - 12) + 'px';
            list.style.bottom = (window.innerHeight - rect.top + 2) + 'px';
        }
    });

    document.addEventListener('click', () => {
        list.classList.add('hidden');
    });
}

export function initModelSelector(models: string[]): void {
    const vscode = getVscode();
    const btn = document.getElementById('model-dropdown-btn');
    const label = document.getElementById('model-dropdown-label');
    const list = document.getElementById('model-dropdown-list');
    if (!btn || !label || !list) {
        const capsule = document.getElementById('header-model-capsule');
        if (capsule && models.length > 0) {
            capsule.textContent = '模型: ' + models[0].split('/').pop() || models[0];
        }
        return;
    }
    list.innerHTML = '';
    for (const m of models) {
        const item = document.createElement('li');
        item.className = 'agent-dropdown-item';
        item.textContent = m;
        item.title = m;
        item.addEventListener('click', () => {
            label.textContent = truncateModel(m);
            label.title = m;
            list.classList.add('hidden');
            vscode.postMessage({ type: 'switchModel', model: m });
        });
        list.appendChild(item);
    }
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasHidden = list.classList.contains('hidden');
        if (!wasHidden) { list.classList.add('hidden'); return; }
        list.classList.remove('hidden');
    });
}

export function truncateModel(m: string): string {
    const parts = m.split('/');
    if (parts.length >= 2 && parts[parts.length - 1].length <= 20) return parts[parts.length - 1];
    return m.length > 18 ? m.substring(0, 16) + '…' : m;
}
