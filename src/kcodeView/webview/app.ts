// KCode WebView Main App
// Handles layout interactions, message passing, and coordinates sub-modules

declare const vscode: any;

document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    initTabs();
    initChat();
    initInstructionToggle();
    initMessageHandler();
});

// ==================== VSCode Message Handler ====================

function initMessageHandler() {
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'loadMessages':
                streamMessageEl = null;
                if ((window as any).renderMessages) {
                    if (message.messages && message.messages.length > 0) {
                        activeTaskId = message.messages[0].taskId;
                    }
                    (window as any).renderMessages(message.messages);
                }
                break;
            case 'showFilePreview':
                if ((window as any).showPreview) {
                    (window as any).showPreview(message.filePath, message.content);
                    activateTab('preview');
                }
                break;
            case 'showDiff':
                if ((window as any).showDiff) {
                    (window as any).showDiff(message.original, message.modified);
                    activateTab('diff');
                }
                break;
            case 'showWebView':
                if ((window as any).showWebView) {
                    (window as any).showWebView(message.url);
                    activateTab('webview');
                }
                break;
            case 'deviceConnect':
                if ((window as any).connectToDevice) {
                    (window as any).connectToDevice(message.host, message.port, message.connectionType);
                    activateTab('device');
                }
                break;
            case 'agentStreamUpdate':
                handleAgentStreamUpdate(message.text);
                break;
            case 'agentStatus':
                handleAgentStatus(message.status, message.message);
                break;
            // Timeline step updates from the extension
            case 'addTimelineStep':
                addTimelineItem(message.icon, message.text, message.time);
                break;
        }
    });
}

// ==================== Timeline ====================

function addTimelineItem(icon: string, text: string, time?: string) {
    const container = document.getElementById('chat-messages')!;
    // Remove placeholder if it exists
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const item = document.createElement('div');
    item.className = 'timeline-item';

    const iconSpan = document.createElement('span');
    iconSpan.className = `timeline-icon ${icon === '⟳' ? 'thinking' : icon === '✓' ? 'done' : icon === '◇' ? 'agent' : ''}`;
    iconSpan.textContent = icon;
    item.appendChild(iconSpan);

    const textSpan = document.createElement('span');
    textSpan.className = 'timeline-text';
    textSpan.textContent = text;
    item.appendChild(textSpan);

    if (time) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timeline-time';
        timeSpan.textContent = time;
        item.appendChild(timeSpan);
    }

    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
}

// ==================== Streaming ====================

let streamMessageEl: HTMLElement | null = null;

function handleAgentStreamUpdate(text: string) {
    const container = document.getElementById('chat-messages')!;
    // Remove the timeline header if present (keep it for first message ref)
    // Don't remove timeline-header — it stays at the top

    if (!streamMessageEl) {
        // Create agent streaming bubble
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg agent';

        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = 'Agent';
        msgDiv.appendChild(sender);

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        msgDiv.appendChild(bubble);

        container.appendChild(msgDiv);
        streamMessageEl = bubble;
    }

    const rendered = text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    streamMessageEl.innerHTML = rendered;
    container.scrollTop = container.scrollHeight;
}

function handleAgentStatus(status: string, message: string) {
    const container = document.getElementById('chat-messages')!;
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'text-align:center;padding:8px;margin:8px 0;font-size:12px;color:#888;';
    statusDiv.textContent = `\u{1F50C} ${message}`;
    container.appendChild(statusDiv);
    container.scrollTop = container.scrollHeight;
}

/** Reset streaming state when loading messages */
(window as any).__resetStream = () => {
    streamMessageEl = null;
};

function activateTab(tabName: string) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

    const tabBtn = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (tabBtn) tabBtn.classList.add('active');

    const content = document.getElementById(`tab-${tabName}`);
    if (content) content.classList.add('active');
}

// Track the currently selected task ID for sending messages
let activeTaskId: string | null = null;

// ==================== Layout ====================

function initLayout() {
    const container = document.getElementById('container')!;
    const splitter2 = document.getElementById('splitter-2')!;
    const rightPanel = document.getElementById('right-panel')!;
    const sidebar = document.getElementById('sidebar')!;

    let activeSplitter: HTMLElement | null = null;

    function onMouseDown(e: MouseEvent, splitter: HTMLElement) {
        activeSplitter = splitter;
        splitter.classList.add('active');
        e.preventDefault();
    }

    function onMouseMove(e: MouseEvent) {
        if (!activeSplitter) return;

        const containerRect = container.getBoundingClientRect();

        if (activeSplitter === splitter2) {
            let newWidth = containerRect.right - e.clientX;
            newWidth = Math.max(200, Math.min(600, newWidth));
            rightPanel.style.width = `${newWidth}px`;
        }
    }

    function onMouseUp() {
        if (activeSplitter) {
            activeSplitter.classList.remove('active');
            activeSplitter = null;
        }
    }

    splitter2.addEventListener('mousedown', (e) => onMouseDown(e, splitter2));
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Right panel close button
    const closeBtn = document.getElementById('right-panel-close')!;
    closeBtn.addEventListener('click', () => {
        rightPanel.classList.toggle('hidden');
    });
}

// ==================== Instruction Toggle ====================

function initInstructionToggle() {
    const toggle = document.querySelector('.instruction-toggle');
    toggle?.addEventListener('click', () => {
        toggle.classList.toggle('collapsed');
    });
}

// ==================== Tabs ====================

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = (btn as HTMLElement).dataset.tab;

            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));

            btn.classList.add('active');
            const content = document.getElementById(`tab-${tabName}`);
            if (content) content.classList.add('active');
        });
    });
}

// ==================== Chat / Input ====================

function initChat() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('btn-send')!;

    if (!input) return;

    // Auto-resize textarea
    function autoResize() {
        input.style.height = 'auto';
        const newHeight = Math.min(input.scrollHeight, 200);
        input.style.height = newHeight + 'px';
    }
    input.addEventListener('input', autoResize);

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addUserMessage(text);
        input.value = '';
        autoResize();
        input.focus();

        vscode.postMessage({
            type: 'sendMessage',
            text,
            taskId: activeTaskId
        });
    }

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Input tool buttons
    const settingsBtn = document.querySelector('.settings-btn');
    settingsBtn?.addEventListener('click', () => {
        vscode.postMessage({ type: 'openSettings' });
    });
}

function addUserMessage(content: string) {
    const container = document.getElementById('chat-messages')!;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = content;
    msgDiv.appendChild(bubble);

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Legacy addMessage for compatibility
function addMessage(role: 'user' | 'agent', content: string) {
    if (role === 'user') {
        addUserMessage(content);
        return;
    }

    const container = document.getElementById('chat-messages')!;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'Agent';
    msgDiv.appendChild(sender);

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    const rendered = content
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    bubble.innerHTML = rendered;
    msgDiv.appendChild(bubble);

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Export for use by other modules
(window as any).addMessage = addMessage;
(window as any).addTimelineItem = addTimelineItem;
