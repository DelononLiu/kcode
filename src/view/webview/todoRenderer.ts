import { G } from './state';
import { escapeHtml } from './markdownRenderer';
import { createCard } from './cardBuilder';

export function _isTodoArray(text: string): boolean {
    try {
        const arr = JSON.parse(text.trim());
        return Array.isArray(arr) && arr.length > 0 && arr.every((item: any) =>
            item && typeof item.content === 'string' && typeof item.status === 'string'
        );
    } catch {
        return false;
    }
}

export function _parseTodoStr(text: string): { items: any[]; done: number; total: number } {
    let items: any[] = [];
    const titleMatch = text.match(/<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/);
    if (titleMatch) {
        try { items = JSON.parse(titleMatch[1]); } catch {}
    } else if (text.trim().startsWith('[')) {
        try { items = JSON.parse(text.trim()); } catch {}
    }
    items = items.map((item: any, idx: number) => ({
        id: String(idx),
        content: String(item.content || ''),
        status: item.status === 'completed' ? 'completed' : 'pending',
    }));
    const done = items.filter((i: any) => i.status === 'completed').length;
    return { items, done, total: items.length };
}

export function _todoHeaderHtml(done: number, total: number): string {
    return `✅ 待办清单 <span class="todo-header-progress">${done}/${total}</span>`;
}

export function renderTodoCard(msg: any): HTMLElement {
    let items: any[];
    try {
        items = JSON.parse(msg.content || '[]');
    } catch {
        items = [];
    }
    items = items.map((item: any, idx: number) => ({
        id: String(idx),
        content: String(item.content || ''),
        status: item.status === 'completed' ? 'completed' : 'pending',
    }));
    const done = items.filter((i: any) => i.status === 'completed').length;
    const total = items.length;

    const bodyHtml = items.map((item: any) => {
        const isDone = item.status === 'completed';
        return `<label class="todo-item"><input type="checkbox" class="todo-checkbox" data-msg-id="${msg.id}" data-item-id="${item.id}" ${isDone ? 'checked' : ''}><span class="todo-item-text${isDone ? ' todo-done' : ''}">${escapeHtml(item.content)}</span></label>`;
    }).join('');

    const card = createCard({
        headerHtml: _todoHeaderHtml(done, total),
        bodyHtml: `<div class="todo-list">${bodyHtml}</div>`,
        rawData: msg,
        defaultCollapsed: false,
        borderColor: '#3c3c3c',
        headerBg: '#2d2d2d',
        headerColor: '#e0e0e0',
    });

    card.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.classList.contains('todo-checkbox')) return;
        const msgId = target.dataset.msgId;
        const itemId = target.dataset.itemId;
        const checked = target.checked;
        G.vscode.postMessage({ type: 'updateTodoItem', taskId: msg.taskId, msgId, itemId, checked });
    });

    return card;
}

export function buildTodoBodyHtml(output: string, toolCallId: string, taskId: string): string {
    const { items } = _parseTodoStr(output);
    if (items.length === 0) {
        return '<div class="op-empty">无待办项</div>';
    }
    const itemsHtml = items.map((item: any) => {
        const d = item.status === 'completed';
        return `<label class="todo-item"><input type="checkbox" class="todo-checkbox" data-msg-id="tool_${toolCallId}" data-item-id="${item.id}" ${d ? 'checked' : ''}><span class="todo-item-text${d ? ' todo-done' : ''}">${escapeHtml(item.content)}</span></label>`;
    }).join('');
    return `<div class="todo-list">${itemsHtml}</div>`;
}
