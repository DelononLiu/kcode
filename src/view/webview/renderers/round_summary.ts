import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/msgRenderer';
import { registerRenderer, MessageRenderer } from './registry';
import { buildSummaryHtml, isNonCollapsible } from '../taskv3/msgRenderer';

const roundSummaryRenderer: MessageRenderer = {
    type: 'round_summary',
    render: (msg: Message, sm: MsgStateAccess) => {
        let counts: { thinking: number; tools: Record<string, number> };
        try { counts = JSON.parse(msg.content); } catch { return null; }
        const div = document.createElement('div');
        div.className = 'chat-msg agent round-summary';
        div.dataset.msgId = msg.id;
        if (msg.phaseAction?.phase) div.dataset.phase = msg.phaseAction.phase;
        div.innerHTML = `<span class="round-summary-chip">${buildSummaryHtml(counts)}</span>`;
        div.addEventListener('click', () => {
            const st = sm.snapshot();
            const cur = st.messages.find(m => m.id === msg.id);
            const targetCollapsed = !(cur?.collapsed);
            const toggled = st.messages.map(m => {
                if (m.id === msg.id) return { ...m, collapsed: targetCollapsed };
                if (m.roundGroup === (msg as any).roundGroup && m.type !== 'round_summary' && !isNonCollapsible(m) && 'collapsed' in (m as any)) {
                    return { ...m, collapsed: targetCollapsed };
                }
                return m;
            });
            sm.patch({ messages: toggled });
        });
        return div;
    },
};
registerRenderer(roundSummaryRenderer);
