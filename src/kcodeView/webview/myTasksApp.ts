declare function acquireVsCodeApi(): any;

interface MockTask {
    id: string;
    title: string;
    status: 'pending' | 'active' | 'in_review' | 'completed' | 'cancelled';
    phase: 'demand' | 'goal' | 'plan' | 'execute' | 'self_verify' | 'review';
    workspace: string;
    createdAt: number;
    archived: boolean;
}

const MOCK_TASKS: MockTask[] = [
    { id: 't1', title: 'P17-01 文件存储层 — TaskStore 迁移', status: 'active', phase: 'execute', workspace: 'kcode', createdAt: Date.now() - 2 * 3600000, archived: false },
    { id: 't2', title: 'P17-02 跨工作区任务索引', status: 'active', phase: 'plan', workspace: 'kcode', createdAt: Date.now() - 4 * 3600000, archived: false },
    { id: 't3', title: 'P16-02 ConfigService 实现', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 86400000, archived: false },
    { id: 't4', title: 'P16-05 配置迁移兼容', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 2 * 86400000, archived: false },
    { id: 't5', title: 'P15-01 小助手独立实体', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 3 * 86400000, archived: false },
    { id: 't6', title: 'P13-01 稳定性与 Bug 修复', status: 'in_review', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 3600000, archived: false },
    { id: 't7', title: 'P13-05 Todo 卡片实现', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 5 * 86400000, archived: false },
    { id: 't8', title: 'Bug fix: OAuth token 过期未刷新', status: 'active', phase: 'execute', workspace: 'auth-service', createdAt: Date.now() - 8 * 3600000, archived: false },
    { id: 't9', title: '实现用户注册页面', status: 'in_review', phase: 'review', workspace: 'auth-service', createdAt: Date.now() - 12 * 3600000, archived: false },
    { id: 't10', title: '数据库连接池优化', status: 'active', phase: 'execute', workspace: 'data-platform', createdAt: Date.now() - 86400000, archived: false },
    { id: 't11', title: 'API 文档自动生成', status: 'active', phase: 'demand', workspace: 'data-platform', createdAt: Date.now() - 3 * 86400000, archived: false },
    { id: 't12', title: 'CI/CD 流水线搭建', status: 'completed', phase: 'review', workspace: 'devops', createdAt: Date.now() - 7 * 86400000, archived: false },
    { id: 't13', title: '旧版 Dashboard 移除', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 86400000, archived: true },
    { id: 't14', title: 'Phase 6 Markdown 渲染', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 14 * 86400000, archived: true },
    { id: 't15', title: 'P10-01 任务类型分类模板', status: 'completed', phase: 'review', workspace: 'kcode', createdAt: Date.now() - 20 * 86400000, archived: true },
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

    tbody.innerHTML = tasks.map(t => {
        const phaseCls = PHASE_CLASS[t.phase] || '';
        const statusCls = STATUS_CLASS[t.status] || '';
        const statusLabel = STATUS_LABELS[t.status] || t.status;
        return `<tr data-task-id="${t.id}">
            <td><span class="task-title" data-id="${t.id}">${escapeHtml(t.title)}</span></td>
            <td><span class="ws-tag">${escapeHtml(t.workspace)}</span></td>
            <td><span class="status-dot ${statusCls}">${statusLabel}</span></td>
            <td><span class="phase-tag ${phaseCls}">${PHASE_LABELS[t.phase] || t.phase}</span></td>
            <td style="color:var(--text-secondary);font-size:12px">${formatTime(t.createdAt)}</td>
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
    const counts = {
        active: MOCK_TASKS.filter(t => !t.archived && (t.status === 'active' || t.status === 'pending')).length,
        review: MOCK_TASKS.filter(t => !t.archived && t.status === 'in_review').length,
        archived: MOCK_TASKS.filter(t => t.archived).length,
        all: MOCK_TASKS.filter(t => !t.archived).length,
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
    const tabBar = document.getElementById('tab-bar')!;
    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
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

    updateTabCounts();
    render();
})();
