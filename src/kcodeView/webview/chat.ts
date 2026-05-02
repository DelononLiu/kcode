// Chat message renderer
// Will be fully implemented in Phase 3

export function renderMessages(messages: any[]) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div class="chat-placeholder">输入需求，开始与 AI 对话</div>';
        return;
    }

    for (const msg of messages) {
        addMessageElement(msg.role, msg.content);
    }
    container.scrollTop = container.scrollHeight;
}

function addMessageElement(role: string, content: string) {
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

    const markdownFn = (window as any).simpleMarkdown || ((s: string) => s.replace(/\n/g, '<br>'));
    const rendered = markdownFn(content);

    bubble.innerHTML = rendered;
    msgDiv.appendChild(bubble);

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

// Register global for app.ts to call
(window as any).renderMessages = renderMessages;

export { addMessageElement as addChatMessage };
