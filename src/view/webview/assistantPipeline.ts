/**
 * 助理视图渲染管线（共用 msgRenderer 内核，独立 StateManager 实例）
 *
 * 与任务管线（renderManager/basePipeline）平行，不含 phase/round 逻辑。
 */

import { StateManager } from './taskv3/state';
import { createMsgElement, updateMsgElement, setMsgPostAction } from './taskv3/msgRenderer';
import type { Message } from './taskv3/types';
import { getChatMessages, getChatScroll } from './domContainers';
import { G } from './state';
import { handleStreamChunk, handleStreamDone, handleThinkingChunk, handleToolChunk } from './streamHandler';
import type { StreamStateAccess } from './streamHandler';

// ── 助理专用 StateManager ──
let _asstSm: StateManager | null = null;
let _renderedMsgIds = new Set<string>();
let _lastMsgVersion = -1;

/** 初始化助理管线（注册消息监听 + 状态订阅） */
export function initAssistantPipeline() {
    if (_asstSm) return;
    _asstSm = new StateManager();

    // postAction 沿用 msgRenderer.ts 的默认值（全局空函数桩），
    // 注意：不要在此调用 setMsgPostAction，否则会覆盖 renderManager.ts 中 initTaskV3 设置的真实 postAction

    _asstSm.subscribe((state) => {
        if (state.msgVersion !== _lastMsgVersion) {
            _renderedMsgIds.clear();
            _renderAll(state.messages);
            _lastMsgVersion = state.msgVersion;
        }
    });

    _asstSm.onPatch(() => {
        _syncMessages();
        if (!G._userScrolledUp) {
            G._programmaticScroll = true;
            const scroller = getChatScroll();
            if (scroller) scroller.scrollTop = scroller.scrollHeight;
            requestAnimationFrame(() => { G._programmaticScroll = false; });
        }
    });

    window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;
        if (!_asstSm) return;
        const v3Types = ['stream-chunk', 'stream-done', 'thinking-chunk', 'tool-chunk'];
        if (!v3Types.includes(msg.type)) return;

        // 过滤任务消息（有 taskId 的由 renderManager 处理）
        if (msg.taskId) return;

        const mgr = _asstSm; // local const for type narrowing in closures

        switch (msg.type) {
            case 'stream-chunk': {
                G._userScrolledUp = false;
                const sm: StreamStateAccess = {
                    state: mgr.state,
                    patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
                };
                handleStreamChunk(msg.text, sm);
                break;
            }
            case 'stream-done': {
                const sm: StreamStateAccess = {
                    state: mgr.state,
                    patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
                };
                handleStreamDone(sm);
                break;
            }
            case 'thinking-chunk': {
                const sm: StreamStateAccess = {
                    state: mgr.state,
                    patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
                };
                handleThinkingChunk(msg, sm);
                break;
            }
            case 'tool-chunk': {
                const sm: StreamStateAccess = {
                    state: mgr.state,
                    patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
                };
                handleToolChunk(msg, sm);
                break;
            }
        }
    });
}

/** 流式更新当前 agent 消息（累积追加文本） */
export function streamAssistantMessage(text: string) {
    if (!_asstSm) return;
    const mgr = _asstSm;
    G._userScrolledUp = false;
    const sm: StreamStateAccess = {
        state: mgr.state,
        patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
    };
    handleStreamChunk(text, sm);
}

/** 流式结束，取消 streaming 标记 */
export function finishAssistantStream() {
    if (!_asstSm) return;
    const mgr = _asstSm;
    const sm: StreamStateAccess = {
        state: mgr.state,
        patch: (d) => mgr.patch({ ...d, msgVersion: ++_lastMsgVersion }),
    };
    handleStreamDone(sm);
}

/** 添加工具调用/思考消息 */
export function addAssistantToolMessage(kind: string, toolCallId: string, title: string, status: string, output: string) {
    if (!_asstSm) return;
    const msgs = [..._asstSm.state.messages];
    const toolContent = JSON.stringify({ toolCallId, title, kind, status, output });
    const existingIdx = msgs.findIndex(m => m.type === 'tool_call' && m.content && m.content.includes(toolCallId));
    if (existingIdx >= 0) {
        msgs[existingIdx] = { ...msgs[existingIdx], content: toolContent };
    } else {
        msgs.push({
            id: 'tool_' + toolCallId,
            taskId: '',
            role: 'tool',
            type: 'tool_call',
            content: toolContent,
            timestamp: Date.now(),
            streaming: false,
            collapsed: false,
            roundGroup: null,
        });
    }
    _asstSm.patch({ messages: msgs, msgVersion: ++_lastMsgVersion });
}

/** 主动添加用户/agent 消息（用于加载历史或手动追加） */
export function addAssistantMessage(msg: Message) {
    if (!_asstSm) return;
    const msgs = [..._asstSm.state.messages, msg];
    _asstSm.patch({ messages: msgs, msgVersion: ++_lastMsgVersion });
}

/** 添加系统消息（走 V3 状态，不丢失） */
export function addAssistantSystemMessage(content: string) {
    if (!_asstSm) return;
    const msgs = [..._asstSm.state.messages];
    msgs.push({
        id: 'sys_' + Date.now(),
        taskId: '',
        role: 'agent' as const,
        type: 'text',
        content,
        timestamp: Date.now(),
        streaming: false,
        collapsed: false,
        roundGroup: null,
    });
    _asstSm.patch({ messages: msgs, msgVersion: ++_lastMsgVersion });
}

export function setAssistantMessages(messages: Message[]) {
    if (!_asstSm) return;
    // 全量替换消息时，清除旧 DOM 避免重复
    const container = getChatMessages();
    if (container) container.innerHTML = '';
    _renderedMsgIds.clear();
    _asstSm.patch({ messages, msgVersion: ++_lastMsgVersion });
}

export function getAssistantStateManager(): StateManager | null {
    return _asstSm;
}

// ── 内部实现 ──

/** 渲染所有消息到 DOM */
function _renderAll(messages: Message[]) {
    const container = getChatMessages();
    if (!container) return;
    container.innerHTML = '';
    _renderedMsgIds.clear();
    // 移除 chat-empty 类让容器可见
    const scrollEl = getChatScroll();
    if (scrollEl) scrollEl.classList.remove('chat-empty');
    for (const msg of messages) {
        const el = createMsgElement(msg, _asstSm!);
        if (el) {
            container.appendChild(el);
            _renderedMsgIds.add(msg.id);
        }
    }
}

/** 增量同步 DOM */
function _syncMessages() {
    if (!_asstSm) return;
    const msgs = _asstSm.state.messages;
    const container = getChatMessages();
    if (!container) return;

    // 有消息时移除 chat-empty 类让容器可见
    if (msgs.length > 0) {
        const scrollEl = getChatScroll();
        if (scrollEl) scrollEl.classList.remove('chat-empty');
    }

    for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        if (_renderedMsgIds.has(msg.id)) {
            const el = container.querySelector(`[data-msg-id="${msg.id}"]`) as HTMLElement;
            if (el) updateMsgElement(el, msg, _asstSm);
            continue;
        }
        const el = createMsgElement(msg, _asstSm);
        if (!el) continue;
        _renderedMsgIds.add(msg.id);
        container.appendChild(el);
    }
}
