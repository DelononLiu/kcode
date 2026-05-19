const _dvcVscode: any = (window as any).__vscode;

let connected = false;
let savedDevices: any[] = [];

function dbg(msg: string) {
    console.log('[device]', msg);
    try { _dvcVscode?.postMessage({ type: 'deviceDebugLog', text: msg }); } catch {}
}

function updateFormFieldsImpl(typeSelect: HTMLSelectElement) {
    const hostRow = document.getElementById('device-host-row');
    const portRow = document.getElementById('device-port-row');
    const usernameRow = document.getElementById('device-username-row');
    const passwordRow = document.getElementById('device-password-row');
    const keyRow = document.getElementById('device-key-row');
    const portInput = document.getElementById('device-port') as HTMLInputElement;
    const type = typeSelect.value;
    if (hostRow) hostRow.style.display = type !== 'local' ? '' : 'none';
    if (portRow) portRow.style.display = type !== 'local' ? '' : 'none';
    if (usernameRow) usernameRow.style.display = (type === 'ssh' || type === 'telnet') ? '' : 'none';
    if (passwordRow) passwordRow.style.display = (type === 'ssh' || type === 'telnet') ? '' : 'none';
    if (keyRow) keyRow.style.display = type === 'ssh' ? '' : 'none';
    if (portInput) portInput.value = type === 'ssh' ? '22' : type === 'telnet' ? '23' : '5555';
}

function fillFormFromPreset(device: any) {
    if (!device) return;
    const typeSelect = document.getElementById('device-type') as HTMLSelectElement;
    const hostInput = document.getElementById('device-host') as HTMLInputElement;
    const portInput = document.getElementById('device-port') as HTMLInputElement;
    const usernameInput = document.getElementById('device-username') as HTMLInputElement;
    const passwordInput = document.getElementById('device-password') as HTMLInputElement;
    if (typeSelect) typeSelect.value = device.type || 'ssh';
    if (hostInput) hostInput.value = device.host || '';
    if (portInput) portInput.value = String(device.port || '');
    if (usernameInput) usernameInput.value = device.username || '';
    if (passwordInput) passwordInput.value = device.password || '';
    if (typeSelect) updateFormFieldsImpl(typeSelect);
}

function updatePresetDropdown(devices: any[]) {
    const presetSelect = document.getElementById('device-preset-select') as HTMLSelectElement;
    if (!presetSelect) { dbg('presetSelect not found'); return; }
    presetSelect.innerHTML = '<option value="">— 从配置加载 —</option>';
    for (let i = 0; i < devices.length; i++) {
        const d = devices[i];
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = `${d.name || '未命名'} (${d.type || 'ssh'}: ${d.host || ''}:${d.port || ''})`;
        presetSelect.appendChild(opt);
    }
    dbg(`preset dropdown updated: ${devices.length} devices`);
}

export function initDeviceTab() {
    try {
        if (!_dvcVscode) { console.error('[device] vscode API not available, cannot init'); return; }
        dbg('initDeviceTab() called');

        const typeSelect = document.getElementById('device-type') as HTMLSelectElement | null;
        const connectBtn = document.getElementById('btn-device-connect');
        const disconnectBtn = document.getElementById('btn-device-disconnect');
        const commandInput = document.getElementById('device-command-input') as HTMLInputElement | null;
        const sendBtn = document.getElementById('btn-device-send');
        const output = document.getElementById('device-output');
        const statusEl = document.getElementById('device-connection-status');
        const presetSelect = document.getElementById('device-preset-select') as HTMLSelectElement | null;

        dbg(`typeSelect=${!!typeSelect} connectBtn=${!!connectBtn} disconnectBtn=${!!disconnectBtn} commandInput=${!!commandInput} sendBtn=${!!sendBtn} output=${!!output} statusEl=${!!statusEl} presetSelect=${!!presetSelect}`);

        if (!connectBtn) { dbg('ERROR: btn-device-connect not found!'); return; }
        if (!typeSelect) { dbg('ERROR: device-type not found!'); return; }

        presetSelect?.addEventListener('change', () => {
            const idx = parseInt(presetSelect.value, 10);
            if (isNaN(idx) || idx < 0) return;
            fillFormFromPreset(savedDevices[idx]);
            dbg(`preset selected: ${idx}`);
        });

        typeSelect.addEventListener('change', () => updateFormFieldsImpl(typeSelect));
        updateFormFieldsImpl(typeSelect);

        connectBtn.addEventListener('click', () => {
            try {
                dbg('connect button clicked');
                if (connected) { dbg('already connected, ignoring'); return; }
                const type = typeSelect.value;
                const config: any = { type };
                if (type !== 'local') {
                    const hostInput = document.getElementById('device-host') as HTMLInputElement;
                    const portInput = document.getElementById('device-port') as HTMLInputElement;
                    const usernameInput = document.getElementById('device-username') as HTMLInputElement;
                    const passwordInput = document.getElementById('device-password') as HTMLInputElement;
                    const keyPathInput = document.getElementById('device-key-path') as HTMLInputElement;
                    config.host = hostInput?.value.trim() || 'localhost';
                    config.port = parseInt(portInput?.value || '22', 10);
                    if (usernameInput?.value) config.username = usernameInput.value.trim();
                    if (passwordInput?.value) config.password = passwordInput.value;
                    if (type === 'ssh' && keyPathInput?.value) config.privateKey = keyPathInput.value.trim();
                } else {
                    config.host = 'localhost';
                    config.port = 0;
                }
                const connectedView = document.getElementById('device-connected-view');
                const connectForm = document.getElementById('device-connect-form');
                const out = document.getElementById('device-output');
                if (connectedView) connectedView.classList.add('visible');
                if (connectForm) connectForm.style.display = 'none';
                if (out) {
                    out.innerHTML += `<div class="device-output-line info">→ 正在连接 ${config.type}://${config.host}:${config.port} ...</div>\n`;
                    out.scrollTop = out.scrollHeight;
                }
                dbg(`postMessage deviceConnect: type=${config.type} host=${config.host} port=${config.port}`);
                _dvcVscode?.postMessage({ type: 'deviceConnect', config });
                if (statusEl) statusEl.textContent = '正在连接...';
            } catch (e: any) {
                dbg(`connect click error: ${e?.message || e}`);
            }
        });

        disconnectBtn?.addEventListener('click', () => {
            dbg('disconnect button clicked');
            _dvcVscode?.postMessage({ type: 'deviceDisconnect' });
        });

        function sendCommand() {
            if (!commandInput || !output) return;
            const cmd = commandInput.value.trim();
            if (!cmd) return;
            output.innerHTML += `<div class="device-output-line cmd">$ ${escapeHtml(cmd)}</div>\n`;
            commandInput.value = '';
            _dvcVscode?.postMessage({ type: 'deviceCommand', command: cmd });
            output.scrollTop = output.scrollHeight;
            dbg(`command sent: ${cmd}`);
        }

        sendBtn?.addEventListener('click', sendCommand);
        commandInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendCommand();
        });

        _dvcVscode?.postMessage({ type: 'getSavedDevices' });
        dbg('initDeviceTab() done');
    } catch (e: any) {
        console.error('[device] initDeviceTab error:', e);
        try { _dvcVscode?.postMessage({ type: 'deviceDebugLog', text: `initDeviceTab error: ${e?.message || e}` }); } catch {}
    }
}

export function handleSavedDevices(devices: any[]) {
    savedDevices = devices || [];
    dbg(`handleSavedDevices: ${savedDevices.length} devices`);
    updatePresetDropdown(savedDevices);
}

export function handleDeviceConnected(config: any) {
    dbg(`handleDeviceConnected: ${config.type} ${config.host}:${config.port}`);
    connected = true;
    const connectForm = document.getElementById('device-connect-form');
    const connectedView = document.getElementById('device-connected-view');
    const statusEl = document.getElementById('device-connection-status');
    const connectedLabel = document.getElementById('device-connected-label');
    const output = document.getElementById('device-output');
    if (connectForm) connectForm.style.display = 'none';
    if (connectedView) connectedView.classList.add('visible');
    if (connectedLabel) connectedLabel.textContent = `${config.type.toUpperCase()} ${config.host}:${config.port}`;
    if (statusEl) statusEl.textContent = '已连接';
    if (output) {
        output.innerHTML += `<div class="device-output-line info">✔ 已连接到 ${config.type}://${config.host}:${config.port}</div>\n`;
        output.scrollTop = output.scrollHeight;
    }
    setTimeout(() => {
        const input = document.getElementById('device-command-input');
        input?.focus();
    }, 100);
}

export function handleDeviceDisconnected() {
    dbg('handleDeviceDisconnected');
    connected = false;
    const connectForm = document.getElementById('device-connect-form');
    const connectedView = document.getElementById('device-connected-view');
    const statusEl = document.getElementById('device-connection-status');
    const output = document.getElementById('device-output');
    if (connectForm) connectForm.style.display = '';
    if (connectedView) connectedView.classList.remove('visible');
    if (statusEl) statusEl.textContent = '未连接';
    if (output) output.innerHTML = '';
}

export function handleDeviceOutput(data: string) {
    const output = document.getElementById('device-output');
    if (!output) { dbg('handleDeviceOutput: output element not found'); return; }
    const lines = data.split('\n').filter((l: string) => l.length > 0);
    for (const line of lines) {
        const cls = line.startsWith('\x1b[31m') ? 'stderr' : 'stdout';
        const text = line.replace(/\x1b\[[0-9;]*m/g, '');
        output.innerHTML += `<div class="device-output-line ${cls}">${escapeHtml(text)}</div>\n`;
    }
    output.scrollTop = output.scrollHeight;
}

export function handleDeviceStatus(status: string, message: string) {
    dbg(`handleDeviceStatus: ${status} - ${message}`);
    const statusEl = document.getElementById('device-connection-status');
    const indicator = document.getElementById('device-status-indicator');
    if (statusEl) statusEl.textContent = message;
    if (indicator) {
        if (status === 'connected') indicator.className = 'device-status-ok';
        else if (status === 'error') indicator.className = 'device-status-err';
    }
    if (status === 'error') {
        const output = document.getElementById('device-output');
        if (output) {
            output.innerHTML += `<div class="device-output-line stderr">[错误] ${escapeHtml(message)}</div>\n`;
            output.scrollTop = output.scrollHeight;
        }
        const connectedView = document.getElementById('device-connected-view');
        if (connectedView && !connectedView.classList.contains('visible')) {
            connectedView.classList.add('visible');
        }
    }
    const statusBar = document.getElementById('device-status-bar');
    if (statusBar) statusBar.style.display = '';
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(window as any).initDeviceTab = initDeviceTab;
(window as any).handleSavedDevices = handleSavedDevices;
(window as any).handleDeviceConnected = handleDeviceConnected;
(window as any).handleDeviceDisconnected = handleDeviceDisconnected;
(window as any).handleDeviceOutput = handleDeviceOutput;
(window as any).handleDeviceStatus = handleDeviceStatus;
