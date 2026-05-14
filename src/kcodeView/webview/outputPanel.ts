// Right output panel: four output artifact tabs

function opEscapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initOutputPanel() {
    const panel = document.getElementById('right-output-panel');
    const handle = document.getElementById('output-resize-handle');
    const expandBtn = document.getElementById('op-expand-btn');
    if (!panel) return;

    // Expand button to restore panel
    expandBtn?.addEventListener('click', () => {
        panel.classList.remove('collapsed');
        panel.style.width = '220px';
        panel.style.flex = 'none';
        expandBtn.classList.add('hidden');
    });

    // Draggable resize + collapse when dragged to left edge
    if (handle) {
        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startWidth = panel.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const diff = startX - e.clientX;
            const newWidth = startWidth + diff;
            if (newWidth < 30) {
                // Collapse when dragged to edge
                panel.classList.add('collapsed');
                expandBtn?.classList.remove('hidden');
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            } else {
                panel.classList.remove('collapsed');
                expandBtn?.classList.add('hidden');
                panel.style.width = Math.min(500, Math.max(100, newWidth)) + 'px';
                panel.style.flex = 'none';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }
}

function updateOutputPanel(taskInfo: any, changes: any[]) {
    // Update code changes tab
    const codeList = document.getElementById('op-code-list');
    if (codeList) {
        if (changes && changes.length > 0) {
            codeList.innerHTML = changes.map((c: any) => {
                const icon = !c.original ? '📄' : !c.modified ? '🗑️' : '📝';
                const label = !c.original ? '新建' : !c.modified ? '删除' : '修改';
                return `<div class="op-item" data-filepath="${opEscapeHtml(c.filePath)}">
                    <span class="op-item-icon">${icon}</span>
                    <span class="op-item-label">${label}</span>
                    <span class="op-item-name">${opEscapeHtml(c.filePath)}</span>
                </div>`;
            }).join('');
            codeList.querySelectorAll('.op-item').forEach(el => {
                el.addEventListener('click', () => {
                    const fp = (el as HTMLElement).dataset.filepath;
                    if (fp && (window as any).__openFileInRightPanel) {
                        (window as any).__openFileInRightPanel(fp);
                    }
                });
            });
        } else {
            codeList.innerHTML = '<div class="op-empty">暂无代码变更</div>';
        }
    }

    // Update tool records tab
    const toolList = document.getElementById('op-tool-list');
    if (toolList && taskInfo) {
        toolList.innerHTML = '<div class="op-empty">工具执行记录将在此显示</div>';
    }

    // Update plan/todo tab
    const planList = document.getElementById('op-plan-list');
    if (planList && taskInfo) {
        const steps = taskInfo.planSteps || [];
        if (steps.length > 0) {
            const statusEmoji: Record<string, string> = { pending: '○', active: '◉', completed: '✓' };
            const done = steps.filter((s: any) => s.status === 'completed').length;
            planList.innerHTML =
                `<div class="op-plan-header">${done}/${steps.length} 完成</div>` +
                `<div class="op-plan-bar"><div class="op-plan-fill" style="width:${steps.length > 0 ? (done / steps.length * 100) : 0}%"></div></div>` +
                steps.map((s: any) =>
                    `<div class="op-item"><span class="op-item-icon">${statusEmoji[s.status] || '○'}</span><span class="op-item-name">${opEscapeHtml(s.content)}</span></div>`
                ).join('');
        } else {
            planList.innerHTML = '<div class="op-empty">暂无计划步骤</div>';
        }
    }

    // Update knowledge tab
    const knowledgeList = document.getElementById('op-knowledge-list');
    if (knowledgeList) {
        knowledgeList.innerHTML = '<div class="op-empty">关联知识将在此显示</div>';
    }
}

(window as any).initOutputPanel = initOutputPanel;
(window as any).updateOutputPanel = updateOutputPanel;
