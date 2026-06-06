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

export let reviewChangesMap: Map<string, FileChange[]> = new Map();

(window as any).handleDemoCardUpdate = handleDemoCardUpdate;
(window as any).renderDemoCard = renderDemoCard;
