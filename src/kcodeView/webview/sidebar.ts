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

        const batchDeleteBtn = document.getElementById('btn-batch-delete');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => {
                if (selectedTaskIds.size === 0) return;
                const ids = [...selectedTaskIds];
                selectedTaskIds.clear();
                updateSelectionVisual();
                updateBatchActionBar();
                vscode.postMessage({ type: 'deleteTasks', taskIds: ids });
            });
        }

        const batchPinBtn = document.getElementById('btn-batch-pin');
        if (batchPinBtn) {
            batchPinBtn.addEventListener('click', () => {
                if (selectedTaskIds.size === 0) return;
                const ids = [...selectedTaskIds];
                const tasks = JSON.parse(document.getElementById('__sidebarData')?.dataset.tasks || '[]');
                const allPinned = ids.every((id: string) => {
                    const t = tasks.find((x: any) => x.id === id);
                    return t && t.pinned;
                });
                vscode.postMessage({ type: 'pinTasks', taskIds: ids, pinned: !allPinned });
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

        const inSelection = selectedTaskIds.size > 1 && selectedTaskIds.has(task.id);
        const idsToDelete = inSelection ? [...selectedTaskIds] : [task.id];

        const pinText = task.pinned ? '取消置顶' : '置顶';
        const pinLabel = inSelection ? (task.pinned ? `取消置顶选中 (${idsToDelete.length})` : `置顶选中 (${idsToDelete.length})`) : pinText;
        const pinItem = document.createElement('div');
        pinItem.className = 'context-menu-item';
        pinItem.textContent = pinLabel;
        pinItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            if (inSelection) {
                vscode.postMessage({ type: 'pinTasks', taskIds: idsToDelete, pinned: !task.pinned });
            } else {
                vscode.postMessage({ type: 'pinTask', taskId: task.id, pinned: !task.pinned });
            }
        });
        menu.appendChild(pinItem);

        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        deleteItem.textContent = inSelection ? `删除选中 (${idsToDelete.length})` : 'Delete';
        deleteItem.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            if (inSelection) {
                selectedTaskIds.clear();
                updateSelectionVisual();
                updateBatchActionBar();
                vscode.postMessage({ type: 'deleteTasks', taskIds: idsToDelete });
            } else {
                vscode.postMessage({ type: 'deleteTask', taskId: task.id });
            }
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
        const countEl = document.getElementById('batch-count');
        const pinBtn = document.getElementById('btn-batch-pin');
        if (!bar) return;
        const count = selectedTaskIds.size;
        if (count > 0) {
            bar.style.display = 'flex';
            if (countEl) countEl.textContent = `已选 ${count}`;
            if (pinBtn) {
                const tasks = JSON.parse(document.getElementById('__sidebarData')?.dataset.tasks || '[]');
                const allPinned = Array.from(selectedTaskIds).every((id: string) => {
                    const t = tasks.find((x: any) => x.id === id);
                    return t && t.pinned;
                });
                pinBtn.textContent = allPinned ? '取消置顶' : '置顶';
            }
        } else {
            bar.style.display = 'none';
        }
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
                        for (let i = start; i <= end; i++) {
                            selectedTaskIds.add(allIds[i]);
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
                anchorTaskId = null;
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
