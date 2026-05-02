// Sidebar renderer
// Handles rendering pinned items, workspace groups, and task lists

declare const vscode: any;

/** Main entry: render all sidebar dynamic content */
export function renderSidebar(workspaces: any[]) {
    renderPinnedItems();
    renderTaskList(workspaces);
}

function renderPinnedItems() {
    const container = document.getElementById('pinned-list');
    if (!container) return;

    container.innerHTML = `
        <div class="pinned-item">
            <svg class="pinned-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 1.5l4 4-6 6H3V7.5l5.5-6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
                <path d="M11.5 4.5l.7-.7a1 1 0 00-1.4-1.4l-.7.7" stroke="currentColor" stroke-width="1.2"/>
                <path d="M1 13l3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span class="pinned-text">使用浏览器 获取...</span>
        </div>
    `;
}

export function renderTaskList(workspaces: any[]) {
    const container = document.getElementById('task-list');
    if (!container) return;

    container.innerHTML = '';

    if (workspaces.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无任务</div>';
        return;
    }

    for (const ws of workspaces) {
        const group = document.createElement('div');
        group.className = 'workspace-group';

        // Header
        const header = document.createElement('div');
        header.className = 'workspace-header';

        const cloudIcon = document.createElement('span');
        cloudIcon.className = 'cloud-icon';
        cloudIcon.textContent = '☁';
        header.appendChild(cloudIcon);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'ws-name';
        nameSpan.textContent = escapeHtml(ws.name);
        header.appendChild(nameSpan);

        const actions = document.createElement('span');
        actions.className = 'workspace-actions';
        const infoBtn = document.createElement('button');
        infoBtn.className = 'ws-action-btn';
        infoBtn.title = '信息';
        infoBtn.textContent = 'ⓘ';
        actions.appendChild(infoBtn);
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'ws-action-btn';
        refreshBtn.title = '刷新';
        refreshBtn.textContent = '↻';
        actions.appendChild(refreshBtn);
        header.appendChild(actions);

        header.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.ws-action-btn')) return;
            const tasksEl = group.querySelector('.workspace-tasks') as HTMLElement;
            if (tasksEl) {
                const isHidden = tasksEl.style.display === 'none';
                tasksEl.style.display = isHidden ? 'block' : 'none';
            }
        });
        group.appendChild(header);

        // Task list
        const taskList = document.createElement('div');
        taskList.className = 'workspace-tasks';

        if (ws.tasks && ws.tasks.length > 0) {
            for (const task of ws.tasks) {
                const item = document.createElement('div');
                item.className = 'task-item';
                if (task.status === 'active') item.classList.add('active');

                const dot = document.createElement('span');
                dot.className = `task-dot ${task.status}`;
                item.appendChild(dot);

                const label = document.createElement('span');
                label.className = 'task-title';
                label.textContent = escapeHtml(task.title);
                item.appendChild(label);

                item.addEventListener('click', () => {
                    document.querySelectorAll('.task-item').forEach(t => t.classList.remove('active'));
                    item.classList.add('active');
                    vscode.postMessage({
                        type: 'selectTask',
                        taskId: task.id,
                        workspaceId: ws.id
                    });
                });

                taskList.appendChild(item);
            }
        }

        group.appendChild(taskList);
        container.appendChild(group);
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Register globally for app.ts to call
(window as any).renderSidebar = renderSidebar;
(window as any).renderTaskList = renderTaskList;
