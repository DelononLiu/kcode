declare function acquireVsCodeApi(): any;

{
    const vscode = acquireVsCodeApi();
    let contextMenuEl: HTMLDivElement | null = null;
    let draggedTaskId: string | null = null;
    const _groupCollapsed = new Map<string, boolean>();

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
                    renderTaskList(message.tasks, message.groups || [], message.activeTaskId);
                    break;
            }
        });
    })();

    const dataEl = document.getElementById('__sidebarData');
    if (dataEl) {
        const tasks = JSON.parse(dataEl.dataset.tasks || '[]');
        const groups = JSON.parse(dataEl.dataset.groups || '[]');
        const activeTaskId = dataEl.dataset.activeTaskId || undefined;
        renderTaskList(tasks, groups, activeTaskId);
    }

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

    function renderTaskList(tasks: any[], groups: string[], activeTaskId?: string) {
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
                pinnedList.appendChild(createTaskItem(task, activeTaskId));
            }
        }

        taskList.innerHTML = '';
        const hasContent = ungrouped.length > 0 || groups.length > 0 || pinned.length > 0;
        if (!hasContent) {
            taskList.innerHTML = '<div class="placeholder-text">暂无任务</div>';
            return;
        }

        const ungroupedZone = document.createElement('div');
        ungroupedZone.className = 'section-body drop-zone';
        ungroupedZone.dataset.group = '';
        for (const task of ungrouped) {
            ungroupedZone.appendChild(createTaskItem(task, activeTaskId));
        }
        makeContainerDropTarget(ungroupedZone, null);
        taskList.appendChild(ungroupedZone);

        for (const key of _groupCollapsed.keys()) {
            if (!groups.includes(key)) {
                _groupCollapsed.delete(key);
            }
        }

        for (const [groupName, groupTasks] of groupMap) {
            const section = createGroupSection(groupName, groupTasks, activeTaskId);
            taskList.appendChild(section);
        }
    }

    function makeContainerDropTarget(el: HTMLElement, group: string | null) {
        el.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add('drag-over');
        });
        el.addEventListener('dragleave', (e) => {
            if (!el.contains(e.relatedTarget as Node)) {
                el.classList.remove('drag-over');
            }
        });
        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drag-over');
            const taskId = e.dataTransfer?.getData('text/plain');
            if (taskId) {
                vscode.postMessage({
                    type: 'reorderTask',
                    taskId,
                    targetTaskId: null,
                    position: null,
                    group
                });
            }
        });
    }

    function clearDropIndicators() {
        document.querySelectorAll('.task-item').forEach(el => {
            el.classList.remove('drop-before', 'drop-after');
        });
    }

    function createTaskItem(task: any, activeTaskId?: string): HTMLElement {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.id === activeTaskId) item.classList.add('active');
        item.draggable = true;
        item.dataset.taskId = task.id;

        const iconMap: Record<string, string> = {
            unknown: '○',
            pending: '◯',
            active: '⏳',
            in_review: '⏸',
            completed: '✓',
            cancelled: '✕'
        };
        const iconEl = document.createElement('span');
        iconEl.className = `status-icon ${task.status}`;
        iconEl.textContent = iconMap[task.status] || '◯';
        item.appendChild(iconEl);

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
            draggedTaskId = task.id;
            e.dataTransfer?.setData('text/plain', task.id);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            draggedTaskId = null;
            item.classList.remove('dragging');
            clearDropIndicators();
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY, task);
        });

        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = item.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const position = y < rect.height / 2 ? 'before' : 'after';
            clearDropIndicators();
            item.classList.add(position === 'before' ? 'drop-before' : 'drop-after');
        });

        item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget as Node)) {
                item.classList.remove('drop-before', 'drop-after');
            }
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearDropIndicators();
            const taskId = e.dataTransfer?.getData('text/plain');
            if (!taskId) return;
            const rect = item.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const position = y < rect.height / 2 ? 'before' : 'after';
            const container = item.closest('.drop-zone') as HTMLElement;
            const group = container?.dataset?.group !== undefined ? (container.dataset.group || null) : null;
            vscode.postMessage({
                type: 'reorderTask',
                taskId,
                targetTaskId: task.id,
                position,
                group
            });
        });

        return item;
    }

    function createGroupSection(groupName: string, tasks: any[], activeTaskId?: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'section';

        const header = document.createElement('div');
        header.className = 'section-header';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        header.appendChild(arrow);

        const label = document.createElement('span');
        label.textContent = escapeHtml(groupName);
        header.appendChild(label);

        let collapsed = _groupCollapsed.get(groupName) ?? false;
        header.addEventListener('click', () => {
            collapsed = !collapsed;
            _groupCollapsed.set(groupName, collapsed);
            body.style.display = collapsed ? 'none' : '';
            arrow.classList.toggle('collapsed', collapsed);
        });

        header.addEventListener('dragenter', () => {
            if (collapsed) {
                collapsed = false;
                _groupCollapsed.set(groupName, false);
                body.style.display = '';
                arrow.classList.remove('collapsed');
            }
        });

        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'section-body drop-zone';
        body.dataset.group = groupName;
        if (tasks.length === 0) {
            body.classList.add('empty');
            const hint = document.createElement('div');
            hint.className = 'group-placeholder';
            hint.textContent = '拖入任务到此分组';
            body.appendChild(hint);
        }
        for (const task of tasks) {
            body.appendChild(createTaskItem(task, activeTaskId));
        }
        makeContainerDropTarget(body, groupName);
        section.appendChild(body);

        if (collapsed) {
            body.style.display = 'none';
            arrow.classList.add('collapsed');
        }

        return section;
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    (window as any).renderTaskList = renderTaskList;
}
