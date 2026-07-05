import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/rendererShared';
import { registerRenderer, MessageRenderer } from './registry';
import { createTimelineEntry } from '../timelineRenderer';

export function renderToolCall(msg: Message, _sm: MsgStateAccess): HTMLElement | null {
    if (!msg.toolCall) return null;
    const info = msg.toolCall;
    const entry = createTimelineEntry(info);
    const body = entry.querySelector('.tl-entry-body');
    if (body && !msg.collapsed) body.classList.add('open');
    const div = document.createElement('div');
    div.className = 'chat-msg tool';
    div.dataset.msgId = msg.id;
    if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
    div.appendChild(entry);
    if (msg.collapsed) div.style.display = 'none';
    return div;
}

const toolCallRenderer: MessageRenderer = {
    type: 'tool_call',
    render: renderToolCall,
};
registerRenderer(toolCallRenderer);
