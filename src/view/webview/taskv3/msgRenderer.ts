/**
 * 消息渲染内核（纯函数，共享于任务管线和助理管线）
 *
 * 不持有任何状态。需要操作状态时通过参数传入 StateManager 接口。
 *
 * createMsgElement 按 type 分发到各渲染器模块。
 */

import type { Message } from './types';
import type { MsgStateAccess } from './rendererShared';
import { renderRoundSummary } from '../renderers/round_summary';
import { renderPhaseAction } from '../renderers/phase_action';
import { renderThinking } from '../renderers/thinking';
import { renderToolCall } from '../renderers/tool_call';
import { renderUserMessage } from '../renderers/user';
import { renderText } from '../renderers/text';
import { renderMarkdown } from '../markdownRenderer';

// 重新导出给旧调用方（renderManager、basePipeline、assistantPipeline）
export { setMsgPostAction } from './rendererShared';
export { isNonCollapsible, buildSummaryHtml } from './rendererShared';

// ── DOM 创建（按 type 分发到各渲染器）──

export function createMsgElement(msg: Message, sm: MsgStateAccess): HTMLElement | null {
    // round_summary 特殊处理
    if (msg.type === 'round_summary') {
        return renderRoundSummary(msg, sm);
    }
    // phase_action
    if (msg.type === 'phase_action' && msg.phaseAction) {
        return renderPhaseAction(msg, sm);
    }
    // thinking
    if (msg.type === 'thinking') {
        return renderThinking(msg, sm);
    }
    // tool_call
    if (msg.type === 'tool_call') {
        return renderToolCall(msg, sm);
    }
    // user
    if (msg.role === 'user') {
        return renderUserMessage(msg, sm);
    }
    // agent（默认 text 渲染）
    if (msg.role === 'agent') {
        return renderText(msg, sm);
    }

    return null;
}

// ── DOM 更新（增量更新已有元素）──

export function updateMsgElement(el: HTMLElement, msg: Message, sm: MsgStateAccess) {
    if (msg.type !== 'round_summary') {
        (el as HTMLElement).style.display = msg.collapsed ? 'none' : '';
    }
    if (msg.role === 'agent' && msg.streaming) {
        const contentEl = el.querySelector('#__v3-stream-content') as HTMLElement;
        if (contentEl && !_streamRafPending) {
            _streamRafPending = true;
            requestAnimationFrame(() => {
                _streamRafPending = false;
                const current = sm.snapshot().messages.find(m => m.role === 'agent' && m.streaming);
                if (current && contentEl) {
                    contentEl.innerHTML = renderMarkdown(current.content);
                }
            });
        }
    }
    if (msg.type === 'thinking') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) pre.textContent = msg.content;
        if (!msg.streaming) {
            const entry = el.querySelector('.tl-entry') as HTMLElement;
            if (entry) entry.removeAttribute('id');
        }
        const body = el.querySelector('.tl-entry-body');
        if (body) body.classList.toggle('open', !msg.collapsed);
    }
    if (msg.type === 'tool_call') {
        const pre = el.querySelector('.tl-entry-body pre') as HTMLElement;
        if (pre) {
            if (msg.toolResult?.output) pre.textContent = msg.toolResult.output;
        }
        const body = el.querySelector('.tl-entry-body');
        if (body) body.classList.toggle('open', !msg.collapsed);
    }
    if (msg.type === 'round_summary') {
        const chip = el.querySelector('.round-summary-chip') as HTMLElement;
        if (chip) el.classList.toggle('expanded', !msg.collapsed);
    }
}

let _streamRafPending = false;
