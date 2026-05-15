declare function acquireVsCodeApi(): any;

{
    const vscode = acquireVsCodeApi();
    let contextMenuEl: HTMLDivElement | null = null;
    let draggedTaskId: string | null = null;
    let selectedTaskIds: Set<string> = new Set();
    let anchorTaskId: string | null = null;
    const _collapsed = new Map<string, boolean>();

    (function () {
        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'openSettings' });
            });
        }

        const myTasksBtn = document.getElementById('btn-my-tasks');
        if (myTasksBtn) {
            myTasksBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'showMyTasks' });
            });
        }

        const knowledgeBtn = document.getElementById('btn-knowledge');
        if (knowledgeBtn) {
            knowledgeBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'showKnowledgeBase' });
            });
        }

        const newTaskBtn = document.getElementById('btn-new-task');
        if (newTaskBtn) {
            newTaskBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'newTask' });
            });
        }

        const importBtn = document.getElementById('btn-import-task');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'importGitHubIssue' });
            });
        }

        const myProjectsBtn = document.getElementById('btn-my-projects');
        if (myProjectsBtn) {
            myProjectsBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'showMyProjects' });
            });
        }

        const templateBtn = document.getElementById('btn-template-task');
        if (templateBtn) {
            templateBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'newTaskFromTemplate' });
            });
        }

        document.addEventListener('click', (e) => {
            hideContextMenu();
        });

        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.type) {
                case 'updateTaskList':
                    renderSidebar(message.tasks, message.containers || [], message.activeTaskId);
                    break;
                case 'expandContainer':
                    _collapsed.delete(message.containerId);
                    break;
            }
        });
    })();

    const dataEl = document.getElementById('__sidebarData');
    if (dataEl) {
        const tasks = JSON.parse(dataEl.dataset.tasks || '[]');
        const groups = JSON.parse(dataEl.dataset.groups || '[]');
        const containers = JSON.parse(dataEl.dataset.containers || '[]');
        const activeTaskId = dataEl.dataset.activeTaskId || undefined;
        renderSidebar(tasks, containers, activeTaskId);
    }

    function renderSidebar(tasks: any[], containers: any[], activeTaskId?: string) {
        const projectList = document.getElementById('project-list');
        if (!projectList) return;

        const validIds = new Set(tasks.map((t: any) => t.id));
        for (const id of Array.from(selectedTaskIds)) {
            if (!validIds.has(id)) selectedTaskIds.delete(id);
        }

        const dataEl = document.getElementById('__sidebarData');
        if (dataEl) {
            dataEl.dataset.tasks = JSON.stringify(tasks);
            dataEl.dataset.containers = JSON.stringify(containers);
            dataEl.dataset.activeTaskId = activeTaskId || '';
        }

        projectList.innerHTML = '';

        const visible = tasks.filter((t: any) => !t.archived);
        const projects = containers.filter((c: any) => c.type === 'project');
        const unassigned = visible.filter((t: any) => !t.containerId);

        if (projects.length === 0 && unassigned.length === 0) {
            projectList.innerHTML = '<div class="placeholder-text">暂无任务</div>';
            return;
        }

        // Render "未分配" section as a virtual project
        if (unassigned.length > 0) {
            const section = createVirtualProjectSection(unassigned, activeTaskId);
            projectList.appendChild(section);
        }

        for (const project of projects) {
            const section = createProjectSection(project, containers, visible, activeTaskId);
            projectList.appendChild(section);
        }
    }

    function createVirtualProjectSection(tasks: any[], activeTaskId?: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'project-section';

        const header = document.createElement('div');
        header.className = 'project-header';

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        header.appendChild(arrow);

        const icon = document.createElement('span');
        icon.className = 'project-icon';
        icon.textContent = '📦';
        header.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'project-name';
        name.textContent = '未分类任务';
        header.appendChild(name);

        const count = document.createElement('span');
        count.className = 'project-progress-text';
        const done = tasks.filter((t: any) => t.status === 'completed').length;
        count.textContent = tasks.length > 0 ? `${done}/${tasks.length}` : '';
        header.appendChild(count);

        section.appendChild(header);

        let collapsed = _collapsed.get('__unassigned') ?? false;
        header.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.context-menu')) return;
            collapsed = !collapsed;
            _collapsed.set('__unassigned', collapsed);
            body.classList.toggle('hidden', collapsed);
            arrow.classList.toggle('collapsed', collapsed);
        });

        const body = document.createElement('div');
        body.className = 'project-body';
        if (collapsed) body.classList.add('hidden');

        const zone = document.createElement('div');
        zone.className = 'section-body';
        zone.dataset.container = '';
        for (const task of tasks) {
            zone.appendChild(createTaskItem(task, activeTaskId));
        }
        body.appendChild(zone);
        section.appendChild(body);

        return section;
    }

    function createProjectSection(project: any, containers: any[], tasks: any[], activeTaskId?: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'project-section';
        section.dataset.projectId = project.id;

        const header = document.createElement('div');
        header.className = 'project-header';
        header.dataset.projectId = project.id;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        header.appendChild(arrow);

        const icon = document.createElement('span');
        icon.className = 'project-icon';
        icon.textContent = '📦';
        header.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'project-name';
        name.textContent = escapeHtml(project.name);
        header.appendChild(name);

        const progress = computeProgress(project.id, containers, tasks);
        const progText = document.createElement('span');
        progText.className = 'project-progress-text';
        progText.textContent = progress.total > 0 ? `${progress.completed}/${progress.total}` : '';
        header.appendChild(progText);

        let collapsed = _collapsed.get(project.id) ?? false;
        header.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.context-menu')) return;
            if ((e.target as HTMLElement).closest('.project-add-btn')) return;
            collapsed = !collapsed;
            _collapsed.set(project.id, collapsed);
            body.classList.toggle('hidden', collapsed);
            arrow.classList.toggle('collapsed', collapsed);
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showProjectContextMenu(e.clientX, e.clientY, project, containers, tasks);
        });

        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'project-body';
        if (collapsed) body.classList.add('hidden');

        // Child groups
        const childContainers = containers.filter((c: any) => c.parentId === project.id && c.type === 'group');
        for (const child of childContainers) {
            const childTasks = tasks.filter((t: any) => t.containerId === child.id);
            body.appendChild(createGroupSection(child.name, childTasks, activeTaskId, child.id, project.id));
        }

        // Direct tasks under project
        const directTasks = tasks.filter((t: any) => t.containerId === project.id);
        const zone = document.createElement('div');
        zone.className = 'group-body';
        zone.dataset.container = project.id;
        if (directTasks.length === 0 && childContainers.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'placeholder-text';
            hint.textContent = '空项目';
            zone.appendChild(hint);
        }
        for (const task of directTasks) {
            zone.appendChild(createTaskItem(task, activeTaskId));
        }
        body.appendChild(zone);

        section.appendChild(body);
        return section;
    }

    function computeProgress(projectId: string, containers: any[], tasks: any[]): { completed: number; total: number } {
        const containerIds = new Set<string>();
        const collectIds = (parentId: string) => {
            containerIds.add(parentId);
            for (const c of containers) {
                if (c.parentId === parentId) collectIds(c.id);
            }
        };
        collectIds(projectId);
        const projectTasks = tasks.filter((t: any) => t.containerId && containerIds.has(t.containerId) && t.status !== 'cancelled');
        const total = projectTasks.length;
        const completed = projectTasks.filter((t: any) => t.status === 'completed').length;
        return { completed, total };
    }

    function showProjectContextMenu(x: number, y: number, project: any, containers: any[], tasks: any[]) {
        hideContextMenu();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const newGroupItem = createMenuItem('新建分组', () => {
            vscode.postMessage({ type: 'newGroupInProject', projectId: project.id });
        });
        menu.appendChild(newGroupItem);

        addSeparator(menu);

        const renameItem = createMenuItem('重命名', () => {
            vscode.postMessage({ type: 'renameContainer', containerId: project.id, name: project.name });
        });
        menu.appendChild(renameItem);

        addSeparator(menu);

        const upItem = createMenuItem('上移', () => {
            vscode.postMessage({ type: 'moveContainer', containerId: project.id, direction: 'up' });
        });
        menu.appendChild(upItem);

        const downItem = createMenuItem('下移', () => {
            vscode.postMessage({ type: 'moveContainer', containerId: project.id, direction: 'down' });
        });
        menu.appendChild(downItem);

        addSeparator(menu);

        const projectTasks = tasks.filter((t: any) => t.containerId === project.id);
        const deleteItem = document.createElement('div');
        deleteItem.className = 'context-menu-item';
        if (projectTasks.length > 0) {
            deleteItem.textContent = `删除项目（${projectTasks.length} 个任务需先移出）`;
            deleteItem.style.color = '#888';
            deleteItem.style.cursor = 'not-allowed';
        } else {
            deleteItem.textContent = '删除项目';
            deleteItem.addEventListener('click', (e) => {
                e.stopPropagation();
                hideContextMenu();
                vscode.postMessage({ type: 'deleteContainer', containerId: project.id });
            });
        }
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function createGroupSection(groupName: string, tasks: any[], activeTaskId?: string, containerId?: string, projectId?: string): HTMLElement {
        const section = document.createElement('div');

        const header = document.createElement('div');
        header.className = 'group-header';
        if (containerId) header.dataset.containerId = containerId;

        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        header.appendChild(arrow);

        const icon = document.createElement('span');
        icon.className = 'group-icon';
        icon.textContent = '📚';
        header.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'group-label';
        label.textContent = escapeHtml(groupName);
        header.appendChild(label);

        let collapsed = _collapsed.get(groupName) ?? false;
        header.addEventListener('click', (e) => {
            if (e.target && (e.target as HTMLElement).closest('.context-menu')) return;
            collapsed = !collapsed;
            _collapsed.set(groupName, collapsed);
            body.style.display = collapsed ? 'none' : '';
            arrow.classList.toggle('collapsed', collapsed);
        });

        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showGroupContextMenu(e.clientX, e.clientY, groupName, tasks.length, containerId);
        });

        section.appendChild(header);

        const body = document.createElement('div');
        body.className = 'group-body';
        if (tasks.length === 0) {
            const hint = document.createElement('div');
            hint.className = 'placeholder-text';
            hint.textContent = '空分组';
            body.appendChild(hint);
        }
        for (const task of tasks) {
            body.appendChild(createTaskItem(task, activeTaskId));
        }
        section.appendChild(body);

        if (collapsed) {
            body.style.display = 'none';
            arrow.classList.add('collapsed');
        }

        return section;
    }

    function showGroupContextMenu(x: number, y: number, groupName: string, taskCount: number, containerId?: string) {
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const renameItem = createMenuItem('重命名', () => {
            if (containerId) {
                vscode.postMessage({ type: 'renameContainer', containerId, name: groupName });
            }
        });
        menu.appendChild(renameItem);

        addSeparator(menu);

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
                if (containerId) {
                    vscode.postMessage({ type: 'deleteContainer', containerId });
                }
            });
        }
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    function getPhaseLetter(phase: string): string {
        const map: Record<string, string> = { demand: 'D', goal: 'T', plan: 'P', execute: 'E', self_verify: 'V', review: 'C' };
        return map[phase] || '';
    }

    function getStatusIndicator(task: any): { text: string; className: string } {
        if (task.type === 'chat') return { text: '○', className: 's-chat' };
        switch (task.status) {
            case 'completed': return { text: '\u2713', className: 's-completed' };
            case 'cancelled': return { text: '\u2715', className: 's-cancelled' };
            case 'active':
                const letter = getPhaseLetter(task.phase);
                return { text: letter || '\u25CF', className: 's-active' };
            case 'in_review': return { text: '\u23F3', className: 's-waiting' };
            case 'pending': return { text: '', className: '' };
            default: return { text: '', className: '' };
        }
    }

    function createTaskItem(task: any, activeTaskId?: string): HTMLElement {
        const item = document.createElement('div');
        item.className = 'task-item';
        if (task.id === activeTaskId) item.classList.add('active');
        item.dataset.taskId = task.id;

        // Type icon: 📝 for task, 💬 for chat
        const typeIcon = document.createElement('span');
        typeIcon.className = 'task-type-icon';
        typeIcon.textContent = task.type === 'chat' ? '💬' : '📝';
        item.appendChild(typeIcon);

        // Status indicator: circle-letter for active, checkmark for completed, etc.
        const indicator = getStatusIndicator(task);
        if (indicator.text) {
            const statusEl = document.createElement('span');
            statusEl.className = 'task-status-icon ' + indicator.className;
            statusEl.textContent = indicator.text;
            item.appendChild(statusEl);
        }

        const label = document.createElement('span');
        label.className = 'task-title';
        label.textContent = escapeHtml(task.title);
        item.appendChild(label);

        item.addEventListener('click', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (selectedTaskIds.has(task.id)) {
                    selectedTaskIds.delete(task.id);
                } else {
                    selectedTaskIds.add(task.id);
                }
                anchorTaskId = task.id;
                e.preventDefault();
            } else if (e.shiftKey) {
                if (anchorTaskId) {
                    const allIds = getTaskOrder();
                    const anchorIdx = allIds.indexOf(anchorTaskId);
                    const currentIdx = allIds.indexOf(task.id);
                    if (anchorIdx !== -1 && currentIdx !== -1) {
                        const start = Math.min(anchorIdx, currentIdx);
                        const end = Math.max(anchorIdx, currentIdx);
                        selectedTaskIds.clear();
                        for (let i = start; i <= end; i++) {
                            selectedTaskIds.add(allIds[i]);
                        }
                    }
                } else {
                    selectedTaskIds.add(task.id);
                    anchorTaskId = task.id;
                }
                e.preventDefault();
            } else {
                selectedTaskIds.clear();
                anchorTaskId = task.id;
                document.querySelectorAll('.task-item').forEach(t => t.classList.remove('active'));
                item.classList.add('active');
                vscode.postMessage({
                    type: 'selectTask',
                    taskId: task.id
                });
            }
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTaskContextMenu(e.clientX, e.clientY, task);
        });

        return item;
    }

    function showTaskContextMenu(x: number, y: number, task: any) {
        hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        const targetIds = selectedTaskIds.has(task.id) ? Array.from(selectedTaskIds) : [task.id];

        const pinText = task.pinned ? '取消置顶' : '置顶';
        const pinItem = createMenuItem(pinText, () => {
            vscode.postMessage({ type: 'pinTasks', taskIds: targetIds, pinned: !task.pinned });
        });
        menu.appendChild(pinItem);

        const archiveText = task.archived ? '取消归档' : '归档';
        const archiveItem = createMenuItem(archiveText, () => {
            vscode.postMessage({ type: 'pinTasks', taskIds: targetIds, pinned: false });
            // Archive via deleteTasks for now — we skip archived semantic since sidebar hides them
            for (const id of targetIds) {
                vscode.postMessage({ type: 'deleteTask', taskId: id });
            }
        });
        menu.appendChild(archiveItem);

        addSeparator(menu);

        const renameItem = createMenuItem('重命名', () => {
            vscode.postMessage({ type: 'renameTask', taskId: task.id, currentTitle: task.title });
        });
        menu.appendChild(renameItem);

        addSeparator(menu);

        const containers = JSON.parse(document.getElementById('__sidebarData')?.dataset.containers || '[]');

        // 移至项目
        const projectTrigger = document.createElement('div');
        projectTrigger.className = 'context-menu-item has-submenu';
        projectTrigger.innerHTML = '<span>移至项目</span><span class="submenu-arrow">&#x25B6;</span>';

        const projectSubmenu = document.createElement('div');
        projectSubmenu.className = 'context-menu submenu';

        const noneProjectItem = createMenuItem(task.containerId ? '无项目' : '✔ 无项目', () => {
            for (const id of targetIds) {
                vscode.postMessage({ type: 'updateTaskContainer', taskId: id, containerId: undefined });
            }
        });
        projectSubmenu.appendChild(noneProjectItem);

        const projects = containers.filter((c: any) => c.type === 'project');
        for (const p of projects) {
            const checked = task.containerId === p.id ? '✔ ' : '';
            const pItem = createMenuItem(checked + p.name, () => {
                for (const id of targetIds) {
                    vscode.postMessage({ type: 'updateTaskContainer', taskId: id, containerId: p.id });
                }
            });
            projectSubmenu.appendChild(pItem);
        }

        projectTrigger.appendChild(projectSubmenu);
        projectTrigger.addEventListener('mouseenter', () => { projectSubmenu.style.display = 'block'; });
        projectTrigger.addEventListener('mouseleave', (e) => {
            const rel = e.relatedTarget as Node;
            if (!projectSubmenu.contains(rel) && rel !== projectTrigger) projectSubmenu.style.display = 'none';
        });
        projectSubmenu.addEventListener('mouseleave', (e) => {
            const rel = e.relatedTarget as Node;
            if (!projectTrigger.contains(rel) && rel !== projectTrigger) projectSubmenu.style.display = 'none';
        });

        menu.appendChild(projectTrigger);

        const deleteItem = createMenuItem('删除', () => {
            vscode.postMessage({ type: 'deleteTasks', taskIds: targetIds });
        });
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);
        contextMenuEl = menu;
    }

    // ===== Helper functions =====

    function addSeparator(menu: HTMLDivElement): void {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        menu.appendChild(sep);
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

    function getTaskOrder(): string[] {
        return Array.from(document.querySelectorAll('.task-item'))
            .map(el => (el as HTMLElement).dataset.taskId)
            .filter((id): id is string => !!id);
    }

    function escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    (window as any).renderSidebar = renderSidebar;
}
