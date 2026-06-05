import * as vscode from 'vscode';
import { getInlineStyles } from './chatPanelCss';

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
}

function svgIcon(name: string): string {
    const icons: Record<string, string> = {
        cube: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        send: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
        warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9b26" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };
    return icons[name] || '';
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, agents?: { label: string; type: string }[], _viewMode?: string): string {
    const scriptUri = (name: string) => webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'view', 'webview', `${name}.js`)
    ).toString();
    const inlineStyles = getInlineStyles();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>${inlineStyles}</style>
    <title>KCode</title>
</head>
<body>

<!-- ========== Assistant View (V1 — 小助手) ========== -->
<div id="assistant-view">
    <div id="container">
        <div id="chat-area">
            <div id="chat-header">
                <div id="chat-header-row1">
                    <span class="task-info-title">选择任务开始对话</span>
                    <span id="chat-header-slogan" class="hidden">专业陪聊 · 答疑解惑 · 出谋划策 · 代码评审</span>
                    <span id="task-status-badge" class="task-status-badge hidden"></span>
                    <span id="task-model-badge" class="task-model-badge hidden"></span>
                </div>
                <div id="chat-header-sub">
                    <span id="task-info-created"></span>
                    <span id="task-info-sep" class="hidden">|</span>
                    <span id="task-info-review"></span>
                </div>
                <div id="chat-header-row2" class="hidden">
                    <span class="header-label">🎯</span>
                    <span id="goal-header-text" class="goal-header-text"></span>
                    <div id="confirmed-tags" class="confirmed-tags"></div>
                </div>
                <div id="chat-header-row3" class="hidden">
                    <span id="task-phase-badge" class="task-phase-badge"></span>
                    <span id="phase-desc" class="phase-desc"></span>
                    <div id="phase-confirm-btns">
                        <button id="goal-confirm-btn" class="plan-confirm-btn hidden">确认目标 ✓</button>
                        <button id="plan-confirm-btn" class="plan-confirm-btn hidden">确认计划</button>
                        <button id="execute-confirm-btn" class="plan-confirm-btn hidden">确认完成 ✓</button>
                    </div>
                    <div id="plan-progress-header" class="plan-progress-header hidden">
                        <div class="plan-progress-bar"><div class="plan-progress-fill" id="header-progress-fill" style="width:0%"></div></div>
                        <span id="header-progress-label" class="plan-progress-label">0/0</span>
                    </div>
                    <button id="hooks-edit-btn" class="hooks-edit-btn" title="编辑阶段提示词">⚙️</button>
                    <span id="hooks-count" class="hooks-count hidden"></span>
                    <button id="terminal-replay-btn" class="hooks-edit-btn hidden" title="终端日志重放">💻 终端</button>
                </div>
                <div id="chat-header-row-assistant" class="hidden">
                    <span>智能体: <strong id="header-agent-name">-</strong></span>
                    <span class="header-sep">|</span>
                    <span>驱动模型: <strong id="header-model-name">-</strong></span>
                    <span class="header-sep">|</span>
                    <span id="header-codemap-status">Codewiki: 已连接</span>
                </div>
                <div id="hooks-editor" class="hooks-editor hidden">
                    <div class="hooks-editor-header">
                        <span class="hooks-editor-title">阶段提示词命令</span>
                        <button id="hooks-close-btn" class="hooks-close-btn">✕</button>
                    </div>
                    <div id="hooks-phases-list"></div>
                </div>
            </div>

            <div id="chat-body">
                <div id="node-timeline-gutter" class="hidden">
                    <div id="tl-dots"></div>
                </div>
                <div id="chat-scroll" class="chat-empty">
                    <div id="chat-messages"></div>
                    <div id="working-indicator" class="hidden">
                        <span class="working-spinner"></span>
                        <span class="working-text">思考中</span>
                    </div>
                </div>
            </div>

            <div id="chat-nav-btns" class="hidden">
                <button id="nav-top-btn" class="chat-nav-btn nav-top-btn" title="回到顶部">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V5M4 9l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button id="nav-prev-btn" class="chat-nav-btn" title="上一条用户消息">↑</button>
                <button id="nav-next-btn" class="chat-nav-btn" title="下一条用户消息">↓</button>
                <button id="nav-bottom-btn" class="chat-nav-btn nav-bottom-btn" title="回到底部">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v8M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </div>

            <div id="chat-bottom">
                <div id="chat-input-area">
                    <div id="queue-bar" class="hidden">
                        <div class="queue-header" id="queue-header">
                            <span id="queue-summary"></span>
                            <button id="queue-toggle" class="queue-action-btn"></button>
                            <button id="queue-clear-all" class="queue-action-btn queue-clear" title="全部取消">全部取消</button>
                        </div>
                        <div id="queue-list" class="hidden"></div>
                    </div>
                    <div id="system-narration" class="hidden"></div>
                    <div id="near-input-tools">
                        <button id="btn-knowledge-extract" class="near-tool-btn hidden" title="从当前任务萃取知识">📚 知识萃取</button>
                        <button id="acp-log-btn" class="near-tool-btn" title="查看 ACP 协议日志">🔍 查看日志</button>
                        <button id="btn-terminal" class="near-tool-btn" title="打开终端">💻 打开终端</button>
                    </div>
                    <div class="input-wrapper">
                        <textarea id="chat-input" placeholder="向小助手描述你的问题..."></textarea>
                        <div class="input-footer">
                            <div class="input-footer-left">
                                <span class="shortcut-hint">快捷指令: <code>/tasks</code> <code>/next</code> <code>/models</code></span>
                            </div>
                            <div class="input-footer-right">
                                <button class="input-tool-btn image-btn" title="图片">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><path d="M1.5 11l3.5-3 2.5 2 3-3 3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                                </button>
                                <button class="input-tool-btn attach-btn" title="附件">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v7a2 2 0 004 0V4.5a3.5 3.5 0 00-7 0V10a4.5 4.5 0 009 0V3h-1v7a3.5 3.5 0 01-7 0V4.5a2.5 2.5 0 015 0V10a1 1 0 01-2 0V3H8z" fill="currentColor"/></svg>
                                </button>
                                <button id="send-btn" class="input-tool-btn" title="发送">
                                    ${svgIcon('send')}
                                </button>
                                <button id="stop-btn" class="input-tool-btn hidden" title="停止生成">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<!-- ========== Task View (V4 — 单时间轴) ========== -->
<div id="task-view">

    <div class="tv4-init" id="tv4-init">
        <div class="tv4-init-logo">
            ${svgIcon('cube')}
            <span class="tv4-accent">KCode</span> Task
        </div>
        <div class="tv4-init-box">
            <textarea id="tv4-init-input" placeholder="输入原始工程任务..." rows="1" autofocus></textarea>
            <span class="tv4-enter-badge">↵ Enter</span>
        </div>
    </div>

    <div class="tv4-panel" id="tv4-panel">
        <header class="tv4-header">
            <span class="tv4-header-name" id="tv4-task-name">-</span>
            <span class="tv4-category-badge" id="tv4-category-badge"></span>
            <span class="tv4-status-badge" id="tv4-status">待确认</span>
            <span class="tv4-model-badge" id="tv4-model"></span>
            <div style="margin-left:auto;display:flex;align-items:center;gap:12px;font-size:11px;color:var(--text-dim)">
                <span>阶段 <span id="tv4-phase-count">0/6</span></span>
            </div>
        </header>
        <div class="tv4-header-row2" id="tv4-header-row2">
            <span class="tv4-h2-stage" id="h2-current-phase">⚡ 需求提取</span>
            <span class="tv4-h2-sep"></span>
            <span class="tv4-h2-group" id="h2-done-pipeline"></span>
            <span class="tv4-h2-group is-pending" id="h2-pending-pipeline"></span>
            <span class="tv4-h2-msgcount" id="h2-msg-count">💬 0</span>
        </div>

        <div class="tv4-scroll" id="tv4-scroll">
            <div id="chat-messages"></div>
        </div>

        <div class="tv4-input-area">
            <div id="tv4-queue-bar" class="hidden">
                <div class="queue-header" id="queue-header">
                    <span id="queue-summary"></span>
                    <button id="queue-toggle" class="queue-action-btn"></button>
                    <button id="queue-clear-all" class="queue-action-btn queue-clear" title="全部取消">全部取消</button>
                </div>
                <div id="queue-list" class="hidden"></div>
            </div>
            <div id="tv4-system-narration" class="hidden"></div>
            <div id="tv4-near-input-tools">
                <button id="tv4-btn-knowledge-extract" class="near-tool-btn hidden" title="从当前任务萃取知识">📚 知识萃取</button>
                <button id="tv4-acp-log-btn" class="near-tool-btn" title="查看 ACP 协议日志">🔍 查看日志</button>
                <button id="tv4-btn-terminal" class="near-tool-btn" title="打开终端">💻 打开终端</button>
            </div>
            <div class="tv4-input-wrapper">
                <textarea id="tv4-input" placeholder="输入指令与 AI 协作..." rows="1"></textarea>
                <div class="tv4-input-footer">
                    <div class="tv4-input-footer-left">
                        <span class="shortcut-hint">快捷指令: <code>/tasks</code> <code>/next</code> <code>/models</code></span>
                    </div>
                    <div class="tv4-input-footer-right">
                        <button class="tv4-input-tool-btn tv4-image-btn" title="图片">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/><circle cx="5" cy="6" r="1.5" fill="currentColor"/><path d="M1.5 11l3.5-3 2.5 2 3-3 3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
                        </button>
                        <button class="tv4-input-tool-btn tv4-attach-btn" title="附件">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v7a2 2 0 004 0V4.5a3.5 3.5 0 00-7 0V10a4.5 4.5 0 009 0V3h-1v7a3.5 3.5 0 01-7 0V4.5a2.5 2.5 0 015 0V10a1 1 0 01-2 0V3H8z" fill="currentColor"/></svg>
                        </button>
                        <button id="tv4-send-btn" class="tv4-input-tool-btn" title="发送">
                            ${svgIcon('send')}
                        </button>
                        <button id="tv4-stop-btn" class="tv4-input-tool-btn hidden" title="停止生成">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>



<!-- ========== Shared: Overlay Right Panel ========== -->
<div id="right-panel" class="hidden">
    <div id="right-panel-header">
        <div class="tabs">
            <button class="tab active" data-tab="diff">Diff</button>
            <button class="tab" data-tab="device">Device</button>
            <button class="tab" data-tab="acplog">ACP Log</button>
        </div>
        <button id="right-panel-close" class="close-btn">✕</button>
    </div>
    <div id="right-panel-content">
        <div id="tab-diff" class="tab-content active">Diff</div>
        <div id="tab-device" class="tab-content">
            <div id="device-connect-form">
                <div class="device-field-row"><select id="device-preset-select"><option value="">— 从配置加载 —</option></select></div>
                <div style="border-top:1px solid rgba(255,255,255,.06);margin:4px 0 8px;"></div>
                <div class="device-field-row"><select id="device-type"><option value="ssh">SSH</option><option value="telnet">Telnet</option><option value="adb">ADB</option><option value="local">Local</option></select></div>
                <div class="device-field-row" id="device-host-row"><input id="device-host" type="text" placeholder="主机地址"></div>
                <div class="device-field-row" id="device-port-row"><input id="device-port" type="number" placeholder="端口"></div>
                <div class="device-field-row" id="device-username-row"><input id="device-username" type="text" placeholder="用户名"></div>
                <div class="device-field-row" id="device-password-row"><input id="device-password" type="password" placeholder="密码"></div>
                <div class="device-btn-row"><button id="btn-device-connect" class="device-btn primary">连接</button></div>
            </div>
            <div id="device-connected-view" style="display:none">
                <div id="device-connected-header"><span id="device-status-indicator" class="device-status-ok">●</span><span id="device-connected-label"></span><button id="btn-device-disconnect" class="device-btn small danger">断开</button></div>
                <div id="device-terminal"><div id="device-output"></div><div id="device-input-row"><span id="device-prompt">$</span><input id="device-command-input" type="text" placeholder="输入命令..."><button id="btn-device-send" class="device-btn small">发送</button></div></div>
            </div>
            <div id="device-status-bar"><span id="device-connection-status">未连接</span></div>
        </div>
        <div id="tab-acplog" class="tab-content">
            <div id="acp-log-toolbar"><label><input type="checkbox" id="acp-log-enable"> 采集日志</label><button id="acp-log-clear" class="toolbar-btn">清空</button></div>
            <div id="acp-log-content"></div>
        </div>
    </div>
</div>

<div id="__panelData" data-available-agents="${escapeAttr(JSON.stringify(agents || []))}" style="display:none"></div>

<div id="plugin-manager-overlay" class="hidden">
    <div id="plugin-manager-dialog">
        <div id="plugin-manager-header"><span>🔌 插件管理</span><button id="plugin-manager-close" class="close-btn">✕</button></div>
        <div id="plugin-manager-body"><div class="plugin-manager-hint">加载中...</div></div>
    </div>
</div>

<script src="${scriptUri('app.bundle')}"></script>
<script src="${scriptUri('device.bundle')}"></script>
</body>
</html>`;
}
