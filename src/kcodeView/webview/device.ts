// Device Tab - SSH/Telnet remote device demo display and interaction

export function connectToDevice(host: string, port: number, type: 'ssh' | 'telnet') {
    const el = document.getElementById('tab-device');
    if (!el) return;

    el.innerHTML = `
        <div style="display:flex;flex-direction:column;height:100%;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #3c3c3c;margin-bottom:8px;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span>${type === 'ssh' ? '🔒' : '🔓'}</span>
                    <span style="color:#d4d4d4;font-size:13px;">${escapeHtml(host)}:${port}</span>
                    <span style="color:#4ec9b0;font-size:11px;">● connected</span>
                </div>
                <button id="btn-device-disconnect" style="background:#c12;color:#fff;border:none;border-radius:3px;padding:3px 10px;font-size:11px;cursor:pointer;">断开</button>
            </div>
            <div id="device-output" style="flex:1;background:#0d0d0d;border-radius:4px;padding:12px;overflow-y:auto;font-family:'Cascadia Code',Consolas,monospace;font-size:13px;color:#4ec9b0;white-space:pre-wrap;line-height:1.4;">
                <span style="color:#888;">// Connected to ${host}:${port} via ${type.toUpperCase()}</span>
                <span style="color:#888;">// Ready for demo interaction</span>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-shrink:0;">
                <input id="device-input" type="text" placeholder="输入命令..." style="flex:1;background:#3c3c3c;color:#d4d4d4;border:1px solid #555;border-radius:4px;padding:8px 10px;font-family:monospace;font-size:13px;outline:none;">
                <button id="device-send-btn" class="send-btn" style="padding:6px 16px;">发送</button>
            </div>
        </div>
    `;

    const input = document.getElementById('device-input') as HTMLInputElement;
    const sendBtn = document.getElementById('device-send-btn');
    const output = document.getElementById('device-output');
    const disconnectBtn = document.getElementById('btn-device-disconnect');

    function sendCommand() {
        if (!input || !output) return;
        const cmd = input.value.trim();
        if (!cmd) return;
        output.innerHTML += `\r\n<span style="color:#569cd6;">$ ${escapeHtml(cmd)}</span>\r\n`;
        input.value = '';
        // Placeholder: actual SSH/telnet in future
        output.innerHTML += `<span style="color:#888;">// 命令 "${escapeHtml(cmd)}" 已发送 (设备交互将在后续版本实现)</span>\r\n`;
        output.scrollTop = output.scrollHeight;
    }

    sendBtn?.addEventListener('click', sendCommand);
    input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendCommand();
    });

    disconnectBtn?.addEventListener('click', () => {
        disconnectDevice();
    });

    // Focus input
    setTimeout(() => input?.focus(), 100);
}

export function disconnectDevice() {
    const el = document.getElementById('tab-device');
    if (el) {
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;gap:12px;">
                <span style="font-size:32px;">🔌</span>
                <span style="font-size:14px;">设备已断开连接</span>
                <button id="btn-device-reconnect" style="background:#0e639c;color:#fff;border:none;border-radius:4px;padding:6px 20px;font-size:13px;cursor:pointer;">重新连接</button>
            </div>
        `;
        document.getElementById('btn-device-reconnect')?.addEventListener('click', () => {
            showDeviceFallback();
        });
    }
}

export function appendDeviceOutput(text: string) {
    const output = document.getElementById('device-output');
    if (!output) return;
    output.innerHTML += escapeHtml(text);
    output.scrollTop = output.scrollHeight;
}

function showDeviceFallback() {
    const el = document.getElementById('tab-device');
    if (!el) return;
    el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#888;gap:16px;">
            <div style="font-size:40px;">🖥️</div>
            <div style="font-size:14px;">Device Tab - 远程设备 Demo 展示</div>
            <div style="font-size:12px;text-align:center;max-width:280px;">
              在此展示远程设备 (SSH/Telnet) 上运行的程序。
            </div>
        </div>
    `;
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Register globals
(window as any).connectToDevice = connectToDevice;
(window as any).disconnectDevice = disconnectDevice;
(window as any).appendDeviceOutput = appendDeviceOutput;
