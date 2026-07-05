import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/rendererShared';
import { registerRenderer, MessageRenderer } from './registry';
import { createTimelineEntry } from '../timelineRenderer';

export function renderThinking(msg: Message, _sm: MsgStateAccess): HTMLElement | null {
    const entry = createTimelineEntry({
        kind: 'thinking',
        title: '思考',
        content: msg.content,
        status: msg.streaming ? 'running' : 'completed',
    });
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

const thinkingRenderer: MessageRenderer = {
    type: 'thinking',
    render: renderThinking,
};
registerRenderer(thinkingRenderer);
