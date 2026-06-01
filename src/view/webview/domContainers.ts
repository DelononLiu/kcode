function getActiveView(): 'assistant' | 'task' {
    const av = document.getElementById('assistant-view');
    if (av && av.style.display !== 'none') return 'assistant';
    return 'task';
}

export function getChatScroll(): HTMLElement | null {
    const el = document.querySelector(`#${getActiveView()}-view #chat-scroll`);
    if (el) return el as HTMLElement;
    // Fallback for task view (no shared chat-scroll)
    const taskChat = document.querySelector('#task-view #chat-messages');
    return taskChat ? taskChat.parentElement || (taskChat as HTMLElement) : null;
}

export function getChatMessages(): HTMLElement | null {
    return document.querySelector(`#${getActiveView()}-view #chat-messages`);
}

export function getWorkingIndicator(): HTMLElement | null {
    return document.querySelector(`#${getActiveView()}-view #working-indicator`);
}

export function getTlFilterBar(): HTMLElement | null {
    return document.querySelector(`#${getActiveView()}-view #tl-filter-bar`);
}
