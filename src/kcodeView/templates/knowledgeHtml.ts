import * as vscode from 'vscode';
import { getKnowledgeStyles } from './knowledgeCss';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'out', 'kcodeView', 'webview', 'knowledge.bundle.js')
    ).toString();
    const styles = getKnowledgeStyles();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; img-src ${webview.cspSource} data:;">
    <style>${styles}</style>
    <title>知识库</title>
</head>
<body>
    <div id="container">
        <div id="header">
            <h1>知识库</h1>
            <div id="search-bar">
                <input id="search-input" type="text" placeholder="搜索知识条目..." />
                <div id="type-filter">
                    <button class="filter-btn active" data-type="all">全部</button>
                    <button class="filter-btn" data-type="decision">📐 决策</button>
                    <button class="filter-btn" data-type="pitfall">🐛 踩坑</button>
                    <button class="filter-btn" data-type="pattern">🔧 模式</button>
                    <button class="filter-btn" data-type="code_snippet">💻 代码段</button>
                </div>
            </div>
        </div>
        <div id="body">
            <div id="sidebar">
                <div id="entry-count">共 0 条</div>
                <div id="entry-list"></div>
            </div>
            <div id="content">
                <div id="detail-view" class="empty-state">
                    <span>📖</span>
                    <span>选择一条知识条目查看详情</span>
                </div>
            </div>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
}
