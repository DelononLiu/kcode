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
    --card-radius:4px;
    --card-border:1px solid rgba(255,255,255,.08);
    --card-header-bg:rgba(0,0,0,.2);
    --card-header-hover:rgba(255,255,255,.025);
    --card-body-bg:transparent;
    --card-gap:6px;
    --tool-color-bash:#4CAF50;
    --tool-color-read:#2196F3;
    --tool-color-write:#FF9800;
    --tool-color-glob:#9C27B0;
    --tool-color-grep:#2196F3;
    --tool-color-thinking:#9E9E9E;
    --tl-color-thinking:#888;--tl-color-file:#4a8bb5;--tl-color-write:#d4a84b;--tl-color-command:#5a9d6b;--tl-color-search:#8b5cf6;--tl-color-device:#e6b422;--tl-color-fail:#e06c75;
}

*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:var(--text-main);background:var(--bg-deep)}
.hidden{display:none}

/* ========== #chat-scroll (scoped per view, duplicate in HTML) ========== */
#chat-scroll{overflow-y:auto;position:relative;min-height:0}
#chat-scroll.chat-empty{display:none}
#chat-scroll .tl-filter-bar.hidden{display:none}

/* ========== Task View (V4) hidden by default ========== */
#task-view{display:none}

/* === V4 Init Screen === */
.tv4-init{position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--bg-deep);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:100}
.tv4-init-logo{font-size:24px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:10px;letter-spacing:1px}
.tv4-init-logo svg{width:28px;height:28px}
.tv4-accent{color:var(--accent)}
.tv4-init-box{width:100%;max-width:680px;background:var(--bg-panel);border:1px solid var(--border);border-radius:8px;padding:14px 20px;box-shadow:0 20px 40px rgba(0,0,0,.5);display:flex;align-items:center;transition:border-color .2s}
.tv4-init-box:focus-within{border-color:#3e3e4a;box-shadow:0 20px 40px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.05)}
.tv4-init-box input{background:transparent;border:none;color:#fff;flex:1;outline:none;font-size:16px}
.tv4-init-box input::placeholder{color:#494952}
.tv4-enter-badge{background:var(--bg-item);border:1px solid var(--border);color:var(--text-dim);padding:2px 6px;border-radius:4px;font-size:11px;font-family:monospace}

/* === V4 Panel Layout === */
.tv4-panel{display:flex;flex-direction:column;height:100vh;width:100vw;background:var(--bg-deep)}
.tv4-header{display:flex;align-items:center;padding:0 16px;height:40px;border-bottom:1px solid var(--border);background:var(--bg-panel);flex-shrink:0;gap:10px}
.tv4-header-name{font-size:14px;font-weight:600;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}
.tv4-status-badge{font-size:10px;padding:1px 7px;border-radius:3px;font-weight:500;white-space:nowrap;flex-shrink:0}
.tv4-status-badge.status-pending{background:rgba(255,255,255,.06);color:#888}
.tv4-status-badge.status-active{background:rgba(74,139,181,.12);color:#5a9bc8}
.tv4-status-badge.status-in_review{background:rgba(78,201,176,.1);color:#4ec9b0}
.tv4-status-badge.status-completed{background:rgba(90,157,107,.1);color:#5a9d6b}
.tv4-status-badge.status-cancelled{background:rgba(224,96,96,.08);color:#e06060}
.tv4-model-badge{font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(255,255,255,.05);color:#888;white-space:nowrap;flex-shrink:0;cursor:pointer}
.tv4-model-badge:hover{color:#bbb}

/* === V4 Timeline === */
.tv4-scroll{flex:1;overflow-y:auto;overflow-x:hidden;position:relative}

#task-view #chat-messages{max-width:900px;margin:0 auto;padding:24px 24px 32px;min-height:100%}

/* === Phase Group Container === */
.tv4-phase-group{border:1px solid var(--border);border-radius:6px;margin:8px 0;overflow:hidden}
.tv4-pg-toggle{display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:11px;color:#888;cursor:pointer;user-select:none;background:rgba(255,255,255,.015);transition:color .15s,background .15s}
.tv4-pg-toggle:hover{color:#aaa;background:rgba(255,255,255,.03)}
.tv4-pg-icon{display:inline-block;width:12px;font-size:10px;text-align:center;flex-shrink:0;transition:transform .2s}
.tv4-pg-body{display:none;border-top:1px solid var(--border);background:rgba(0,0,0,.08)}
.tv4-phase-group[data-collapsed="false"] .tv4-pg-body{display:block}
.tv4-pg-body .chat-msg{padding:6px 12px}

/* Task view: show message sender */
#task-view .chat-msg .msg-sender{display:flex;font-size:11px;font-weight:500;color:var(--text-dim);margin-bottom:2px;gap:4px}
#task-view .chat-msg .msg-sender .msg-timestamp{font-weight:400;color:#555;font-size:10px}
#task-view .chat-msg .msg-row{display:none}

/* Task view: user message bubble */
#task-view .chat-msg.user .msg-bubble{display:inline-block;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:8px 14px;background:rgba(255,255,255,.02);max-width:80%;line-height:1.5;font-size:13.5px;color:var(--text-main)}
#task-view .chat-msg.agent .msg-bubble{font-size:13.5px;line-height:1.6;color:var(--text-main);padding:2px 0}

/* === Task View: Tool Card Collapse === */
#task-view .chat-msg.tool{position:relative;cursor:pointer;margin:2px 0;padding:3px 0;border-left:2px solid transparent;transition:border-color .15s}
#task-view .chat-msg.tool:hover{border-left-color:rgba(255,255,255,.08)}
#task-view .chat-msg.tool .msg-card-body,
#task-view .chat-msg.tool .tl-entry-body{display:none!important}
#task-view .chat-msg.tool.expanded .msg-card-body,
#task-view .chat-msg.tool.expanded .tl-entry-body{display:block!important}
#task-view .chat-msg.tool .msg-card-header{border-bottom:none;min-height:26px}
#task-view .chat-msg.tool.expanded .msg-card-header{border-bottom:1px solid rgba(255,255,255,.05)}
#task-view .chat-msg.tool .tl-entry-header{min-height:20px}
#task-view .chat-msg.tool .tl-entry-bar{min-height:24px}

/* === V4 Input Area === */
.tv4-input-area{flex-shrink:0;border-top:1px solid var(--border);padding:10px 16px 8px;background:var(--bg-deep)}
.tv4-input-area .tv4-input-wrapper{max-width:900px;margin:0 auto}
.tv4-input-area textarea{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.06);border-radius:6px;color:var(--text-main);font-family:inherit;font-size:13.5px;resize:none;outline:none;min-height:36px;max-height:160px;line-height:1.35;padding:10px 12px;transition:border-color .2s}
.tv4-input-area textarea:focus{border-color:#007fd4;box-shadow:0 0 8px rgba(0,127,212,.3)}
.tv4-input-area textarea::placeholder{color:#555}
.tv4-input-row{display:flex;align-items:center;justify-content:space-between;padding-top:4px;min-height:28px}
.tv4-btn{border:none;border-radius:4px;padding:4px 14px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;transition:background .15s}
.tv4-btn.primary{background:#4a8bb5;color:#fff}
.tv4-btn.primary:hover{background:#5a9bc8}
.tv4-btn.danger{background:#c94a4a;color:#fff}
.tv4-btn.danger:hover{background:#e06060}
.tv4-btn.hidden{display:none}
.tv4-input-area .shortcut-hint{font-size:10px;color:#555;white-space:nowrap}

/* V4: queue bar */
#tv4-queue-bar{margin-bottom:6px;border:1px solid rgba(255,255,255,.06);border-radius:4px;overflow:hidden}
#tv4-queue-bar.hidden{display:none}
#tv4-queue-bar .queue-header{display:flex;align-items:center;padding:5px 10px;font-size:12px;gap:8px;background:rgba(255,255,255,.02);cursor:pointer}
#tv4-queue-bar #queue-summary{color:#888;flex:1}
#tv4-queue-bar .queue-action-btn{background:none;border:none;color:#666;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:3px;font-family:inherit}

/* === Shared: Chat message layout / rows === */
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px;user-select:none}
.msg-row{display:flex;align-items:center;min-height:20px}
.chat-msg.user{text-align:right}
.chat-msg.tool{padding:3px 0}
.chat-msg.tool .msg-bubble{font-size:13px;line-height:1.5;color:#b5c9a8}
.chat-msg.stop-message .msg-bubble{text-align:center;font-size:12px;color:#666;padding:4px 0}
.msg-sender{display:flex;align-items:center;gap:4px}
.msg-timestamp{font-size:10px;color:#555;font-weight:400}
.msg-highlight{animation:msg-highlight-fade 1.5s ease-out}
@keyframes msg-highlight-fade{0%{background:rgba(78,201,176,.1);border-left:2px solid #4ec9b0}100%{background:transparent;border-left:2px solid transparent}}
.copy-msg-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#555;cursor:pointer;padding:2px 4px;border-radius:3px;line-height:1;transition:opacity .2s,color .2s,background .2s;display:inline-flex;align-items:center;gap:3px;font-size:12px;font-family:inherit}
.chat-msg:hover .copy-msg-btn{opacity:1}
.copy-msg-btn:hover{background:rgba(255,255,255,.04);color:#999}
.convert-msg-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#4a8bb5;cursor:pointer;padding:2px 6px;border-radius:3px;line-height:1;font-size:12px;font-family:inherit;transition:opacity .2s,color .2s,background .2s}
.chat-msg:hover .convert-msg-btn{opacity:1}
.convert-msg-btn:hover{background:rgba(74,139,181,.12);color:#5a9bc8}
.convert-task-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#4ec9b0;cursor:pointer;padding:2px 6px;border-radius:3px;line-height:1;font-size:12px;font-family:inherit;transition:opacity .2s,color .2s,background .2s}
.chat-msg:hover .convert-task-btn{opacity:1}
.convert-task-btn:hover{background:rgba(78,201,176,.12);color:#7ec8a0}
.thinking-dots{display:inline-flex;gap:4px;align-items:center;padding:6px 0}
.thinking-dots .dot{width:5px;height:5px;border-radius:50%;background:#666;animation:dot-bounce 1.4s infinite ease-in-out both}
.thinking-dots .dot:nth-child(1){animation-delay:-0.32s}
.thinking-dots .dot:nth-child(2){animation-delay:-0.16s}
.thinking-dots .dot:nth-child(3){animation-delay:0s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.3}40%{transform:scale(1);opacity:.8}}
#chat-area:has(#chat-scroll.chat-empty) #chat-header{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-body{display:none}

/* === Shared: Chat bubbles / Cards / Timeline === */
.chat-msg{padding:10px 0}.chat-msg:last-child{padding-bottom:0}
.tl-node-wrap{display:flex;align-items:center;justify-content:center;width:100%;z-index:2;flex-shrink:0}
.tl-line-segment{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center;width:4px;z-index:1}.tl-line-dot{width:3px;height:3px;border-radius:50%;flex-shrink:0}
.tl-node{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;transition:background .3s,box-shadow .3s;pointer-events:auto;cursor:pointer;flex-shrink:0;position:relative}
.tl-node.status-completed{background:#1e7a32}
.tl-node.status-active{background:#1a5f9e;box-shadow:0 0 8px rgba(26,95,158,.5);animation:tl-pulse 2s infinite}
.tl-node.status-pending{background:rgba(26,95,158,.3)}
.tl-node.status-cancelled{background:#a04040;box-shadow:0 0 6px rgba(160,64,64,.4)}
.tl-emoji{font-size:9px;font-weight:700;pointer-events:none;line-height:1;font-family:inherit;color:#fff}
@keyframes tl-pulse{0%{box-shadow:0 0 0 0 rgba(26,95,158,.3)}70%{box-shadow:0 0 0 5px rgba(26,95,158,0)}100%{box-shadow:0 0 0 0 rgba(26,95,158,0)}}
.tl-label{font-size:9px;color:#777;white-space:nowrap;position:absolute;left:18px;top:50%;transform:translateY(-50%);pointer-events:none;line-height:1;font-family:inherit}
.tl-node.status-active .tl-label{color:#bbb;font-weight:500}
.tl-node.status-completed .tl-label{color:#5a9d6b}
.tl-node.status-pending .tl-label{color:#5a8db5}
.tl-node.status-cancelled .tl-label{color:#e06060}
.chat-msg .msg-sender{display:none}
.chat-msg .msg-bubble{font-size:13.5px;line-height:1.6;word-wrap:break-word;color:var(--text-main)}
.chat-msg .msg-bubble p{margin:.3em 0}
.chat-msg .msg-bubble ul,.chat-msg .msg-bubble ol{margin:.3em 0;padding-left:1.5em}
.chat-msg .msg-bubble li{margin:.1em 0}
.chat-msg .msg-bubble code{font-family:monospace;font-size:12.5px;color:#d69d85;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:3px}
.chat-msg .msg-bubble pre code{color:inherit;background:transparent;padding:0;border-radius:0;font-size:12.5px}
.chat-msg .msg-bubble .code-block-wrapper{margin:12px 0;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.chat-msg .msg-bubble .code-block-header{display:flex;align-items:center;justify-content:space-between;padding:5px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px}
.chat-msg .msg-bubble .code-lang-label{color:#666}
.chat-msg .msg-bubble .code-copy-btn{background:none;border:1px solid transparent;color:#666;cursor:pointer;font-size:11px;padding:1px 6px;border-radius:3px;font-family:inherit;opacity:0;transition:opacity .2s,background .2s}
.chat-msg .msg-bubble .code-block-wrapper:hover .code-copy-btn{opacity:1}
.chat-msg .msg-bubble .code-copy-btn:hover{background:rgba(255,255,255,.06);color:#aaa}
.chat-msg .msg-bubble .code-block-wrapper pre{padding:14px 16px;margin:0;overflow-x:auto}
.chat-msg .msg-bubble .code-block-wrapper code.hljs{font-family:monospace;font-size:12.5px;line-height:1.55;background:transparent;padding:0;display:block}
.chat-msg.agent .msg-row{justify-content:flex-start;padding-left:2px}
.chat-msg.user .msg-row{justify-content:flex-end}
.chat-msg.system{padding:6px 0;text-align:center}
.chat-msg.system .msg-bubble{display:inline-block;font-size:12px;color:#888;padding:2px 12px;background:rgba(255,255,255,.02);border-radius:4px;line-height:1.4}

.msg-card{border:var(--card-border);border-radius:var(--card-radius);overflow:hidden;margin-bottom:6px}
.msg-card-header{display:flex;align-items:center;min-height:34px;padding:3px 10px;font-size:12px;cursor:pointer;user-select:none;gap:var(--card-gap);color:#bbb;background:var(--card-header-bg);border-left:3px solid transparent}
.msg-card-header:hover{background:var(--card-header-hover)}
.msg-card-header-text{flex:1;display:flex;align-items:center;gap:5px;min-width:0}
.msg-card-body{padding:8px 12px;font-size:13.5px;line-height:1.6;color:var(--text-main);overflow-y:auto;max-height:300px}
.msg-card-body.collapsed{max-height:0;padding:0 12px;opacity:0;overflow:hidden}
.msg-card-toggle{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:#666;transition:transform .2s}
.msg-card-toggle.collapsed{transform:rotate(-90deg)}
.msg-card-actions{display:flex;gap:8px;padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.05)}
.msg-card-btn{flex:1;max-width:150px;padding:5px 10px;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500}
.msg-card-btn.primary{background:#4a8bb5;color:#fff}.msg-card-btn.primary:hover{background:#5a9bc8}
.msg-card-btn.secondary{background:rgba(255,255,255,.06);color:var(--text-main)}
.msg-card-status{padding:4px 12px 10px;font-size:12px;color:#777;text-align:center}
.msg-card-btn.cancel{background:transparent;color:#888;border:1px solid rgba(255,255,255,.08)}
.msg-card-btn.cancel:hover{background:rgba(255,255,255,.04);color:#bbb}
.msg-card-status{padding:4px 12px 10px;font-size:12px;color:#777;text-align:center}
.msg-card-body.tool-card-body{max-height:250px}
.msg-card[data-tool-kind="bash"] .msg-card-header,.msg-card[data-tool-kind="command"] .msg-card-header,.msg-card[data-tool-kind="terminal"] .msg-card-header{border-left-color:var(--tool-color-bash)}
.msg-card[data-tool-kind="read"] .msg-card-header{border-left-color:var(--tool-color-read)}
.msg-card[data-tool-kind="write"] .msg-card-header,.msg-card[data-tool-kind="edit"] .msg-card-header{border-left-color:var(--tool-color-write)}
.msg-card[data-tool-kind="glob"] .msg-card-header{border-left-color:var(--tool-color-glob)}
.msg-card[data-tool-kind="grep"] .msg-card-header,.msg-card[data-tool-kind="search"] .msg-card-header{border-left-color:var(--tool-color-grep)}
.msg-card[data-tool-kind="thinking"] .msg-card-header{border-left-color:var(--tool-color-thinking)}
.card-copy-raw-btn{background:none;border:none;color:#555;cursor:pointer;font-size:11px;padding:0 4px;border-radius:3px;flex-shrink:0;line-height:1;transition:color .2s,background .2s;margin-left:auto;margin-right:2px}
.card-copy-raw-btn:hover{color:#ddd;background:rgba(255,255,255,.05)}
.tool-kind-icon{font-size:12px;flex-shrink:0;opacity:.55;display:inline-flex;vertical-align:middle}
.tool-body-content{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:12px;color:#9aa;background:transparent;padding:0}
.tool-body-bash{background:rgba(0,0,0,.3);border-radius:3px;padding:8px!important}
.tool-bash-output{color:var(--tool-color-bash)}
.tool-body-diff{color:var(--text-main)}
.tool-thinking{background:rgba(0,0,0,.25)}
.tool-thinking .msg-card-header{color:#777;font-style:italic}
.tool-thinking .tool-body-content{font-size:11.5px;font-style:italic;color:#777}
.tool-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:var(--tool-color-bash);border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
@keyframes tool-spin{to{transform:rotate(360deg)}}
.msg-bubble.card-bubble{padding:0;border:none;background:transparent}
.msg-bubble hr{margin:.6em 0;border:none;border-top:1px solid rgba(255,255,255,.06)}
.msg-bubble table{border-collapse:collapse;margin:8px 0;font-size:13px}
.msg-bubble th,.msg-bubble td{text-align:left;padding:8px 14px;line-height:1.6}
.msg-bubble thead th{font-weight:600;color:#e0e0e0;border-bottom:1px solid rgba(255,255,255,.1)}
.msg-bubble tbody tr{border-bottom:1px solid rgba(255,255,255,.04)}
.msg-bubble tbody tr:last-child{border-bottom:none}
.msg-bubble .code-block-wrapper pre::-webkit-scrollbar{height:4px}
.msg-bubble .code-block-wrapper pre::-webkit-scrollbar-track{background:transparent}
.msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:2px}
.msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.12)}
#chat-body.showing-categories{display:flex!important}
#chat-body.showing-categories #chat-scroll{display:flex;flex-direction:column;align-items:center}
#chat-body.showing-categories #chat-messages{padding:0;width:100%;max-width:480px;min-height:auto}
#chat-body.showing-categories ~ #chat-bottom{display:none}

/* === Shared: Status badges, input helpers === */
.task-status-badge.status-pending{color:#888}
.task-status-badge.status-active{background:rgba(74,139,181,.15);color:#5a9bc8}
.task-status-badge.status-in_review{background:rgba(78,201,176,.12);color:#4ec9b0}
.task-status-badge.status-completed{background:rgba(90,157,107,.12);color:#5a9d6b}
.task-status-badge.status-cancelled{background:rgba(224,96,96,.1);color:#e06060}
.hooks-count.has-workspace{color:#4ec9b0;background:rgba(78,201,176,.08)}
.hooks-count.has-task{color:#5a9bc8;background:rgba(74,139,181,.08)}
.input-tool-btn:hover{background:rgba(255,255,255,.05);color:#999}
.image-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.attach-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.pill-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15)}
.agent-dropdown-item.active{background:rgba(74,139,181,.15);color:#4a8bb5}
.agent-label-name{color:#e0e0e0;display:block;line-height:1.3}
.agent-label-model{color:#888;font-size:10px;display:block;line-height:1.2}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 0;white-space:nowrap;font-size:11px;color:#555;flex-shrink:0}
.status-item svg{opacity:.4}

/* === Shared: Slash command menu === */
.slash-context-menu{position:fixed;padding:4px 0;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:200;min-width:160px;max-height:260px;overflow-y:auto;list-style:none;font-family:inherit}
.slash-menu-item{padding:5px 12px;font-size:12px;color:#ccc;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .1s;white-space:nowrap}
.slash-menu-item:hover,.slash-menu-item.hover{background:rgba(74,139,181,.2);color:#fff}
.slash-context-name{font-weight:500;color:inherit;flex-shrink:0}
.slash-context-desc{font-size:11px;color:#777;overflow:hidden;text-overflow:ellipsis}
.template-chip.import-chip{font-weight:500}.template-chip.import-chip:hover{color:#bbb;background:rgba(255,255,255,.07)}
.template-chip-sep{color:#444;font-size:11px;padding:0 2px;user-select:none}

/* === Shared: Queue bar === */
.queue-header:hover{background:rgba(255,255,255,.04)}
.queue-action-btn:hover{color:#aaa;background:rgba(255,255,255,.05)}
.queue-clear{color:#c94a4a}.queue-clear:hover{color:#e06060}
#queue-list{border-top:1px solid rgba(255,255,255,.04);padding:4px 0;max-height:120px;overflow-y:auto}
#queue-list.hidden{display:none}
.queue-item{display:flex;align-items:center;padding:4px 10px;font-size:12px;gap:6px}
.queue-item-num{color:#555;flex-shrink:0;min-width:18px}
.queue-item-text{color:#999;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.queue-item-cancel{background:none;border:none;color:#555;cursor:pointer;font-size:12px;padding:1px 4px;border-radius:2px;font-family:inherit;flex-shrink:0}
.queue-item-cancel:hover{color:#c94a4a;background:rgba(255,255,255,.04)}
.input-wrapper.input-flash{animation:input-flash .8s ease-out}
@keyframes input-flash{0%{box-shadow:0 0 0 0 rgba(90,150,200,.2)}50%{box-shadow:0 0 0 4px rgba(90,150,200,.1)}100%{box-shadow:0 0 0 0 rgba(90,150,200,0)}}
#system-narration .narration-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#4a8bb5;animation:narration-pulse 1.2s ease-in-out infinite;flex-shrink:0}
@keyframes narration-pulse{0%,100%{opacity:.3}50%{opacity:1}}

.tl-entry{display:flex;gap:8px;margin:0}
.tl-entry-bar{width:3px;border-radius:2px;flex-shrink:0;min-height:20px;align-self:stretch;opacity:.6}
.tl-entry-main{flex:1;min-width:0}
.tl-entry-header{display:flex;align-items:center;gap:6px;cursor:pointer;padding:1px 0;user-select:none;min-height:20px}
.tl-entry-body{font-size:12px;line-height:1.4;color:#999;overflow:hidden;max-height:0;transition:max-height .2s ease,opacity .15s;opacity:0;padding:0 0 0 22px}
.tl-entry-body.open{max-height:500px;opacity:1;padding:1px 0 2px 22px}
.tl-entry-body pre{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:monospace;font-size:11.5px;color:#9aa;line-height:1.4}
.tl-entry-body .tl-body-bash{background:rgba(0,0,0,.25);border-radius:3px;padding:1px 8px}
.tl-entry-body .tl-body-bash pre{color:#5a9d6b}
.tl-entry-body .tl-body-diff{color:var(--text-main);padding:0}
.tl-entry-body .tl-body-thinking{font-style:italic;color:#777;font-size:11px}
.tl-thinking-preview{padding:2px 0 2px 22px;font-size:11.5px;font-style:italic;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;min-height:18px}
.tl-thinking-preview.hidden{display:none}

.tl-filter-bar{display:flex;gap:4px;padding:4px 0;flex-wrap:wrap}
.tl-filter-bar.hidden{display:none}
.tl-filter-btn{background:rgba(255,255,255,.04);border:1px solid transparent;border-radius:3px;color:#888;font-size:11px;padding:2px 8px;cursor:pointer;font-family:inherit}
.tl-filter-btn:hover{color:#bbb;background:rgba(255,255,255,.08)}
.tl-filter-btn.active{color:#ddd;border-color:rgba(255,255,255,.12);background:rgba(255,255,255,.06)}

.review-changes{padding:6px 0 0;border-top:1px solid rgba(255,255,255,.04);margin-top:6px}
.review-changes-label{font-size:11px;color:#888;padding:4px 0 2px}
.review-changes-item{display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;font-size:12px;color:var(--accent);border-radius:3px}
.review-changes-item:hover{background:rgba(255,255,255,.03)}
.review-changes-item.selected{background:rgba(78,201,176,.12);color:#fff}
.review-changes-icon{flex-shrink:0;font-size:13px}
.review-changes-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.review-changes-type{font-size:10px;color:#888;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.04);flex-shrink:0}
.review-changes-summary{font-size:10px;color:#5a9d6b;flex-shrink:0}
.review-changes-open{font-size:12px;color:#555;flex-shrink:0;cursor:pointer;padding:0 4px;transition:color .2s}
.review-changes-open:hover{color:#4a8bb5}
.review-criteria{padding:8px 0 0;margin-top:8px;border-top:1px solid rgba(255,255,255,.06)}
.review-criteria-label{font-size:11px;color:#888;padding:2px 0 6px}
.review-criteria-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#aaa;padding:2px 0;cursor:pointer}
.review-criteria-item:hover{color:#ddd}
.criteria-checkbox{accent-color:#4a9eff;cursor:pointer;flex-shrink:0}
.agent-diff-summary{margin-top:10px;padding:6px 10px;background:rgba(78,201,176,.04);border-left:2px solid #4ec9b0;border-radius:3px;font-size:12px;line-height:1.6;color:#9aa}
.review-inline-actions{display:flex;gap:8px;padding:8px 0 2px}
.review-inline-status{font-size:12px;color:#777;padding:6px 0 2px}
.goal-confirmed-label{font-size:11px;color:#777;padding:4px 0 2px}

.working-indicator{display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-size:12px;color:#888}
.working-indicator.hidden{display:none}
.working-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}

/* === Demo Card === */
.demo-card{padding:4px 0}.demo-card-section{padding:4px 8px}
.demo-card-section+.demo-card-section{border-top:1px solid rgba(255,255,255,.05)}
.demo-card-info{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12px;line-height:1.5}
.demo-card-info-key{color:#888;white-space:nowrap}
.demo-card-info-value{color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.demo-card-env-header{display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;font-size:11px;color:#777;padding:2px 0;transition:color .15s}
.demo-card-env-header:hover{color:#aaa}
.demo-card-env-header svg{width:10px;height:10px;transition:transform .2s;flex-shrink:0}
.demo-card-env-header.collapsed svg{transform:rotate(-90deg)}
.demo-card-env-body{padding:4px 0 2px 14px;font-size:11px;line-height:1.5;color:#666;overflow:hidden;transition:max-height .2s ease,opacity .15s,padding .15s}
.demo-card-env-body.collapsed{max-height:0;padding:0 0 0 14px;opacity:0}
.demo-card-env-row{display:flex;gap:8px}
.demo-card-env-key{color:#888;flex-shrink:0}
.demo-card-env-val{color:#777;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.demo-card-output{max-height:240px;overflow-y:auto;background:rgba(0,0,0,.25);border-radius:3px;padding:6px 8px;font-family:monospace;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-all;margin:4px 8px 6px}
.demo-card-output-line{padding:0;word-break:break-all}
.demo-card-output-line.stdout{color:#d4d4d4}
.demo-card-output-line.stderr{color:#e2777a}
.demo-card-status-row{display:flex;align-items:center;gap:8px;padding:6px 8px 4px}
.demo-card-status-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;padding:2px 10px;border-radius:4px;font-weight:500}
.demo-card-status-badge.running{background:rgba(26,95,158,.15);color:#5a9bc8}
.demo-card-status-badge.completed{background:rgba(90,157,107,.12);color:#5a9d6b}
.demo-card-status-badge.failed{background:rgba(224,96,96,.1);color:#e06060}
.demo-card-footer{display:flex;gap:6px;padding:4px 8px 8px;justify-content:flex-end}
.demo-card-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#999;border-radius:3px;padding:3px 10px;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s}
.demo-card-btn:hover{background:rgba(255,255,255,.1);color:#ccc}
.demo-card-btn.danger{color:#e06060;border-color:rgba(224,96,96,.25)}
.demo-card-btn.danger:hover{background:rgba(224,96,96,.1);color:#ff7b89}
.demo-card-btn.primary{background:#4a8bb5;border-color:#4a8bb5;color:#fff}
.demo-card-btn.primary:hover{background:#5a9bc8}
.demo-card-btn:disabled{opacity:.35;cursor:default;pointer-events:none}

/* === Unified Diff === */
.unified-diff{direction:ltr}
.diff-hunk-header{color:#569cd6;padding:4px 0;font-weight:500;font-size:11px}
.diff-line{display:flex;gap:0;min-height:20px;align-items:stretch}
.diff-line.diff-add{background:rgba(90,157,107,.1)}
.diff-line.diff-del{background:rgba(226,119,122,.08)}
.diff-ln{min-width:36px;text-align:right;padding:0 6px;color:#555;font-size:11px;user-select:none;flex-shrink:0;line-height:20px}
.diff-ln-new{border-left:1px solid rgba(255,255,255,.06);margin-left:4px;padding-left:8px;min-width:36px}
.diff-prefix{width:16px;flex-shrink:0;text-align:center;color:#888;line-height:20px;font-weight:700}
.diff-add .diff-prefix{color:#7ec87e}
.diff-del .diff-prefix{color:#e2777a}
.diff-text{flex:1;white-space:pre;padding:0 4px;line-height:20px;overflow:hidden}
.diff-add .diff-text{color:#7ec87e}
.diff-del .diff-text{color:#e2777a}
.diff-eq .diff-text{color:#999}
.diff-file-header{display:flex;align-items:center;justify-content:space-between;padding:6px 0 8px;border-bottom:1px solid #3c3c3c;margin-bottom:8px;gap:8px}
.diff-file-header span{font-size:12px;color:#888;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.diff-open-native{background:none;border:1px solid rgba(255,255,255,.1);color:#4a8bb5;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:3px;font-family:inherit;white-space:nowrap;flex-shrink:0;transition:background .2s,border-color .2s}
.diff-open-native:hover{background:rgba(74,139,181,.08);border-color:rgba(74,139,181,.3)}

/* === Plan/Goal Editing === */
.goal-edit-textarea{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;min-height:120px;line-height:1.5}
.goal-edit-textarea:focus{border-color:rgba(78,201,176,.4)}
.plan-confirmation-card{margin:8px 0}
.plan-goal-section{margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #404040}
.plan-confirm-actions .msg-card-btn{margin-right:8px}
.plan-edit-label{font-size:13px;font-weight:600;color:#c0c0c0;margin:8px 0 4px}
.plan-edit-label:first-child{margin-top:0}
.plan-edit-goal-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;min-height:60px;line-height:1.5;box-sizing:border-box}
.plan-edit-goal-input:focus{border-color:rgba(78,201,176,.4)}
.plan-edit-steps{display:flex;flex-direction:column;gap:4px}
.plan-edit-step-row{display:flex;align-items:center;gap:6px}
.plan-edit-step-input{flex:1;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:6px 8px;outline:none;box-sizing:border-box}
.plan-edit-step-input:focus{border-color:rgba(78,201,176,.4)}
.plan-edit-step-remove{background:none;border:none;color:#e06c75;cursor:pointer;font-size:14px;padding:4px;line-height:1;flex-shrink:0}
.plan-edit-step-remove:hover{color:#ff7b89}
.plan-edit-add-step{background:none;border:1px dashed rgba(255,255,255,.15);border-radius:4px;color:#888;cursor:pointer;font-size:12px;padding:6px;margin-top:4px;width:100%;text-align:center}
.plan-edit-add-step:hover{border-color:rgba(78,201,176,.4);color:#4ec9b0}
.plan-edit-actions{display:flex;gap:8px;margin-top:12px}
.plan-goal-header{font-size:13px;font-weight:600;color:#e0c080;margin-bottom:4px}
.plan-goal-body{font-size:13px;color:#b0b0b0;white-space:pre-wrap;line-height:1.5}
.plan-steps-body{padding:4px 0}
.plan-step-line{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#d2d2d4}
.plan-step-status{font-size:12px;width:16px;text-align:center;flex-shrink:0;color:#888}
.reject-input-area{padding:4px 0;width:100%}
#partial-approve-btn{background:rgba(78,201,176,.12);color:#4ec9b0;border:1px solid rgba(78,201,176,.25)}
#partial-approve-btn:hover{background:rgba(78,201,176,.2);border-color:rgba(78,201,176,.4)}
.reject-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:32px}
.reject-input:focus{border-color:rgba(255,255,255,.2)}
.reject-btn-row{display:flex;gap:6px;padding:6px 0 0;justify-content:flex-end}

/* === Template Flow === */
.template-flow-wrapper{max-width:480px;margin:0 auto;padding:16px 16px 0}
.template-flow-title{font-size:15px;font-weight:600;color:#e0e0e0;text-align:center;margin-bottom:16px}
.template-flow-select{width:100%;padding:8px 10px;margin-bottom:8px;background:#1e1e22;color:#d2d2d4;border:1px solid rgba(255,255,255,.08);border-radius:5px;font-family:inherit;font-size:13px;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' fill='%23888' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
.template-flow-select:focus{border-color:rgba(78,201,176,.3)}
.template-flow-select:disabled{opacity:.4;cursor:default}
.template-flow-desc{font-size:12px;color:#777;padding:0 0 8px;line-height:1.4}
.form-field-group{display:flex;flex-direction:column;gap:4px}
.form-field-label{font-size:12px;color:#aaa;font-weight:500}
.form-field-required{color:#e06060}
.form-field-input,.form-field-textarea{width:100%;background:#1e1e22;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:7px 10px;outline:none;resize:vertical;transition:border-color .15s}
.form-field-input:focus,.form-field-textarea:focus{border-color:rgba(78,201,176,.3)}
.form-field-textarea{min-height:52px;line-height:1.4}
.form-btn-row{display:flex;justify-content:center;padding:8px 16px 16px;max-width:460px;margin:0 auto}
.start-task-btn{background:#4a8bb5;color:#fff;border:none;border-radius:6px;padding:8px 28px;font-size:14px;cursor:pointer;font-family:inherit;font-weight:500;transition:background .2s}
.start-task-btn:hover{background:#5a9bc8}

/* === Todo Card === */
.todo-list{padding:2px 0}
.todo-item{display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px;color:#d2d2d4}
.todo-item:hover{color:#fff}
.todo-checkbox{accent-color:#4ec9b0;cursor:pointer;flex-shrink:0;width:14px;height:14px}
.todo-item-text{flex:1;min-width:0;line-height:1.4}
.todo-item-text.todo-done{text-decoration:line-through;color:#666;opacity:.6}
.todo-progress{display:flex;align-items:center;gap:8px;padding:8px 0 2px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px}
.todo-header-progress{font-size:11px;color:#888;margin-left:6px;font-weight:400}
.todo-progress-label{font-size:11px;color:#888;flex-shrink:0}
.todo-progress-bar{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.todo-progress-fill{height:100%;background:#4ec9b0;border-radius:2px;transition:width .3s ease}

/* ====== V1 Assistant Layout (scoped under #assistant-view) ====== */
#assistant-view{height:100vh;width:100vw;overflow:hidden;position:relative}
#assistant-view #container{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative}
#assistant-view #chat-area{position:relative;flex:1;display:flex;flex-direction:column;min-width:300px;background:var(--bg-deep)}
#assistant-view #chat-header{flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.06);width:100%;max-width:900px;margin:0 auto}
#assistant-view #chat-header.assistant-header{height:46px;overflow:hidden}
#assistant-view #chat-header-row1{display:flex;align-items:center;gap:8px;padding:16px 24px 4px}
#assistant-view .task-info-title{font-size:14px;font-weight:600;color:#e0e0e0;white-space:nowrap}
#assistant-view .task-status-badge{font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(255,255,255,.06);color:#888;flex-shrink:0;white-space:nowrap}
#assistant-view .task-status-badge.hidden{display:none}
#assistant-view .task-model-badge{font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(74,139,181,.12);color:#5a9bc8;flex-shrink:0;white-space:nowrap;font-weight:500}
#assistant-view .task-model-badge.hidden{display:none}
#assistant-view #chat-header-sub{display:flex;align-items:center;gap:8px;font-size:10px;color:#555;padding:4px 24px 6px;flex-wrap:wrap}
#assistant-view #chat-header-slogan{font-size:11px;color:#777;white-space:nowrap}
#assistant-view #chat-header-slogan.hidden{display:none}
#assistant-view #chat-header-row2{display:flex;align-items:center;gap:6px;padding:2px 24px;background:rgba(78,201,176,.03)}
#assistant-view #chat-header-row2.hidden{display:none}
#assistant-view .goal-header-text{font-size:12.5px;color:#4ec9b0;line-height:1.4;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#assistant-view .confirmed-tags{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}
#assistant-view .confirmed-tag{display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:0 5px;border-radius:3px;background:rgba(78,201,176,.08);color:#7ec8a0;white-space:nowrap}
#assistant-view .confirmed-tag::before{content:'\\2713';font-weight:700;font-size:9px}
#assistant-view #chat-header-row3{display:flex;align-items:center;gap:6px;padding:2px 24px 4px;flex-wrap:wrap}
#assistant-view #chat-header-row3.hidden{display:none}
#assistant-view .task-phase-badge{font-size:11px;padding:1px 8px;border-radius:3px;background:rgba(78,201,176,.1);color:#4ec9b0;font-weight:500;display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
#assistant-view .phase-desc{font-size:11px;color:#777;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#assistant-view #phase-confirm-btns{display:flex;gap:4px;flex-shrink:0}
#assistant-view .plan-confirm-btn{background:#4a8bb5;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;white-space:nowrap;transition:background .2s}
#assistant-view .plan-confirm-btn:hover{background:#5a9bc8}
#assistant-view .plan-confirm-btn.hidden{display:none}
#assistant-view .plan-progress-header{display:flex;align-items:center;gap:6px;flex-shrink:0}
#assistant-view .plan-progress-header.hidden{display:none}
#assistant-view #header-progress-fill{height:100%;background:#4a8bb5;border-radius:2px;transition:width .4s ease}
#assistant-view #header-progress-label{font-size:10px;color:#666;white-space:nowrap}

#assistant-view #chat-body{position:relative;flex:1;display:flex;min-height:0}
#assistant-view #node-timeline-gutter{position:absolute;left:8px;top:0;bottom:0;width:28px;z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:visible}
#assistant-view #node-timeline-gutter.hidden{display:none}
#assistant-view #tl-dots{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;width:100%;z-index:1;padding:16px 0 4px}

/* When chat-scroll is inside #chat-body (assistant view) */
#assistant-view #chat-scroll{flex:1;overflow-y:auto;min-height:0;background:var(--bg-deep);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
#assistant-view #chat-scroll.chat-empty{display:none}
#assistant-view #chat-messages{padding:0 24px 0 38px;min-height:100%;max-width:900px;margin:0 auto}



#assistant-view #chat-bottom{margin-top:auto}
#assistant-view #near-input-tools{display:flex;gap:8px;padding:0 0 8px;flex-shrink:0;flex-wrap:wrap;max-width:900px;margin:0 auto}
#assistant-view .near-tool-btn{background:transparent;border:none;color:#888;cursor:pointer;font-size:11px;padding:2px 8px;border-radius:3px;white-space:nowrap;display:flex;align-items:center;gap:4px}
#assistant-view .near-tool-btn:hover{color:#ddd;background:rgba(255,255,255,.04)}
#assistant-view #chat-input-area{border-top:1px solid rgba(255,255,255,.06);padding:12px 24px 10px;background:var(--bg-deep);flex-shrink:0;max-width:900px;margin:0 auto;width:100%}
#assistant-view #system-narration{max-width:900px;margin:0 auto;width:100%;padding:6px 24px 0;font-size:12px;color:#888;display:flex;align-items:center;gap:6px;flex-shrink:0}
#assistant-view #system-narration.hidden{display:none}
#assistant-view .input-wrapper{background:#25252a;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:10px 12px 6px;transition:border-color .2s,box-shadow .2s}
#assistant-view .input-wrapper:focus-within{border-color:#007fd4;box-shadow:0 0 8px rgba(0,127,212,.3)}
#assistant-view #chat-input{width:100%;background:transparent;color:#d2d2d4;border:none;font-family:inherit;font-size:13.5px;resize:none;outline:none;min-height:36px;max-height:200px;line-height:1.35}
#assistant-view #chat-input::placeholder{color:#555}
#assistant-view .input-footer{display:flex;align-items:center;padding-top:4px;min-height:28px;justify-content:space-between}
#assistant-view .input-footer-left{display:flex;align-items:center;gap:4px;flex:1}
#assistant-view .input-footer-right{display:flex;align-items:center;gap:2px;flex-shrink:0}
#assistant-view .input-tool-btn{background:none;border:none;color:#666;cursor:pointer;padding:4px;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:color .2s,background .2s}
#assistant-view .input-tool-btn.hidden{display:none}
#assistant-view #send-btn{color:#4a8bb5}#assistant-view #send-btn:hover{color:#5a9bc8;background:rgba(74,139,181,.1)}
#assistant-view #stop-btn{color:#c94a4a}#assistant-view #stop-btn:hover{color:#e06060;background:rgba(201,74,74,.1)}

#assistant-view .status-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}
#assistant-view .status-dot.online{background:#5a9d6b}
#assistant-view .status-dot.offline{background:#555}
#assistant-view .agent-dropdown{position:relative;display:inline-flex;align-items:center}
#assistant-view .agent-dropdown-btn{background:transparent;border:none;color:#888;font-size:12px;font-family:inherit;cursor:pointer;outline:none;display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
#assistant-view .agent-dropdown-btn:hover{color:#ccc}
#assistant-view .agent-dropdown-arrow{flex-shrink:0;opacity:.5;pointer-events:none}
#assistant-view .pill-btn{padding:1px 8px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);line-height:1.6}
#assistant-view .agent-dropdown-list{position:fixed;margin-top:2px;padding:4px 0;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:100;min-width:90px;list-style:none;overflow-y:auto}
#assistant-view .agent-dropdown-list.hidden{display:none}
#assistant-view .agent-dropdown-item{padding:5px 12px;font-size:12px;color:#ccc;cursor:pointer;transition:background .1s;display:flex;flex-direction:column;gap:1px}
#assistant-view .agent-dropdown-item:hover{background:rgba(74,139,181,.2);color:#fff}
#assistant-view .agent-name{color:#e0e0e0}
#assistant-view .agent-model{font-size:10px;color:#888}

#assistant-view #input-template-bar{display:inline-flex;align-items:center;gap:3px}
#assistant-view .shortcut-hint{font-size:10px;color:#555;margin-right:4px;white-space:nowrap}
#assistant-view #chat-header-row-assistant{display:flex;align-items:center;gap:6px;font-size:11px;color:#777;padding:4px 24px 8px;flex-wrap:wrap;font-family:'Fira Code',monospace}
#assistant-view #chat-header-row-assistant.hidden{display:none}
#assistant-view #chat-header-row-assistant strong{color:#bbb;font-weight:500}
#assistant-view #chat-header-row-assistant .header-sep{color:#444;font-size:10px}
#assistant-view #header-codemap-status{color:#2fa87b}
#assistant-view .template-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;font-size:12px;color:#666;background:rgba(255,255,255,.03);border-radius:3px;cursor:pointer;user-select:none;transition:all .15s;font-family:inherit;line-height:1.5;white-space:nowrap}
#assistant-view .template-chip:hover{color:#bbb;background:rgba(255,255,255,.07)}
#assistant-view .template-chip.active{color:#4a8bb5;background:rgba(74,139,181,.15)}
#assistant-view .template-chip .tmpl-icon{font-size:12px}

/* V1: queue bar */
#assistant-view #queue-bar{margin-bottom:6px;border:1px solid rgba(255,255,255,.08);border-radius:6px;overflow:hidden}
#assistant-view #queue-bar.hidden{display:none}
#assistant-view .queue-header{display:flex;align-items:center;padding:6px 10px;font-size:12px;gap:8px;background:rgba(255,255,255,.02);cursor:pointer}
#assistant-view #queue-summary{color:#888;flex:1}
#assistant-view .queue-action-btn{background:none;border:none;color:#666;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:3px;font-family:inherit}

/* V1: chat nav buttons */
#assistant-view #chat-nav-btns{position:absolute;bottom:12px;right:max(36px,calc((100% - 900px) / 2 + 36px));display:flex;flex-direction:column;align-items:center;gap:4px;z-index:20}
#assistant-view #chat-nav-btns.hidden{display:none}
#assistant-view .chat-nav-btn{width:26px;height:26px;border:none;background:rgba(40,40,40,.88);color:#999;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px}
#assistant-view .chat-nav-btn:disabled{opacity:.25;cursor:default}
#assistant-view .nav-top-btn,.nav-bottom-btn{width:32px;height:32px;border-radius:50%;background:#4a8bb5;color:#fff}
#assistant-view .nav-top-btn:disabled,.nav-bottom-btn:disabled{opacity:.3}

/* V1: hooks editor */
#assistant-view .hooks-edit-btn{background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:0 4px;line-height:1;transition:color .2s;border-radius:3px;flex-shrink:0}
#assistant-view .hooks-edit-btn:hover{color:#ddd;background:rgba(255,255,255,.04)}
#assistant-view .hooks-count{font-size:10px;padding:1px 5px;border-radius:3px;color:#888;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;flex-shrink:0}
#assistant-view .hooks-count.hidden{display:none}
#assistant-view .hooks-editor{padding:6px 24px 8px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.06)}
#assistant-view .hooks-editor.hidden{display:none}
#assistant-view .hooks-editor-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}
#assistant-view .hooks-editor-title{font-size:12px;color:#bbb;font-weight:500;flex:1}
#assistant-view .hooks-close-btn{background:none;border:none;color:#888;cursor:pointer;font-size:14px;padding:0 4px;line-height:1}
#assistant-view .hooks-close-btn:hover{color:#ddd}
#assistant-view #hooks-phases-list{display:flex;flex-direction:column;gap:2px}
#assistant-view .hooks-phase-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:3px;cursor:pointer;transition:background .1s}
#assistant-view .hooks-phase-row:hover{background:rgba(255,255,255,.02)}
#assistant-view .hooks-phase-row.active{background:rgba(255,255,255,.04)}
#assistant-view .hooks-phase-label{font-size:11px;font-weight:500;color:#999;width:52px;flex-shrink:0}
#assistant-view .hooks-phase-summary{font-size:11px;color:#666;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#assistant-view .hooks-phase-summary.has-any{color:#7ec8a0}
#assistant-view .hooks-phase-expand{font-size:9px;color:#555;flex-shrink:0}
#assistant-view .hooks-phase-detail{display:none;padding:4px 6px 8px 14px;border-left:2px solid rgba(255,255,255,.06);margin:0 0 2px 4px}
#assistant-view .hooks-phase-detail.open{display:block}
#assistant-view .hooks-ws-label{font-size:10px;color:#4ec9b0;font-weight:500;margin:4px 0 2px}
#assistant-view .hooks-ws-item{font-size:11px;color:#7ec8a0;padding:1px 0;line-height:1.4;padding-left:8px}
#assistant-view .hooks-task-textarea{width:100%;background:#1e1e22;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:36px;line-height:1.4;margin-top:4px}
#assistant-view .hooks-task-textarea:focus{border-color:rgba(78,201,176,.3)}
#assistant-view .hooks-detail-actions{display:flex;gap:6px;padding:4px 0 0;justify-content:flex-end}
#assistant-view .hooks-save-btn{background:#4a8bb5;color:#fff;border:none;border-radius:3px;padding:2px 10px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;transition:background .2s}
#assistant-view .hooks-save-btn:hover{background:#5a9bc8}
#assistant-view .hooks-task-label{font-size:10px;color:#5a9bc8;font-weight:500;margin:4px 0 0}
#assistant-view .hooks-count:hover{color:#ddd;background:rgba(255,255,255,.04)}

/* V1: chat-specific messages */
#assistant-view .msg-sender{display:none}
#assistant-view .user .msg-bubble{display:inline-block;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:8px 14px;background:rgba(255,255,255,.02);max-width:80%;line-height:1.5}
#assistant-view .tool-bubble{padding:0;border:none;background:transparent}

/* === Overlay Right Panel === */
#right-panel{position:fixed;right:0;top:0;height:100%;width:500px;background:var(--bg-panel);border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;z-index:20;box-shadow:-4px 0 16px rgba(0,0,0,.35)}
#right-panel.hidden{display:none}
#right-panel-header{display:flex;align-items:stretch;background:rgba(0,0,0,.15);flex-shrink:0}
.tabs{display:flex;flex:1;min-width:0;flex-wrap:wrap}
.tab{flex:1;min-width:100px;text-align:center;padding:7px 8px;background:transparent;border:none;border-bottom:1px solid rgba(255,255,255,.06);color:#666;font-size:12px;cursor:pointer;font-family:inherit}
.tab:hover{color:#999}
.tab.active{color:#ddd;font-weight:500;background:var(--bg-panel);border-bottom-color:transparent}
.tab.disabled{color:#444;cursor:default}
.tab-content{display:none;flex:1;overflow-y:auto;padding:12px;min-height:0}
.tab-content.active{display:block}
#right-panel-content{flex:1;overflow:hidden;position:relative;display:flex;flex-direction:column}
.close-btn{background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:6px 12px}
.close-btn:hover{color:#ddd}
#tab-acplog{display:none;flex-direction:column;overflow:hidden;font-size:11px;padding:0;min-height:0}
#tab-acplog.tab-content.active{display:flex}
#acp-log-toolbar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}
#acp-log-toolbar label{display:flex;align-items:center;gap:4px;cursor:pointer;color:#aaa;font-size:11px}
#acp-log-content{flex:1;overflow-y:auto;padding:4px 6px;font-family:monospace;white-space:pre-wrap;word-break:break-all;line-height:1.4;background:var(--bg-deep)}
.acp-log-entry{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.acp-log-entry.send{border-left:2px solid #4a9eff;padding-left:6px;margin:2px 0}
.acp-log-entry.recv{border-left:2px solid #6fcf97;padding-left:6px;margin:2px 0}
.acp-log-dir{display:inline-block;width:28px;font-weight:700;color:#888}
.acp-log-time{color:#666;font-size:10px;margin-right:6px}
.acp-log-text{color:#d4d4d4}

/* === Device Tab === */
#tab-device{display:none;flex-direction:column;overflow:hidden;padding:8px;min-height:0;gap:8px}
#tab-device.tab-content.active{display:flex}
#device-connect-form{display:flex;flex-direction:column;gap:6px;padding:8px;background:rgba(0,0,0,.1);border-radius:4px;flex-shrink:0}
.device-field-row{display:flex;gap:6px;flex-shrink:0}
.device-field-row select,.device-field-row input{flex:1;background:var(--bg-item);color:var(--text-main);border:1px solid #555;border-radius:3px;padding:5px 8px;font-size:12px;font-family:inherit;outline:none}
.device-field-row select:focus,.device-field-row input:focus{border-color:#4a9eff}
.device-btn-row{display:flex;gap:6px;justify-content:flex-end}
.device-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#ccc;border-radius:3px;padding:5px 14px;font-size:12px;cursor:pointer;font-family:inherit}
.device-btn.primary{background:#0e639c;border-color:#0e639c;color:#fff}
.device-btn.danger{background:#c12;border-color:#c12;color:#fff}
.device-btn.small{padding:3px 10px;font-size:11px}
#device-connected-view{display:none;flex-direction:column;flex:1;overflow:hidden}
#device-connected-view.visible{display:flex}
#device-connected-header{display:flex;align-items:center;gap:8px;padding:4px 0 6px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;font-size:12px}
.device-status-ok{color:#4ec9b0;font-size:14px}
.device-status-err{color:#e2777a;font-size:14px}
#device-connected-label{flex:1;color:#aaa}
#device-terminal{flex:1;overflow:hidden;display:flex;flex-direction:column;margin-top:4px}
#device-output{flex:1;overflow-y:auto;background:var(--bg-deep);border-radius:4px;padding:8px;font-family:monospace;font-size:13px;color:#4ec9b0;white-space:pre-wrap;line-height:1.4}
#device-input-row{display:flex;gap:4px;padding:6px 0 0;flex-shrink:0;align-items:center}
#device-input-row span{color:#4ec9b0;font-family:monospace;font-size:13px;flex-shrink:0}
#device-command-input{flex:1;background:var(--bg-item);color:var(--text-main);border:1px solid #555;border-radius:3px;padding:6px 8px;font-family:monospace;font-size:13px;outline:none}
#device-command-input:focus{border-color:#4a9eff}
#device-status-bar{display:flex;align-items:center;gap:4px;padding:4px 0;font-size:11px;color:#666;flex-shrink:0}
#device-connection-status{color:#888;font-size:11px}
.device-output-line{padding:1px 0;word-break:break-all}
.device-output-line.cmd{color:#569cd6}
.device-output-line.stdout{color:#d4d4d4}
.device-output-line.stderr{color:#e2777a}
.device-output-line.info{color:#888;font-style:italic}

/* === Plugin Manager Modal === */
#plugin-manager-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center}
#plugin-manager-overlay.hidden{display:none}
#plugin-manager-dialog{background:var(--bg-panel);border:1px solid rgba(255,255,255,.12);border-radius:8px;width:520px;max-height:70vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,.45)}
#plugin-manager-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.1);font-size:13px;font-weight:500;color:#ccc}
#plugin-manager-body{padding:8px 0;overflow-y:auto;flex:1}
.plugin-manager-hint{padding:20px;text-align:center;color:#666;font-size:12px}

/* Misc */
@keyframes spin{100%{transform:rotate(360deg)}}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
::-webkit-scrollbar-track{background:transparent}
/* === Code syntax highlighting (hljs) === */
.hljs{color:#d2d2d4}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-number,.hljs-class{color:#b5cea8}.hljs-string,.hljs-meta .hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#dcdcaa}.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#808080}.hljs-variable,.hljs-template-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background:#144212;display:inline-block;width:100%}.hljs-deletion{background:#600;display:inline-block;width:100%}
/* === Card tool-header details === */
.tool-title-label{flex-shrink:0;font-weight:500;color:#bbb}
.tool-title-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888;font-size:11.5px;min-width:0}
.msg-card-header[aria-expanded="true"]{border-bottom:1px solid rgba(255,255,255,.05)}
.msg-card-toggle svg{display:block}
@keyframes demo-pulse{0%{box-shadow:0 0 0 0 rgba(26,95,158,.2)}70%{box-shadow:0 0 0 6px rgba(26,95,158,0)}100%{box-shadow:0 0 0 0 rgba(26,95,158,0)}}


`;
}
