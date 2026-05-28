import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import { TaskTerminalManager } from './TaskTerminalManager';

const terminalManager = new TaskTerminalManager();

const plugin: KCodePlugin = {
    id: 'kcode.terminal',
    name: '任务终端重放',
    version: '1.0.0',
    mode: 'task',

    async activate(api: PluginAPI) {
        api.onMessage('openTerminalReplay', (msg: any) => {
            const store = api.getStore();
            const task = store?.getTask(msg.taskId);
            terminalManager.openReplay(msg.taskId, task?.title || '任务');
        });

        api.addOutputPanelTab('terminal-replay', '💻 终端', (taskInfo: any) => {
            const taskId = taskInfo?.id;
            if (!taskId) return '<div class="op-empty">无任务</div>';
            const count = terminalManager.getLogCount(taskId);
            if (count === 0) {
                return `<div class="op-empty">暂无终端日志</div>`;
            }
            return `<div class="op-item op-terminal-entry" data-task-id="${taskId}">
                <span class="op-terminal-icon">💻</span>
                <span class="op-terminal-label">终端历史 (${count} 条命令)</span>
                <button class="op-terminal-replay-btn" data-task-id="${taskId}">▶ 重放</button>
            </div>`;
        });
    },

    async deactivate() {
        terminalManager.dispose();
    },
};

export default plugin;
