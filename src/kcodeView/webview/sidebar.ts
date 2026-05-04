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

        const groupBtn = document.getElementById('btn-new-group');
        if (groupBtn) {
            groupBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({ type: 'newGroup' });
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
                    renderTaskList(message.tasks, message.groups || []);
                    break;
            }
        });
    })();

    function showContextMenu(x: number, y: number, task: any) {
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const pinText = task.pinned ? '取消置顶' : '置顶';
        const pinItem = document.createElement('div');
        pinItem.className = 'context-menu-item';
        pinItem.textContent = pinText;
        pinItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            vscode.postMessage({ type: 'pinTask', taskId: task.id, pinned: !task.pinned });
        });
        menu.appendChild(pinItem);

        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = 'Delete';
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            vscode.postMessage({ type: 'deleteTask', taskId: task.id });
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

    function renderTaskList(tasks: any[], groups: string[]) {
        const pinnedList = document.getElementById('pinned-list');
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        const pinned = tasks.filter((t: any) => t.pinned);
        const groupMap = new Map<string, any[]>();
        for (const g of groups) {
            groupMap.set(g, []);
        }
        const ungrouped = tasks.filter((t: any) => {
            if (t.pinned) return false;
            if (t.group && groupMap.has(t.group)) {
                groupMap.get(t.group)!.push(t);
                return false;
            }
            return true;
        });

        const pinnedSection = document.getElementById('section-pinned');
        if (pinnedSection && pinnedList) {
            pinnedSection.style.display = pinned.length > 0 ? '' : 'none';
            pinnedList.innerHTML = '';
            for (const task of pinned) {
                pinnedList.appendChild(createTaskItem(task));
            }
        }

        taskList.innerHTML = '';
        const hasContent = ungrouped.length > 0 || groups.length > 0 || pinned.length > 0;
        if (!hasContent) {
            taskList.innerHTML = '<div class="placeholder-text">暂无任务</div>';
            return;
        }

        for (const task of ungrouped) {
            taskList.appendChild(createTaskItem(task));
        }

        for (const [groupName, groupTasks] of groupMap) {
            const section = createGroupSection(groupName, groupTasks);
            const body = section.querySelector('.section-body') as HTMLElement;
            if (body) makeDropTarget(body, groupName);
            taskList.appendChild(section);
        }

        makeDropTarget(taskList, null);
    }

    function makeDropTarget(el: HTMLElement, group: string | null) {
        let dragCounter = 0;
        el.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', () => {
            dragCounter--;
            if (dragCounter === 0) {
                el.classList.remove('drag-over');
            }
        });
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dragCounter = 0;
            el.classList.remove('drag-over');
            const taskId = e.dataTransfer?.getData('text/plain');
            if (taskId) {
                vscode.postMessage({ type: 'moveTaskToGroup', taskId, group });
            }
        });
    }

    function createTaskItem(task: any): HTMLElement {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.status === 'active') item.classList.add('active');
        item.draggable = true;

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

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', task.id);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, task);
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