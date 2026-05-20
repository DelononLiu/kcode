import * as vscode from 'vscode';
import { getInlineStyles } from './chatPanelCss';

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, agents?: { label: string; type: string }[]): string {
    const scriptUri = (name: string) => webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', `${name}.js`)
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
    <div id="container">
        <!-- Middle Panel — Chat -->
        <div id="chat-area">
            <div id="chat-header">
                <!-- Row 1: Title + type + status + secondary info -->
                <div id="chat-header-row1">
                    <span class="task-info-title">选择任务开始对话</span>
                    <span id="task-status-badge" class="task-status-badge hidden"></span>
                </div>
                <div id="chat-header-sub">
                    <span id="task-info-created"></span>
                    <span id="task-info-sep" class="hidden">|</span>
                    <span id="task-info-review"></span>
                </div>

                <!-- Row 2: Goal + confirmed tags -->
                <div id="chat-header-row2" class="hidden">
                    <span class="header-label">🎯</span>
                    <span id="goal-header-text" class="goal-header-text"></span>
                    <div id="confirmed-tags" class="confirmed-tags"></div>
                </div>

                <!-- Row 3: Phase + progress bar -->
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
                </div>

                <div id="hooks-editor" class="hooks-editor hidden">
                    <div class="hooks-editor-header">
                        <span class="hooks-editor-title">阶段提示词命令</span>
                        <button id="hooks-close-btn" class="hooks-close-btn" title="关闭">✕</button>
                    </div>
                    <div id="hooks-phases-list"></div>
                </div>
            </div>

            <div id="chat-body">
                <div id="node-timeline-gutter" class="hidden">
                    <div id="tl-dots"></div>
                </div>
                <div id="chat-scroll" class="chat-empty">
                    <div id="chat-messages">
                    <div id="tl-filter-bar" class="tl-filter-bar hidden">
                        <button class="tl-filter-btn active" data-tl-filter="all">全部</button>
                        <button class="tl-filter-btn" data-tl-filter="thinking">💭 思考</button>
                        <button class="tl-filter-btn" data-tl-filter="file">📄 文件</button>
                        <button class="tl-filter-btn" data-tl-filter="command">💻 命令</button>
                        <button class="tl-filter-btn" data-tl-filter="search">🔍 搜索</button>
                    </div>
                    <div id="working-indicator" class="hidden">
                        <span class="working-spinner"></span>
                        <span class="working-text">思考中</span>
                    </div>
                </div>
            </div>
            <div id="chat-nav-btns" class="hidden">
                <button id="nav-top-btn" class="chat-nav-btn nav-top-btn" title="回到顶部">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 13V5M4 9l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <button id="nav-prev-btn" class="chat-nav-btn" title="上一条用户消息">↑</button>
                <button id="nav-next-btn" class="chat-nav-btn" title="下一条用户消息">↓</button>
                <button id="nav-bottom-btn" class="chat-nav-btn nav-bottom-btn" title="回到底部">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v8M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            </div>

            <div id="chat-bottom">
                <div id="chat-toolbar">
                    <button id="btn-knowledge-extract" class="toolbar-btn hidden" title="从当前任务萃取知识">📚 知识萃取</button>
                    <button id="acp-log-btn" class="toolbar-btn" title="查看 ACP 协议日志">🔍 查看日志</button>
                    <button id="btn-terminal" class="toolbar-btn" title="打开终端">💻 打开终端</button>
                </div>
                <div id="chat-input-area">
                    <div id="queue-bar" class="hidden">
                        <div class="queue-header" id="queue-header">
                            <span id="queue-summary"></span>
                            <button id="queue-toggle" class="queue-action-btn"></button>
                            <button id="queue-clear-all" class="queue-action-btn queue-clear" title="全部取消">全部取消</button>
                        </div>
                        <div id="queue-list" class="hidden"></div>
                    </div>
                    <div class="input-wrapper">
                        <textarea id="chat-input" placeholder="提出后续修改要求"></textarea>
                        <div class="input-footer">
                            <div class="input-footer-left">
                                <span class="status-item">
                                    <span id="agent-status-dot" class="status-dot offline"></span>
                                    <div class="agent-dropdown" id="agent-dropdown">
                                        <button class="agent-dropdown-btn" id="agent-dropdown-btn">
                                            <span id="agent-dropdown-label">Agent</span>
                                            <svg class="agent-dropdown-arrow" width="8" height="5" viewBox="0 0 8 5"><path d="M1 1l3 3 3-3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                        </button>
                                        <ul class="agent-dropdown-list hidden" id="agent-dropdown-list"></ul>
                                    </div>
                                </span>
                                <span class="status-divider"></span>
                                <div id="input-template-bar"></div>
                            </div>
                            <div class="input-footer-right">
                                <button class="input-tool-btn image-btn" title="图片">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
                                        <circle cx="5" cy="6" r="1.5" fill="currentColor"/>
                                        <path d="M1.5 11l3.5-3 2.5 2 3-3 3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                                    </svg>
                                </button>
                                <button class="input-tool-btn attach-btn" title="附件">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 3v7a2 2 0 004 0V4.5a3.5 3.5 0 00-7 0V10a4.5 4.5 0 009 0V3h-1v7a3.5 3.5 0 01-7 0V4.5a2.5 2.5 0 015 0V10a1 1 0 01-2 0V3H8z" fill="currentColor"/>
                                    </svg>
                                </button>
                                <button id="send-btn" class="input-tool-btn" title="发送">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M2 14L14 8L2 2v4.5l6 1.5-6 1.5V14z" fill="currentColor"/>
                                    </svg>
                                </button>
                                <button id="stop-btn" class="input-tool-btn hidden" title="停止生成">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor"/>
                                    </svg>
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Right Output Panel — vertical sections, collapse via edge handle -->
        <div id="output-resize-handle" class="output-resize-handle"></div>
        <div id="right-output-panel">
            <div id="right-output-content">
                <div class="op-section">
                    <div class="op-section-title">TODO区</div>
                    <div id="op-plan-list"><div class="op-empty">暂无待办</div></div>
                </div>
                <div class="op-section">
                    <div class="op-section-title">变更列表</div>
                    <div id="op-code-list"><div class="op-empty">暂无变更</div></div>
                </div>
                <div class="op-section" style="padding-bottom:4px">
                    <div class="op-section-title">
                        <span>知识wiki</span>
                        <button id="op-export-btn" class="op-export-btn hidden" title="导出对话内容到项目 Wiki">📤 导出 Wiki</button>
                    </div>
                    <div id="op-knowledge-list"><div class="op-empty">暂无知识</div></div>
                </div>
            </div>
        </div>

        <!-- Overlay Right Panel — Diff / ACP Log -->
        <div id="right-panel" class="hidden">
            <div id="right-panel-header">
                <div class="tabs">
                    <button class="tab active" data-tab="diff">Diff</button>
                    <button class="tab" data-tab="device">Device</button>
                    <button class="tab" data-tab="acplog">ACP Log</button>
                </div>
                <button id="right-panel-close" class="close-btn" title="关闭右侧面板">✕</button>
            </div>
            <div id="right-panel-content">
                <div id="tab-diff" class="tab-content active">Diff</div>
                <div id="tab-device" class="tab-content">
                    <div id="device-connect-form">
                        <div class="device-field-row">
                            <select id="device-preset-select">
                                <option value="">— 从配置加载 —</option>
                            </select>
                        </div>
                        <div style="border-top:1px solid rgba(255,255,255,.06);margin:4px 0 8px;"></div>
                        <div class="device-field-row">
                            <select id="device-type">
                                <option value="ssh">SSH</option>
                                <option value="telnet">Telnet</option>
                                <option value="adb">ADB</option>
                                <option value="local">Local</option>
                            </select>
                        </div>
                        <div class="device-field-row" id="device-host-row">
                            <input id="device-host" type="text" placeholder="主机地址">
                        </div>
                        <div class="device-field-row" id="device-port-row">
                            <input id="device-port" type="number" placeholder="端口">
                        </div>
                        <div class="device-field-row device-auth-row" id="device-username-row">
                            <input id="device-username" type="text" placeholder="用户名">
                        </div>
                        <div class="device-field-row device-auth-row" id="device-password-row">
                            <input id="device-password" type="password" placeholder="密码">
                        </div>
                        <div class="device-field-row device-auth-row" id="device-key-row" style="display:none;">
                            <input id="device-key-path" type="text" placeholder="私钥路径">
                        </div>
                        <div class="device-btn-row">
                            <button id="btn-device-connect" class="device-btn primary">连接</button>
                        </div>
                    </div>
                    <div id="device-connected-view" style="display:none;">
                        <div id="device-connected-header">
                            <span id="device-status-indicator" class="device-status-ok">●</span>
                            <span id="device-connected-label"></span>
                            <button id="btn-device-disconnect" class="device-btn small danger">断开</button>
                        </div>
                        <div id="device-terminal">
                            <div id="device-output"></div>
                            <div id="device-input-row">
                                <span id="device-prompt">$</span>
                                <input id="device-command-input" type="text" placeholder="输入命令...">
                                <button id="btn-device-send" class="device-btn small">发送</button>
                            </div>
                        </div>
                    </div>
                    <div id="device-status-bar">
                        <span id="device-connection-status">未连接</span>
                    </div>
                </div>
                <div id="tab-acplog" class="tab-content">
                    <div id="acp-log-toolbar">
                        <label><input type="checkbox" id="acp-log-enable"> 采集日志</label>
                        <button id="acp-log-clear" class="toolbar-btn">清空</button>
                    </div>
                    <div id="acp-log-content"></div>
                </div>
            </div>
        </div>
    </div>

    <div id="__panelData"
         data-available-agents="${escapeAttr(JSON.stringify(agents || []))}"
         style="display:none"></div>
    <script src="${scriptUri('app.bundle')}"></script>
    <script src="${scriptUri('outputPanel')}"></script>
    <script src="${scriptUri('device.bundle')}"></script>
</body>
</html>`;
}
