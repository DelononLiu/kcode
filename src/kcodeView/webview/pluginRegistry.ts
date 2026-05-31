import { G } from './state';

interface MessageRenderer {
    type: string;
    render: (msg: any) => HTMLElement | null;
}

interface OutputPanelTabDef {
    id: string;
    label: string;
    render: (taskInfo: any) => string;
}

class PluginRegistry {
    private messageRenderers = new Map<string, MessageRenderer>();
    private outputPanelTabs = new Map<string, OutputPanelTabDef>();
    private toolbarButtons: { id: string; label: string; icon: string; action: string }[] = [];

    registerMessageRenderer(type: string, render: (msg: any) => HTMLElement | null): void {
        this.messageRenderers.set(type, { type, render });
    }

    registerOutputPanelTab(id: string, label: string, render: (taskInfo: any) => string): void {
        this.outputPanelTabs.set(id, { id, label, render });
    }

    registerToolbarButton(id: string, label: string, icon: string, action: string): void {
        this.toolbarButtons.push({ id, label, icon, action });
    }

    resolveMessageRenderer(type: string): ((msg: any) => HTMLElement | null) | undefined {
        return this.messageRenderers.get(type)?.render;
    }

    getOutputPanelTabs(): OutputPanelTabDef[] {
        return Array.from(this.outputPanelTabs.values());
    }

    getToolbarButtons(): { id: string; label: string; icon: string; action: string }[] {
        return [...this.toolbarButtons];
    }

    applyPluginContributions(contribs: any[]): void {
        for (const contrib of contribs) {
            if (contrib.type === 'messageRenderer' && contrib.messageType && contrib.label) {
                this.registerMessageRenderer(contrib.messageType, () => {
                    const el = document.createElement('div');
                    el.className = 'chat-msg plugin-rendered';
                    el.innerHTML = `<div class="msg-bubble"><div class="msg-card">${contrib.label}</div></div>`;
                    return el;
                });
            }
            if (contrib.type === 'outputPanelTab' && contrib.id && contrib.label) {
                this.registerOutputPanelTab(contrib.id, contrib.label, () => `<div class="op-empty">${contrib.label} tab</div>`);
            }
            if (contrib.type === 'toolbarButton' && contrib.id && contrib.label) {
                this.registerToolbarButton(contrib.id, contrib.label, contrib.icon || '🔌', contrib.action || '');
            }
        }
        if (typeof (window as any).renderPluginTabs === 'function') {
            (window as any).renderPluginTabs();
        }
    }
}

const registry = new PluginRegistry();
(window as any).pluginRegistry = registry;

export function initPluginManager() {
    const btn = document.getElementById('btn-plugin-manager');
    const overlay = document.getElementById('plugin-manager-overlay');
    const closeBtn = document.getElementById('plugin-manager-close');
    if (!btn || !overlay) return;

    btn.addEventListener('click', () => {
        overlay.classList.remove('hidden');
        G.vscode.postMessage({ type: 'getPluginList' });
    });

    const close = () => overlay.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
}

export function renderPluginList(plugins: { id: string; name: string; version: string; enabled: boolean; active: boolean }[]) {
    const body = document.getElementById('plugin-manager-body');
    if (!body) return;

    if (!plugins || plugins.length === 0) {
        body.innerHTML = '<div class="plugin-manager-hint">暂无插件</div>';
        return;
    }

    body.innerHTML = plugins.map(p => {
        const isOn = p.enabled;
        const badgeText = p.active ? '已激活' : (p.enabled ? '未激活' : '已禁用');
        const badgeCls = p.active ? 'active' : '';
        return `<div class="plugin-manager-item">
            <div class="plugin-manager-item-info">
                <div class="plugin-manager-item-name">${p.name}</div>
                <div class="plugin-manager-item-id">${p.id} v${p.version}</div>
            </div>
            <span class="plugin-manager-item-badge ${badgeCls}">${badgeText}</span>
            <button class="plugin-manager-toggle ${isOn ? 'on' : ''}"
                data-plugin-id="${p.id}"
                title="${isOn ? '点击禁用' : '点击启用'}"></button>
        </div>`;
    }).join('');

    body.querySelectorAll('.plugin-manager-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).dataset.pluginId;
            if (!id) return;
            const isCurrentlyOn = btn.classList.contains('on');
            G.vscode.postMessage({
                type: isCurrentlyOn ? 'disablePlugin' : 'enablePlugin',
                id,
            });
            btn.classList.toggle('on');
        });
    });
}
