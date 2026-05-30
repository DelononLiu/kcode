export function getInlineStyles(): string {
    return `/* === V3 Design Tokens === */
:root {
    --bg-deep: #0d0d0f;
    --bg-panel: #141417;
    --bg-item: #1c1c1f;
    --accent: #04d361;
    --accent-glow: rgba(4, 211, 97, 0.25);
    --border: #242428;
    --text-main: #e1e1e6;
    --text-dim: #7c7c8a;
    --warning: #ff9b26;
    --terminal-bg: #09090b;
}

*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:var(--text-main);background:var(--bg-deep)}

/* === State A: Init Space === */
.init-space {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: var(--bg-deep);
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    z-index: 100;
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.init-logo { font-size: 24px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; letter-spacing: 1px; }
.init-logo svg { width: 28px; height: 28px; }
.init-logo .accent { color: var(--accent); }
.center-input-box {
    width: 100%; max-width: 680px;
    background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 14px 20px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    display: flex; align-items: center;
    transition: border-color 0.2s;
}
.center-input-box:focus-within { border-color: #3e3e4a; box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05); }
.center-input-box input { background: transparent; border: none; color: #fff; flex: 1; outline: none; font-size: 16px; }
.center-input-box input::placeholder { color: #494952; }
.enter-badge { background: var(--bg-item); border: 1px solid var(--border); color: var(--text-dim); padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; }
.init-hint { margin-top: 16px; font-size: 12px; color: var(--text-dim); display: flex; gap: 16px; }
.init-hint span { cursor: pointer; }
.init-hint span:hover { color: var(--text-main); }

/* === State B: Control Panel === */
.app-container {
    display: grid;
    grid-template-columns: 56px 1fr 340px;
    grid-template-rows: 46px 1fr;
    height: 100vh; width: 100vw;
    opacity: 0; transform: scale(0.99);
    transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: none;
}
.app-container.activated { opacity: 1; transform: scale(1); pointer-events: auto; }

/* Header */
.header {
    grid-column: 1 / 4;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center;
    padding: 0 16px;
    font-size: 13px;
    background: var(--bg-panel);
    z-index: 10;
}
.header-title { font-weight: 700; display: flex; align-items: center; gap: 8px; }
.header-title svg { width: 18px; height: 18px; }
.status-pill {
    background: rgba(4, 211, 97, 0.08); color: var(--accent);
    padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;
    margin-left: 12px; border: 1px solid rgba(4, 211, 97, 0.2);
    display: flex; align-items: center; gap: 4px;
}
.header-meta-controls { margin-left: 40px; display: flex; gap: 8px; font-size: 12px; }
.header-capsule {
    background: var(--bg-deep); border: 1px solid var(--border);
    color: #a9a9b3; padding: 2px 8px; border-radius: 4px; cursor: pointer;
    display: flex; align-items: center; gap: 4px;
}
.header-capsule.active { border-color: rgba(4, 211, 97, 0.3); color: var(--accent); background: rgba(4, 211, 97, 0.02); }

/* Sidebar Rail */
.sidebar-rail {
    grid-row: 2 / 3; grid-column: 1 / 2;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 24px; border-right: 1px solid var(--border);
    position: relative; background: var(--bg-deep);
}
.rail-track { position: absolute; width: 2px; top: 40px; bottom: 40px; background: repeating-linear-gradient(to bottom, var(--border), var(--border) 4px, transparent 4px, transparent 8px); z-index: 1; }
.rail-track-active { position: absolute; width: 2px; top: 40px; height: 0; background: var(--accent); box-shadow: 0 0 12px var(--accent); z-index: 1; transition: height 0.5s ease; }
.stage-node { width: 26px; height: 26px; border-radius: 50%; background: var(--bg-deep); border: 2px solid var(--border); margin-bottom: 38px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--text-dim); z-index: 2; position: relative; cursor: pointer; }
.stage-node:last-child { margin-bottom: 0; }
.stage-node.done { border-color: var(--accent); color: var(--accent); }
.stage-node.active { background: var(--accent); border-color: var(--accent); color: var(--bg-deep); box-shadow: 0 0 15px var(--accent-glow); }

/* Main Task Board */
.main-task-board {
    grid-row: 2 / 3; grid-column: 2 / 3;
    padding: 24px 32px;
    overflow-y: auto;
    background: linear-gradient(145deg, #101013 0%, var(--bg-deep) 60%);
}
.task-board-title { font-size: 12px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.task-board-task-name { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 20px; }

/* Task Row (Accordion Card) */
.task-row { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px; overflow: hidden; }
.task-row.active { border-color: #2e3c32; }
.task-header { padding: 10px 14px; display: flex; align-items: center; cursor: pointer; user-select: none; background: linear-gradient(to bottom, rgba(255,255,255,0.01), transparent); }
.chevron { font-size: 11px; color: var(--text-dim); width: 16px; transition: transform 0.2s; flex-shrink: 0; }
.task-row.expanded .chevron { transform: rotate(90deg); }
.status-icon-box { margin-right: 12px; display: flex; align-items: center; font-size: 14px; flex-shrink: 0; }
.status-icon-box.success { color: var(--accent); }
.status-icon-box.running { color: var(--accent); animation: spin 2s linear infinite; }
.status-icon-box.pending { color: var(--text-dim); }
.task-step-name { font-size: 13.5px; font-weight: 500; flex: 1; min-width: 0; }
.task-duration { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 12px; color: var(--text-dim); flex-shrink: 0; }
.task-body { display: none; background: rgba(0, 0, 0, 0.15); border-top: 1px solid var(--border); padding: 12px 16px; }
.task-row.expanded .task-body { display: block; }

/* Sandbox Toolbar */
.sandbox-toolbar { background: #18181c; border: 1px solid var(--border); padding: 6px 12px; border-radius: 4px; font-size: 12px; margin-bottom: 12px; display: flex; gap: 16px; color: var(--text-dim); flex-wrap: wrap; }
.sandbox-toolbar strong { color: var(--warning); }

/* Sub steps */
.sub-step { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 6px 0; color: var(--text-dim); border-bottom: 1px solid rgba(255,255,255,0.01); }
.sub-step.done { color: var(--text-main); }
.sub-step svg { margin-right: 8px; flex-shrink: 0; }
.sub-step .check { color: var(--accent); }

/* Terminal Block */
.terminal-block { background: var(--terminal-bg); border: 1px solid #1a261f; border-radius: 6px; padding: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 12px; margin-top: 8px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8); }
.terminal-row { display: flex; line-height: 1.6; }
.terminal-num { width: 28px; color: #3b3b44; user-select: none; text-align: right; padding-right: 12px; flex-shrink: 0; }
.terminal-text { color: #a9a9b3; flex: 1; white-space: pre-wrap; }
.terminal-text .brand { color: var(--accent); }

/* Control Trigger Group */
.control-trigger-group { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
.btn-trigger { background: var(--bg-item); border: 1px solid var(--border); color: var(--text-main); padding: 5px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.btn-trigger:hover { background: var(--border); }
.btn-trigger.warn { border-color: var(--warning); color: var(--warning); }
.btn-trigger.warn:hover { background: rgba(255,155,38,0.05); }

/* Inline Intervention Zone */
.inline-intervention-zone { margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 12px; }
.inline-intervention-zone .zone-label { font-size: 12px; color: var(--warning); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.inline-input-wrapper { background: var(--terminal-bg); border: 1px solid #222; border-radius: 4px; padding: 6px 12px; display: flex; align-items: center; max-width: 500px; }
.inline-input-wrapper input { background: transparent; border: none; color: #fff; flex: 1; outline: none; font-size: 12.5px; }
.inline-input-wrapper input::placeholder { color: #494952; }
.inline-input-wrapper svg { color: var(--text-dim); font-size: 12px; flex-shrink: 0; }

/* Monitor Tower */
.monitor-tower {
    grid-row: 2 / 3; grid-column: 3 / 4;
    border-left: 1px solid var(--border);
    padding: 16px;
    background: var(--bg-panel);
    display: flex; flex-direction: column; gap: 16px;
    overflow-y: auto;
}
.panel-section-title { font-size: 11px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; }
.tower-card { background: var(--bg-item); border: 1px solid var(--border); border-radius: 6px; padding: 12px; }
.tower-card-empty { font-size: 11px; color: #555; text-align: center; padding: 8px 0; }
.todo-item { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; margin-bottom: 8px; color: var(--text-main); }
.todo-item:last-child { margin-bottom: 0; }
.todo-item svg { margin-top: 2px; flex-shrink: 0; }
.diff-file-row { display: flex; justify-content: space-between; font-size: 12px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; padding: 4px 0; }
.diff-file-row + .diff-file-row { border-top: 1px solid rgba(255,255,255,0.03); }
.diff-add { color: var(--accent); }
.wiki-incubator-box { border: 1px dashed var(--warning); background: rgba(255, 155, 38, 0.02); padding: 10px; border-radius: 4px; font-size: 12px; }
.wiki-incubator-box .wiki-title { color: var(--warning); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.wiki-incubator-box .wiki-desc { color: var(--text-dim); font-size: 11px; }

/* Agent + Model selector in header */
.header-agent-select { display: flex; align-items: center; gap: 4px; margin-left: 12px; }
.header-agent-select .agent-dot { width: 6px; height: 6px; border-radius: 50%; }
.header-agent-select .agent-dot.online { background: var(--accent); }
.header-agent-select .agent-dot.offline { background: #555; }

/* Chat messages container (embedded in task board for existing rendering) */
#chat-messages-container { display: none; }

/* Chat messages rendered in stage card bodies - keep existing msg classes but scoped */
.chat-msg { padding: 10px 0; }
.chat-msg:last-child { padding-bottom: 0; }
.chat-msg .msg-sender { display: none; }
.chat-msg .msg-bubble { font-size: 13.5px; line-height: 1.6; word-wrap: break-word; color: var(--text-main); }
.chat-msg .msg-bubble p { margin: .3em 0; }
.chat-msg .msg-bubble ul, .chat-msg .msg-bubble ol { margin: .3em 0; padding-left: 1.5em; }
.chat-msg .msg-bubble li { margin: .1em 0; }
.chat-msg .msg-bubble code { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 12.5px; color: #d69d85; background: rgba(255,255,255,0.04); padding: 1px 5px; border-radius: 3px; }
.chat-msg .msg-bubble pre code { color: inherit; background: transparent; padding: 0; border-radius: 0; font-size: 12.5px; }
.chat-msg .msg-bubble .code-block-wrapper { margin: 12px 0; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.chat-msg .msg-bubble .code-block-header { display: flex; align-items: center; justify-content: space-between; padding: 5px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 11px; }
.chat-msg .msg-bubble .code-lang-label { color: #666; }
.chat-msg .msg-bubble .code-copy-btn { background: none; border: 1px solid transparent; color: #666; cursor: pointer; font-size: 11px; padding: 1px 6px; border-radius: 3px; font-family: inherit; opacity: 0; transition: opacity .2s, background .2s; }
.chat-msg .msg-bubble .code-block-wrapper:hover .code-copy-btn { opacity: 1; }
.chat-msg .msg-bubble .code-copy-btn:hover { background: rgba(255,255,255,0.06); color: #aaa; }
.chat-msg .msg-bubble .code-block-wrapper pre { padding: 14px 16px; margin: 0; overflow-x: auto; scrollbar-width: thin; }
.chat-msg .msg-bubble .code-block-wrapper code.hljs { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 12.5px; line-height: 1.55; background: transparent; padding: 0; display: block; }

/* Keep existing card + tl-entry styles for rendering inside stage cards */
.msg-card { border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
.msg-card-header { display: flex; align-items: center; min-height: 34px; padding: 3px 10px; font-size: 12px; cursor: pointer; user-select: none; gap: 6px; color: #bbb; background: rgba(0,0,0,0.2); border-left: 3px solid transparent; }
.msg-card-header-text { flex: 1; display: flex; align-items: center; gap: 5px; min-width: 0; }
.msg-card-body { padding: 8px 12px; font-size: 13.5px; line-height: 1.6; color: var(--text-main); overflow-y: auto; max-height: 300px; }
.msg-card-body.collapsed { max-height: 0; padding: 0 12px; opacity: 0; overflow: hidden; }
.msg-card-toggle { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; color: #666; transition: transform .2s; }
.msg-card-toggle.collapsed { transform: rotate(-90deg); }
.msg-card-actions { display: flex; gap: 8px; padding: 8px 12px 10px; border-top: 1px solid rgba(255,255,255,0.05); }
.msg-card-btn { flex: 1; max-width: 150px; padding: 5px 10px; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; font-family: inherit; font-weight: 500; }
.msg-card-btn.primary { background: #4a8bb5; color: #fff; }
.msg-card-btn.primary:hover { background: #5a9bc8; }
.msg-card-btn.secondary { background: rgba(255,255,255,0.06); color: var(--text-main); }
.msg-card-status { padding: 4px 12px 10px; font-size: 12px; color: #777; text-align: center; }
.msg-card-btn.cancel { background: transparent; color: #888; border: 1px solid rgba(255,255,255,0.08); }

/* TL entries for tool calls */
.tl-entry { display: flex; gap: 8px; margin: 0; }
.tl-entry-bar { width: 3px; border-radius: 2px; flex-shrink: 0; min-height: 20px; align-self: stretch; opacity: .6; }
.tl-entry-main { flex: 1; min-width: 0; }
.tl-entry-header { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 1px 0; user-select: none; min-height: 20px; }
.tl-entry-body { font-size: 12px; line-height: 1.4; color: #999; overflow: hidden; max-height: 0; transition: max-height .2s ease, opacity .15s, padding .15s; opacity: 0; padding: 0 0 0 22px; }
.tl-entry-body.open { max-height: 500px; opacity: 1; padding: 1px 0 2px 22px; }
.tl-entry-body pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 11.5px; color: #9aa; line-height: 1.4; }
.tl-entry-body .tl-body-bash { background: rgba(0,0,0,0.25); border-radius: 3px; padding: 1px 8px; }
.tl-entry-body .tl-body-bash pre { color: #5a9d6b; }
.tl-entry-body .tl-body-diff { color: var(--text-main); padding: 0; }
.tl-entry-body .tl-body-thinking { font-style: italic; color: #777; font-size: 11px; }
.tl-thinking-preview { padding: 2px 0 2px 22px; font-size: 11.5px; font-style: italic; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; min-height: 18px; }
.tl-thinking-preview.hidden { display: none; }
.tl-merged { margin: 2px 0; }
.tl-filter-bar { display: flex; gap: 4px; padding: 4px 0; flex-wrap: wrap; }
.tl-filter-btn { background: rgba(255,255,255,0.04); border: 1px solid transparent; border-radius: 3px; color: #888; font-size: 11px; padding: 2px 8px; cursor: pointer; font-family: inherit; }
.tl-filter-btn.active { color: #ddd; border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); }
.tl-filter-bar.hidden { display: none; }

/* Keep existing review changes styles */
.review-changes { padding: 6px 0 0; border-top: 1px solid rgba(255,255,255,0.04); margin-top: 6px; }
.review-changes-label { font-size: 11px; color: #888; padding: 4px 0 2px; }
.review-changes-item { display: flex; align-items: center; gap: 8px; padding: 4px; cursor: pointer; font-size: 12px; color: var(--accent); border-radius: 3px; }
.review-changes-item:hover { background: rgba(255,255,255,0.03); }
.review-changes-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-changes-summary { font-size: 10px; color: #5a9d6b; flex-shrink: 0; }

/* Chat scroll within main task board */
#chat-scroll { overflow-y: visible; min-height: 0; }
#chat-messages { max-width: 100%; }

/* Working indicator */
.working-indicator { display: flex; align-items: center; gap: 8px; padding: 8px 0 4px; font-size: 12px; color: #888; }
.working-indicator.hidden { display: none; }
.working-spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.08); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; flex-shrink: 0; }

/* Overlay Right Panel (Diff/Device/ACP Log) */
#right-panel { position: fixed; right: 0; top: 0; height: 100%; width: 500px; background: var(--bg-panel); border-left: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; z-index: 20; box-shadow: -4px 0 16px rgba(0,0,0,.35); }
#right-panel.hidden { display: none; }
#right-panel-header { display: flex; align-items: stretch; background: rgba(0,0,0,.15); flex-shrink: 0; }
.tabs { display: flex; flex: 1; min-width: 0; flex-wrap: wrap; }
.tab { flex: 1; min-width: 100px; text-align: center; padding: 7px 8px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.06); color: #666; font-size: 12px; cursor: pointer; font-family: inherit; }
.tab:hover { color: #999; }
.tab.active { color: #ddd; font-weight: 500; background: var(--bg-panel); border-bottom-color: transparent; }
.tab-content { display: none; flex: 1; overflow-y: auto; padding: 12px; min-height: 0; }
.tab-content.active { display: block; }
#right-panel-content { flex: 1; overflow: hidden; position: relative; display: flex; flex-direction: column; }
.close-btn { background: none; border: none; color: #666; font-size: 14px; cursor: pointer; padding: 6px 12px; }
.close-btn:hover { color: #ddd; }
#tab-acplog { display: none; flex-direction: column; overflow: hidden; font-size: 11px; padding: 0; min-height: 0; }
#tab-acplog.tab-content.active { display: flex; }
#acp-log-toolbar { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }
#acp-log-content { flex: 1; overflow-y: auto; padding: 4px 6px; font-family: monospace; white-space: pre-wrap; word-break: break-all; line-height: 1.4; background: var(--bg-deep); }
.acp-log-entry { padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }

/* Plugin Manager Modal */
#plugin-manager-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,.55); z-index: 9999; display: flex; align-items: center; justify-content: center; }
#plugin-manager-overlay.hidden { display: none; }
#plugin-manager-dialog { background: var(--bg-panel); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; width: 520px; max-height: 70vh; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,.45); }
#plugin-manager-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 13px; font-weight: 500; color: #ccc; }
#plugin-manager-body { padding: 8px 0; overflow-y: auto; flex: 1; }
.plugin-manager-hint { padding: 20px; text-align: center; color: #666; font-size: 12px; }

/* Demo card */
.demo-card { padding: 4px 0; }
.demo-card-section { padding: 4px 8px; }
.demo-card-output { max-height: 240px; overflow-y: auto; background: rgba(0,0,0,.25); border-radius: 3px; padding: 6px 8px; font-family: monospace; font-size: 12px; line-height: 1.45; white-space: pre-wrap; word-break: break-all; margin: 4px 8px 6px; }
.demo-card-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 2px 10px; border-radius: 4px; font-weight: 500; }
.demo-card-status-badge.running { background: rgba(26,95,158,.15); color: #5a9bc8; }
.demo-card-status-badge.completed { background: rgba(90,157,107,.12); color: #5a9d6b; }
.demo-card-status-badge.failed { background: rgba(224,96,96,.1); color: #e06060; }

/* Right output panel (retained for backward compat) */
#right-output-panel, .output-resize-handle { display: none; }

/* Misc */
@keyframes spin { 100% { transform: rotate(360deg); } }
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
::-webkit-scrollbar-track { background: transparent; }
`;
}
