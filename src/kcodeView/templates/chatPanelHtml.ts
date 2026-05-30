import * as vscode from 'vscode';
import { getInlineStyles } from './chatPanelCss';

function escapeAttr(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&#62;');
}

function svgIcon(name: string): string {
    const icons: Record<string, string> = {
        cube: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#04d361" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
        hourglass: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6l2 2-2 2v6"/><path d="M12 2v6l-2 2 2 2v6"/><rect x="4" y="2" width="16" height="20" rx="2"/></svg>',
        spinner: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
        circle: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>',
        warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff9b26" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
        send: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
        plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        dot: '<svg width="6" height="6" viewBox="0 0 6 6"><circle cx="3" cy="3" r="3" fill="currentColor"/></svg>',
    };
    return icons[name] || '';
}

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, agents?: { label: string; type: string }[], viewMode?: string): string {
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

<!-- ======== State A: Init Space ======== -->
<div class="init-space" id="init-screen">
    <div class="init-logo">
        ${svgIcon('cube')}
        <span class="accent">KCode</span> Task
    </div>
    <div class="center-input-box">
        <input type="text" id="initial-task-input" placeholder="输入原始工程任务（例如：帮我构造一个生成1-20数字并打印的Python脚本）..." autofocus>
        <span class="enter-badge">↵ Enter 下达任务</span>
    </div>
    <div class="init-hint">
        <span><span style="color:var(--warning)">✳</span> 需求开发</span>
        <span>● 问题分析</span>
        <span>◌ 代码评审</span>
        <span onclick="(window as any).resetToInput?.()">⟲ 返回大本营</span>
    </div>
</div>

<!-- ======== State B: Control Panel ======== -->
<div class="app-container" id="control-panel">

    <!-- Header -->
    <header class="header" id="app-header">
        <div class="header-title">
            ${svgIcon('cube')}
            <strong>KCODE 任务面板</strong>
        </div>
        <span class="status-pill" id="header-status-pill"><span id="header-spinner">${svgIcon('spinner')}</span> <span id="header-status-text">任务攻坚中</span></span>

        <div class="header-meta-controls" id="header-meta-controls">
            <span class="header-capsule active" id="header-mode-capsule">✳ 需求开发</span>
            <span class="header-capsule" id="header-model-capsule">模型: Kilo</span>
            <div class="header-agent-select" id="header-agent-select">
                <span class="agent-dot offline" id="header-agent-dot"></span>
            </div>
        </div>

        <div style="margin-left: auto; color: var(--text-dim); font-size: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; display: flex; align-items: center; gap: 12px;">
            <span id="header-new-task" style="text-decoration:underline; cursor:pointer; display:flex; align-items:center; gap:4px;">${svgIcon('plus')} 新建其他任务</span>
            <span>|</span>
            <span id="header-duration">⏱️ 阶段: <span id="header-phase-count">0/6</span></span>
        </div>
    </header>

    <!-- Sidebar Rail -->
    <aside class="sidebar-rail" id="sidebar-rail">
        <div class="rail-track" id="rail-track"></div>
        <div class="rail-track-active" id="rail-track-active"></div>
        <div class="stage-node" data-stage="demand">D</div>
        <div class="stage-node" data-stage="goal">T</div>
        <div class="stage-node" data-stage="plan">P</div>
        <div class="stage-node" data-stage="execute">E</div>
        <div class="stage-node" data-stage="verify">V</div>
        <div class="stage-node" data-stage="review">C</div>
    </aside>

    <!-- Main Task Board -->
    <main class="main-task-board" id="main-task-board">
        <div style="margin-bottom: 20px;">
            <div class="task-board-title">当前执行任务</div>
            <div class="task-board-task-name" id="task-board-task-name">-</div>
        </div>

        <!-- Stage Cards -->
        <div id="stage-cards">
            <!-- D: Demand -->
            <div class="task-row" data-stage="demand">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">1. 需求提取 (REQUIREMENT)</span>
                    <span class="task-duration" id="dur-demand">0s</span>
                </div>
                <div class="task-body" id="stage-body-demand">
                    <div style="color: var(--text-dim); font-size: 12px; font-style: italic;">等待任务启动...</div>
                </div>
            </div>

            <!-- T: Goal -->
            <div class="task-row" data-stage="goal">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">2. 目标锚定 (TARGET)</span>
                    <span class="task-duration" id="dur-goal">0s</span>
                </div>
                <div class="task-body" id="stage-body-goal">
                    <div style="color: var(--text-dim); font-size: 12px;">等待目标确认...</div>
                </div>
            </div>

            <!-- P: Plan -->
            <div class="task-row" data-stage="plan">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">3. 计划编排 (PLANNING)</span>
                    <span class="task-duration" id="dur-plan">0s</span>
                </div>
                <div class="task-body" id="stage-body-plan">
                    <div class="sandbox-toolbar" id="plan-toolbar" style="display:none;">
                        <span><strong>人机协同沙盘</strong></span>
                        <span>[ 📂 拖拽重排 ]</span>
                        <span>[ ✎ 双击编辑 ]</span>
                        <span>[ 🔒 锁定并执行 ]</span>
                    </div>
                    <div id="plan-substeps"></div>
                    <div style="color: var(--text-dim); font-size: 12px;">等待计划生成...</div>
                </div>
            </div>

            <!-- E: Execute -->
            <div class="task-row active" data-stage="execute">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">4. 代码执行 (EXECUTION)</span>
                    <span class="task-duration" id="dur-execute">0s</span>
                </div>
                <div class="task-body" id="stage-body-execute">
                    <div style="font-size: 13px; color: var(--warning); margin-bottom: 8px; font-weight: 500; display:none;" id="exec-warning">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span id="exec-warning-text">正在处理...</span>
                    </div>
                    <div class="terminal-block" id="exec-terminal" style="display:none;">
                        <div id="exec-terminal-lines"></div>
                    </div>
                    <div id="exec-messages" style="color: var(--text-dim); font-size: 12px;">等待开始执行...</div>
                    <div class="control-trigger-group" id="exec-controls" style="display:none;">
                        <button class="btn-trigger warn" id="btn-time-travel">${svgIcon('clock')} 时间旅行 (回滚至此)</button>
                        <button class="btn-trigger" id="btn-pause">${svgIcon('pause')} 暂停管道监控</button>
                    </div>
                    <div class="inline-intervention-zone" id="exec-intervention" style="display:none;">
                        <div class="zone-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> 就地追加局部微调指令 (可选)：</div>
                        <div class="inline-input-wrapper">
                            <input type="text" id="inline-intervention-input" placeholder="只针对当前代码执行进行微调...">
                            ${svgIcon('send')}
                        </div>
                    </div>
                </div>
            </div>

            <!-- V: Verify -->
            <div class="task-row" data-stage="verify">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">5. 自动化自验 (VERIFY)</span>
                    <span class="task-duration" id="dur-verify">0s</span>
                </div>
                <div class="task-body" id="stage-body-verify">
                    <div style="color: var(--text-dim); font-size: 12px;">等待自验...</div>
                </div>
            </div>

            <!-- C: Close/Review -->
            <div class="task-row" data-stage="review">
                <div class="task-header" onclick="(window as any).toggleTaskRow?.(this)">
                    <svg class="chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    <div class="status-icon-box pending"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg></div>
                    <span class="task-step-name">6. 最终签署 (CLOSE)</span>
                    <span class="task-duration" id="dur-review">0s</span>
                </div>
                <div class="task-body" id="stage-body-review">
                    <div style="color: var(--text-dim); font-size: 12px;">等待验收...</div>
                </div>
            </div>
        </div>

        <!-- Chat messages container — renders below stage cards -->
        <div id="chat-scroll">
            <div id="tl-filter-bar" class="tl-filter-bar hidden">
                <button class="tl-filter-btn active" data-tl-filter="all">全部</button>
                <button class="tl-filter-btn" data-tl-filter="thinking">💭 思考</button>
                <button class="tl-filter-btn" data-tl-filter="file">📄 文件</button>
                <button class="tl-filter-btn" data-tl-filter="command">💻 命令</button>
                <button class="tl-filter-btn" data-tl-filter="search">🔍 搜索</button>
            </div>
            <div id="chat-messages"></div>
            <div id="working-indicator" class="hidden">
                <span class="working-spinner"></span>
                <span class="working-text">思考中</span>
            </div>
        </div>
    </main>

    <!-- Monitor Tower -->
    <aside class="monitor-tower" id="monitor-tower">
        <div>
            <div class="panel-section-title">实时待办项 (TODO)</div>
            <div class="tower-card" id="tower-todo">
                <div class="tower-card-empty" id="tower-todo-empty">暂无待办</div>
                <div id="tower-todo-list"></div>
            </div>
        </div>

        <div>
            <div class="panel-section-title">实时文件变更 (DIFF)</div>
            <div class="tower-card" id="tower-diff">
                <div class="tower-card-empty" id="tower-diff-empty">暂无变更</div>
                <div id="tower-diff-list"></div>
            </div>
        </div>

        <div>
            <div class="panel-section-title">知识库沉淀 (WIKI)</div>
            <div class="tower-card" id="tower-wiki" style="background:transparent;border:none;padding:0;">
                <div class="wiki-incubator-box" id="tower-wiki-box">
                    <div class="wiki-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg> 避坑指南孵化区</div>
                    <div class="wiki-desc">当前任务正在推进。可在最终签署 (Approval) 阶段一键让 AI 将策略固化至 Wiki 文档。</div>
                </div>
            </div>
        </div>
    </aside>
</div>

<!-- ======== Overlay Right Panel (Diff / Device / ACP Log) ======== -->
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
                <div class="device-field-row device-auth-row" id="device-username-row"><input id="device-username" type="text" placeholder="用户名"></div>
                <div class="device-field-row device-auth-row" id="device-password-row"><input id="device-password" type="password" placeholder="密码"></div>
                <div class="device-field-row device-auth-row" id="device-key-row" style="display:none;"><input id="device-key-path" type="text" placeholder="私钥路径"></div>
                <div class="device-btn-row"><button id="btn-device-connect" class="device-btn primary">连接</button></div>
            </div>
            <div id="device-connected-view" style="display:none;">
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

<!-- ======== Hidden data containers ======== -->
<div id="__panelData"
     data-available-agents="${escapeAttr(JSON.stringify(agents || []))}"
     style="display:none"></div>
<div id="__viewdata" style="display:none" data-viewmode="${viewMode || 'chat'}"></div>

<!-- Plugin Management Modal -->
<div id="plugin-manager-overlay" class="hidden">
    <div id="plugin-manager-dialog">
        <div id="plugin-manager-header"><span>🔌 插件管理</span><button id="plugin-manager-close" class="close-btn">✕</button></div>
        <div id="plugin-manager-body"><div class="plugin-manager-hint">加载中...</div></div>
    </div>
</div>

<script src="${scriptUri('app.bundle')}"></script>
<script src="${scriptUri('outputPanel')}"></script>
<script src="${scriptUri('device.bundle')}"></script>
</body>
</html>`;
}
