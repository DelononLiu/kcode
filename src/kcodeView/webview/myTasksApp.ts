declare function acquireVsCodeApi(): any;

interface MockTask {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    phase: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    workspace: string;
    projectName?: string;
    containerId?: string;
    createdAt: number;
    archived: boolean;
}

interface ContainerEntity {
    id: string;
    name: string;
    type: 'project' | 'group';
    parentId?: string;
    createdAt: number;
}

const MOCK_TASKS: MockTask[] = [
    { id: 't1', title: 'P17-01 文件存储层 — TaskStore 迁移', status: 'active', phase: 'execute', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 2 * 3600000, archived: false },
    { id: 't2', title: 'P17-02 跨工作区任务索引', status: 'active', phase: 'plan', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 4 * 3600000, archived: false },
    { id: 't3', title: 'P16-02 ConfigService 实现', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 86400000, archived: false },
    { id: 't4', title: 'P16-05 配置迁移兼容', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 2 * 86400000, archived: false },
    { id: 't5', title: 'P15-01 小助手独立实体', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 3 * 86400000, archived: false },
    { id: 't6', title: 'P13-01 稳定性与 Bug 修复', status: 'in_review', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 3600000, archived: false },
    { id: 't7', title: 'P13-05 Todo 卡片实现', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 5 * 86400000, archived: false },
    { id: 't8', title: 'Bug fix: OAuth token 过期未刷新', status: 'active', phase: 'execute', workspace: 'auth-service', createdAt: Date.now() - 8 * 3600000, archived: false },
    { id: 't9', title: '实现用户注册页面', status: 'in_review', phase: 'review', workspace: 'auth-service', createdAt: Date.now() - 12 * 3600000, archived: false },
    { id: 't10', title: '数据库连接池优化', status: 'active', phase: 'execute', workspace: 'data-platform', createdAt: Date.now() - 86400000, archived: false },
    { id: 't11', title: 'API 文档自动生成', status: 'active', phase: 'demand', workspace: 'data-platform', createdAt: Date.now() - 3 * 86400000, archived: false },
    { id: 't12', title: 'CI/CD 流水线搭建', status: 'completed', phase: 'review', workspace: 'devops', createdAt: Date.now() - 7 * 86400000, archived: false },
    { id: 't13', title: '旧版 Dashboard 移除', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 86400000, archived: true },
    { id: 't14', title: 'Phase 6 Markdown 渲染', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 14 * 86400000, archived: true },
    { id: 't15', title: 'P10-01 任务类型分类模板', status: 'completed', phase: 'review', workspace: 'kcode', projectName: 'KCode', createdAt: Date.now() - 20 * 86400000, archived: true },
];

const PHASE_LABELS: Record<string, string> = {
    demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收',
};
const PHASE_CLASS: Record<string, string> = {
    demand: 'phase-demand', goal: 'phase-goal', plan: 'phase-plan',
    execute: 'phase-execute', self_verify: 'phase-self_verify', review: 'phase-review',
};
const STATUS_LABELS: Record<string, string> = {
    pending: '待开始', active: '进行中', in_review: '待验收', completed: '已完成', cancelled: '已取消',
};
const STATUS_CLASS: Record<string, string> = {
    pending: 'status-pending', active: 'status-active', in_review: 'status-in_review',
    completed: 'status-completed', cancelled: 'status-cancelled',
};

let currentTab = 'active';
let searchQuery = '';
let _currentWorkspace = '';
let _filterByWorkspace = true;

function vscode() {
    try { return acquireVsCodeApi(); } catch { return { postMessage: () => {} }; }
}

function formatTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
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

// ===== Primary tab state =====
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

// ===== Project state =====
let _projects: ContainerEntity[] = [];

function getProjectTaskCounts(projectId: string, projectName: string): { workspace: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const t of MOCK_TASKS) {
        const matches = t.projectName === projectName || t.containerId === projectId;
        if (matches) {
            counts.set(t.workspace, (counts.get(t.workspace) || 0) + 1);
        }
    }
    const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        return [{ workspace: '-', count: 0 }];
    }
    return entries.map(([ws, c]) => ({ workspace: ws, count: c }));
}

function renderProjects() {
    const tbody = document.getElementById('project-table-body');
    const empty = document.getElementById('project-empty');
    if (!tbody || !empty) return;

    if (_projects.length === 0) {
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
        renameItem.textContent = '✏️ 重命名';
        renameItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideProjectContextMenu();
            const row = tbody?.querySelector(`.project-row[data-id="${projectId}"]`);
            const nameEl = row?.querySelector('.p-name') as HTMLElement | null;
            if (nameEl) {
                makeProjectNameEditable(nameEl, projectId, _projects.find(p => p.id === projectId)?.name || '');
            }
        });
        menu.appendChild(renameItem);

        const sep = document.createElement('div');
        sep.className = 'project-context-menu-separator';
        menu.appendChild(sep);

        const deleteItem = document.createElement('div');
        deleteItem.className = 'project-context-menu-item';
        deleteItem.textContent = '🗑️ 删除';
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideProjectContextMenu();
            vscode().postMessage({ type: 'deleteProject', containerId: projectId });
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

        const finish = (save: boolean) => {
            const newName = input.value.trim();
            if (save && newName && newName !== originalName) {
                vscode().postMessage({ type: 'renameProject', containerId: projectId, name: newName });
            } else {
                nameEl.textContent = `📦 ${escapeHtml(originalName)}`;
            }
        };

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
    }

    tbody.innerHTML = _projects.map(p => {
        const wsCounts = getProjectTaskCounts(p.id, p.name);
        const wsCells = wsCounts.map(wc =>
            `<span class="ws-tag">${escapeHtml(wc.workspace)}</span>`
        ).join(' ');
        const countCells = wsCounts.map(wc =>
            `<span>${wc.count}</span>`
        ).join(' ');
        return `<tr class="project-row" data-id="${p.id}">
            <td><span class="p-name">📦 ${escapeHtml(p.name)}</span></td>
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

// ===== Task functions =====

function getFilteredTasks(): MockTask[] {
    let tasks = MOCK_TASKS;
    if (currentTab === 'active') {
        tasks = tasks.filter(t => !t.archived && (t.status === 'active' || t.status === 'pending'));
    } else if (currentTab === 'review') {
        tasks = tasks.filter(t => !t.archived && t.status === 'in_review');
    } else if (currentTab === 'archived') {
        tasks = tasks.filter(t => t.archived);
    } else {
        tasks = tasks.filter(t => !t.archived);
    }
    if (_filterByWorkspace && _currentWorkspace) {
        tasks = tasks.filter(t => t.workspace === _currentWorkspace);
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
        countEl.textContent = '0 个任务';
        wsEl.textContent = '';
        return;
    }
    empty.style.display = 'none';

    const workspaces = new Set(tasks.map(t => t.workspace));
    countEl.textContent = `共 ${tasks.length} 个任务`;
    wsEl.textContent = `· ${workspaces.size} 个工作区`;

    function getProjectName(t: MockTask): string {
        if (t.projectName) return t.projectName;
        if (t.containerId) {
            const p = _projects.find(c => c.id === t.containerId);
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
            <td>${projName ? `<span class="ws-tag">📦 ${escapeHtml(projName)}</span>` : ''}</td>
            <td><span class="ws-tag">${escapeHtml(t.workspace)}</span></td>
            <td><span class="status-dot ${statusCls}">${statusLabel}</span></td>
            <td><span class="phase-tag ${phaseCls}">${PHASE_LABELS[t.phase] || t.phase}</span></td>
            <td style="color:var(--text-secondary);font-size:12px">${formatStartTime(t.createdAt)}</td>
            <td>${t.archived
                ? `<button class="btn-action btn-restore" data-id="${t.id}">恢复</button>`
                : `<button class="btn-action btn-archive" data-id="${t.id}">归档</button>`
            }</td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.task-title').forEach(el => {
        el.addEventListener('click', () => {
            const id = (el as HTMLElement).dataset.id;
            const task = MOCK_TASKS.find(t => t.id === id);
            if (task) {
                vscode().postMessage({ type: 'openTask', taskId: task.id, title: task.title });
            }
        });
    });

    tbody.querySelectorAll('.btn-archive').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (el as HTMLElement).dataset.id;
            const task = MOCK_TASKS.find(t => t.id === id);
            if (task) { task.archived = true; render(); }
        });
    });

    tbody.querySelectorAll('.btn-restore').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = (el as HTMLElement).dataset.id;
            const task = MOCK_TASKS.find(t => t.id === id);
            if (task) { task.archived = false; render(); }
        });
    });

    updateTabCounts();
}

function updateTabCounts() {
    function filterBase(tasks: MockTask[]): MockTask[] {
        if (_filterByWorkspace && _currentWorkspace) {
            return tasks.filter(t => t.workspace === _currentWorkspace);
        }
        return tasks;
    }
    const base = filterBase(MOCK_TASKS);
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
    // Project: new project button
    const newProjectBtn = document.getElementById('btn-new-project');
    if (newProjectBtn) {
        newProjectBtn.addEventListener('click', () => {
            vscode().postMessage({ type: 'newProject' });
        });
    }

    // Workspace filter checkbox
    const wsFilter = document.getElementById('workspace-filter') as HTMLInputElement;
    if (wsFilter) {
        wsFilter.addEventListener('change', () => {
            _filterByWorkspace = wsFilter.checked;
            updateTabCounts();
            render();
        });
    }

    // Listen for extension messages
    window.addEventListener('message', (event) => {
        const msg = event.data;
        switch (msg.type) {
            case 'updateProjects':
                _projects = msg.projects || [];
                if (msg.currentWorkspace) _currentWorkspace = msg.currentWorkspace;
                if (_primaryTab === 'projects') renderProjects();
                updateTabCounts();
                render();
                break;
        }
    });

    // Primary tab bar
    const tabBar = document.getElementById('tab-bar')!;
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = (btn as HTMLElement).dataset.primaryTab;
            if (tab === 'tasks' || tab === 'projects') {
                switchPrimaryTab(tab);
            }
        });
    });

    // Sub tab bar (task filters)
    const subTabBar = document.getElementById('sub-tab-bar')!;
    subTabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            subTabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = (btn as HTMLElement).dataset.tab || 'active';
            render();
        });
    });

    // Search
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        render();
    });

    document.getElementById('btn-refresh')?.addEventListener('click', () => {
        render();
    });

    // Notify extension that we're ready to receive data
    vscode().postMessage({ type: 'ready' });

    updateTabCounts();
    render();
})();
