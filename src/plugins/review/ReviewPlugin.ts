import type { KCodePlugin, PluginAPI } from '../../core/plugin/PluginInterface';
import type { FileChange } from '../../types';
import { getCategory } from '../../taskflow/templates';

const plugin: KCodePlugin = {
    id: 'kcode.review',
    name: 'Review Manager',
    version: '1.0.0',
    mode: 'task',

    activate(api: PluginAPI) {
        api.onPhaseChanged((taskId: string, fromPhase: string, toPhase: string) => {
            if (toPhase === 'review') {
                const store = api.getStore();
                const router = api.getRouter();
                const task = store.getTask(taskId);
                if (!task) return;
                const changes: FileChange[] = store.getReviewChanges(taskId);
                const reviewMsgId = store.nextMessageId(taskId);
                store.addMessage({ id: reviewMsgId, taskId, role: 'agent', type: 'review_request' as any, content: '验收阶段', timestamp: Date.now() });
                store.updateTaskNodeMessageId(taskId, 'review', reviewMsgId);
                store.updateTaskStatus(taskId, 'in_review');

                let acceptanceCriteria: string[] | undefined;
                if (task?.category) {
                    const cat = getCategory(task.category);
                    acceptanceCriteria = cat?.acceptanceCriteria;
                }

                router.PostMessage({
                    type: 'loadMessages', messages: store.getMessages(taskId), taskId,
                    taskPhase: 'review', taskStatus: 'in_review', reviewChanges: changes.length > 0 ? changes : undefined,
                    acceptanceCriteria,
                });
            }
        });

        api.onToolCall('write', (taskId: string, info: any) => {
            const store = api.getStore();
            const changes: FileChange[] = store.getReviewChanges(taskId);
            const filePath = info.title || '';
            if (filePath && !changes.find((c: FileChange) => c.filePath === filePath)) {
                changes.push({ filePath, original: '', modified: info.output || '' });
                store.storeReviewChanges(taskId, changes);
            }
        });

        api.onToolCall('edit', (taskId: string, info: any) => {
            const store = api.getStore();
            const changes: FileChange[] = store.getReviewChanges(taskId);
            const filePath = info.title || '';
            if (filePath && !changes.find((c: FileChange) => c.filePath === filePath)) {
                changes.push({ filePath, original: '', modified: info.output || '' });
                store.storeReviewChanges(taskId, changes);
            }
        });
    },

    deactivate() {},
};

export default plugin;
