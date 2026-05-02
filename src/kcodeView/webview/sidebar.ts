declare const vscode: any;

export function renderTaskList(tasks: any[]) {
    const container = document.getElementById('task-list');
    if (!container) return;

    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = '<div class="placeholder-text">暂无任务</div>';
        return;
    }

    for (const task of tasks) {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.status === 'active') item.classList.add('active');

        const dot = document.createElement('span');
        dot.className = `status-dot ${task.status}`;
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
                taskId: task.id
            });
        });

        container.appendChild(item);
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

(window as any).renderTaskList = renderTaskList;