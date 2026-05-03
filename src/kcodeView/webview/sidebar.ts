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

        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'openSettings' });
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
        const pinnedList = document.getElementById('pinned-list');
        const groupsContainer = document.getElementById('groups-container');
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        const pinned = tasks.filter((t: any) => t.pinned);
        const groupMap = new Map<string, any[]>();
        const ungrouped = tasks.filter((t: any) => {
            if (t.pinned) return false;
            if (t.group) {
                const list = groupMap.get(t.group) || [];
                list.push(t);
                groupMap.set(t.group, list);
                return false;
            }
            return true;
        });

        // Pinned section
        const pinnedSection = document.getElementById('section-pinned');
        if (pinnedSection && pinnedList) {
            pinnedSection.style.display = pinned.length > 0 ? '' : 'none';
            pinnedList.innerHTML = '';
            for (const task of pinned) {
                pinnedList.appendChild(createTaskItem(task));
            }
        }

        // Group sections
        if (groupsContainer) {
            groupsContainer.innerHTML = '';
            for (const [groupName, groupTasks] of groupMap) {
                groupsContainer.appendChild(createGroupSection(groupName, groupTasks));
            }
        }

        // Ungrouped tasks
        taskList.innerHTML = '';
        if (ungrouped.length === 0 && groupMap.size === 0 && pinned.length === 0) {
            taskList.innerHTML = '<div class="placeholder-text">暂无任务</div>';
        } else {
            for (const task of ungrouped) {
                taskList.appendChild(createTaskItem(task));
            }
        }
    }

    function createTaskItem(task: any): HTMLElement {
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

        return item;
    }

    function createGroupSection(groupName: string, tasks: any[]): HTMLElement {
        const section = document.createElement('div');
        section.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.innerHTML = '&#x25BE;';
        header.appendChild(arrow);

        const label = document.createElement('span');
        label.textContent = escapeHtml(groupName);
        header.appendChild(label);

        let collapsed = false;
        header.addEventListener('click', () => {
            collapsed = !collapsed;
            body.style.display = collapsed ? 'none' : '';
            arrow.classList.toggle('collapsed', collapsed);
        });

        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'section-body';
        for (const task of tasks) {
            body.appendChild(createTaskItem(task));
        }
        section.appendChild(body);

        return section;
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    (window as any).renderTaskList = renderTaskList;
}