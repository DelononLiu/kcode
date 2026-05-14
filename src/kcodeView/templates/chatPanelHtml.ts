import * as vscode from 'vscode';
import { getInlineStyles } from './chatPanelCss';

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, allTasks?: any[]): string {
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
                    <div class="chat-placeholder">输入需求，开始与 AI 对话</div>
                    <div id="working-indicator" class="hidden">
                        <span class="working-spinner"></span>
                        <span class="working-text">思考中</span>
                    </div>
                </div>
            </div>
            <div id="chat-nav-btns" class="hidden">
                <button id="nav-prev-btn" class="chat-nav-btn" title="上一条用户消息">↑</button>
                <button id="nav-next-btn" class="chat-nav-btn" title="下一条用户消息">↓</button>
                <button id="nav-bottom-btn" class="chat-nav-btn nav-bottom-btn" title="回到底部">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 3v8M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div id="dashboard-panel" class="hidden">
                <div class="dashboard-title">📊 KCode 工作台</div>
                <div id="dashboard-review-section" class="dp-section" style="display:none">
                    <div class="dp-section-header">⚠️ 待验收</div>
                    <div id="dashboard-review-list" class="dp-list"></div>
                </div>
                <div id="dashboard-active-section" class="dp-section" style="display:none">
                    <div class="dp-section-header dp-collapsible" data-target="dashboard-active-body">
                        <span class="dp-arrow">▶</span> 进行中
                    </div>
                    <div id="dashboard-active-body" class="dp-body">
                        <div id="dashboard-active-list" class="dp-list"></div>
                    </div>
                </div>
                <div id="dashboard-completed-section" class="dp-section" style="display:none">
                    <div class="dp-section-header dp-collapsible" data-target="dashboard-completed-body">
                        <span class="dp-arrow">▶</span> 最近完成
                    </div>
                    <div id="dashboard-completed-body" class="dp-body">
                        <div id="dashboard-completed-list" class="dp-list"></div>
                    </div>
                </div>
                <div id="dashboard-empty-msg" class="dp-empty" style="display:none">暂无任务，点击下方按钮创建</div>
            </div>
            </div>

            <div id="chat-bottom">
                <div id="chat-toolbar">
                    <button id="btn-new-task" class="toolbar-btn" title="新建任务">新任务</button>
                    <button id="btn-dashboard" class="toolbar-btn" title="打开工作台">工作台</button>
                    <button id="hooks-toolbar-btn" class="toolbar-btn" title="编辑阶段提示词命令">任务钩子</button>
                    <button id="acp-log-btn" class="toolbar-btn" title="查看 ACP 协议日志">查看日志</button>
                    <button id="btn-terminal" class="toolbar-btn" title="打开终端">打开终端</button>
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
                                    <span id="status-model">Agent</span>
                                </span>
                                <span class="status-divider"></span>
                                <div id="input-category-bar"></div>
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
                    <div class="op-section-title">变更列表</div>
                    <div id="op-code-list"><div class="op-empty">暂无变更</div></div>
                </div>
                <div class="op-section">
                    <div class="op-section-title">知识wiki</div>
                    <div id="op-knowledge-list"><div class="op-empty">暂无知识</div></div>
                </div>
                <div class="op-section">
                    <div class="op-section-title">TODO区</div>
                    <div id="op-plan-list"><div class="op-empty">暂无待办</div></div>
                </div>
                <div class="op-section">
                    <div class="op-section-title">工具调用</div>
                    <div id="op-tool-list"><div class="op-empty">暂无工具调用</div></div>
                </div>
            </div>
        </div>

        <!-- Overlay Right Panel — Diff / Preview / ACP Log -->
        <div id="right-panel" class="hidden">
            <div id="right-panel-header">
                <div class="tabs">
                    <button class="tab active" data-tab="preview">Preview</button>
                    <button class="tab" data-tab="diff">Diff</button>
                    <button class="tab" data-tab="acplog">ACP Log</button>
                    <button class="tab disabled" data-tab="device" title="即将推出">Device</button>
                </div>
                <button id="right-panel-close" class="close-btn" title="关闭右侧面板">✕</button>
            </div>
            <div id="right-panel-content">
                <div id="tab-preview" class="tab-content active">Preview</div>
                <div id="tab-diff" class="tab-content">Diff</div>
                <div id="tab-acplog" class="tab-content">
                    <div id="acp-log-toolbar">
                        <label><input type="checkbox" id="acp-log-enable"> 采集日志</label>
                        <button id="acp-log-clear" class="toolbar-btn">清空</button>
                    </div>
                    <div id="acp-log-content"></div>
                </div>
                <div id="tab-device" class="tab-content">Device</div>
            </div>
        </div>
    </div>

    <div id="__panelData"
         data-all-tasks="${escapeAttr(JSON.stringify(allTasks || []))}"
         style="display:none"></div>
    <script src="${scriptUri('app.bundle')}"></script>
    <script src="${scriptUri('preview')}"></script>
    <script src="${scriptUri('outputPanel')}"></script>
</body>
</html>`;
}
