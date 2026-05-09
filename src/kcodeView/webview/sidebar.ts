declare function acquireVsCodeApi(): any;

{
    const vscode = acquireVsCodeApi();
    let contextMenuEl: HTMLDivElement | null = null;
    let draggedTaskId: string | null = null;
    let selectedTaskIds: Set<string> = new Set();
    let anchorTaskId: string | null = null;
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

        const togglePanelBtn = document.getElementById('btn-toggle-panel');
        if (togglePanelBtn) {
            togglePanelBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'toggleRightPanel' });
            });
        }

        const batchClearBtn = document.getElementById('btn-batch-clear');
        if (batchClearBtn) {
            batchClearBtn.addEventListener('click', () => {
                selectedTaskIds.clear();
                updateSelectionVisual();
                updateBatchActionBar();
            });
        }

        document.addEventListener('click', (e) => {
            hideContextMenu();
            const batchBar = document.getElementById('batch-bar');
            if (batchBar && !batchBar.contains(e.target as Node)) {
                const target = e.target as HTMLElement;
                if (!target.closest('.task-item')) {
                    selectedTaskIds.clear();
                    anchorTaskId = null;
                    updateSelectionVisual();
                    updateBatchActionBar();
                }
            }
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'updateTaskList':
                    renderTaskList(message.tasks, message.groups || [], message.activeTaskId, message.editingGroupName);
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

    function addSeparator(menu: HTMLDivElement): void {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        menu.appendChild(sep);
    }

    function startInlineEdit(
        displayEl: HTMLElement,
        currentText: string,
        onSave: (newText: string) => void,
    ): void {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'inline-edit-input';

        const parent = displayEl.parentNode!;
        parent.insertBefore(input, displayEl.nextSibling);
        displayEl.style.display = 'none';
        input.focus();
        input.select();

        const finish = (save: boolean) => {
            const newText = input.value.trim();
            if (save && newText && newText !== currentText) {
                onSave(newText);
            }
            displayEl.style.display = '';
            input.remove();
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finish(true);
            } else if (e.key === 'Escape') {
                finish(false);
            }
        });

        input.addEventListener('blur', () => {
            finish(true);
        });
    }

    function showContextMenu(x: number, y: number, task: any) {
        vscode.postMessage({ type: 'debugLog', text: 'showContextMenu called! task.id=' + task.id + ' task.title=' + task.title + ' task.pinned=' + task.pinned + ' task.archived=' + task.archived });
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // --- 重命名 ---
        const renameItem = createMenuItem('重命名', () => {
            const taskItem = document.querySelector(`.task-item[data-task-id="${task.id}"]`);
            if (taskItem) {
                const titleEl = taskItem.querySelector('.task-title');
                if (titleEl) {
                    const prefix = task.type === 'task' ? 'Task: ' : 'Chat: ';
                    const rawName = task.title.startsWith(prefix) ? task.title.slice(prefix.length) : task.title;
                    startInlineEdit(titleEl as HTMLElement, rawName, (newTitle) => {
                        vscode.postMessage({ type: 'renameTask', taskId: task.id, currentTitle: prefix + newTitle });
                    });
                }
            }
        });
        menu.appendChild(renameItem);

        addSeparator(menu);

        const targetIds = selectedTaskIds.has(task.id) ? Array.from(selectedTaskIds) : [task.id];

        const pinText = task.pinned ? '取消置顶' : '置顶';
        const pinItem = createMenuItem(pinText, () => {
            vscode.postMessage({ type: 'pinTasks', taskIds: targetIds, pinned: !task.pinned });
        });
        menu.appendChild(pinItem);

        const archiveText = task.archived ? '取消归档' : '归档';
        const archiveItem = createMenuItem(archiveText, () => {
            vscode.postMessage({ type: 'archiveTasks', taskIds: targetIds, archived: !task.archived });
        });
        menu.appendChild(archiveItem);

        addSeparator(menu);

        const tasks = JSON.parse(document.getElementById('__sidebarData')?.dataset.tasks || '[]');
        const groups = JSON.parse(document.getElementById('__sidebarData')?.dataset.groups || '[]');

        const submenuTrigger = document.createElement('div');
        submenuTrigger.className = 'context-menu-item has-submenu';
        submenuTrigger.innerHTML = '<span>移至分组</span><span class="submenu-arrow">&#x25B6;</span>';

        const submenu = document.createElement('div');
        submenu.className = 'context-menu submenu';

        const noneItem = createMenuItem(task.group ? '未分组' : '✔ 未分组', () => {
            for (const id of targetIds) {
                vscode.postMessage({ type: 'moveTaskToGroup', taskId: id, group: null });
            }
        });
        submenu.appendChild(noneItem);

        for (const g of groups) {
            const checked = task.group === g ? '✔ ' : '';
            const groupItem = createMenuItem(checked + g, () => {
                for (const id of targetIds) {
                    vscode.postMessage({ type: 'moveTaskToGroup', taskId: id, group: g });
                }
            });
            submenu.appendChild(groupItem);
        }

        submenuTrigger.appendChild(submenu);

        submenuTrigger.addEventListener('mouseenter', () => {
            submenu.style.display = 'block';
        });
        submenuTrigger.addEventListener('mouseleave', (e) => {
            const rel = e.relatedTarget as Node;
            if (!submenu.contains(rel) && rel !== submenuTrigger) {
                submenu.style.display = 'none';
            }
        });
        submenu.addEventListener('mouseleave', (e) => {
            const rel = e.relatedTarget as Node;
            if (!submenuTrigger.contains(rel) && rel !== submenuTrigger) {
                submenu.style.display = 'none';
            }
        });

        menu.appendChild(submenuTrigger);
        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function createMenuItem(text: string, action: () => void): HTMLDivElement {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.textContent = text;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            action();
        });
        return item;
    }

    function hideContextMenu() {
        if (contextMenuEl) {
            contextMenuEl.remove();
            contextMenuEl = null;
        }
    }

    function renderTaskList(tasks: any[], groups: string[], activeTaskId?: string, editingGroupName?: string) {
        const pinnedList = document.getElementById('pinned-list');
        const taskList = document.getElementById('task-list');
        if (!taskList) return;

        const validIds = new Set(tasks.map((t: any) => t.id));
        for (const id of Array.from(selectedTaskIds)) {
            if (!validIds.has(id)) selectedTaskIds.delete(id);
        }

        const dataEl = document.getElementById('__sidebarData');
        if (dataEl) {
            dataEl.dataset.tasks = JSON.stringify(tasks);
            dataEl.dataset.groups = JSON.stringify(groups);
            dataEl.dataset.activeTaskId = activeTaskId || '';
        }

        updateBatchActionBar();

        const visible = tasks.filter((t: any) => !t.archived);
        const pinned = visible.filter((t: any) => t.pinned);
        const groupMap = new Map<string, any[]>();
        for (const g of groups) {
            groupMap.set(g, []);
        }
        const ungrouped = visible.filter((t: any) => {
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
            updateSelectionVisual();
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

        for (const key of Array.from(_groupCollapsed.keys())) {
            if (!groups.includes(key)) {
                _groupCollapsed.delete(key);
            }
        }

        for (const [groupName, groupTasks] of groupMap) {
            const section = createGroupSection(groupName, groupTasks, activeTaskId);
            taskList.appendChild(section);
        }

        updateSelectionVisual();

        if (editingGroupName) {
            requestAnimationFrame(() => {
                const header = document.querySelector(`.section-header[data-group-name="${editingGroupName}"]`);
                if (header) {
                    const label = header.querySelector('.group-label');
                    if (label) {
                        startInlineEdit(label as HTMLElement, editingGroupName, (newName) => {
                            vscode.postMessage({ type: 'renameGroup', groupName: editingGroupName, currentName: newName });
                        });
                    }
                }
            });
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
            const taskIds = parseDragTaskIds(e);
            if (taskIds.length > 0) {
                vscode.postMessage({
                    type: 'reorderTasks',
                    taskIds,
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

    function parseDragTaskIds(e: DragEvent): string[] {
        const raw = e.dataTransfer?.getData('text/plain');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [raw];
        } catch {
            return [raw];
        }
    }

    function getTaskOrder(): string[] {
        return Array.from(document.querySelectorAll('.task-item'))
            .map(el => (el as HTMLElement).dataset.taskId)
            .filter((id): id is string => !!id);
    }

    function updateSelectionVisual() {
        document.querySelectorAll('.task-item').forEach(el => {
            const id = (el as HTMLElement).dataset.taskId;
            el.classList.toggle('selected', id ? selectedTaskIds.has(id) : false);
        });
    }

    function updateBatchActionBar() {
        const bar = document.getElementById('batch-bar');
        if (!bar) return;
        bar.style.display = selectedTaskIds.size > 0 ? 'flex' : 'none';
    }

    function getStatusIndicator(task: any): { text: string; className: string } {
        if (task.type === 'chat') return { text: '', className: '' };
        switch (task.status) {
            case 'completed': return { text: '\u2713', className: 'status-completed' };
            case 'cancelled': return { text: '\u2715', className: 'status-cancelled' };
            case 'active': return { text: '\u25CF', className: 'status-active' };
            case 'in_review': return { text: '\u23F3', className: 'status-waiting' };
            case 'pending': return { text: '', className: '' };
            default: return { text: '', className: '' };
        }
    }

    function createTaskItem(task: any, activeTaskId?: string): HTMLElement {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.id === activeTaskId) item.classList.add('active');
        item.draggable = true;
        item.dataset.taskId = task.id;

        const indicator = getStatusIndicator(task);
        if (indicator.text) {
            const statusEl = document.createElement('span');
            statusEl.className = 'task-status ' + indicator.className;
            statusEl.textContent = indicator.text;
            item.appendChild(statusEl);
        }

        const label = document.createElement('span');
        label.className = 'task-title';
        label.textContent = escapeHtml(task.title);
        item.appendChild(label);

        item.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (selectedTaskIds.size === 0) {
                    const activeEl = document.querySelector('.task-item.active');
                    if (activeEl) {
                        const activeId = (activeEl as HTMLElement).dataset.taskId;
                        if (activeId && activeId !== task.id) {
                            selectedTaskIds.add(activeId);
                        }
                    }
                }
                if (selectedTaskIds.has(task.id)) {
                    selectedTaskIds.delete(task.id);
                } else {
                    selectedTaskIds.add(task.id);
                }
                anchorTaskId = task.id;
                updateSelectionVisual();
                updateBatchActionBar();
                e.preventDefault();
            } else if (e.shiftKey) {
                if (anchorTaskId) {
                    const allIds = getTaskOrder();
                    const anchorIdx = allIds.indexOf(anchorTaskId);
                    const currentIdx = allIds.indexOf(task.id);
                    if (anchorIdx !== -1 && currentIdx !== -1) {
                        const start = Math.min(anchorIdx, currentIdx);
                        const end = Math.max(anchorIdx, currentIdx);
                        const outside = Array.from(selectedTaskIds).filter(id => {
                            const idx = allIds.indexOf(id);
                            return idx < start || idx > end;
                        });
                        selectedTaskIds.clear();
                        for (let i = start; i <= end; i++) {
                            selectedTaskIds.add(allIds[i]);
                        }
                        for (const id of outside) {
                            selectedTaskIds.add(id);
                        }
                    }
                } else {
                    selectedTaskIds.add(task.id);
                    anchorTaskId = task.id;
                }
                updateSelectionVisual();
                updateBatchActionBar();
                e.preventDefault();
            } else {
                selectedTaskIds.clear();
                anchorTaskId = task.id;
                updateSelectionVisual();
                updateBatchActionBar();
                document.querySelectorAll('.task-item').forEach(t => t.classList.remove('active'));
                item.classList.add('active');
                vscode.postMessage({
                    type: 'selectTask',
                    taskId: task.id
                });
            }
        });

        item.addEventListener('dragstart', (e) => {
            const ids = selectedTaskIds.size > 0 ? [...selectedTaskIds] : [task.id];
            e.dataTransfer?.setData('text/plain', JSON.stringify(ids));
            draggedTaskId = task.id;
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
            vscode.postMessage({ type: 'debugLog', text: 'contextmenu fired on task.id=' + task.id });
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
            const taskIds = parseDragTaskIds(e);
            if (taskIds.length === 0) return;
            const rect = item.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const position = y < rect.height / 2 ? 'before' : 'after';
            const container = item.closest('.drop-zone') as HTMLElement;
            const group = container?.dataset?.group !== undefined ? (container.dataset.group || null) : null;
            vscode.postMessage({
                type: 'reorderTasks',
                taskIds,
                targetTaskId: item.dataset.taskId,
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
        header.draggable = true;
        header.dataset.groupName = groupName;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        header.appendChild(arrow);

        const label = document.createElement('span');
        label.className = 'group-label';
        label.textContent = escapeHtml(groupName);
        header.appendChild(label);

        let collapsed = _groupCollapsed.get(groupName) ?? false;
        header.addEventListener('click', (e) => {
            if (e.target && (e.target as HTMLElement).closest('.context-menu')) return;
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

        header.addEventListener('dragstart', (e) => {
            e.dataTransfer?.setData('text/plain', 'GROUP:' + groupName);
            header.classList.add('dragging');
        });

        header.addEventListener('dragend', () => {
            header.classList.remove('dragging');
            clearGroupDropIndicators();
        });

        header.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = header.getBoundingClientRect();
            const y = e.clientY - rect.top;
            clearGroupDropIndicators();
            header.classList.add(y < rect.height / 2 ? 'group-drop-before' : 'group-drop-after');
        });

        header.addEventListener('dragleave', (e) => {
            if (!header.contains(e.relatedTarget as Node)) {
                header.classList.remove('group-drop-before', 'group-drop-after');
            }
        });

        header.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            clearGroupDropIndicators();
            const raw = e.dataTransfer?.getData('text/plain');
            if (!raw) return;
            if (raw.startsWith('GROUP:')) {
                const draggedGroup = raw.slice(6);
                if (draggedGroup === groupName) return;
                const groups = JSON.parse(document.getElementById('__sidebarData')?.dataset.groups || '[]');
                const fromIdx = groups.indexOf(draggedGroup);
                const toIdx = groups.indexOf(groupName);
                if (fromIdx === -1 || toIdx === -1) return;
                const rect = header.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const position = y < rect.height / 2 ? 'before' : 'after';
                groups.splice(fromIdx, 1);
                const newToIdx = groups.indexOf(groupName);
                groups.splice(newToIdx + (position === 'after' ? 1 : 0), 0, draggedGroup);
                vscode.postMessage({ type: 'reorderGroups', groupNames: groups });
            }
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGroupContextMenu(e.clientX, e.clientY, groupName, tasks.length);
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

    function showGroupContextMenu(x: number, y: number, groupName: string, taskCount: number) {
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // --- 重命名 ---
        const renameItem = createMenuItem('重命名', () => {
            const header = document.querySelector(`.section-header[data-group-name="${groupName}"]`);
            if (header) {
                const label = header.querySelector('.group-label');
                if (label) {
                    startInlineEdit(label as HTMLElement, groupName, (newName) => {
                        vscode.postMessage({ type: 'renameGroup', groupName, currentName: newName });
                    });
                }
            }
        });
        menu.appendChild(renameItem);

        addSeparator(menu);

        // --- 上移 ---
        const upItem = createMenuItem('上移', () => {
            vscode.postMessage({ type: 'moveGroup', groupName, direction: 'up' });
        });
        menu.appendChild(upItem);

        // --- 下移 ---
        const downItem = createMenuItem('下移', () => {
            vscode.postMessage({ type: 'moveGroup', groupName, direction: 'down' });
        });
        menu.appendChild(downItem);

        addSeparator(menu);

        // --- 删除 ---
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        if (taskCount > 0) {
            deleteItem.textContent = '删除分组（请先移出所有任务）';
            deleteItem.style.color = '#888';
            deleteItem.style.cursor = 'not-allowed';
        } else {
            deleteItem.textContent = '删除';
            deleteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                hideContextMenu();
                vscode.postMessage({ type: 'deleteGroup', groupName });
            });
        }
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function clearGroupDropIndicators() {
        document.querySelectorAll('.section-header').forEach(el => {
            el.classList.remove('group-drop-before', 'group-drop-after');
        });
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    (window as any).renderTaskList = renderTaskList;
}
