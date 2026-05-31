(() => {
    const vscode = acquireVsCodeApi();

    let config: any = {};
    let draft: any = {};
    let isDirty = false;
    let globalPath = '';
    let projectPath = '';

    let deviceListJson = '';

    const TAB_CONFIGS: Record<string, { label: string; fields: FieldDef[] }> = {
        agent: {
            label: 'Agent',
            fields: [
                { key: 'agentName', label: 'Agent 名称', desc: 'Agent 名称或可执行路径。留空表示无 agent', type: 'text', default: '' },
                { key: 'agentArgs', label: 'Agent 参数', desc: '传递给 agent 的额外参数（逗号分隔）', type: 'text', default: '', transform: { to: (v: any) => Array.isArray(v) ? v.join(', ') : v, from: (v: string) => v.split(',').map((s: string) => s.trim()).filter(Boolean) } },
                { key: 'agentPath', label: 'Agent 路径', desc: 'Agent 可执行路径（用于 opencode/kilo）', type: 'text', default: '' },
            ],
        },
        provider: {
            label: 'Provider',
            fields: [
                { key: 'provider.openai.apiKey', label: 'OpenAI API Key', desc: 'OpenAI API key；可回退到 OPENAI_API_KEY 环境变量', type: 'password', default: '' },
                { key: 'provider.openai.model', label: '模型', desc: 'OpenAI 模型名；可回退到 OPENAI_MODEL 环境变量', type: 'text', default: 'deepseek-v4-flash' },
                { key: 'provider.openai.baseUrl', label: 'API Base URL', desc: 'OpenAI API base URL；可回退到 OPENAI_BASE_URL 环境变量', type: 'text', default: 'https://api.deepseek.com' },
            ],
        },
        log: {
            label: 'ACP Log',
            fields: [
                { key: 'log.acpLogEnabled', label: '启用日志', desc: '是否启用 ACP 日志收集', type: 'checkbox', default: false },
                { key: 'log.acpLogMaxGlobal', label: '全局最大日志数', desc: '所有任务中最大 ACP 日志条目数', type: 'number', default: 5000 },
                { key: 'log.acpLogMaxTask', label: '单任务最大日志数', desc: '单个任务中最大 ACP 日志条目数', type: 'number', default: 2000 },
            ],
        },
        github: {
            label: 'GitHub',
            fields: [
                { key: 'github.token', label: 'GitHub Token', desc: 'GitHub Personal Access Token，用于提高 API rate limit', type: 'password', default: '' },
            ],
        },
        device: {
            label: '设备',
            fields: [],
        },
        about: {
            label: '关于',
            fields: [],
        },
    };

    interface FieldDef {
        key: string;
        label: string;
        desc: string;
        type: 'text' | 'password' | 'number' | 'checkbox';
        default: any;
        transform?: { to: (v: any) => any; from: (v: any) => any };
    }

    function getNested(obj: any, key: string): any {
        return key.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
    }

    function setNested(obj: any, key: string, value: any): void {
        const parts = key.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
    }

    function cloneDeep(obj: any): any {
        return JSON.parse(JSON.stringify(obj));
    }

    function renderPanels(): void {
        const container = document.getElementById('panels')!;
        container.innerHTML = '';

        for (const [tabId, tabCfg] of Object.entries(TAB_CONFIGS)) {
            const panel = document.createElement('div');
            panel.className = 'settings-panel' + (tabId === 'agent' ? ' active' : '');
            panel.id = `panel-${tabId}`;

            if (tabId === 'device') {
                const devices: any[] = getNested(draft, 'devices') || [];
                deviceListJson = JSON.stringify(devices, null, 2);
                panel.innerHTML = `
                    <h2>📡 设备</h2>
                    <p class="desc">预配置的设备连接。在 Device 面板中可直接选择已保存的设备快速连接。</p>
                    <div class="device-list" id="device-list-panel"></div>
                    <textarea class="device-json-editor" id="device-json-editor" rows="8">${escapeHtml(deviceListJson)}</textarea>
                    <div class="device-btn-row">
                        <button class="btn btn-secondary" id="btn-device-add-template">+ 添加模板</button>
                        <button class="btn btn-secondary" id="btn-device-apply-json">应用 JSON</button>
                    </div>
                `;
                renderDeviceListPreview(devices);
                panel.querySelector('#btn-device-add-template')?.addEventListener('click', () => {
                    const devices: any[] = getNested(draft, 'devices') || [];
                    devices.push({ name: '新设备', type: 'ssh', host: '192.168.1.1', port: 22, username: 'root', password: '' });
                    setDraftField('devices', devices);
                    deviceListJson = JSON.stringify(devices, null, 2);
                    const editor = document.getElementById('device-json-editor') as HTMLTextAreaElement;
                    if (editor) editor.value = deviceListJson;
                    renderDeviceListPreview(devices);
                    updateDirtyState();
                });
                panel.querySelector('#btn-device-apply-json')?.addEventListener('click', () => {
                    const editor = document.getElementById('device-json-editor') as HTMLTextAreaElement;
                    if (!editor) return;
                    try {
                        const parsed = JSON.parse(editor.value);
                        if (!Array.isArray(parsed)) throw new Error('必须是数组');
                        setDraftField('devices', parsed);
                        deviceListJson = editor.value;
                        renderDeviceListPreview(parsed);
                        updateDirtyState();
                    } catch (e: any) {
                        alert('JSON 格式错误: ' + e.message);
                    }
                });
            } else if (tabId === 'about') {
                panel.innerHTML = `
                    <h2>关于 KCode</h2>
                    <p class="desc">独立配置系统 — Phase 16</p>
                    <p class="desc">配置文件使用 JSONC 格式（支持注释和尾逗号），存储在以下位置：</p>
                    <div id="file-links">
                        <span class="file-link" data-target="global">🌐 全局配置: ~/.kcode/kcode.jsonc</span>
                        <span class="file-link" data-target="project">📁 项目配置: .kcode/kcode.jsonc</span>
                    </div>
                    <hr>
                    <p class="desc">设置面板通过 ${Object.keys(TAB_CONFIGS).length - 1} 个标签页组织配置项。UI 展示一份完整配置，保存时按作用域自动拆分：Agent/Provider 写入项目文件，ACP Log/UI 写入全局文件。</p>
                `;
                panel.querySelectorAll('.file-link').forEach(el => {
                    el.addEventListener('click', () => {
                        vscode.postMessage({ type: 'openFile', target: (el as HTMLElement).dataset.target });
                    });
                });
            } else {
                const fieldsHtml = tabCfg.fields.map(f => renderField(f)).join('\n');
                panel.innerHTML = `
                    <h2>${tabCfg.label}</h2>
                    <p class="desc">配置 ${tabCfg.label} 相关设置</p>
                    ${fieldsHtml}
                `;
                panel.querySelectorAll('input, select').forEach(el => {
                    const input = el as HTMLInputElement;
                    const key = input.dataset.key;
                    if (!key) return;
                    if (input.type === 'checkbox') {
                        input.addEventListener('change', () => {
                            setDraftField(key, input.checked);
                            updateDirtyState();
                        });
                    } else {
                        input.addEventListener('input', () => {
                            const field = findField(key);
                            let value: any = input.value;
                            if (field?.transform?.from) value = field.transform.from(value);
                            if (field?.type === 'number') value = parseFloat(value) || 0;
                            setDraftField(key, value);
                            updateDirtyState();
                        });
                    }
                });
            }

            container.appendChild(panel);
        }
    }

    function renderField(f: FieldDef): string {
        const draftVal = getNested(draft, f.key);
        const val = draftVal !== undefined ? draftVal : f.default;

        if (f.type === 'checkbox') {
            return `
                <div class="field-group">
                    <div class="inline-checkbox">
                        <input type="checkbox" class="field-input" data-key="${f.key}" ${val ? 'checked' : ''}>
                        <label>${f.label}</label>
                    </div>
                    <span class="field-desc">${f.desc}</span>
                </div>
            `;
        }

        const inputType = f.type === 'password' ? 'password' : 'text';
        const displayVal = f.transform?.to ? f.transform.to(val) : val;
        const inputClass = f.type === 'number' ? 'field-input field-number' : 'field-input';

        return `
            <div class="field-group">
                <label class="field-label">${f.label}</label>
                <span class="field-desc">${f.desc}</span>
                <input type="${inputType}" class="${inputClass}" data-key="${f.key}" value="${escapeHtml(String(displayVal ?? ''))}" ${f.type === 'number' ? 'type="number"' : ''}>
            </div>
        `;
    }

    function findField(key: string): FieldDef | undefined {
        for (const tab of Object.values(TAB_CONFIGS)) {
            const f = tab.fields.find((ff: FieldDef) => ff.key === key);
            if (f) return f;
        }
        return undefined;
    }

    function setDraftField(key: string, value: any): void {
        setNested(draft, key, value);
    }

    function updateDirtyState(): void {
        isDirty = JSON.stringify(config) !== JSON.stringify(draft);
        const saveBar = document.getElementById('save-bar')!;
        const dirtyIndicator = document.getElementById('dirty-indicator')!;
        saveBar.className = isDirty ? 'visible' : '';
        dirtyIndicator.style.display = isDirty ? 'inline-block' : 'none';

        vscode.postMessage({ type: 'updateConfig', config: cloneDeep(draft) });
    }

    function escapeHtml(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function onConfigLoaded(msg: any): void {
        config = msg.config || {};
        draft = msg.draft || {};
        isDirty = msg.isDirty || false;
        globalPath = msg.globalPath || '';
        projectPath = msg.projectPath || '';

        const saveBar = document.getElementById('save-bar')!;
        const dirtyIndicator = document.getElementById('dirty-indicator')!;
        saveBar.className = isDirty ? 'visible' : '';
        dirtyIndicator.style.display = isDirty ? 'inline-block' : 'none';

        renderPanels();
        updateFieldValues();
    }

    function updateFieldValues(): void {
        document.querySelectorAll('[data-key]').forEach(el => {
            const input = el as HTMLInputElement;
            const key = input.dataset.key;
            if (!key) return;
            const field = findField(key);
            let val = getNested(draft, key);
            if (val === undefined) val = field?.default;
            if (field?.transform?.to) val = field.transform.to(val);

            if (input.type === 'checkbox') {
                input.checked = !!val;
            } else {
                input.value = String(val ?? '');
            }
        });
    }

    function initTabs(): void {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const panel = document.getElementById(`panel-${(btn as HTMLElement).dataset.tab}`);
                if (panel) panel.classList.add('active');
            });
        });
    }

    function initActions(): void {
        document.getElementById('btn-save')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'saveConfig' });
        });
        document.getElementById('btn-discard')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'discardConfig' });
        });
        document.getElementById('btn-export')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'exportConfig' });
        });
        document.getElementById('btn-import')?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,.jsonc';
            input.addEventListener('change', async () => {
                const file = input.files?.[0];
                if (!file) return;
                const text = await file.text();
                vscode.postMessage({ type: 'importConfig', json: text });
            });
            input.click();
        });
    }

    window.addEventListener('message', (event: MessageEvent) => {
        const msg = event.data;
        switch (msg.type) {
            case 'configLoaded':
            case 'configUpdated':
                onConfigLoaded(msg);
                break;
            case 'configSaved':
                isDirty = false;
                updateDirtyState();
                showMsg('✅ 配置已保存', 'success');
                break;
            case 'configDiscarded':
                showMsg('已放弃更改', 'info');
                break;
            case 'configUpdateFailed':
                showMsg(`❌ ${msg.error}`, 'error');
                break;
            case 'configImportDone':
                showMsg('✅ 配置已导入', 'success');
                break;
        }
    });

    let msgTimer: any = null;

    function showMsg(text: string, type: 'success' | 'error' | 'info'): void {
        const status = document.querySelector('.save-status');
        if (status) {
            status.textContent = text;
            status.className = 'save-status ' + (type === 'error' ? 'error-msg' : type === 'success' ? 'success-msg' : '');
        }
        if (msgTimer) clearTimeout(msgTimer);
        msgTimer = setTimeout(() => {
            if (status) {
                status.textContent = isDirty ? '有未保存的更改' : '';
                status.className = 'save-status';
            }
        }, 3000);
    }

    function renderDeviceListPreview(devices: any[]) {
        const container = document.getElementById('device-list-panel');
        if (!container) return;
        if (!devices || devices.length === 0) {
            container.innerHTML = '<span class="field-desc">暂无已保存的设备。点击"添加模板"或直接编辑下方 JSON。</span>';
            return;
        }
        container.innerHTML = devices.map((d, i) =>
            `<div class="device-preview-item">
                <span class="device-preview-icon">${deviceIcon(d.type)}</span>
                <span class="device-preview-name">${escapeHtml(d.name || '未命名')}</span>
                <span class="device-preview-addr">${escapeHtml(d.host || '')}:${d.port || ''}</span>
                <span class="device-preview-user">${d.username ? escapeHtml(d.username) : ''}</span>
                <span class="device-preview-type tag">${d.type || 'ssh'}</span>
            </div>`
        ).join('');
    }

    function deviceIcon(type: string): string {
        switch (type) {
            case 'ssh': return '🔒';
            case 'telnet': return '🔓';
            case 'adb': return '📱';
            case 'local': return '💻';
            default: return '🖥️';
        }
    }

    vscode.postMessage({ type: 'loadConfig' });
    initTabs();
    initActions();
    renderPanels();
})();
