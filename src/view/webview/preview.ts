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

type DiffLine = { type: 'equal' | 'insert' | 'delete'; text: string; oldNum?: number; newNum?: number };

function computeDiff(original: string[], modified: string[]): DiffLine[] {
    const oLen = original.length;
    const mLen = modified.length;

    const dp: number[][] = Array.from({ length: oLen + 1 }, () => Array(mLen + 1).fill(0));
    for (let i = 1; i <= oLen; i++) {
        for (let j = 1; j <= mLen; j++) {
            dp[i][j] = original[i - 1] === modified[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const result: DiffLine[] = [];
    let i = oLen, j = mLen;
    const temp: DiffLine[] = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && original[i - 1] === modified[j - 1]) {
            temp.push({ type: 'equal', text: original[i - 1], oldNum: i, newNum: j });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            temp.push({ type: 'insert', text: modified[j - 1], newNum: j });
            j--;
        } else {
            temp.push({ type: 'delete', text: original[i - 1], oldNum: i });
            i--;
        }
    }

    return temp.reverse();
}

function escapeAttr(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateDiffHtml(original: string, modified: string): string {
    const oLines = original ? original.split('\n') : [];
    const mLines = modified ? modified.split('\n') : [];
    if (oLines.length === 0 && mLines.length === 0) return '<div style="padding:12px;color:#888;text-align:center;">文件无差异</div>';
    const diffLines = computeDiff(oLines, mLines);

    const CONTEXT = 3;

    const changeRegions: { start: number; end: number }[] = [];
    let inChange = false;
    let regionStart = 0;

    for (let i = 0; i < diffLines.length; i++) {
        if (diffLines[i].type !== 'equal') {
            if (!inChange) {
                regionStart = Math.max(0, i - CONTEXT);
                inChange = true;
            }
        } else if (inChange) {
            let nextChange = -1;
            for (let j = i + 1; j < Math.min(diffLines.length, i + 1 + CONTEXT); j++) {
                if (diffLines[j].type !== 'equal') { nextChange = j; break; }
            }
            if (nextChange === -1) {
                changeRegions.push({ start: regionStart, end: Math.min(diffLines.length, i + CONTEXT) });
                inChange = false;
            }
        }
    }
    if (inChange) {
        changeRegions.push({ start: regionStart, end: diffLines.length });
    }

    if (changeRegions.length === 0) return '<div style="padding:12px;color:#888;text-align:center;">文件无差异</div>';

    let html = '<div class="unified-diff">';
    for (const region of changeRegions) {
        const lines = diffLines.slice(region.start, region.end);
        const firstChange = lines.find(l => l.type !== 'equal') || lines[0];
        const lastChange = [...lines].reverse().find(l => l.type !== 'equal') || lines[lines.length - 1];
        const oldStart = firstChange.oldNum ?? 1;
        const newStart = firstChange.newNum ?? 1;
        const oldCount = (lastChange.oldNum ?? 1) - oldStart + 1;
        const newCount = (lastChange.newNum ?? 1) - newStart + 1;

        html += `<div class="diff-hunk-header">@@ -${oldStart},${oldCount} +${newStart},${newCount} @@</div>`;
        for (const line of lines) {
            const prefix = line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' ';
            const cls = line.type === 'insert' ? 'diff-add' : line.type === 'delete' ? 'diff-del' : 'diff-eq';
            html += `<div class="diff-line ${cls}"><span class="diff-ln">${line.oldNum || ''}</span><span class="diff-ln diff-ln-new">${line.newNum || ''}</span><span class="diff-prefix">${prefix}</span><span class="diff-text">${escapeHtml(line.text)}</span></div>`;
        }
    }
    html += '</div>';
    return html;
}

export function showDiff(original: string, modified: string) {
    const el = document.getElementById('tab-diff');
    if (!el) return;
    el.innerHTML = generateDiffHtml(original, modified);
}

export function showDiffWithFile(original: string, modified: string, filePath: string) {
    const el = document.getElementById('tab-diff');
    if (!el) return;
    const fileName = filePath.split('/').pop() || filePath;
    el.innerHTML = `
        <div class="diff-file-header">
            <span>📄 ${escapeHtml(filePath)}</span>
            <button class="diff-open-native" data-original="${escapeAttr(original)}" data-modified="${escapeAttr(modified)}" data-file="${escapeAttr(filePath)}">⇱ 打开原生对比</button>
        </div>
        ${generateDiffHtml(original, modified)}
    `;
    el.querySelector('.diff-open-native')?.addEventListener('click', () => {
        const btn = el.querySelector('.diff-open-native') as HTMLElement;
        if (!btn) return;
        (window as any).__openNativeDiff?.(btn.dataset.original || '', btn.dataset.modified || '', btn.dataset.file || '');
    });
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
(window as any).showDiffWithFile = showDiffWithFile;
(window as any).generateDiffHtml = generateDiffHtml;
(window as any).showWebView = showWebView;
(window as any).showDeviceFallback = showDeviceFallback;
