import type { TaskStore } from '../store/TaskStore';
import type { AgentService } from '../core/AgentService';
import type { MessageRouter } from './MessageRouter';
import type { TaskSessionHandler } from './TaskSessionHandler';
import type { Task } from '../types';
import type { AcpMessageHandler } from '../types';

export class AssistantHandler {
    constructor(
        private store: TaskStore,
        private agentService: AgentService,
        private router: MessageRouter,
        private sessionHandler: TaskSessionHandler,
        private setGenerationState: (generating: boolean) => void,
        private isGenerating: () => boolean,
        private pushPending: (text: string, taskId: string) => void,
        private sendPendingQueueUpdate: () => void,
        private refreshSidebar?: () => void,
        private loadTask?: (taskId: string) => void,
    ) {}

    loadMessages() {
        const msgs = this.store.getAssistantMessages();
        this.router.PostMessage({ type: 'loadMessages', messages: msgs, taskId: '', taskType: 'assistant' });
    }

    showLanding() {
        this.router.PostMessage({ type: 'updateNodePanel', nodes: [], taskType: 'assistant' });
        this.router.PostMessage({ type: 'updateTaskInfo', title: '💬 小助手', taskType: 'assistant', goal: '', status: '', phase: '', phaseLabel: '', confirmedItems: [], pendingItems: [], planSteps: [], hooks: {}, workspaceHooks: {}, messageCount: 0, executeFinished: false });
    }

    async handleMessage(text: string) {
        const tid = '__assistant__';
        if (text.trim().startsWith('/go')) {
            const messages = this.store.getAssistantMessages();
            const context = messages.slice(-10).map(m =>
                `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.substring(0, 200)}`
            ).join('\n');
            const newTask: Task = {
                id: `task_${Date.now()}`,
                title: context ? context.split('\n')[0].replace(/^[^:]*:\s*/, '').substring(0, 50) : '从助手创建',
                goal: context,
                type: 'task',
                status: 'pending',
                phase: 'demand',
                confirmedItems: [],
                pendingItems: [],
                planSteps: [],
                createdAt: Date.now(),
                pinned: false,
            };
            this.store.addTask(newTask);
            this.loadTask?.(newTask.id);
            this.refreshSidebar?.();
            return;
        }

        if (this.isGenerating()) {
            this.pushPending(text, tid);
            this.sendPendingQueueUpdate();
            return;
        }

        const msgId = this.store.nextAssistantMessageId();
        this.store.addAssistantMessage({ id: msgId, role: 'user', content: text, timestamp: Date.now() });
        this.router.PostMessage({ type: 'addUserMessage', content: text });
        this.loadMessages();

        if (!this.agentService.isConnected) {
            await this.sessionHandler.ensureConnection();
            if (!this.agentService.isConnected) {
                this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: 请配置并启动 Agent]` });
                return;
            }
        }

        const handler = this.createResponseHandler();
        this.setGenerationState(true);
        await this.agentService.sendPrompt(tid, text, handler);
    }

    createResponseHandler(): AcpMessageHandler {
        let buffer = '';
        return {
            onText: (chunk: string) => {
                buffer += chunk;
                this.router.PostMessage({ type: 'agentStreamUpdate', text: buffer });
            },
            onReasoning: () => {},
            onToolCall: () => {},
            onToolCallUpdate: () => {},
            onPlan: () => {},
            onError: (error: string) => {
                this.setGenerationState(false);
                this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${error}]` });
            },
            onDone: (stopReason?: string) => {
                this.setGenerationState(false);
                if (stopReason === 'cancelled') return;
                if (buffer.trim()) {
                    const id = this.store.nextAssistantMessageId();
                    this.store.addAssistantMessage({ id, role: 'agent', content: buffer, timestamp: Date.now() });
                }
                this.loadMessages();
                buffer = '';
            },
        };
    }
}
