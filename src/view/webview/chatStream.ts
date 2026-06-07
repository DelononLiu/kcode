import { G } from './state';
import { truncateModel } from './assistantView';
import { escapeHtml, renderMarkdown } from './markdownRenderer';
import { createTimelineEntry, createMergedTimelineEntry, showTlFilterBar, forceTitle } from './timelineRenderer';
import { _isTodoArray, _parseTodoStr, buildTodoBodyHtml } from './todoRenderer';
import { renderToolBubbleContent } from './toolRenderer';
import { getChatScroll, getChatMessages, getWorkingIndicator } from './domContainers';
import { groupPhases } from './taskView';
import {
  parseLine, resetFileMap, resetTestStatus,
  fileMap, testStatus,
} from './streamParser';

// ===== Module-level state =====

export const activeToolCallElements: Map<string, HTMLElement> = new Map();

let _tabGroup: { elems: Map<string, any>; element: HTMLElement } | null = null;

export function resetTabGroup() { _tabGroup = null; }

let _mergeState: { thinkingId: string; thinkingTitle: string; thinkingBody: string; tools: any[]; phase: string } | null = null;

export function clearMergeState() { _mergeState = null; }

let latestStreamText = '';
let streamRenderPending = false;

function _ensureAgentHeader() {
    if (G._agentHeaderShown) return;
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();
    hideWorkingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg agent-header';
    if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
    const sender = document.createElement('div');
    sender.className = 'msg-sender';
    sender.textContent = 'Agent';
    msgDiv.appendChild(sender);
    appendToChatMessages(msgDiv);
    G._agentHeaderShown = true;
}

function _cacheToolMessage(msg: any) {
    const id = 'tool_' + (msg.toolCallId || '');
    if (!G._liveMessages.some(m => m.id === id)) {
        G._liveMessages.push({
            id,
            role: 'tool',
            type: 'tool_call',
            content: JSON.stringify({ kind: msg.kind, title: msg.title, output: msg.content || msg.output, toolCallId: msg.toolCallId }),
            taskId: msg.taskId || G.activeTaskId || '',
            timestamp: Date.now(),
            phase: G.activeTaskPhase,
        });
    }
}

// ===== Working indicator =====

// ──────────── Stream Parser Integration ────────────

/** 上次处理的文本长度，用于增量解析 */
let _lastProcessedLen = 0;

export function resetStreamParser(): void {
  _lastProcessedLen = 0;
  resetFileMap();
  resetTestStatus();
  updateSummaryAreas();
  const marquee = document.getElementById('kcode-single-marquee');
  if (marquee) { marquee.className = 'kc-marquee'; marquee.textContent = ''; }
}

function updateMarquee(cls: string, text: string): void {
  const el = document.getElementById('kcode-single-marquee');
  if (!el) return;
  // 最多 120 字，长文本截断
  const displayText = text.length > 120 ? text.slice(0, 117) + '...' : text;
  el.textContent = displayText;
  el.className = 'kc-marquee active ' + cls;
}

function clearMarquee(): void {
  const el = document.getElementById('kcode-single-marquee');
  if (el) { el.className = 'kc-marquee'; el.textContent = ''; }
}

/** 文件图标映射 */
const FILE_ICONS: Record<string, string> = { reading: '📖', edited: '✏️', deleted: '🗑️' };

function updateFileBadges(): void {
  const container = document.getElementById('kcode-file-badges');
  if (!container) return;
  // 缓存已有 badge 元素
  const existing = new Map<string, HTMLElement>();
  container.querySelectorAll('.kc-file-badge').forEach(el => {
    const path = (el as HTMLElement).dataset.path;
    if (path) existing.set(path, el as HTMLElement);
  });

  const entries = Array.from(fileMap.values());
  // 删除已不在 fileMap 中的 badge
  for (const [path, el] of existing) {
    if (!fileMap.has(path)) el.remove();
  }

  for (const asset of entries) {
    let badge = existing.get(asset.path);
    const icon = FILE_ICONS[asset.status] || '📄';
    if (badge) {
      // 已有：原地刷新状态
      badge.className = `kc-file-badge status-${asset.status}`;
      const iconEl = badge.querySelector('.kc-file-icon');
      if (iconEl) iconEl.textContent = icon;
    } else {
      // 新建：啪地弹出
      badge = document.createElement('div');
      badge.className = `kc-file-badge status-${asset.status}`;
      badge.dataset.path = asset.path;
      badge.innerHTML = `<span class="kc-file-icon">${icon}</span><span class="kc-file-path">${escapeHtml(asset.path)}</span>`;
      container.appendChild(badge);
    }
  }
}

/** 测试状态指示灯 */
const TEST_LABELS: Record<string, string> = { vitest: '🧪 单元测试', tsc: '🧱 类型检查', eslint: '📐 代码规范' };
const DEFAULT_TEST_LABEL = '🧪 测试';

function updateTestBadges(): void {
  const container = document.getElementById('kcode-test-badges');
  if (!container) return;
  // testBadge 使用固定 key 'primary'
  let badge = container.querySelector('.kc-test-badge') as HTMLElement;
  const hasResult = testStatus.file || testStatus.total !== undefined;

  if (!hasResult) {
    if (badge) badge.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'kc-test-badge';
    container.appendChild(badge);
  }

  if (testStatus.pass && !testStatus.file && testStatus.total !== undefined) {
    // 汇总态：全部通过
    badge.className = 'kc-test-badge status-pass';
    badge.innerHTML = `✅ ${testStatus.total} passed`;
  } else if (!testStatus.pass && testStatus.failed !== undefined) {
    badge.className = 'kc-test-badge status-fail';
    badge.innerHTML = `❌ ${testStatus.failed} failed / ${testStatus.total}`;
  } else if (testStatus.file && testStatus.pass) {
    badge.className = 'kc-test-badge status-pass';
    badge.innerHTML = `✅ ${escapeHtml(testStatus.file)}`;
  } else if (testStatus.file && !testStatus.pass) {
    badge.className = 'kc-test-badge status-fail';
    badge.innerHTML = `❌ ${escapeHtml(testStatus.file)}`;
  }
}

function updateSummaryAreas(): void {
  updateFileBadges();
  updateTestBadges();
}

function parseNewContent(text: string): void {
  if (text.length <= _lastProcessedLen) return;
  const newPortion = text.slice(_lastProcessedLen);
  _lastProcessedLen = text.length;
  const lines = newPortion.split('\n');
  for (const rawLine of lines) {
    const result = parseLine(rawLine);
    switch (result.type) {
      case 'thinking':
        updateMarquee('thinking', result.text);
        break;
      case 'terminal':
        updateMarquee('terminal', result.text);
        break;
      case 'file_op':
        updateSummaryAreas();
        break;
      case 'test_output':
        updateSummaryAreas();
        break;
      // 'normal' 不做处理，交给正常渲染
    }
  }
}

// ──────────── End Stream Parser Integration ────────────

export function __resetStream() {
    if (G.streamMessageEl && latestStreamText) {
        G._liveMessages.push({
            id: 'agent_' + Date.now(),
            role: 'agent',
            content: latestStreamText,
            taskId: G.activeTaskId || '',
            timestamp: Date.now(),
            phase: G.activeTaskPhase,
        });
    }
    G.streamMessageEl = null;
    G._agentHeaderShown = false;
    resetStreamParser();
}

export function showAgentThinking() {
    const indicator = getWorkingIndicator();
    if (!indicator) return;
    const container = getChatMessages();
    const scrollContainer = getChatScroll();
    if (!container || !scrollContainer) return;

    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    indicator.classList.remove('hidden');
    const textEl = indicator.querySelector('.working-text') as HTMLElement;
    if (textEl) textEl.textContent = '思考中';
    if (indicator.parentElement === container) {
        container.appendChild(indicator);
    }
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function updateWorkingIndicator(msg: any) {
    const indicator = getWorkingIndicator();
    if (!indicator || indicator.classList.contains('hidden')) return;
    const textEl = indicator.querySelector('.working-text') as HTMLElement;
    if (!textEl) return;
    const status = msg.status || 'pending';
    const isRunning = status === 'running' || status === 'pending';
    if (isRunning && msg.title) {
        textEl.textContent = msg.title;
    } else if (!isRunning) {
        textEl.textContent = '思考中';
    }
}

export function hideWorkingIndicator() {
    const indicator = getWorkingIndicator();
    if (indicator) indicator.classList.add('hidden');
}

// ===== Append to chat =====

export function updateLastMsgConvertBtn() {
    if (G.activeTaskType !== 'assistant') return;
    const messages = getChatMessages();
    if (!messages) return;
    const agentMsgs = messages.querySelectorAll('.chat-msg.agent');
    if (agentMsgs.length === 0) return;

    messages.querySelectorAll('.convert-task-btn').forEach(el => el.remove());
    const lastAgent = agentMsgs[agentMsgs.length - 1] as HTMLElement;
    const row = lastAgent.querySelector('.msg-row') as HTMLElement;
    if (!row) return;
    const btn = document.createElement('button');
    btn.className = 'convert-task-btn';
    btn.title = '将当前对话转为正式任务';
    btn.textContent = '🌿 转为任务';
    btn.addEventListener('click', () => {
        G.vscode.postMessage({ type: 'convertAssistantToTask' });
    });
    row.appendChild(btn);
}

function _getOrCreatePhaseGroup(phase: string): HTMLElement {
    const container = getChatMessages()!;
    let group = container.querySelector(`.tv4-phase-group[data-phase="${phase}"]`) as HTMLElement | null;
    if (!group) {
        group = document.createElement('div');
        group.className = 'tv4-phase-group';
        group.dataset.phase = phase;
        const indicator = getWorkingIndicator();
        if (indicator && indicator.parentElement === container) {
            container.insertBefore(group, indicator);
        } else {
            container.appendChild(group);
        }
    }
    return group;
}

/** 在 stream 消息之前插入（用于合并条目保持正确时序） */
function _insertBeforeStreamMsg(el: Element): boolean {
    const ref = G.streamMessageEl ? G.streamMessageEl.closest('.chat-msg') : null;
    if (ref && ref.parentElement) {
        ref.parentElement.insertBefore(el, ref);
        return true;
    }
    return false;
}

export function appendToChatMessages(el: Element) {
    const container = getChatMessages()!;
    const phase = (el as HTMLElement).dataset.phase;
    if (phase) {
        const group = _getOrCreatePhaseGroup(phase);
        const indicator = getWorkingIndicator();
        if (indicator && indicator.parentElement === group) {
            group.insertBefore(el, indicator);
        } else {
            group.appendChild(el);
        }
    } else {
        const indicator = getWorkingIndicator();
        if (indicator && indicator.parentElement === container) {
            container.insertBefore(el, indicator);
        } else {
            container.appendChild(el);
        }
    }
    updateLastMsgConvertBtn();
    groupPhases();
}

// ===== Stream handlers =====

export function handleAgentStreamUpdate(text: string) {
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    // 前置解析：提取文件/测试资产，中间态进 marquee
    parseNewContent(text);

    if (!G.streamMessageEl) {
        resetTabGroup();
        _ensureAgentHeader();

        G._userScrolledUp = false;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg agent';
        if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        msgDiv.appendChild(bubble);

        appendToChatMessages(msgDiv);
        G.streamMessageEl = bubble;
    }

    latestStreamText = text;
    if (!streamRenderPending) {
        streamRenderPending = true;
        requestAnimationFrame(() => {
            streamRenderPending = false;
            if (G.streamMessageEl) {
                G.streamMessageEl.innerHTML = renderMarkdown(latestStreamText);
                if (!G._userScrolledUp) {
                    G._programmaticScroll = true;
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                    requestAnimationFrame(() => { G._programmaticScroll = false; });
                }
            }
        });
    }
}

export function handleAgentStatus(status: string, message: string, agentName: string, modelName?: string) {
    const headerDot = document.getElementById('header-agent-dot');
    if (headerDot) {
        headerDot.className = 'agent-dot ' + (status === 'connected' ? 'online' : 'offline');
        headerDot.title = message;
    }
    if (modelName) {
        G.activeModelName = modelName;
        const modelBadge = document.getElementById('task-model-badge');
        if (modelBadge && G.activeTaskType === 'assistant') {
            modelBadge.textContent = modelName;
            modelBadge.classList.remove('hidden');
        }
    }
    if (status === 'connected') {
        const headerAgentName = document.getElementById('header-agent-name');
        if (headerAgentName) headerAgentName.textContent = agentName;
        const headerModelName = document.getElementById('header-model-name');
        if (headerModelName && modelName) {
            headerModelName.textContent = truncateModel(modelName);
            headerModelName.title = modelName;
        }
    }
}

export function flushMerge() {
    if (!_mergeState) return;
    const { thinkingTitle, thinkingBody, tools } = _mergeState;
    if (tools.length > 0) {
        const mergedEntry = createMergedTimelineEntry({ title: thinkingTitle, content: thinkingBody }, tools);
        const existingMerge = document.querySelector('.tl-entry.tl-merged');
        if (existingMerge) {
            const msgDiv = existingMerge.closest('.chat-msg');
            if (msgDiv) msgDiv.remove();
        }
        const thinkingEntry = document.querySelector(`.tl-entry[data-tl-id="${_mergeState.thinkingId}"]`);
        if (thinkingEntry) {
            const thinkingMsgDiv = thinkingEntry.closest('.chat-msg');
            if (thinkingMsgDiv) thinkingMsgDiv.remove();
        }
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';
        if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(mergedEntry);
        msgDiv.appendChild(bubble);
        // 合并条目插到 stream 消息之前，避免跑到 AI 回复后面
        if (!_insertBeforeStreamMsg(msgDiv)) {
            appendToChatMessages(msgDiv);
        }
    }
    _mergeState = null;
}

/** 是否为终端探测命令（应走 marquee 而非独立 DOM） */
const PROBE_CMDS = ['ls', 'find', 'which', 'cat', 'head', 'tail', 'pwd', 'grep'];
function isProbeCommand(title: string): boolean {
  const t = (title || '').trim().toLowerCase();
  return PROBE_CMDS.some(cmd => t === cmd || t.startsWith(cmd + ' '));
}

export function handleToolCallUpdate(msg: any) {
    _ensureAgentHeader();
    _cacheToolMessage(msg);
    const container = getChatMessages()!;
    const scrollContainer = getChatScroll()!;
    scrollContainer.classList.remove('chat-empty');
    const placeholder = container.querySelector('.chat-placeholder');
    if (placeholder) placeholder.remove();

    const toolId = msg.toolCallId;
    const kind = msg.kind || '';
    const rawContent = msg.content || msg.output || '';

    // 终端探测命令 → marquee 实时闪烁（同时保留完整 DOM 记录，可随时回溯）
    if ((kind === 'command' || kind === 'bash' || kind === 'terminal') && msg.title) {
      if (isProbeCommand(msg.title)) {
        updateMarquee('terminal', `$ ${msg.title}`);
      }
      // 无论是否探测命令，都解析输出中的文件/测试资产
      if (rawContent) {
        for (const line of rawContent.split('\n')) {
          const r = parseLine(line);
          if (r.type === 'file_op' || r.type === 'test_output') updateSummaryAreas();
        }
      }
    }

    if (kind === 'todowrite' || _isTodoArray(rawContent)) {
        flushMerge();
        _tabGroup = null;
        if (activeToolCallElements.has(toolId)) {
            const existingEl = activeToolCallElements.get(toolId)!;
            const raw = msg.content || msg.output || '';
            const body = existingEl.querySelector('.msg-card-body');
            if (body && raw) body.innerHTML = buildTodoBodyHtml(raw, toolId, msg.taskId || G.activeTaskId || '');
            const header = existingEl.querySelector('.msg-card-header-text');
            if (header) {
                const { done, total } = _parseTodoStr(raw);
                const svg = '<span class="tool-kind-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 5h12v2H2V7zm0 5h8v2H2v-2z"/></svg></span>';
                header.innerHTML = svg + '<span class="tool-title-label">待办清单</span> <span class="todo-header-progress">' + done + '/' + total + '</span>';
            }
        } else {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            msgDiv.dataset.msgId = 'tool_' + toolId;
            if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble tool-bubble';
            msgDiv.appendChild(bubble);
            renderToolBubbleContent(bubble, {
                toolCallId: toolId, kind: 'todowrite', title: msg.title || '待办清单',
                status: msg.status || 'running', content: msg.content || msg.output || '',
                taskId: msg.taskId || G.activeTaskId || '',
            });
            appendToChatMessages(msgDiv);
            activeToolCallElements.set(toolId, msgDiv);
        }
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (kind === 'thinking') {
        const preMergeThinkingId = _mergeState?.thinkingId;
        const preMergeHasTools = _mergeState && _mergeState.tools.length > 0;
        flushMerge();
        if (preMergeHasTools && preMergeThinkingId === toolId) {
            updateWorkingIndicator(msg);
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            return;
        }
        const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
        if (existingEntry) {
            const bodyPre = existingEntry.querySelector('.tl-entry-body pre');
            if (bodyPre) bodyPre.textContent = msg.content || msg.output || '';
            const content = msg.content || msg.output || '';
            let preview = existingEntry.querySelector('.tl-thinking-preview') as HTMLElement | null;
            if (content) {
                if (!preview) {
                    preview = document.createElement('div');
                    preview.className = 'tl-thinking-preview';
                    preview.textContent = content.split('\n')[0].trim();
                    const header = existingEntry.querySelector('.tl-entry-header');
                    if (header) header.insertAdjacentElement('afterend', preview);
                    else existingEntry.querySelector('.tl-entry-main')?.insertBefore(preview, existingEntry.querySelector('.tl-entry-body'));
                } else {
                    preview.classList.remove('hidden');
                    preview.textContent = content.split('\n')[0].trim();
                }
            }
        } else {
            const entry = createTimelineEntry({
                toolCallId: toolId, kind, title: msg.title || '',
                status: msg.status || '', content: msg.content || msg.output || '',
                taskId: msg.taskId || G.activeTaskId || '',
            });
            entry.dataset.tlId = toolId;
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            msgDiv.dataset.msgId = 'tool_' + toolId;
            if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.appendChild(entry);
            msgDiv.appendChild(bubble);
            appendToChatMessages(msgDiv);
            showTlFilterBar();
        }
        _mergeState = {
            thinkingId: toolId,
            thinkingTitle: existingEntry
                ? (existingEntry.querySelector('.tl-entry-title')?.textContent || '思考')
                : forceTitle('thinking', msg.title || '思考'),
            thinkingBody: msg.content || msg.output || '',
            tools: [],
            phase: G.activeTaskPhase,
        };
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    if (_mergeState && (!_mergeState.phase || _mergeState.phase === G.activeTaskPhase)) {
        const toolInfo = { kind, title: msg.title || '', content: msg.content || msg.output || '', status: msg.status || '' };
        const existingIdx = _mergeState.tools.findIndex((t: any) => t.toolId === toolId);
        if (existingIdx >= 0) {
            _mergeState.tools[existingIdx] = { ..._mergeState.tools[existingIdx], ...toolInfo };
            const status = msg.status || '';
            if (status === 'running' || status === 'failed' || status === 'error') {
                const mergedEntry = createMergedTimelineEntry(
                    { title: _mergeState.thinkingTitle, content: _mergeState.thinkingBody },
                    _mergeState.tools
                );
                const existingMerge = document.querySelector('.tl-entry.tl-merged');
                if (existingMerge) {
                    const msgDiv = existingMerge.closest('.chat-msg');
                    if (msgDiv) msgDiv.remove();
                }
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-msg tool';
                if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
                const bubble = document.createElement('div');
                bubble.className = 'msg-bubble';
                bubble.appendChild(mergedEntry);
                msgDiv.appendChild(bubble);
                if (!_insertBeforeStreamMsg(msgDiv)) appendToChatMessages(msgDiv);
            }
        } else {
            _mergeState.tools.push({ toolId, ...toolInfo });
            const thinkingEntry = document.querySelector(`.tl-entry[data-tl-id="${_mergeState.thinkingId}"]`);
            if (thinkingEntry) {
                const thinkingMsgDiv = thinkingEntry.closest('.chat-msg');
                if (thinkingMsgDiv) thinkingMsgDiv.remove();
            }
            const existingMerge = document.querySelector('.tl-entry.tl-merged');
            if (existingMerge) {
                const msgDiv = existingMerge.closest('.chat-msg');
                if (msgDiv) msgDiv.remove();
            }
            const mergedEntry = createMergedTimelineEntry(
                { title: _mergeState.thinkingTitle, content: _mergeState.thinkingBody },
                _mergeState.tools
            );
            const msgDiv = document.createElement('div');
            msgDiv.className = 'chat-msg tool';
            if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
            const bubble = document.createElement('div');
            bubble.className = 'msg-bubble';
            bubble.appendChild(mergedEntry);
            msgDiv.appendChild(bubble);
            appendToChatMessages(msgDiv);
        }
        showTlFilterBar();
        updateWorkingIndicator(msg);
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        return;
    }

    const existingEntry = document.querySelector(`.tl-entry[data-tl-id="${toolId}"]`);
    if (existingEntry) {
        const body = existingEntry.querySelector('.tl-entry-body');
        const newContent = msg.content || msg.output || '';
        if (body && newContent) {
            const pre = body.querySelector('pre');
            if (pre) pre.textContent = newContent;
            // 有内容时自动展开，无论状态如何
            if (!body.classList.contains('open')) {
                body.classList.add('open');
                const expand = existingEntry.querySelector('.tl-entry-expand');
                if (expand) expand.classList.add('open');
            }
        }
    } else {
        const entry = createTimelineEntry({
            toolCallId: toolId, kind, title: msg.title || '',
            status: msg.status || '', content: msg.content || msg.output || '',
            taskId: msg.taskId || G.activeTaskId || '',
        });
        // 新条目默认展开 body
        const body = entry.querySelector('.tl-entry-body');
        if (body && (msg.content || msg.output)) body.classList.add('open');
        entry.dataset.tlId = toolId;
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-msg tool';
        msgDiv.dataset.msgId = 'tool_' + toolId;
        if (G.activeTaskPhase) msgDiv.dataset.phase = G.activeTaskPhase;
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.appendChild(entry);
        msgDiv.appendChild(bubble);
        appendToChatMessages(msgDiv);
        showTlFilterBar();
    }

    updateWorkingIndicator(msg);
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

(window as any).__resetStream = __resetStream;
