declare function acquireVsCodeApi(): any;

interface TaskData {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    phase: 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    containerId?: string;
    createdAt: number;
    archived?: boolean;
}

interface ContainerEntity {
    id: string;
    name: string;
    type: 'project' | 'group';
    parentId?: string;
    createdAt: number;
}

const PHASE_LABELS: Record<string, string> = {
};
const PHASE_CLASS: Record<string, string> = {
    execute: 'phase-execute', self_verify: 'phase-self_verify', review: 'phase-review',
};
const STATUS_LABELS: Record<string, string> = {
    pending: '\u5f85\u5f00\u59cb', active: '\u8fdb\u884c\u4e2d', in_review: '\u5f85\u9a8c\u6536', completed: '\u5df2\u5b8c\u6210', cancelled: '\u5df2\u53d6\u6d88',
};
const STATUS_CLASS: Record<string, string> = {
    pending: 'status-pending', active: 'status-active', in_review: 'status-in_review',
    completed: 'status-completed', cancelled: 'status-cancelled',
};

let currentTab = 'active';
let searchQuery = '';
let _currentWorkspace = '';
let _filterByWorkspace = true;

let _tasks: TaskData[] = [];
let _containers: ContainerEntity[] = [];

const vscode = acquireVsCodeApi();

function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return '\u521a\u521a';
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    if (diff < 7 * 86400000) return `${Math.round(diff / 86400000)}d`;
    return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function formatStartTime(ts: number): string {
    const d = new Date(ts);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${min}`;
}

let _primaryTab: 'tasks' | 'projects' = 'tasks';

function switchPrimaryTab(tab: 'tasks' | 'projects') {
    _primaryTab = tab;

    const tabBar = document.getElementById('tab-bar')!;
    tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = tabBar.querySelector(`.tab-btn[data-primary-tab="${tab}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const taskToolbar = document.getElementById('task-toolbar')!;
    const projectToolbar = document.getElementById('project-toolbar')!;
    const taskContent = document.getElementById('task-content')!;
    const projectContent = document.getElementById('project-content')!;

    if (tab === 'projects') {
        taskToolbar.style.display = 'none';
        projectToolbar.style.display = 'flex';
        taskContent.style.display = 'none';
        projectContent.style.display = 'flex';
        renderProjects();
    } else {
        projectToolbar.style.display = 'none';
        taskToolbar.style.display = 'flex';
        projectContent.style.display = 'none';
        taskContent.style.display = 'flex';
    }
}

function insertNewProjectRow() {
    const tbody = document.getElementById('project-table-body');
    const empty = document.getElementById('project-empty');
    if (!tbody) return;

    empty!.style.display = 'none';

    const row = document.createElement('tr');
    row.className = 'project-row project-row-new';

    const nameCell = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '\u65b0\u9879\u76ee\u540d\u79f0...';
    input.style.cssText = 'width:100%;background:var(--input-bg);color:var(--input-fg);border:1px solid var(--focus-border);outline:none;padding:2px 6px;font-size:13px;border-radius:2px;';

    let submitted = false;
    const submit = () => {
        if (submitted) return;
        submitted = true;
        const name = input.value.trim();
        if (name) {
            vscode.postMessage({ type: 'createProject', name });
        }
        row.remove();
    };

    input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Escape') { e.preventDefault(); row.remove(); }
    });
    input.addEventListener('blur', () => submit());

    nameCell.appendChild(input);
    row.appendChild(nameCell);

    const wsCell = document.createElement('td');
    wsCell.innerHTML = `<span class="ws-tag">${escapeHtml(_currentWorkspace || '-')}</span>`;
    row.appendChild(wsCell);

    const countCell = document.createElement('td');
    countCell.textContent = '0';
    row.appendChild(countCell);

    tbody.insertBefore(row, tbody.firstChild);
    input.focus();
}

function getProjectTaskCounts(projectId: string): { workspace: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const t of _tasks) {
        if (t.containerId === projectId) {
            const ws = _currentWorkspace || '-';
            counts.set(ws, (counts.get(ws) || 0) + 1);
        }
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return [{ workspace: '-', count: 0 }];
    return entries.map(([ws, c]) => ({ workspace: ws, count: c }));
}

function renderProjects() {
    const tbody = document.getElementById('project-table-body');
    const empty = document.getElementById('project-empty');
    if (!tbody || !empty) return;

    const projects = _containers.filter(c => c.type === 'project');

    if (projects.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';

    let contextMenuEl: HTMLDivElement | null = null;

    function showProjectContextMenu(x: number, y: number, projectId: string) {
        hideProjectContextMenu();
        const menu = document.createElement('div');
        menu.className = 'project-context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const renameItem = document.createElement('div');
        renameItem.className = 'project-context-menu-item';
        renameItem.textContent = '\u270F\uFE0F \u91cd\u547d\u540d';
        renameItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideProjectContextMenu();
            const row = tbody?.querySelector(`.project-row[data-id="${projectId}"]`);
            const nameEl = row?.querySelector('.p-name') as HTMLElement | null;
            if (nameEl) {
                makeProjectNameEditable(nameEl, projectId, projects.find(p => p.id === projectId)?.name || '');
            }
        });
        menu.appendChild(renameItem);

        const sep = document.createElement('div');
        sep.className = 'project-context-menu-separator';
        menu.appendChild(sep);

        const deleteItem = document.createElement('div');
        deleteItem.className = 'project-context-menu-item';
        deleteItem.textContent = '\uD83D\uDDD1\uFE0F \u5220\u9664';
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideProjectContextMenu();
            vscode.postMessage({ type: 'deleteProject', containerId: projectId });
        });
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function hideProjectContextMenu() {
        if (contextMenuEl) {
            contextMenuEl.remove();
            contextMenuEl = null;
        }
    }

    function makeProjectNameEditable(nameEl: HTMLElement, projectId: string, originalName: string) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.style.cssText = 'width:100%;background:var(--input-bg);color:var(--input-fg);border:1px solid var(--focus-border);outline:none;padding:2px 4px;font-size:13px;border-radius:2px;';

        nameEl.textContent = '';
        nameEl.appendChild(input);
        input.focus();
        input.select();

    let finished = false;
    const finish = (save: boolean) => {
        if (finished) return;
        finished = true;
        const newName = input.value.trim();
        console.log(`[MyTasks] finish save=${save} newName="${newName}" original="${originalName}"`);
        if (save && newName && newName !== originalName) {
            nameEl.textContent = `\uD83D\uDCE6 ${escapeHtml(newName)}`;
            try {
                vscode.postMessage({ type: 'renameProject', containerId: projectId, name: newName });
            } catch (e) {
                try { vscode.postMessage({ type: 'debugLog', text: `renameProject error: ${e}` }); } catch {}
                return;
            }
            try { vscode.postMessage({ type: 'debugLog', text: `renameProject sent: id=${projectId} name=${newName}` }); } catch {}
        } else {
            nameEl.textContent = `\uD83D\uDCE6 ${escapeHtml(originalName)}`;
            console.log(`[MyTasks] save=false or name unchanged, resetting`);
        }
    };

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
    }

    tbody.innerHTML = projects.map(p => {
        const wsCounts = getProjectTaskCounts(p.id);
        const wsCells = wsCounts.map(wc =>
            `<span class="ws-tag">${escapeHtml(wc.workspace)}</span>`
        ).join(' ');
        const countCells = wsCounts.map(wc =>
            `<span>${wc.count}</span>`
        ).join(' ');
        return `<tr class="project-row" data-id="${p.id}">
            <td><span class="p-name">\uD83D\uDCE6 ${escapeHtml(p.name)}</span></td>
            <td>${wsCells}</td>
            <td>${countCells}</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.project-row').forEach(el => {
        el.addEventListener('contextmenu', (e: Event) => {
            const me = e as MouseEvent;
            me.preventDefault();
            me.stopPropagation();
            const id = (el as HTMLElement).dataset.id;
            if (id) showProjectContextMenu(me.clientX, me.clientY, id);
        });
    });

    document.addEventListener('click', () => hideProjectContextMenu());
}

function getFilteredTasks(): TaskData[] {
    let tasks = _tasks;
    if (currentTab === 'active') {
        tasks = tasks.filter(t => !t.archived && (t.status === 'active' || t.status === 'pending'));
    } else if (currentTab === 'review') {
        tasks = tasks.filter(t => !t.archived && t.status === 'in_review');
    } else if (currentTab === 'archived') {
        tasks = tasks.filter(t => t.archived);
    } else {
        tasks = tasks.filter(t => !t.archived);
    }
    if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        tasks = tasks.filter(t => t.title.toLowerCase().includes(q));
    }
    return tasks;
}

function render() {
    const tasks = getFilteredTasks();
    const tbody = document.getElementById('table-body')!;
    const empty = document.getElementById('empty-state')!;
    const countEl = document.getElementById('footer-count')!;
    const wsEl = document.getElementById('footer-workspaces')!;

    if (tasks.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'flex';
        countEl.textContent = '0 \u4e2a\u4efb\u52a1';
        wsEl.textContent = '';
        return;
    }
    empty.style.display = 'none';

    countEl.textContent = `\u5171 ${tasks.length} \u4e2a\u4efb\u52a1`;
    wsEl.textContent = '';

    function getProjectName(t: TaskData): string {
        if (t.containerId) {
            const p = _containers.find(c => c.id === t.containerId);
            if (p) return p.name;
        }
        return '';
    }

    tbody.innerHTML = tasks.map(t => {
        const phaseCls = PHASE_CLASS[t.phase] || '';
        const statusCls = STATUS_CLASS[t.status] || '';
        const statusLabel = STATUS_LABELS[t.status] || t.status;
        const projName = getProjectName(t);
        return `<tr data-task-id="${t.id}">
            <td><span class="task-title" data-id="${t.id}">${escapeHtml(t.title)}</span></td>
            <td>${projName ? `<span class="ws-tag">\u{1F4E6} ${escapeHtml(projName)}</span>` : ''}</td>
            <td><span class="ws-tag">${escapeHtml(_currentWorkspace)}</span></td>
            <td><span class="status-dot ${statusCls}">${statusLabel}</span></td>
            <td><span class="phase-tag ${phaseCls}">${PHASE_LABELS[t.phase] || t.phase}</span></td>
            <td style="color:var(--text-secondary);font-size:12px">${formatStartTime(t.createdAt)}</td>
            <td>${t.archived
                ? `<button class="btn-action btn-restore" data-id="${t.id}">\u6062\u590d</button>`
                : `<button class="btn-action btn-archive" data-id="${t.id}">\u5f52\u6863</button>`
            }</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.task-title').forEach(el => {
        el.addEventListener('click', () => {
            const id = (el as HTMLElement).dataset.id;
            if (id) {
                vscode.postMessage({ type: 'openTask', taskId: id });
            }
        });
    });

    tbody.querySelectorAll('.btn-archive').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (el as HTMLElement).dataset.id;
            vscode.postMessage({ type: 'archiveTask', taskId: id, archived: true });
        });
    });

    tbody.querySelectorAll('.btn-restore').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (el as HTMLElement).dataset.id;
            vscode.postMessage({ type: 'archiveTask', taskId: id, archived: false });
        });
    });

    updateTabCounts();
}

function updateTabCounts() {
    const base = _tasks;
    const counts = {
        active: base.filter(t => !t.archived && (t.status === 'active' || t.status === 'pending')).length,
        review: base.filter(t => !t.archived && t.status === 'in_review').length,
        archived: base.filter(t => t.archived).length,
        all: base.filter(t => !t.archived).length,
    };
    for (const [key, val] of Object.entries(counts)) {
        const btn = document.querySelector(`.tab-btn[data-tab="${key}"] .tab-count`);
        if (btn) btn.textContent = `(${val})`;
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

(function () {
    const newProjectBtn = document.getElementById('btn-new-project');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            insertNewProjectRow();
        });
    }

    const wsFilter = document.getElementById('workspace-filter') as HTMLInputElement;
    if (wsFilter) {
        wsFilter.addEventListener('change', () => {
            _filterByWorkspace = wsFilter.checked;
            updateTabCounts();
            render();
        });
    }

    window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
            case 'updateProjects':
                _containers = msg.containers || [];
                if (msg.currentWorkspace) _currentWorkspace = msg.currentWorkspace;
                if (_primaryTab === 'projects') renderProjects();
                break;
            case 'updateTasks':
                _tasks = msg.tasks || [];
                if (msg.containers) _containers = msg.containers;
                if (msg.currentWorkspace) _currentWorkspace = msg.currentWorkspace;
                updateTabCounts();
                render();
                break;
        }
    });

    const tabBar = document.getElementById('tab-bar')!;
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = (btn as HTMLElement).dataset.primaryTab;
            if (tab === 'tasks' || tab === 'projects') {
                switchPrimaryTab(tab);
            }
        });
    });

    const subTabBar = document.getElementById('sub-tab-bar')!;
    subTabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            subTabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = (btn as HTMLElement).dataset.tab || 'active';
            render();
        });
    });

    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        render();
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        render();
    });

    vscode.postMessage({ type: 'ready' });
})();
