import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/rendererShared';
import { registerRenderer, MessageRenderer } from './registry';
import { renderMarkdown } from '../markdownRenderer';

export function renderText(msg: Message, _sm: MsgStateAccess): HTMLElement | null {
    const div = document.createElement('div');
    div.className = 'chat-msg agent';
    div.dataset.msgId = msg.id;
    if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    if (msg.streaming) {
        const content = document.createElement('div');
        content.id = '__v3-stream-content';
        content.className = 'stream-markdown';
        content.innerHTML = renderMarkdown(msg.content);
        bubble.appendChild(content);
    } else {
        bubble.innerHTML = renderMarkdown(msg.content);
    }
    div.appendChild(bubble);
    if (msg.collapsed) div.style.display = 'none';
    return div;
}

const textRenderer: MessageRenderer = {
    type: 'text',
    render: renderText,
};
registerRenderer(textRenderer);
