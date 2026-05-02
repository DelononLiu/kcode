// KCode WebView Main App
// Handles layout interactions, message passing, and coordinates sub-modules

declare const vscode: any;

document.addEventListener('DOMContentLoaded', () => {
    initLayout();
    initTabs();
    initChat();
    initMessageHandler();
});

// ==================== VSCode Message Handler ====================

function initMessageHandler() {
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'updateTaskList':
                if ((window as any).renderTaskList) {
                    (window as any).renderTaskList(message.workspaces);
                }
                break;
            case 'loadMessages':
                // Reset streaming state when loading a new task's messages
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
                    // Switch to preview tab
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
        }
    });
}

let streamMessageEl: HTMLElement | null = null;

function handleAgentStreamUpdate(text: string) {
    const container = document.getElementById('chat-messages')!;
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    if (!streamMessageEl) {
        // Create new agent message element for streaming
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
        streamMessageEl.dataset.fullText = text;
    }

    // Update the bubble content
    const rendered = text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');

    streamMessageEl.innerHTML = rendered;
    container.scrollTop = container.scrollHeight;
}

function handleAgentStatus(status: string, message: string) {
    // Show agent connection status in the chat
    const container = document.getElementById('chat-messages')!;
    const statusDiv = document.createElement('div');
    statusDiv.style.cssText = 'text-align:center;padding:8px;margin:8px 0;font-size:12px;color:#888;';
    statusDiv.textContent = `🔌 ${message}`;
    container.appendChild(statusDiv);
    container.scrollTop = container.scrollHeight;
}

/**
 * Reset streaming state when loading messages (new task selected)
 */
const originalLoadMessages = handleAgentStreamUpdate;
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

// ==================== Chat ====================

function initChat() {
    const input = document.getElementById('chat-input') as HTMLTextAreaElement;
    const sendBtn = document.getElementById('btn-send')!;

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage('user', text);
        input.value = '';

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
}

function addMessage(role: 'user' | 'agent', content: string) {
    const container = document.getElementById('chat-messages')!;

    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${role}`;

    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = role === 'user' ? 'You' : 'Agent';
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
