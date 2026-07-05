import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import type { TodoItem } from '../../types';

const plugin: KCodePlugin = {
    id: 'kcode.todo',
    name: 'TODO Manager',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.onToolCall('todowrite', (taskId: string, info: any) => {
            const store = api.getStore();
            if (!info.output) return;
            const raw = parseTodosFromOutput(info.output);
            if (raw.length === 0) return;
            const messages = store.getMessages(taskId);
            const existingTodoMsgs = messages.filter((m: any) => m.type === 'todo' as any);
            const items: TodoItem[] = raw.map((r: any, idx: number) => ({
                id: String(r.id ?? idx),
                content: String(r.content || ''),
                status: r.status === 'completed' ? 'completed' : 'pending',
            }));
            if (existingTodoMsgs.length > 0) {
                const last = existingTodoMsgs[existingTodoMsgs.length - 1];
                const existing: TodoItem[] = JSON.parse(last.toolResult?.output || last.content || '[]');
                const merged = [...existing];
                for (const item of items) {
                    const idx2 = merged.findIndex((i: TodoItem) => i.id === item.id);
                    if (idx2 >= 0) merged[idx2] = item;
                    else merged.push(item);
                }
                store.updateMessageContent(taskId, last.id, JSON.stringify(merged));
            } else {
                const msgId = store.nextMessageId(taskId);
                store.addMessage({ id: msgId, taskId, role: 'agent', type: 'todo' as any, content: JSON.stringify(items), toolResult: { toolCallId: msgId, output: JSON.stringify(items) }, timestamp: Date.now() });
            }
            syncTodosToPlanSteps(store, taskId);
            api.getRouter().PostMessage({ type: 'loadMessages', messages: store.getMessages(taskId), taskId, taskPhase: store.getTask(taskId)?.phase, taskStatus: store.getTask(taskId)?.status });
        });

        api.onMessage('updateTodoItem', (msg: any) => {
            const store = api.getStore();
            const { taskId, msgId, itemId, checked } = msg;
            const messages = store.getMessages(taskId);
            let targetMsg = messages.find((m: any) => m.id === msgId);
            if (!targetMsg && msgId?.startsWith('tool_')) {
                const toolCallId = msgId.slice(5);
                targetMsg = messages.find((m: any) => {
                    if (m.type !== 'tool_call') return false;
                    try { const info = m.toolCall || JSON.parse(m.content); return info.toolCallId === toolCallId; } catch { return false; }
                });
            }
            if (!targetMsg) return;
            try {
                if (targetMsg.type === 'todo' as any) {
                    const items: TodoItem[] = JSON.parse(targetMsg.toolResult?.output || targetMsg.content || '[]');
                    const item = items.find((i: TodoItem) => i.id === itemId);
                    if (item) {
                        item.status = checked ? 'completed' : 'pending';
                        store.updateMessageContent(taskId, targetMsg.id, JSON.stringify(items));
                    }
                } else if (targetMsg.type === 'tool_call') {
                    const info = targetMsg.toolCall ? { ...targetMsg.toolCall, output: targetMsg.toolResult?.output || '' } : JSON.parse(targetMsg.content);
                    const rawOutput = info.output || '';
                    const todos = parseTodosFromOutput(rawOutput);
                    const idx = parseInt(itemId, 10);
                    const item = !isNaN(idx) && idx >= 0 && idx < todos.length ? todos[idx] : todos.find((i: any) => String(i.id) === itemId);
                    if (item) {
                        item.status = checked ? 'completed' : 'pending';
                        info.output = replaceTodosInOutput(rawOutput, todos);
                        store.updateMessageContent(taskId, targetMsg.id, JSON.stringify(info));
                    }
                }
                syncTodosToPlanSteps(store, taskId);
                api.getRouter().PostMessage({ type: 'loadMessages', messages: store.getMessages(taskId), taskId, taskPhase: store.getTask(taskId)?.phase, taskStatus: store.getTask(taskId)?.status });
            } catch {}
        });
    },

    deactivate() {},
};

function parseTodosFromOutput(output: string): any[] {
    const titleMatch = output.match(/<title>\s*\d+\s*todos?\s*<\/title>\s*(\[[\s\S]*?\])\s*/);
    if (titleMatch) {
        try { return JSON.parse(titleMatch[1]); } catch {}
    }
    try {
        const arr = JSON.parse(output);
        if (Array.isArray(arr)) return arr;
    } catch {}
    if (output.trim().startsWith('[')) {
        try { return JSON.parse(output.trim()); } catch {}
    }
    return [];
}

function replaceTodosInOutput(output: string, todos: any[]): string {
    const titleMatch = output.match(/^(<title>\s*\d+\s*todos?\s*<\/title>\s*)/i);
    if (titleMatch) {
        return titleMatch[1] + JSON.stringify(todos, null, 2);
    }
    return JSON.stringify(todos, null, 2);
}

function syncTodosToPlanSteps(store: any, taskId: string): void {
    const messages = store.getMessages(taskId);
    const itemsMap = new Map<string, TodoItem>();
    for (const msg of messages) {
        if (msg.type === 'todo' as any) {
            try {
                const items: TodoItem[] = JSON.parse(msg.toolResult?.output || msg.content || '[]');
                for (const item of items) {
                    itemsMap.set(item.id, item);
                }
            } catch {}
        } else if (msg.type === 'tool_call') {
            try {
                const info = msg.toolCall ? { ...msg.toolCall, output: msg.toolResult?.output || '' } : JSON.parse(msg.content);
                if (info.kind === 'todowrite' && info.output) {
                    const raw = parseTodosFromOutput(info.output);
                    for (let idx = 0; idx < raw.length; idx++) {
                        const id = String(raw[idx].id ?? idx);
                        itemsMap.set(id, {
                            id,
                            content: String(raw[idx].content || ''),
                            status: raw[idx].status === 'completed' ? 'completed' : 'pending',
                        });
                    }
                }
            } catch {}
        }
    }
    if (itemsMap.size > 0) {
        const planSteps = Array.from(itemsMap.values()).map(item => ({
            content: item.content,
            status: item.status === 'completed' ? 'completed' : 'pending',
        }));
        store.updatePlanSteps(taskId, planSteps);
    }
}

export default plugin;
