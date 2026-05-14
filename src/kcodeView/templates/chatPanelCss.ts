export function getInlineStyles(): string {
    return `/* === Reset & Base === */
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#ccc;background:var(--vscode-sideBar-background,#1e1e1e)}
#container{display:flex;height:100vh;width:100vw;overflow:hidden;position:relative}
#splitter-2{display:none}
#chat-area{position:relative;flex:1;display:flex;flex-direction:column;min-width:300px;background:var(--vscode-sideBar-background,#1e1e1e)}
#chat-body{position:relative;flex:1;display:flex;min-height:0}
#chat-scroll{flex:1;overflow-y:auto;min-height:0;background:var(--vscode-sideBar-background,#1e1e1e);scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
#chat-messages{padding:0 24px 0 38px;min-height:100%;max-width:900px;margin:0 auto}
/* === Timeline Gutter === */
#node-timeline-gutter{position:absolute;left:8px;top:0;bottom:0;width:28px;z-index:5;display:flex;flex-direction:column;align-items:center;pointer-events:none;overflow:visible}
#node-timeline-gutter.hidden{display:none}
#tl-dots{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;width:100%;z-index:1;padding:16px 0 4px}
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
#chat-scroll.chat-empty{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-header{display:none}
#chat-area:has(#chat-scroll.chat-empty) #chat-body{display:none}
#chat-area:has(#dashboard-panel:not(.hidden)) #chat-body{display:flex!important;align-items:flex-start;justify-content:center;flex-direction:column}
#chat-area:has(#dashboard-panel:not(.hidden)) #chat-header{display:none}
#chat-area:has(#dashboard-panel:not(.hidden)) #chat-bottom{margin-top:auto}
#chat-area:has(#dashboard-panel:not(.hidden)) #chat-input-area .input-wrapper{width:100%;max-width:900px}
#chat-body.showing-categories{display:flex!important}
#chat-body.showing-categories #chat-scroll{display:flex;flex-direction:column;align-items:center}
#chat-body.showing-categories #chat-messages{padding:0;width:100%;max-width:480px;min-height:auto}
#chat-body.showing-categories ~ #chat-bottom{display:none}

/* === Three-Row Header === */
#chat-header{flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.06);width:100%;max-width:900px;margin:0 auto}
#chat-header-row1{display:flex;align-items:center;gap:8px;padding:8px 24px 0}
.task-info-title{font-size:14px;font-weight:600;color:#e0e0e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.task-status-badge{font-size:10px;padding:1px 7px;border-radius:3px;background:rgba(255,255,255,.06);color:#888;flex-shrink:0;white-space:nowrap}
.task-status-badge.hidden{display:none}
.task-status-badge.status-pending{color:#888}
.task-status-badge.status-active{background:rgba(74,139,181,.15);color:#5a9bc8}
.task-status-badge.status-in_review{background:rgba(78,201,176,.12);color:#4ec9b0}
.task-status-badge.status-completed{background:rgba(90,157,107,.12);color:#5a9d6b}
.task-status-badge.status-cancelled{background:rgba(224,96,96,.1);color:#e06060}
#chat-header-sub{display:flex;align-items:center;gap:8px;font-size:10px;color:#555;padding:0 24px 4px;flex-wrap:wrap}
#task-info-created,#task-info-review{color:#555}
#task-info-sep{color:#333}

/* Row 2: Goal */
#chat-header-row2{display:flex;align-items:center;gap:6px;padding:2px 24px;background:rgba(78,201,176,.03)}
#chat-header-row2.hidden{display:none}
#chat-header-row2 .header-label{font-size:12px;flex-shrink:0}
.goal-header-text{font-size:12.5px;color:#4ec9b0;line-height:1.4;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.confirmed-tags{display:flex;gap:4px;flex-wrap:wrap;flex-shrink:0}
.confirmed-tags .confirmed-tag{display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:0 5px;border-radius:3px;background:rgba(78,201,176,.08);color:#7ec8a0;white-space:nowrap}
.confirmed-tags .confirmed-tag::before{content:'\u2713';font-weight:700;font-size:9px}

/* Row 3: Phase */
#chat-header-row3{display:flex;align-items:center;gap:6px;padding:2px 24px 4px;flex-wrap:wrap}
#chat-header-row3.hidden{display:none}
.task-phase-badge{font-size:11px;padding:1px 8px;border-radius:3px;background:rgba(78,201,176,.1);color:#4ec9b0;font-weight:500;display:inline-flex;align-items:center;gap:4px;flex-shrink:0}
.phase-desc{font-size:11px;color:#777;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#phase-confirm-btns{display:flex;gap:4px;flex-shrink:0}
.plan-progress-header{display:flex;align-items:center;gap:6px;flex-shrink:0}
.plan-progress-header.hidden{display:none}
#header-progress-fill{height:100%;background:#4a8bb5;border-radius:2px;transition:width .4s ease}
#header-progress-label{font-size:10px;color:#666;white-space:nowrap}
.hooks-edit-btn{background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:0 4px;line-height:1;transition:color .2s,background .2s;border-radius:3px;flex-shrink:0}
.hooks-edit-btn:hover{color:#ddd;background:rgba(255,255,255,.04)}
.hooks-count{font-size:10px;padding:1px 5px;border-radius:3px;color:#888;white-space:nowrap;display:inline-flex;align-items:center;gap:3px;flex-shrink:0}
.hooks-count.hidden{display:none}
.hooks-count.has-workspace{color:#4ec9b0;background:rgba(78,201,176,.08)}
.hooks-count.has-task{color:#5a9bc8;background:rgba(74,139,181,.08)}
.hooks-editor{padding:6px 24px 8px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.06)}
.hooks-editor.hidden{display:none}
.hooks-editor-header{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.hooks-editor-title{font-size:12px;color:#bbb;font-weight:500;flex:1}
.hooks-close-btn{background:none;border:none;color:#888;cursor:pointer;font-size:14px;padding:0 4px;line-height:1;transition:color .2s}
.hooks-close-btn:hover{color:#ddd}
#hooks-phases-list{display:flex;flex-direction:column;gap:2px}
.hooks-phase-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:3px;cursor:pointer;transition:background .1s}
.hooks-phase-row:hover{background:rgba(255,255,255,.02)}
.hooks-phase-row.active{background:rgba(255,255,255,.04)}
.hooks-phase-label{font-size:11px;font-weight:500;color:#999;width:52px;flex-shrink:0}
.hooks-phase-summary{font-size:11px;color:#666;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hooks-phase-summary.has-any{color:#7ec8a0}
.hooks-phase-expand{font-size:9px;color:#555;flex-shrink:0}
.hooks-phase-detail{display:none;padding:4px 6px 8px 14px;border-left:2px solid rgba(255,255,255,.06);margin:0 0 2px 4px}
.hooks-phase-detail.open{display:block}
.hooks-ws-label{font-size:10px;color:#4ec9b0;font-weight:500;margin:4px 0 2px}
.hooks-ws-item{font-size:11px;color:#7ec8a0;padding:1px 0;line-height:1.4;padding-left:8px}
.hooks-task-textarea{width:100%;background:#1e1e22;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:36px;line-height:1.4;margin-top:4px}
.hooks-task-textarea:focus{border-color:rgba(78,201,176,.3)}
.hooks-detail-actions{display:flex;gap:6px;padding:4px 0 0;justify-content:flex-end}
.hooks-save-btn{background:#4a8bb5;color:#fff;border:none;border-radius:3px;padding:2px 10px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;transition:background .2s}
.hooks-save-btn:hover{background:#5a9bc8}
.hooks-task-label{font-size:10px;color:#5a9bc8;font-weight:500;margin:4px 0 0}
.plan-confirm-btn{background:#4a8bb5;color:#fff;border:none;border-radius:4px;padding:1px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:500;white-space:nowrap;transition:background .2s}
.plan-confirm-btn:hover{background:#5a9bc8}
.plan-confirm-btn.hidden{display:none}

/* === Chat Messages === */
.chat-placeholder{display:flex;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px;user-select:none}
#dashboard-panel{padding:24px 32px;max-width:900px;margin:0 auto;width:100%;box-sizing:border-box}
#dashboard-panel.hidden{display:none}
.dashboard-title{font-size:18px;font-weight:600;color:#ccc;margin-bottom:20px}
.dp-section{margin-bottom:16px}
.dp-section-header{font-size:13px;font-weight:600;color:#999;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:8px}
.dp-section-header.dp-collapsible{cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px}
.dp-section-header.dp-collapsible:hover{color:#ccc}
.dp-arrow{font-size:10px;transition:transform .15s ease;flex-shrink:0}
.dp-arrow:not(.collapsed){transform:rotate(90deg)}
.dp-body.hidden{display:none}
.dp-list{display:flex;flex-direction:column;gap:2px}
.dp-item{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;cursor:pointer;color:#aaa;font-size:13px;transition:background .1s}
.dp-item:hover{background:rgba(255,255,255,.04)}
.dp-item-icon{font-size:10px;flex-shrink:0;width:16px;text-align:center}
.dp-item-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ccc}
.dp-item-type{font-size:11px;color:#666;flex-shrink:0}
.dp-item-time{font-size:11px;color:#555;flex-shrink:0;min-width:48px;text-align:right}
.dp-item-files{font-size:11px;color:#555;flex-shrink:0}
.dp-empty{text-align:center;color:#555;font-size:13px;padding:32px 0}
#working-indicator{display:flex;align-items:center;gap:8px;padding:8px 0 4px;font-size:12px;color:#888;width:100%}
#working-indicator.hidden{display:none}
.working-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:#5a9d6b;border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
.working-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-msg{padding:10px 0}
.msg-row{display:flex;align-items:center;min-height:20px}
.chat-msg.agent .msg-row{justify-content:flex-start;padding-left:2px}
.chat-msg.user .msg-row{justify-content:flex-end}
.chat-msg.system{padding:6px 0;text-align:center}
.chat-msg.system .msg-bubble{display:inline-block;font-size:12px;color:#888;padding:2px 12px;background:rgba(255,255,255,.02);border-radius:4px;line-height:1.4}
.copy-msg-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#555;cursor:pointer;padding:2px 4px;border-radius:3px;line-height:1;transition:opacity .2s,color .2s,background .2s;display:inline-flex;align-items:center;gap:3px;font-size:12px;font-family:inherit}
.chat-msg:hover .copy-msg-btn{opacity:1}
.copy-msg-btn:hover{background:rgba(255,255,255,.04);color:#999}
.chat-msg.user{text-align:right}
.chat-msg .msg-sender{display:none}
.chat-msg .msg-bubble{font-size:13.5px;line-height:1.6;word-wrap:break-word;color:#d2d2d4}
.chat-msg .msg-bubble p{margin:.3em 0}
.chat-msg .msg-bubble ul,.chat-msg .msg-bubble ol{margin:.3em 0;padding-left:1.5em}
.chat-msg .msg-bubble li{margin:.1em 0}
.chat-msg .msg-bubble hr{margin:.6em 0;border:none;border-top:1px solid rgba(255,255,255,.06)}
.chat-msg .msg-bubble table{border-collapse:collapse;margin:8px 0;font-size:13px}
.chat-msg .msg-bubble th,.chat-msg .msg-bubble td{text-align:left;padding:8px 14px;line-height:1.6}
.chat-msg .msg-bubble thead th{font-weight:600;color:#e0e0e0;border-bottom:1px solid rgba(255,255,255,.1)}
.chat-msg .msg-bubble tbody tr{border-bottom:1px solid rgba(255,255,255,.04)}
.chat-msg .msg-bubble tbody tr:last-child{border-bottom:none}
.chat-msg.user .msg-bubble{display:inline-block;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:8px 14px;background:rgba(255,255,255,.02);max-width:80%;line-height:1.5}
.chat-msg .msg-bubble code{font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12.5px;color:#d69d85;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:3px}
.chat-msg .msg-bubble pre code{color:inherit;background:transparent;padding:0;border-radius:0;font-size:12.5px}
.chat-msg .msg-bubble .code-block-wrapper{margin:12px 0;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}
.chat-msg .msg-bubble .code-block-header{display:flex;align-items:center;justify-content:space-between;padding:5px 12px;border-bottom:1px solid rgba(255,255,255,.05);font-size:11px}
.chat-msg .msg-bubble .code-lang-label{color:#666}
.chat-msg .msg-bubble .code-copy-btn{background:none;border:1px solid transparent;color:#666;cursor:pointer;font-size:11px;padding:1px 6px;border-radius:3px;font-family:inherit;opacity:0;transition:opacity .2s,background .2s}
.chat-msg .msg-bubble .code-block-wrapper:hover .code-copy-btn{opacity:1}
.chat-msg .msg-bubble .code-copy-btn:hover{background:rgba(255,255,255,.06);color:#aaa}
.chat-msg .msg-bubble .code-block-wrapper pre{padding:14px 16px;margin:0;overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.06) transparent}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar{height:4px}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-track{background:transparent}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,.06);border-radius:2px}
.chat-msg .msg-bubble .code-block-wrapper pre::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.12)}
.chat-msg .msg-bubble .code-block-wrapper code.hljs{font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12.5px;line-height:1.55;background:transparent;padding:0;display:block}
.hljs{color:#d2d2d4}.hljs-keyword,.hljs-literal,.hljs-symbol,.hljs-name{color:#569cd6}.hljs-link{color:#569cd6;text-decoration:underline}.hljs-built_in,.hljs-type{color:#4ec9b0}.hljs-number,.hljs-class{color:#b5cea8}.hljs-string,.hljs-meta .hljs-string{color:#d69d85}.hljs-regexp,.hljs-template-tag{color:#9a5334}.hljs-subst,.hljs-function,.hljs-title,.hljs-params,.hljs-formula{color:#dcdcaa}.hljs-comment,.hljs-quote{color:#6a9955;font-style:italic}.hljs-doctag{color:#608b4e}.hljs-meta,.hljs-meta .hljs-keyword,.hljs-tag{color:#808080}.hljs-variable,.hljs-template-variable{color:#bd63c5}.hljs-attr,.hljs-attribute{color:#9cdcfe}.hljs-section{color:gold}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}.hljs-bullet,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-selector-pseudo,.hljs-selector-tag{color:#d7ba7d}.hljs-addition{background:#144212;display:inline-block;width:100%}.hljs-deletion{background:#600;display:inline-block;width:100%}

/* === Chat Bottom / Input === */
#chat-toolbar{display:flex;gap:4px;padding:8px 12px;background:var(--vscode-sideBar-background,#1e1e1e);flex-shrink:0;justify-content:center;max-width:900px;margin:0 auto}
.toolbar-btn{background:transparent;border:none;color:#aaa;cursor:pointer;font-size:11px;padding:3px 10px;border-radius:3px;white-space:nowrap}
.toolbar-btn:hover{color:#ddd;background:rgba(255,255,255,.04)}
#chat-input-area{border-top:1px solid rgba(255,255,255,.06);padding:12px 24px 10px;background:var(--vscode-sideBar-background,#1e1e1e);flex-shrink:0;max-width:900px;margin:0 auto;width:100%}
.input-wrapper{background:#25252a;border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:10px 12px 6px;transition:border-color .2s,box-shadow .2s}
.input-wrapper:focus-within{border-color:var(--vscode-focusBorder,#007fd4);box-shadow:0 0 8px rgba(0,127,212,.3)}
.input-wrapper.input-flash{animation:input-flash .8s ease-out}
@keyframes input-flash{0%{box-shadow:0 0 0 0 rgba(90,150,200,.2)}50%{box-shadow:0 0 0 4px rgba(90,150,200,.1)}100%{box-shadow:0 0 0 0 rgba(90,150,200,0)}}
#chat-input{width:100%;background:transparent;color:#d2d2d4;border:none;font-family:inherit;font-size:13.5px;resize:none;outline:none;min-height:52px;max-height:200px;line-height:1.5}
#chat-input::placeholder{color:#555}
.input-footer{display:flex;align-items:center;justify-content:space-between;padding-top:4px;min-height:28px}
.input-footer-left{display:flex;align-items:center;gap:2px}
.input-footer-right{display:flex;align-items:center;gap:2px}
.input-tool-btn{background:none;border:none;color:#666;cursor:pointer;padding:4px;border-radius:3px;display:flex;align-items:center;justify-content:center;transition:color .2s,background .2s}
.input-tool-btn.hidden{display:none}
#send-btn{color:#4a8bb5}#send-btn:hover{color:#5a9bc8;background:rgba(74,139,181,.1)}
#stop-btn{color:#c94a4a}#stop-btn:hover{color:#e06060;background:rgba(201,74,74,.1)}
#queue-bar{margin-bottom:6px;border:1px solid rgba(255,255,255,.08);border-radius:6px;overflow:hidden}
#queue-bar.hidden{display:none}
.queue-header{display:flex;align-items:center;padding:6px 10px;font-size:12px;gap:8px;background:rgba(255,255,255,.02);cursor:pointer}
.queue-header:hover{background:rgba(255,255,255,.04)}
#queue-summary{color:#888;flex:1}
.queue-action-btn{background:none;border:none;color:#666;cursor:pointer;font-size:11px;padding:2px 6px;border-radius:3px;font-family:inherit}
.queue-action-btn:hover{color:#aaa;background:rgba(255,255,255,.05)}
.queue-clear{color:#c94a4a}.queue-clear:hover{color:#e06060}
#queue-list{border-top:1px solid rgba(255,255,255,.04);padding:4px 0;max-height:120px;overflow-y:auto}
#queue-list.hidden{display:none}
.queue-item{display:flex;align-items:center;padding:4px 10px;font-size:12px;gap:6px}
.queue-item-num{color:#555;flex-shrink:0;min-width:18px}
.queue-item-text{color:#999;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.queue-item-cancel{background:none;border:none;color:#555;cursor:pointer;font-size:12px;padding:1px 4px;border-radius:2px;font-family:inherit;flex-shrink:0}
.queue-item-cancel:hover{color:#c94a4a;background:rgba(255,255,255,.04)}
.input-tool-btn:hover{background:rgba(255,255,255,.05);color:#999}
.image-btn{color:#555}.image-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.attach-btn{color:#555}.attach-btn:hover{color:#999;background:rgba(255,255,255,.05)}
.status-item{display:flex;align-items:center;gap:4px;padding:1px 4px;white-space:nowrap;font-size:11px;color:#555;flex-shrink:0}
.status-item svg{opacity:.4}
.status-divider{width:1px;height:10px;background:rgba(255,255,255,.06);flex-shrink:0;margin:0 4px}
.status-dot{width:6px;height:6px;border-radius:50%;display:inline-block;flex-shrink:0}
.status-dot.online{background:#5a9d6b}
.status-dot.offline{background:#555}
#input-category-bar{display:inline-flex;align-items:center;gap:4px}
.category-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;font-size:11.5px;color:#888;background:rgba(255,255,255,.04);border-radius:10px;cursor:pointer;user-select:none;transition:all .15s;font-family:inherit;line-height:1.5}
.category-chip:hover{color:#ccc;background:rgba(255,255,255,.08)}
.category-chip.active{color:#4ec9b0;background:rgba(78,201,176,.12)}

/* === Right Output Panel — vertical sections (no tabs) === */
#right-output-panel{width:220px;min-width:140px;display:flex;flex-direction:column;background:var(--vscode-sideBar-background,#1e1e1e);border-left:1px solid rgba(255,255,255,.06);flex-shrink:0;position:relative;overflow:hidden}
#right-output-panel.collapsed{min-width:0;width:0!important;overflow:hidden;border-left:none;padding:0}
#right-output-panel.collapsed + #right-panel{display:none}
/* Edge handle: sits between chat-area and right-output-panel (outside panel), always accessible */
.output-resize-handle{width:5px;cursor:col-resize;flex-shrink:0;background:transparent;transition:background .15s}
.output-resize-handle:hover,.output-resize-handle:active{background:rgba(74,139,181,.4)}
#right-output-content{flex:1;overflow-y:auto;min-height:0;padding:6px 8px}
.op-section{margin-bottom:4px}
.op-section-title{font-size:11px;font-weight:600;color:#999;padding:4px 0 3px;border-bottom:1px solid rgba(255,255,255,.06);margin-bottom:2px}
.op-empty{font-size:11px;color:#555;text-align:center;padding:6px 0 10px}
.op-item{display:flex;align-items:center;gap:5px;padding:3px 4px;border-radius:3px;cursor:pointer;font-size:11px;color:#aaa;transition:background .1s}
.op-item:hover{background:rgba(255,255,255,.03)}
.op-item-icon{font-size:11px;flex-shrink:0;width:14px;text-align:center}
.op-item-label{font-size:9px;color:#666;flex-shrink:0;padding:0 3px;border-radius:2px;background:rgba(255,255,255,.04)}
.op-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#999}
.op-item:hover .op-item-name{color:#ccc}
.op-plan-header{font-size:10px;color:#888;margin-bottom:2px}
.op-plan-bar{height:2px;background:rgba(255,255,255,.06);border-radius:2px;margin-bottom:4px;overflow:hidden}
.op-plan-fill{height:100%;background:#4a8bb5;border-radius:2px;transition:width .4s ease}

/* === Overlay Right Panel — Diff / Preview / ACP Log (hidden by default) === */
#right-panel{position:absolute;right:0;top:0;height:100%;width:500px;background:var(--vscode-sideBar-background,#1e1e1e);border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;z-index:20;box-shadow:-4px 0 16px rgba(0,0,0,.35)}
#right-panel.hidden{display:none}
#right-panel-header{display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.tabs{display:flex;flex:1;overflow-x:auto}
.tab{padding:8px 14px;background:none;border:none;color:#777;font-size:12px;cursor:pointer;border-bottom:1px solid transparent;white-space:nowrap;transition:color .2s}
.tab:hover{color:#bbb}
.tab.active{color:#ddd;border-bottom-color:rgba(255,255,255,.2)}
.tab.disabled{color:#444;cursor:default}
.tab-content{display:none;height:100%;overflow-y:auto;padding:12px}
.tab-content.active{display:block}
#tab-acplog{display:flex;flex-direction:column;height:100%;font-size:11px}
#acp-log-toolbar{display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}
#acp-log-toolbar label{display:flex;align-items:center;gap:4px;cursor:pointer;color:#aaa;font-size:11px}
#acp-log-toolbar input[type=checkbox]{accent-color:#4a9eff;cursor:pointer}
#acp-log-content{flex:1;overflow-y:auto;padding:4px 6px;font-family:monospace;white-space:pre-wrap;word-break:break-all;line-height:1.4;background:var(--vscode-editor-background,#1e1e1e)}
.acp-log-entry{padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.acp-log-entry.send{border-left:2px solid #4a9eff;padding-left:6px;margin:2px 0}
.acp-log-entry.recv{border-left:2px solid #6fcf97;padding-left:6px;margin:2px 0}
.acp-log-dir{display:inline-block;width:28px;font-weight:700;color:#888}
.acp-log-time{color:#666;font-size:10px;margin-right:6px}
.acp-log-text{color:#d4d4d4}
.close-btn{background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:6px 12px;transition:color .2s}
.close-btn:hover{color:#ddd}
#right-panel-content{flex:1;overflow:hidden;position:relative}

/* === Chat Nav Buttons (just inside message area right edge) === */
#chat-nav-btns{position:absolute;bottom:12px;right:max(36px, calc((100% - 900px) / 2 + 36px));display:flex;flex-direction:column;align-items:center;gap:4px;z-index:20;opacity:0;transition:opacity .2s;pointer-events:none}
#chat-nav-btns:not(.hidden){opacity:1;pointer-events:auto}
.chat-nav-btn{width:26px;height:26px;border:none;background:rgba(40,40,40,.88);color:#999;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;backdrop-filter:blur(4px);transition:background .15s,color .15s}
.chat-nav-btn:hover{background:rgba(70,70,70,.9);color:#ddd}
.chat-nav-btn:disabled{opacity:.25;cursor:default;pointer-events:none}
.chat-nav-btn:disabled:hover{background:rgba(40,40,40,.88);color:#999}
.nav-bottom-btn{width:32px;height:32px;border-radius:50%;background:#4a8bb5;color:#fff;margin-top:2px}
.nav-bottom-btn:hover{background:#5a9bc8;color:#fff}
.nav-bottom-btn:disabled{opacity:.3}
.nav-bottom-btn:disabled:hover{background:#4a8bb5;color:#fff}
.nav-bottom-btn svg{display:block}

/* === Todo Card === */
.todo-list{padding:2px 0}
.todo-item{display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:13px;color:#d2d2d4}
.todo-item:hover{color:#fff}
.todo-checkbox{accent-color:#4ec9b0;cursor:pointer;flex-shrink:0;width:14px;height:14px}
.todo-item-text{flex:1;min-width:0;line-height:1.4}
.todo-item-text.todo-done{text-decoration:line-through;color:#666}
.todo-progress{display:flex;align-items:center;gap:8px;padding:8px 0 2px;border-top:1px solid rgba(255,255,255,.05);margin-top:4px}
.todo-progress-label{font-size:11px;color:#888;flex-shrink:0}
.todo-progress-bar{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.todo-progress-fill{height:100%;background:#4ec9b0;border-radius:2px;transition:width .3s ease}

/* === Card Styles (Kilo-inspired) === */
:root{
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
--tool-color-thinking:#9E9E9E
}
.msg-bubble.card-bubble{padding:0;border:none;background:transparent}
.msg-card{border:var(--card-border);border-radius:var(--card-radius);overflow:hidden;margin-bottom:6px}
.msg-card:last-child{margin-bottom:0}
.msg-card-header{display:flex;align-items:center;min-height:34px;padding:3px 10px;font-size:12px;cursor:pointer;user-select:none;gap:var(--card-gap);color:#bbb;background:var(--card-header-bg);border-left:3px solid transparent;transition:background .15s,border-color .15s}
.msg-card-header:hover{background:var(--card-header-hover)}
.msg-card-header-text{flex:1;display:flex;align-items:center;gap:5px;min-width:0}
.tool-title-label{flex-shrink:0;font-weight:500;color:#bbb}
.tool-title-detail{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#888;font-size:11.5px;min-width:0}
/* Tool type color accents on header left border */
.msg-card[data-tool-kind="bash"] .msg-card-header,.msg-card[data-tool-kind="command"] .msg-card-header,.msg-card[data-tool-kind="terminal"] .msg-card-header{border-left-color:var(--tool-color-bash)}
.msg-card[data-tool-kind="read"] .msg-card-header{border-left-color:var(--tool-color-read)}
.msg-card[data-tool-kind="write"] .msg-card-header,.msg-card[data-tool-kind="edit"] .msg-card-header{border-left-color:var(--tool-color-write)}
.msg-card[data-tool-kind="glob"] .msg-card-header{border-left-color:var(--tool-color-glob)}
.msg-card[data-tool-kind="grep"] .msg-card-header,.msg-card[data-tool-kind="search"] .msg-card-header{border-left-color:var(--tool-color-grep)}
.msg-card[data-tool-kind="thinking"] .msg-card-header{border-left-color:var(--tool-color-thinking)}
.card-copy-raw-btn{background:none;border:none;color:#555;cursor:pointer;font-size:11px;padding:0 4px;border-radius:3px;flex-shrink:0;line-height:1;transition:color .2s,background .2s;margin-left:auto;margin-right:2px}
.card-copy-raw-btn:hover{color:#ddd;background:rgba(255,255,255,.05)}
/* SVG chevron toggle */
.msg-card-toggle{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:#666;transition:transform .2s}
.msg-card-toggle svg{display:block}
.msg-card-toggle.collapsed{transform:rotate(-90deg)}
/* Header bottom border when expanded */
.msg-card-header[aria-expanded="true"]{border-bottom:1px solid rgba(255,255,255,.05)}
.msg-card-body{padding:8px 12px;font-size:13.5px;line-height:1.6;color:#fff;overflow-y:auto;max-height:300px}
.msg-card-body.tool-card-body{max-height:300px}
.msg-card-body.collapsed{display:none}
.msg-card-actions{display:flex;gap:8px;padding:8px 12px 10px;border-top:1px solid rgba(255,255,255,.05)}
.msg-card-btn{flex:1;max-width:150px;padding:5px 10px;border:none;border-radius:4px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:500;transition:all .2s}
.msg-card-btn.primary{background:#4a8bb5;color:#fff}
.msg-card-btn.primary:hover{background:#5a9bc8}
.msg-card-btn.secondary{background:rgba(255,255,255,.06);color:#d2d2d4}
.msg-card-btn.secondary:hover{background:rgba(255,255,255,.1)}
.msg-card-btn.cancel{background:transparent;color:#888;border:1px solid rgba(255,255,255,.08)}
.msg-card-btn.cancel:hover{background:rgba(255,255,255,.04);color:#bbb}
.msg-card-status{padding:4px 12px 10px;font-size:12px;color:#777;text-align:center}
.tool-kind-icon{font-size:12px;flex-shrink:0;opacity:.55;display:inline-flex;vertical-align:middle}
.tool-body-content{margin:0;white-space:pre-wrap;word-wrap:break-word;font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12px;color:#9aa;background:transparent;padding:0}
.tool-body-bash{background:rgba(0,0,0,.3);border-radius:3px;padding:8px!important}
.tool-bash-output{color:var(--tool-color-bash)}
.tool-body-diff{color:#d2d2d4}
.tool-thinking{background:rgba(0,0,0,.25)}
.tool-thinking .msg-card-header{color:#777;font-style:italic}
.tool-thinking .tool-body-content{font-size:11.5px;font-style:italic;color:#777}
.tool-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.08);border-top-color:var(--tool-color-bash);border-radius:50%;animation:tool-spin .8s linear infinite;flex-shrink:0}
@keyframes tool-spin{to{transform:rotate(360deg)}}

/* === Review / Diff / Plan === */
.review-changes{padding:6px 0 0;border-top:1px solid rgba(255,255,255,.04);margin-top:6px}
.review-changes-label{font-size:11px;color:#888;padding:4px 0 2px}
.review-changes-item{display:flex;align-items:center;gap:8px;padding:4px 4px;cursor:pointer;font-size:12px;color:#4ec9b0;border-radius:3px;transition:background .15s}
.review-changes-item:hover{background:rgba(255,255,255,.03)}
.review-changes-item.selected{background:rgba(78,201,176,.12);color:#fff}
.review-changes-icon{flex-shrink:0;font-size:13px}
.review-changes-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.review-changes-type{font-size:10px;color:#888;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.04);flex-shrink:0}
.review-changes-summary{font-size:10px;color:#5a9d6b;flex-shrink:0}
.review-changes-open{font-size:12px;color:#555;flex-shrink:0;cursor:pointer;padding:0 4px;transition:color .2s}
.review-changes-open:hover{color:#4a8bb5}
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
.goal-edit-textarea{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.12);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:8px;resize:vertical;outline:none;min-height:120px;line-height:1.5}
.goal-edit-textarea:focus{border-color:rgba(78,201,176,.4)}
.plan-confirmation-card{margin:8px 0}
.plan-steps-body{padding:4px 0}
.plan-step-line{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#d2d2d4}
.plan-step-status{font-size:12px;width:16px;text-align:center;flex-shrink:0;color:#888}
.reject-input-area{padding:4px 0;width:100%}
#partial-approve-btn{background:rgba(78,201,176,.12);color:#4ec9b0;border:1px solid rgba(78,201,176,.25)}
#partial-approve-btn:hover{background:rgba(78,201,176,.2);border-color:rgba(78,201,176,.4)}
.reject-input{width:100%;background:#25252a;border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:12px;padding:5px 7px;resize:vertical;outline:none;min-height:32px}
.reject-input:focus{border-color:rgba(255,255,255,.2)}
.reject-btn-row{display:flex;gap:6px;padding:6px 0 0;justify-content:flex-end}
.msg-sender{display:flex;align-items:center;gap:4px}
.msg-timestamp{font-size:10px;color:#555;font-weight:400}
.chat-msg.tool{padding:6px 0}
.chat-msg.tool .msg-bubble{font-size:13px;line-height:1.5;color:#b5c9a8}
.agent-diff-summary{margin-top:10px;padding:6px 10px;background:rgba(78,201,176,.04);border-left:2px solid #4ec9b0;border-radius:3px;font-size:12px;line-height:1.6;color:#9aa}
.review-inline-actions{display:flex;gap:8px;padding:8px 0 2px}
.review-inline-status{font-size:12px;color:#777;padding:6px 0 2px}
.goal-confirmed-label{font-size:11px;color:#777;padding:4px 0 2px}
.chat-msg.stop-message .msg-bubble{text-align:center;font-size:12px;color:#666;padding:4px 0}
.msg-highlight{animation:msg-highlight-fade 1.5s ease-out}
@keyframes msg-highlight-fade{0%{background:rgba(78,201,176,.1);border-left:2px solid #4ec9b0}100%{background:transparent;border-left:2px solid transparent}}

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
.review-criteria{padding:8px 0 0;margin-top:8px;border-top:1px solid rgba(255,255,255,.06)}
.review-criteria-label{font-size:11px;color:#888;padding:2px 0 6px}
.review-criteria-item{display:flex;align-items:center;gap:6px;font-size:12px;color:#aaa;padding:2px 0;cursor:pointer}
.review-criteria-item:hover{color:#ddd}
.criteria-checkbox{accent-color:#4a9eff;cursor:pointer;flex-shrink:0}
.convert-msg-btn{opacity:0;flex-shrink:0;background:none;border:none;color:#4a8bb5;cursor:pointer;padding:2px 6px;border-radius:3px;line-height:1;font-size:12px;font-family:inherit;transition:opacity .2s,color .2s,background .2s}
.chat-msg:hover .convert-msg-btn{opacity:1}
.convert-msg-btn:hover{background:rgba(74,139,181,.12);color:#5a9bc8}
.thinking-dots{display:inline-flex;gap:4px;align-items:center;padding:6px 0}
.thinking-dots .dot{width:5px;height:5px;border-radius:50%;background:#666;animation:dot-bounce 1.4s infinite ease-in-out both}
.thinking-dots .dot:nth-child(1){animation-delay:-0.32s}
.thinking-dots .dot:nth-child(2){animation-delay:-0.16s}
.thinking-dots .dot:nth-child(3){animation-delay:0s}
@keyframes dot-bounce{0%,80%,100%{transform:scale(0.6);opacity:.3}40%{transform:scale(1);opacity:.8}}
`;
}
