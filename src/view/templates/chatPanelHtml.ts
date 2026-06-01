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

<!-- ========== Task View (V3 — 自主任务控制台) ========== -->
<div id="task-view">

    <!-- State A: Init Space -->
    <div class="init-space" id="init-screen">
        <div class="init-logo">
            ${svgIcon('cube')}
            <span class="accent">KCode</span> Task
        </div>
        <div class="center-input-box">
            <input type="text" id="initial-task-input" placeholder="输入原始工程任务..." autofocus>
            <span class="enter-badge">↵ Enter 下达任务</span>
        </div>
        <div class="init-hint">
            <span>⟲ 返回大本营</span>
        </div>
    </div>

    <!-- State B: Control Panel -->
    <div class="app-container" id="control-panel">
        <header class="header">
            <div class="header-title">
                ${svgIcon('cube')}
                <strong>KCode 任务面板</strong>
            </div>
            <span class="status-pill"><span style="animation:spin 2s linear infinite;display:inline-block">◌</span> <span id="header-status-text">任务攻坚中</span></span>Code
            <div class="header-meta-controls">
                <span class="header-capsule active" id="header-mode-capsule">✳ 需求开发</span>
                <span class="header-capsule" id="header-model-capsule">模型: Kilo</span>
                <div class="header-agent-select"><span class="agent-dot offline" id="header-agent-dot"></span></div>
            </div>
            <div style="margin-left:auto;color:var(--text-dim);font-size:12px;font-family:monospace;display:flex;align-items:center;gap:12px;">
                <span id="header-new-task" style="text-decoration:underline;cursor:pointer;display:flex;align-items:center;gap:4px;">${svgIcon('plus')} 新建其他任务</span>
                <span>|</span>
                <span>⏱️ 阶段: <span id="header-phase-count">0/6</span></span>
            </div>
        </header>

        <aside class="sidebar-rail">
            <div class="rail-track"></div>
            <div class="rail-track-active"></div>
            <div class="stage-node" data-stage="demand">D</div>
            <div class="stage-node" data-stage="goal">T</div>
            <div class="stage-node" data-stage="plan">P</div>
            <div class="stage-node" data-stage="execute">E</div>
            <div class="stage-node" data-stage="verify">V</div>
            <div class="stage-node" data-stage="review">C</div>
        </aside>

        <main class="main-task-board" id="main-task-board">
            <div style="margin-bottom:20px;">
                <div class="task-board-title">当前执行任务</div>
                <div class="task-board-task-name" id="task-board-task-name">-</div>
            </div>

            <div id="stage-cards">
                <div class="task-row" data-stage="demand">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">1. 需求提取 (REQUIREMENT)</span>
                        <span class="stage-badge" id="badge-demand"></span>
                        <span class="task-duration" id="dur-demand">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-demand">
                        <div id="demand-original-request" class="demand-original-request hidden">
                            <div class="demand-original-label">📋 原始需求</div>
                            <div class="demand-original-text" id="demand-original-text"></div>
                        </div>
                        <div id="demand-confirmed-list" class="demand-list"></div>
                        <div id="demand-pending-list" class="demand-list"></div>
                        <div id="demand-empty-hint" class="demand-empty-hint">添加初始需求项以启动任务</div>
                        <div class="stage-messages" id="stage-messages-demand"></div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-demand" placeholder="📝 需求补充..." data-stage="demand"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
                <div class="task-row" data-stage="goal">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">2. 目标锚定 (TARGET)</span>
                        <span class="stage-badge" id="badge-goal"></span>
                        <span class="task-duration" id="dur-goal">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-goal">
                        <div class="stage-messages" id="stage-messages-goal"></div>
                        <div style="color:var(--text-dim);font-size:12px">等待目标确认...</div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-goal" placeholder="🎯 目标调整..." data-stage="goal"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
                <div class="task-row" data-stage="plan">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">3. 计划编排 (PLANNING)</span>
                        <span class="stage-badge" id="badge-plan"></span>
                        <span class="task-duration" id="dur-plan">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-plan">
                        <div class="sandbox-toolbar" style="display:none"><span><strong>人机协同沙盘</strong></span><span>[ 📂 拖拽重排 ]</span><span>[ ✎ 双击编辑 ]</span><span>[ 🔒 锁定并执行 ]</span></div>
                        <div id="plan-substeps"></div>
                        <div class="stage-messages" id="stage-messages-plan"></div>
                        <div style="color:var(--text-dim);font-size:12px">等待计划生成...</div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-plan" placeholder="🔧 计划调整..." data-stage="plan"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
                <div class="task-row active" data-stage="execute">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">4. 代码执行 (EXECUTION)</span>
                        <span class="stage-badge" id="badge-execute"></span>
                        <span class="task-duration" id="dur-execute">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-execute">
                        <div style="font-size:13px;color:var(--warning);margin-bottom:8px;font-weight:500;display:none" id="exec-warning">${svgIcon('warning')} <span id="exec-warning-text">正在处理...</span></div>
                        <div class="terminal-block" id="exec-terminal" style="display:none"><div id="exec-terminal-lines"></div></div>
                        <div id="exec-messages" style="color:var(--text-dim);font-size:12px">等待开始执行...</div>
                        <div class="control-trigger-group" id="exec-controls" style="display:none">
                            <button class="btn-trigger warn" id="btn-time-travel">${svgIcon('clock')} 时间旅行 (回滚至此)</button>
                            <button class="btn-trigger" id="btn-pause">${svgIcon('pause')} 暂停管道监控</button>
                        </div>
                        <div class="inline-intervention-zone" id="exec-intervention" style="display:none">
                            <div class="zone-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> 就地追加局部微调指令 (可选)：</div>
                            <div class="inline-input-wrapper"><input type="text" id="inline-intervention-input" placeholder="只针对当前代码执行进行微调...">${svgIcon('send')}</div>
                        </div>
                        <div class="stage-messages" id="stage-messages-execute"></div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-execute" placeholder="💬 执行干预..." data-stage="execute"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
                <div class="task-row" data-stage="verify">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">5. 自动化自验 (VERIFY)</span>
                        <span class="stage-badge" id="badge-verify"></span>
                        <span class="task-duration" id="dur-verify">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-verify">
                        <div class="stage-messages" id="stage-messages-verify"></div>
                        <div style="color:var(--text-dim);font-size:12px">等待自验...</div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-verify" placeholder="🔍 分析失败..." data-stage="verify"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
                <div class="task-row" data-stage="review">
                    <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                        <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                        <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                        <span class="task-step-name">6. 最终签署 (CLOSE)</span>
                        <span class="stage-badge" id="badge-review"></span>
                        <span class="task-duration" id="dur-review">0s</span>
                    </div>
                    <div class="task-body" id="stage-body-review">
                        <div class="stage-messages" id="stage-messages-review"></div>
                        <div style="color:var(--text-dim);font-size:12px">等待验收...</div>
                        <div class="stage-input-row"><input type="text" class="stage-input" id="input-review" placeholder="📝 评审意见..." data-stage="review"><button class="stage-send-btn">发送</button></div>
                    </div>
                </div>
            </div>

            <!-- hidden containers for streaming backward compat -->
            <div id="chat-messages" style="display:none"></div>
            <div id="working-indicator" class="hidden" style="position:fixed;bottom:60px;right:60px;z-index:50">
                <span class="working-spinner"></span>
                <span class="working-text">思考中</span>
            </div>
        </main>

    </div>
</div>

<!-- ========== Shared: Card View (V3 breadcrumb + 3-column) ========== -->
<div id="card-view">
    <div id="card-header">
        <span id="card-header-title">选择任务开始对话</span>
        <span id="card-status-badge" class="task-status-badge hidden"></span>
        <span id="card-type-badge" class="hidden"></span>
    </div>
    <div id="card-breadcrumb">
        <div class="cdot" id="cdot-s"></div>
        <div class="cline" id="cl-1"></div>
        <div class="cseg seg-waiting" id="cseg-1">🎯 目标</div>
        <div class="csep sep-waiting" id="csep-1"></div>
        <div class="cseg seg-waiting" id="cseg-2">⚡ 执行</div>
        <div class="csep sep-waiting" id="csep-2"></div>
        <div class="cseg seg-waiting" id="cseg-3">✅ 验收</div>
        <div class="cline" id="cl-6"></div>
        <div class="cdot" id="cdot-e"></div>
    </div>
    <div id="card-columns">
        <div class="col-plan col-waiting" id="col-plan">
            <div class="col-header">🎯 目标 & 方案</div>
            <div class="col-body-1" id="col-body-1"><div class="col-empty">等待 AI 生成目标方案...</div></div>
        </div>
        <div class="col-exec col-waiting" id="col-exec">
            <div class="col-header">⚡ 执行 & 自检</div>
            <div class="col-body-2" id="col-body-2"><div class="col-empty">等待进入执行阶段...</div></div>
        </div>
        <div class="col-review col-waiting" id="col-review">
            <div class="col-header">✅ 变更验收</div>
            <div class="col-body-3" id="col-body-3"><div class="col-empty">等待验收阶段...</div></div>
        </div>
    </div>
    <div id="chat-body" class="hidden">
        <div id="chat-scroll">
            <div id="chat-messages"></div>
            <div id="working-indicator" class="hidden">
                <span class="working-spinner"></span>
                <span class="working-text">思考中</span>
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
<script src="${scriptUri('cardApp.bundle')}"></script>
<script src="${scriptUri('device.bundle')}"></script>
</body>
</html>`;
}
