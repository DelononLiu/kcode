import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/msgRenderer';
import { registerRenderer, MessageRenderer } from './registry';
import { renderMarkdown } from '../markdownRenderer';
import { formatTimestamp } from '../messageRenderer';

const userRenderer: MessageRenderer = {
    type: 'user',
    render: (msg: Message, _sm: MsgStateAccess) => {
        const div = document.createElement('div');
        div.className = 'chat-msg user';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        const ts = msg.timestamp ? formatTimestamp(msg.timestamp) : '';
        sender.innerHTML = 'You' + (ts ? ' <span class="msg-timestamp">' + ts + '</span>' : '');
        div.appendChild(sender);
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = renderMarkdown(msg.content);
        div.appendChild(bubble);
        return div;
    },
};
registerRenderer(userRenderer);
