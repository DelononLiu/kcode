export {};
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();
(window as any).vscode = vscode;

let activeTaskId: string | null = null;
let activeTaskPhase: string = '';
let activeTaskStatus: string = '';
let activeTaskGoal: string = '';
let activeTaskTitle: string = '';
let lastTaskInfo: any = {};
let lastReviewChanges: any[] = [];
let cardActiveTools: { toolCallId: string; title: string; kind: string; status: string; output?: string }[] = [];

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimestamp(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addSystemMessage(content: string): void {
    const el = document.getElementById('system-narration');
    if (!el) return;
    el.innerHTML = `<div style="padding:4px 8px;font-size:12px;color:#e8a84c;border:1px solid rgba(232,168,76,.15);border-radius:4px;background:rgba(232,168,76,.04)">${escapeHtml(content)}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
}

function phaseLabel(phase: string): string {
    const labels: Record<string, string> = { demand: '需求', goal: '目标', plan: '计划', execute: '执行', self_verify: '自验', review: '验收' };
    return labels[phase] || phase;
}

function cardConfirmButtons(phase: string, status: string): string {
    if (status === 'cancelled' || status === 'completed') return '';
    const btns: Record<string, { label: string; action: string }[]> = {
        goal: [{ label: '✅ 确认目标', action: 'confirmGoalFromHeader' }],
        plan: [{ label: '📋 确认计划', action: 'confirmPlan' }],
        execute: [{ label: '⚡ 确认完成', action: 'confirmExecuteDone' }],
    };
    const phaseBtns = btns[phase];
    if (!phaseBtns) return '';
    let html = '<div class="card-section card-actions">';
    for (const btn of phaseBtns) {
        html += `<button class="card-action-btn primary" onclick="vscode.postMessage({type:'${btn.action}',taskId:'${activeTaskId}'})">${btn.label}</button>`;
    }
    html += '</div>';
    return html;
}

function renderCards() {
    const info = lastTaskInfo || {};
    const phase = activeTaskPhase || info.phase || '';
    const status = activeTaskStatus || info.status || '';
    const goal = activeTaskGoal || info.goal || '';
    const planSteps: any[] = info.planSteps || [];
    const confirmedItems: string[] = info.confirmedItems || [];
    const pendingItems: string[] = info.pendingItems || [];
    const terminalLogCount: number = info.terminalLogCount || 0;
    const planVersion: number = info.planVersion || 1;
    const versionLabel = phase === 'review' || status === 'completed' ? 'V' + planVersion + ' 🔒' : 'V' + planVersion;
    const riskItems: string[] = info.riskItems || [];
    const boundaryItems: string[] = info.boundaryItems || [];
    const filePathsFromTools: string[] = info.filePathsFromTools || [];
    const reviewFileList = lastReviewChanges && lastReviewChanges.length > 0
        ? lastReviewChanges.map((ch: any) => ch.filePath).filter(Boolean)
        : [];
    const fileList = [...new Set([...filePathsFromTools, ...reviewFileList])];

    // Card 1: Goal & Plan
    const card1 = document.getElementById('card-1-body');
    if (card1) {
        const subEl = card1.closest('.card-container')?.querySelector('.card-header-sub');
        if (subEl) subEl.textContent = versionLabel;
        if (['demand', 'goal'].includes(phase) && !goal) {
            card1.innerHTML = '<div class="card-empty">等待 AI 生成目标方案...</div>';
        } else if (goal || confirmedItems.length > 0) {
            let html = '';
            if (goal) html += `<div class="card-section"><div class="card-section-title">🎯 目标</div><div class="card-goal-text">${escapeHtml(goal)}</div></div>`;
            if (confirmedItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">✓ 已确认共识</div>`;
                html += confirmedItems.map((item: string) => `<div class="card-confirmed-item">✅ ${escapeHtml(item)}</div>`).join('');
                html += `</div>`;
            }
            if (riskItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title risk-title">⚠️ 风险项</div>`;
                for (const item of riskItems) {
                    html += `<div class="card-risk-badge medium">${escapeHtml(item)}</div>`;
                }
                html += `</div>`;
            }
            if (boundaryItems.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🚧 边界约束</div>`;
                for (const item of boundaryItems) {
                    html += `<div class="card-boundary-item">${escapeHtml(item)}</div>`;
                }
                html += `</div>`;
            }
            if (['plan', 'execute', 'self_verify', 'review'].includes(phase) && planSteps.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">📋 计划步骤</div>`;
                const done = planSteps.filter((s: any) => s.status === 'completed').length;
                html += `<div class="card-plan-progress">${done}/${planSteps.length} 完成`;
                if (planSteps.length > 0) {
                    const pct = Math.round((done / planSteps.length) * 100);
                    html += ` <span class="card-plan-bar"><span class="card-plan-fill" style="width:${pct}%"></span></span>`;
                }
                html += `</div>`;
                planSteps.forEach((s: any) => {
                    html += `<div class="card-plan-step"><span class="card-plan-status">${s.status === 'completed' ? '✅' : '⬜'}</span> ${escapeHtml(s.content)}</div>`;
                });
                html += `</div>`;
            }
            if (fileList.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">📝 变更文件</div>`;
                for (const fp of fileList) {
                    const ext = fp ? fp.split('.').pop() || '' : '';
                    const icon = ['ts', 'tsx', 'js', 'jsx'].includes(ext) ? '📄' : ext === 'json' ? '📋' : '📄';
                    html += `<div class="card-file-item">${icon} ${escapeHtml(fp || '')}</div>`;
                }
                html += `</div>`;
            }
            html += cardConfirmButtons(phase, status);
            card1.innerHTML = html;
        } else {
            card1.innerHTML = '<div class="card-empty">等待 AI 生成方案...</div>';
        }
    }

    // Card 2: Execute & Self-verify
    const card2 = document.getElementById('card-2-body');
    if (card2) {
        const subEl = card2.closest('.card-container')?.querySelector('.card-header-sub');
        const isActive = ['execute', 'self_verify', 'review'].includes(phase);
        if (subEl) subEl.textContent = isActive ? phaseLabel(phase) : '等待中';
        if (isActive && planSteps.length > 0) {
            let html = '';
            const done = planSteps.filter((s: any) => s.status === 'completed').length;
            const pct = planSteps.length > 0 ? Math.round((done / planSteps.length) * 100) : 0;
            html += `<div class="card-section"><div class="card-section-title">⚡ 执行进度</div>`;
            html += `<div class="card-progress-row"><span class="card-progress-bar"><span class="card-progress-fill" style="width:${pct}%"></span></span><span class="card-progress-label">${done}/${planSteps.length}</span></div></div>`;

            if (cardActiveTools.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🔧 当前工具</div>`;
                for (const tool of cardActiveTools) {
                    const icon = tool.kind === 'bash' || tool.kind === 'command' ? '💻' : tool.kind === 'read' ? '📖' : tool.kind === 'write' ? '✏️' : tool.kind === 'thinking' ? '💭' : '🔧';
                    html += `<div class="card-tool-item"><span class="card-tool-status ${tool.status}"></span>${icon} ${escapeHtml(tool.title || '')}`;
                    if (tool.status === 'running') html += ' <span class="card-tool-spinner"></span>';
                    if (tool.output) html += `<div class="card-tool-preview">${escapeHtml(tool.output.substring(0, 200))}</div>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }

            const buildTools = cardActiveTools.filter((t: any) =>
                /build|test|npm (run )?(build|test)|npx (tsc|vitest|jest)|make/i.test(t.title || '')
            );
            if (buildTools.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🏗️ 构建/测试</div>`;
                for (const bt of buildTools) {
                    const ok = bt.status === 'completed' && !/error|fail/i.test(bt.output || '');
                    html += `<div class="card-build-item ${ok ? 'pass' : bt.status === 'running' ? 'running' : 'fail'}">`;
                    html += ok ? '✅' : bt.status === 'running' ? '🔄' : '❌';
                    html += ` ${escapeHtml(bt.title || '')}</div>`;
                }
                html += `</div>`;
            }

            if (phase === 'self_verify') {
                html += `<div class="card-section"><div class="card-section-title">🔍 自验报告</div>`;
                html += `<div class="card-self-verify-report">`;
                html += `<div class="card-sv-header">AI 正在对执行结果进行自我审查...</div>`;
                const svTools = cardActiveTools.filter((t: any) => t.kind === 'thinking' || /verify|check|review/i.test(t.title || ''));
                if (svTools.length > 0) {
                    for (const sv of svTools) {
                        html += `<div class="card-sv-item">💭 ${escapeHtml(sv.title || '')}</div>`;
                        if (sv.output) html += `<div class="card-sv-preview">${escapeHtml(sv.output.substring(0, 300))}</div>`;
                    }
                } else {
                    html += `<div class="card-sv-hint">等待自验完成...</div>`;
                }
                html += `</div></div>`;
            }

            if (terminalLogCount > 0) {
                html += `<div class="card-section"><div class="card-section-title collapsible-header" onclick="this.classList.toggle('collapsed');this.nextElementSibling.classList.toggle('collapsed')">💻 终端日志 <span class="card-count-badge">${terminalLogCount}</span></div>`;
                html += `<div class="card-collapsible-body">`;
                html += `<div class="card-terminal-hint">终端日志共 ${terminalLogCount} 条记录。<br><button class="card-link-btn" onclick="vscode.postMessage({type:'openTerminalReplay',taskId:'${activeTaskId}'})">📋 查看完整日志</button></div>`;
                html += `</div></div>`;
            }

            html += cardConfirmButtons(phase, status);
            card2.innerHTML = html;
        } else if (phase === 'execute' && planSteps.length === 0) {
            card2.innerHTML = '<div class="card-empty">等待 AI 开始执行...</div>';
        } else {
            card2.innerHTML = '<div class="card-empty">等待进入执行阶段...</div>';
        }
    }

    // Card 3: Review
    const card3 = document.getElementById('card-3-body');
    if (card3) {
        const subEl = card3.closest('.card-container')?.querySelector('.card-header-sub');
        if (subEl) subEl.textContent = phase === 'review' ? '🔍 待验收' : '等待中';
        if (phase === 'review' && lastReviewChanges.length > 0) {
            let html = '';
            const testTools = cardActiveTools.filter((t: any) => {
                const out = (t.output || '').toLowerCase();
                return /test|spec|vitest|jest|assert|expect/i.test(t.title || '') ||
                    out.includes('✓') || out.includes('pass') || out.includes('fail');
            });
            if (testTools.length > 0) {
                html += `<div class="card-section"><div class="card-section-title">🧪 自动化测试</div>`;
                for (const tt of testTools) {
                    const ok = !/fail|error/i.test(tt.output || '');
                    html += `<div class="card-test-item ${ok ? 'pass' : 'fail'}">${ok ? '✅' : '❌'} ${escapeHtml(tt.title || '')}</div>`;
                }
                html += `</div>`;
            }
            html += `<div class="card-section"><div class="card-section-title">📄 变更文件</div>`;
            for (const ch of lastReviewChanges) {
                const ext = ch.filePath ? ch.filePath.split('.').pop() || '' : '';
                const icon = ext === 'ts' || ext === 'tsx' ? '📝' : ext === 'css' ? '🎨' : ext === 'json' ? '📋' : '📄';
                html += `<div class="card-review-file" onclick="vscode.postMessage({type:'openNativeDiff',original:${JSON.stringify(ch.original || '')},modified:${JSON.stringify(ch.modified || '')},filePath:${JSON.stringify(ch.filePath || '')}})">${icon} ${escapeHtml(ch.filePath || '')}</div>`;
            }
            html += `</div>`;
            html += `<div class="card-section"><div class="card-section-title">👤 人工验证指引</div>`;
            html += `<ul class="card-verify-steps">`;
            html += `<li class="card-verify-step">1. 审查变更文件的 diff 内容</li>`;
            html += `<li class="card-verify-step">2. 确认代码无逻辑错误和安全问题</li>`;
            html += `<li class="card-verify-step">3. 点击文件查看完整 diff，或打开原生对比</li>`;
            html += `</ul></div>`;
            html += `<div class="card-section"><div style="display:flex;gap:6px;flex-wrap:wrap">`;
            html += `<button class="card-action-btn primary" onclick="vscode.postMessage({type:'approveReview',taskId:'${activeTaskId}'})">✅ 验收通过</button>`;
            html += `<button class="card-action-btn secondary" onclick="showCardRejectPresets('${activeTaskId}')">↩️ 驳回</button>`;
            html += `</div>`;
            html += `<div id="card-reject-presets-${activeTaskId}" class="card-reject-presets hidden">`;
            const rejectReasons = ['代码质量不达标','未处理边界情况','缺少单元测试','与需求不符','存在安全隐患','性能问题'];
            html += `<div class="card-reject-preset-title">选择驳回理由：</div>`;
            for (const reason of rejectReasons) {
                html += `<button class="card-reject-preset-btn" onclick="vscode.postMessage({type:'rejectReview',taskId:'${activeTaskId}',reason:'${reason}'})">${reason}</button>`;
            }
            html += `<button class="card-reject-preset-btn custom" onclick="showCardRejectInput('${activeTaskId}')">✏️ 自定义输入...</button>`;
            html += `<div id="card-reject-custom-${activeTaskId}" class="hidden" style="margin-top:4px">`;
            html += `<textarea id="card-reject-text-${activeTaskId}" class="card-reject-textarea" placeholder="输入驳回原因..." rows="2"></textarea>`;
            html += `<button class="card-action-btn secondary" onclick="sendCardReject('${activeTaskId}')">确认驳回</button>`;
            html += `</div></div></div>`;
            card3.innerHTML = html;
        } else if (phase === 'review') {
            card3.innerHTML = '<div class="card-empty">暂无可验收文件...</div>';
        } else {
            card3.innerHTML = '<div class="card-empty">等待进入验收阶段...</div>';
        }
    }
}

function showCardRejectPresets(taskId: string) {
    const el = document.getElementById('card-reject-presets-' + taskId);
    if (el) el.classList.toggle('hidden');
}
function showCardRejectInput(taskId: string) {
    const el = document.getElementById('card-reject-custom-' + taskId);
    if (el) el.classList.remove('hidden');
}
function sendCardReject(taskId: string) {
    const ta = document.getElementById('card-reject-text-' + taskId) as HTMLTextAreaElement;
    const reason = ta?.value?.trim() || '用户驳回';
    vscode.postMessage({ type: 'rejectReview', taskId, reason });
}

function initCardComments() {
    document.querySelectorAll('.card-comment-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardIdx = (e.currentTarget as HTMLElement).dataset.card;
            const section = document.getElementById(`card-comment-${cardIdx}`);
            if (section) {
                section.classList.toggle('hidden');
                if (!section.classList.contains('hidden')) {
                    const input = document.getElementById(`card-comment-input-${cardIdx}`) as HTMLInputElement;
                    input?.focus();
                }
            }
        });
    });
    document.querySelectorAll('.card-comment-send').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardIdx = (e.currentTarget as HTMLElement).dataset.card;
            const input = document.getElementById(`card-comment-input-${cardIdx}`) as HTMLInputElement;
            if (!input || !input.value.trim()) return;
            const text = input.value.trim();
            input.value = '';
            vscode.postMessage({ type: 'sendCardComment', cardIndex: parseInt(cardIdx || '1'), text, taskId: activeTaskId });
            const list = document.getElementById(`card-comment-list-${cardIdx}`);
            if (list) {
                const item = document.createElement('div');
                item.className = 'card-comment-item';
                item.innerHTML = `<div class="card-comment-meta"><span class="card-comment-author">You</span><span class="card-comment-time">刚刚</span></div><div class="card-comment-text">${escapeHtml(text)}</div>`;
                list.appendChild(item);
                list.scrollTop = list.scrollHeight;
            }
            updateCardCommentCount(parseInt(cardIdx || '1'));
        });
    });
    document.querySelectorAll('.card-comment-input').forEach(input => {
        input.addEventListener('keydown', (e: Event) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' && !ke.shiftKey) {
                e.preventDefault();
                const cardIdx = (e.currentTarget as HTMLElement).id.replace('card-comment-input-', '');
                const btn = document.querySelector(`.card-comment-send[data-card="${cardIdx}"]`) as HTMLButtonElement;
                btn?.click();
            }
        });
    });
}

function loadCardComments(messages: any[]) {
    for (let ci = 1; ci <= 3; ci++) {
        const list = document.getElementById(`card-comment-list-${ci}`);
        if (!list) continue;
        list.innerHTML = '';
        const cardComments = messages.filter((m: any) => m.type === 'card_comment');
        const relevant = cardComments.filter((m: any) => {
            try { const d = JSON.parse(m.content); return d.cardIndex === ci; } catch { return false; }
        });
        for (const cm of relevant) {
            let data: any = {};
            try { data = JSON.parse(cm.content); } catch { continue; }
            const item = document.createElement('div');
            item.className = 'card-comment-item';
            const ts = cm.timestamp ? formatTimestamp(cm.timestamp) : '';
            item.innerHTML = `<div class="card-comment-meta"><span class="card-comment-author">${escapeHtml(data.author || '用户')}</span><span class="card-comment-time">${ts}</span></div><div class="card-comment-text">${escapeHtml(data.text || '')}</div>`;
            list.appendChild(item);
        }
        updateCardCommentCount(ci);
    }
}

function updateCardCommentCount(cardIndex: number) {
    const list = document.getElementById(`card-comment-list-${cardIndex}`);
    const countEl = document.querySelector(`.card-comment-toggle[data-card="${cardIndex}"] .card-comment-count`);
    const toggle = document.querySelector(`.card-comment-toggle[data-card="${cardIndex}"]`);
    if (list && countEl) {
        const count = list.children.length;
        countEl.textContent = String(count);
        if (toggle) toggle.classList.toggle('has-comments', count > 0);
    }
}

function showCardView() {
    const cardView = document.getElementById('card-view');
    if (cardView) cardView.classList.add('visible');
    const chatBody = document.getElementById('chat-body');
    if (chatBody) chatBody.classList.add('hidden');
    const gutter = document.getElementById('node-timeline-gutter');
    if (gutter) gutter.classList.add('hidden');
}

window.addEventListener('message', (event) => {
    const msg = event.data;
    switch (msg.type) {
        case 'loadMessages':
            activeTaskId = msg.taskId;
            activeTaskPhase = msg.taskPhase || '';
            activeTaskStatus = msg.taskStatus || '';
            loadCardComments(msg.messages || []);
            if (msg.reviewChanges && msg.reviewChanges.length > 0) {
                lastReviewChanges = msg.reviewChanges;
            }
            showCardView();
            renderCards();
            break;
        case 'updateTaskInfo':
            lastTaskInfo = msg;
            activeTaskId = msg.taskId;
            activeTaskPhase = msg.phase || '';
            activeTaskStatus = msg.status || '';
            activeTaskGoal = msg.goal || '';
            activeTaskTitle = msg.title || '';
            if (msg.terminalLogCount !== undefined) lastTaskInfo.terminalLogCount = msg.terminalLogCount;
            showCardView();
            renderCards();
            break;
        case 'updateNodePanel':
            break;
        case 'addUserMessage':
            addSystemMessage('用户消息已发送');
            break;
        case 'addSystemMessage':
            addSystemMessage(msg.content || '');
            break;
        case 'agentStreamUpdate':
            break;
        case 'showDiff':
            if ((window as any).showDiff) (window as any).showDiff(msg.original, msg.modified);
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    showCardView();
    initCardComments();
    vscode.postMessage({ type: 'ready' });
});
