// Sidebar renderer for task list

declare const vscode: any;

export function renderTaskList(workspaces: any[]) {
    const container = document.getElementById('task-list');
    if (!container) return;

    container.innerHTML = '';

    if (workspaces.length === 0) {
        container.innerHTML = '<div class="chat-placeholder" style="padding: 20px 0;font-size:12px;">暂无任务</div>';
        return;
    }

    for (const ws of workspaces) {
        const group = document.createElement('div');
        group.className = 'workspace-group';

        const header = document.createElement('div');
        header.className = 'workspace-header';
        header.innerHTML = `<span class="arrow">▼</span> ${escapeHtml(ws.name)}`;
        header.addEventListener('click', () => {
            const tasksEl = group.querySelector('.workspace-tasks') as HTMLElement;
            if (tasksEl) {
                const isHidden = tasksEl.style.display === 'none';
                tasksEl.style.display = isHidden ? 'block' : 'none';
                const arrow = header.querySelector('.arrow');
                if (arrow) arrow.classList.toggle('collapsed', !isHidden);
            }
        });
        group.appendChild(header);

        const taskList = document.createElement('div');
        taskList.className = 'workspace-tasks';

        if (ws.tasks && ws.tasks.length > 0) {
            for (const task of ws.tasks) {
                const item = document.createElement('div');
                item.className = 'task-item';
                if (task.status === 'active') item.classList.add('active');

                const dot = document.createElement('span');
                dot.className = `status-dot ${task.status}`;
                item.appendChild(dot);

                const label = document.createElement('span');
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

// Register global for app.ts to call
(window as any).renderTaskList = renderTaskList;
