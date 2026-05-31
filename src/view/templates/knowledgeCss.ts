export function getKnowledgeStyles(): string {
    return `*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#ccc;background:var(--vscode-sideBar-background,#1e1e1e)}
#container{display:flex;height:100vh;width:100vw;overflow:hidden;flex-direction:column}
#header{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
#header h1{font-size:16px;font-weight:600;color:#e0e0e0;margin-bottom:8px}
#search-bar{display:flex;gap:8px;align-items:center}
#search-input{flex:1;background:#25252a;border:1px solid rgba(255,255,255,.08);border-radius:4px;color:#d2d2d4;font-family:inherit;font-size:13px;padding:6px 10px;outline:none}
#search-input:focus{border-color:rgba(78,201,176,.3)}
#type-filter{display:flex;gap:4px}
.filter-btn{background:transparent;border:1px solid rgba(255,255,255,.06);color:#888;font-size:11px;padding:3px 10px;border-radius:4px;cursor:pointer;font-family:inherit;transition:all .15s}
.filter-btn:hover{color:#bbb;border-color:rgba(255,255,255,.12)}
.filter-btn.active{color:#4ec9b0;border-color:#4ec9b0;background:rgba(78,201,176,.08)}
#body{flex:1;display:flex;overflow:hidden;min-height:0}
#sidebar{width:300px;min-width:200px;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto;flex-shrink:0}
#sidebar.collapsed{width:0;min-width:0;overflow:hidden;border:none}
#content{flex:1;overflow-y:auto;padding:16px 24px;min-width:0}
#entry-count{font-size:11px;color:#666;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.04)}
.knowledge-list-item{display:flex;flex-direction:column;gap:3px;padding:8px 12px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s}
.knowledge-list-item:hover{background:rgba(255,255,255,.02)}
.knowledge-list-item.active{background:rgba(78,201,176,.06);border-left:2px solid #4ec9b0}
.kli-title{font-size:13px;color:#d2d2d4;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kli-type{font-size:10px;color:#666;flex-shrink:0}
.kli-tags{display:flex;gap:3px;flex-wrap:wrap}
.kli-tag{font-size:10px;color:#5a9bc8;background:rgba(74,139,181,.08);padding:0 5px;border-radius:2px}
.kli-time{font-size:10px;color:#555;margin-top:2px}
.detail-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.06)}
.detail-title{font-size:18px;font-weight:600;color:#e0e0e0;margin-bottom:6px}
.detail-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;color:#666}
.detail-tags{display:flex;gap:4px;flex-wrap:wrap}
.detail-tag{font-size:11px;color:#5a9bc8;background:rgba(74,139,181,.08);padding:0 6px;border-radius:3px}
.detail-content{font-size:13.5px;line-height:1.7;color:#d2d2d4}
.detail-content p{margin:.4em 0}
.detail-content code{font-family:'Cascadia Code','Fira Code',Consolas,monospace;font-size:12.5px;color:#d69d85;background:rgba(255,255,255,.04);padding:1px 5px;border-radius:3px}
.detail-content pre{background:rgba(0,0,0,.3);border-radius:4px;padding:12px 16px;margin:10px 0;overflow-x:auto}
.detail-content pre code{background:transparent;padding:0;color:#d2d2d4}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#555;font-size:14px;gap:8px}
#detail-source{margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);font-size:11px;color:#666}
#detail-source a{color:#4a8bb5;text-decoration:none;cursor:pointer}
#detail-source a:hover{text-decoration:underline}
`;
}