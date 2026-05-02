// Right panel tabs: Preview / Diff / WebView / Device

export function showPreview(filePath: string, content: string) {
    const el = document.getElementById('tab-preview');
    if (!el) return;

    const fileName = filePath.split('/').pop() || filePath;

    el.innerHTML = `
        <div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #3c3c3c;font-size:12px;color:#888;">
            📄 ${escapeHtml(filePath)}
        </div>
        <pre style="white-space:pre-wrap;font-family:'Cascadia Code',Consolas,monospace;font-size:13px;color:#d4d4d4;background:#1e1e1e;padding:8px;border-radius:4px;overflow:auto;height:calc(100% - 30px);">${escapeHtml(content)}</pre>
    `;
}

export function showDiff(original: string, modified: string) {
    const el = document.getElementById('tab-diff');
    if (!el) return;

    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const maxLen = Math.max(origLines.length, modLines.length);

    let html = '<div style="font-family:\'Cascadia Code\',Consolas,monospace;font-size:12px;overflow:auto;height:100%;">';
    html += '<table style="width:100%;border-collapse:collapse;">';
    for (let i = 0; i < maxLen; i++) {
        const o = origLines[i] ?? '';
        const m = modLines[i] ?? '';
        if (o !== m) {
            html += `<tr style="background:#3a1a1a;"><td style="color:#e2777a;padding:2px 8px;width:50%;white-space:pre;">${escapeHtml(o)}</td>`;
            html += `<td style="color:#7ec87e;padding:2px 8px;width:50%;white-space:pre;">${escapeHtml(m)}</td></tr>`;
        } else {
            html += `<tr><td style="padding:2px 8px;width:50%;white-space:pre;color:#888;">${escapeHtml(o)}</td>`;
            html += `<td style="padding:2px 8px;width:50%;white-space:pre;color:#888;">${escapeHtml(m)}</td></tr>`;
        }
    }
    html += '</table></div>';
    el.innerHTML = html;
}

export function showWebView(url: string) {
    const el = document.getElementById('tab-webview');
    if (!el) return;

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
            <div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #3c3c3c;margin-bottom:8px;">
                <span style="color:#888;font-size:12px;">🔗 ${escapeHtml(url)}</span>
                <button id="btn-refresh-webview" style="background:none;border:none;color:#0e639c;cursor:pointer;font-size:12px;">⟳ 刷新</button>
            </div>
            <iframe src="${url}" style="flex:1;width:100%;border:none;background:#fff;border-radius:4px;"></iframe>
        </div>
    `;

    document.getElementById('btn-refresh-webview')?.addEventListener('click', () => {
        const iframe = el.querySelector('iframe');
        if (iframe) {
            (iframe as HTMLIFrameElement).src = url;
        }
    });
}

export function showDeviceFallback() {
    const el = document.getElementById('tab-device');
    if (!el) return;

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;gap:16px;">
            <div style="font-size:40px;">🖥️</div>
            <div style="font-size:14px;">Device Tab - 远程设备 Demo 展示</div>
            <div style="font-size:12px;text-align:center;max-width:280px;">
               用于展示/交互在远程设备 (SSH/Telnet) 上运行的 demo 程序。<br>
               设备连接功能将在后续版本实现。
            </div>
        </div>
    `;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Register globals
(window as any).showPreview = showPreview;
(window as any).showDiff = showDiff;
(window as any).showWebView = showWebView;
(window as any).showDeviceFallback = showDeviceFallback;
