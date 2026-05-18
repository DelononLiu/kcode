function opEscapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const _opVscode = (window as any).vscode;

function initOutputPanel() {
    const panel = document.getElementById('right-output-panel');
    const handle = document.getElementById('output-resize-handle');
    if (!panel || !handle) return;

    const MIN_W = 100, MAX_W = 500, SNAP = 30;

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startWidth = panel.classList.contains('collapsed') ? 0 : panel.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const diff = startX - e.clientX;
        const newWidth = Math.min(MAX_W, Math.max(0, startWidth + diff));

        if (panel.classList.contains('collapsed')) {
            if (newWidth > SNAP) {
                panel.style.minWidth = '0';
                panel.style.width = Math.max(MIN_W, newWidth) + 'px';
                panel.style.flex = 'none';
                panel.classList.remove('collapsed');
            }
        } else {
            if (newWidth < SNAP) {
                panel.classList.add('collapsed');
                panel.style.minWidth = '';
                panel.style.width = '';
            } else {
                panel.style.minWidth = '0';
                panel.style.width = Math.min(MAX_W, Math.max(MIN_W, newWidth)) + 'px';
                panel.style.flex = 'none';
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        if (!panel.classList.contains('collapsed')) {
            const w = panel.offsetWidth;
            if (w < SNAP) {
                panel.classList.add('collapsed');
                panel.style.minWidth = '';
                panel.style.width = '';
            } else if (w >= 140) {
                panel.style.minWidth = '';
            }
        }
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

function updateOutputPanel(taskInfo: any, changes: any[]) {
    // Section 1: Changes list
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
            codeList.innerHTML = '<div class="op-empty">暂无变更</div>';
        }
    }

    // Section 2: Knowledge wiki + export
    const knowledgeList = document.getElementById('op-knowledge-list');
    if (knowledgeList) {
        const known = taskInfo?.knowledgeItems;
        if (known && known.length > 0) {
            const typeIcons: Record<string, string> = { decision: '📐', pitfall: '🐛', pattern: '🔧', code_snippet: '💻' };
            knowledgeList.innerHTML = known.map((k: any) => {
                const icon = typeIcons[k.type] || '📌';
                return `<div class="op-knowledge-entry" data-entry-id="${opEscapeHtml(k.id || '')}" data-title="${opEscapeHtml(k.title)}">
                    <span class="op-item-icon">${icon}</span>
                    <div class="op-knowledge-body">
                        <span class="op-knowledge-title">${opEscapeHtml(k.title)}</span>
                        <span class="op-knowledge-preview">${opEscapeHtml(k.content || '').substring(0, 60)}</span>
                        <div class="op-knowledge-tags">${(k.tags || []).map((t: string) => `<span class="op-tag">#${opEscapeHtml(t)}</span>`).join('')}</div>
                    </div>
                </div>`;
            }).join('');
            knowledgeList.querySelectorAll('.op-knowledge-entry').forEach(el => {
                el.addEventListener('click', () => {
                    const entryId = (el as HTMLElement).dataset.entryId;
                    if (entryId && _opVscode) {
                        _opVscode.postMessage({ type: 'openKnowledgeEntry', entryId });
                    }
                });
            });
        } else {
            const taskStatus = taskInfo?.status;
            const taskPhase = taskInfo?.phase;
            const showHint = taskStatus === 'completed' || taskPhase === 'review';
            knowledgeList.innerHTML = showHint
                ? '<div class="op-empty">该任务暂无知识沉淀<br/><span style="font-size:10px;color:#555">可在 review 阶段让 AI 自动生成</span></div>'
                : '<div class="op-empty">暂无知识条目</div>';
        }

        // Export to Wiki button
        const exportBtn = document.getElementById('op-export-btn');
        if (exportBtn) {
            const taskId = taskInfo?.taskId;
            const hasContent = taskInfo?.canExport;
            if (taskId && hasContent && !taskInfo?.isAssistant) {
                exportBtn.classList.remove('hidden');
                (exportBtn as HTMLElement).dataset.taskId = taskId;
            } else {
                exportBtn.classList.add('hidden');
            }
        }
    }

    // Section 3: TODO + Plan steps
    const planList = document.getElementById('op-plan-list');
    if (planList && taskInfo) {
        const steps = taskInfo.planSteps || [];
        const todos: any[] = taskInfo.todos || [];
        const parts: string[] = [];

        if (steps.length > 0) {
            const statusEmoji: Record<string, string> = { pending: '○', active: '◉', completed: '✓' };
            const done = steps.filter((s: any) => s.status === 'completed').length;
            parts.push(
                `<div class="op-plan-header">📋 计划步骤 (${done}/${steps.length})</div>` +
                `<div class="op-plan-bar"><div class="op-plan-fill" style="width:${steps.length > 0 ? (done / steps.length * 100) : 0}%"></div></div>` +
                steps.map((s: any) =>
                    `<div class="op-item"><span class="op-item-icon">${statusEmoji[s.status] || '○'}</span><span class="op-item-name">${opEscapeHtml(s.content)}</span></div>`
                ).join('')
            );
        }

        if (todos.length > 0) {
            const done = todos.filter((t: any) => t.status === 'completed').length;
            parts.push(
                `<div class="op-plan-header" style="margin-top:6px">✅ 待办清单 (${done}/${todos.length})</div>` +
                `<div class="op-plan-bar"><div class="op-plan-fill" style="width:${todos.length > 0 ? (done / todos.length * 100) : 0}%"></div></div>` +
                todos.map((t: any) => {
                    const checked = t.status === 'completed';
                    return `<div class="op-item"><span class="op-item-icon">${checked ? '✓' : '○'}</span><span class="op-item-name" style="${checked ? 'text-decoration:line-through;color:#666' : ''}">${opEscapeHtml(t.content)}</span></div>`;
                }).join('')
            );
        }

        planList.innerHTML = parts.length > 0 ? parts.join('') : '<div class="op-empty">暂无待办</div>';
    }

    // Section 4: Tool call records
    const toolList = document.getElementById('op-tool-list');
    if (toolList) {
        const toolCalls = taskInfo?.toolCalls;
        if (toolCalls && toolCalls.length > 0) {
            toolList.innerHTML = toolCalls.map((tc: any) => {
                const kindIcon: Record<string, string> = { bash: '$', read: '📖', write: '✏️', glob: '🔍', grep: '🔎', thinking: '💭' };
                const icon = kindIcon[tc.kind] || '🔧';
                const statusIcon = tc.status === 'completed' ? '✅' : tc.status === 'running' ? '🔄' : '⏳';
                return `<div class="op-item" title="${opEscapeHtml(tc.title || '')}">
                    <span class="op-item-icon">${icon}</span>
                    <span class="op-item-label">${statusIcon}</span>
                    <span class="op-item-name">${opEscapeHtml(tc.title || tc.kind)}</span>
                </div>`;
            }).join('');
        } else {
            toolList.innerHTML = '<div class="op-empty">暂无工具调用</div>';
        }
    }
}

(window as any).initOutputPanel = initOutputPanel;
(window as any).updateOutputPanel = updateOutputPanel;
