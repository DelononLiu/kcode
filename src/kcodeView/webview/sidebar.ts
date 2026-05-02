declare function acquireVsCodeApi(): any;

{
    const vscode = acquireVsCodeApi();
    let contextMenuEl: HTMLDivElement | null = null;

    (function () {
        const btn = document.getElementById('btn-new-task');
        if (btn) {
            btn.addEventListener('click', () => {
                vscode.postMessage({ type: 'newTask' });
            });
        }

        document.addEventListener('click', () => hideContextMenu());

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'updateTaskList':
                    renderTaskList(message.tasks);
                    break;
            }
        });
    })();

    function showContextMenu(x: number, y: number, taskId: string) {
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            vscode.postMessage({ type: 'deleteTask', taskId });
        });

        menu.appendChild(deleteItem);
        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function hideContextMenu() {
        if (contextMenuEl) {
            contextMenuEl.remove();
            contextMenuEl = null;
        }
    }

    function renderTaskList(tasks: any[]) {
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

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, task.id);
            });

            container.appendChild(item);
        }
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    (window as any).renderTaskList = renderTaskList;
}