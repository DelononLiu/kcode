import type { TaskStore } from '../store/TaskStore';
import type { AgentService } from '../core/AgentService';
import type { MessageRouter } from './MessageRouter';
import type { TaskSessionHandler } from './TaskSessionHandler';
import type { Task, AssistantMessage } from '../types';
import type { AcpMessageHandler } from '../types';
import type { SetupResult } from './SetupWizard';
import { AssistantStreamHandler } from './stream/AssistantStreamHandler';

const ASSISTANT_SYSTEM_PROMPT = `你是一个 AI 编程助手，回答用户的问题、写代码、分析项目。

每次实现/修改完成后，必须按以下格式输出摘要：

### ✅ 实现完成：<功能名>

**修改文件**:
- \`path/to/file.ts\` — 做了什么

**实现原理**:
- 核心逻辑一句话

**验收步骤**:
1. 操作步骤
2. 预期结果

如果只回答不写代码，不需要此格式。

【排版规范】
- 文件路径、函数名、变量名、状态值等所有技术名词，必须用单个反引号包裹，禁止裸写中文
- 加粗仅限核心结论，普通解说文字禁止加粗
- 每段聚焦一个观点，不超过三行。块与块之间用空行拉开视觉距离
- 按紧急度使用前缀信号：❌ 阻断、⚠️ 注意、💡 建议、🔍 根因、🎯 结论
- 调用链按层级分点展开，子属逻辑缩进`;

interface GuideStep {
    agent: string;
    preset: string;
}

const GUIDE_STEPS: GuideStep[] = [
    {
        agent: `👋 欢迎使用 KCode！

KCode 是一个 **Task 驱动的 AI 编程助手**，帮你把需求一步步变成代码。

它的核心流程分为 6 个阶段：

📋 需求收集 → 🎯 目标确认 → 📝 计划制定 → ⚡ 执行实现 → ✅ AI 自验 → 🏁 人工验收

每个阶段都需要你确认后才进入下一步，确保 AI 做的事情是你想要的。

---
按回车继续，我带你了解每个阶段具体做什么。`,
        preset: '好的，带我了解',
    },
    {
        agent: `## 📋 需求收集（Demand）
你说想要什么，AI 复述确认，双方对齐需求。

## 🎯 目标确认（Goal）
AI 把你的需求归纳为清晰的目标条目，你确认后锁定，不可再改。

## 📝 计划制定（Plan）
AI 制定实现步骤，你可以讨论调整，确认后开始执行。

## ⚡ 执行实现（Execute）
AI 写代码、改文件、跑命令，你随时可以中断或提修改意见。

## ✅ AI 自验（Self-Verify）
AI 自己检查刚才的产出，有 bug 自动修复，无需你操心。

## 🏁 人工验收（Review）
展示所有变更文件，你逐条验收通过或驳回修改。

---
**全程你说了算**，每个阶段都有确认按钮，AI 不会跳过你的意见。

按回车，我用示例任务带你走一遍完整流程。`,
        preset: '好的，体验流程',
    },
    {
        agent: `现在创建一个示例任务，带你走一遍完整流程 👇

> **示例任务**：优化项目中的一段代码，提升可读性
> **目标**：体验从需求到验收的全流程

准备好就开始吧！`,
        preset: '开始体验',
    },
];

const SAMPLE_TASK: Task = {
    id: `onboard_`,
    title: '🖐️ 示例：创建 hello.py',
    goal: '在项目根目录创建一个 hello.py，运行后输出 "hello kcode"',
    type: 'task',
    category: 'requirement_dev',
    subType: 'add',
    status: 'pending',
    phase: 'goal',
    confirmedItems: [],
    pendingItems: [],
    planSteps: [],
    createdAt: Date.now(),
    pinned: false,
    workspace: undefined,
};

export class AssistantHandler {
    private _guideStep = -1;
    private _guideMessages: AssistantMessage[] = [];
    private _envPhase: '' | 'detecting' = '';
    private _onEnvSetupComplete: (() => Promise<void>) | null = null;
    private _isFirstLaunch = false;

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
        private workspaceRoot?: string,
        private sendAcpLog?: (taskId: string, direction: 'send' | 'recv', text: string) => void,
        private flushAcpRecvBuffer?: (taskId: string) => void,
    ) {
        this._addAssistantMessage = this._addAssistantMessage.bind(this);
    }

    get inGuide(): boolean { return this._guideStep >= 0; }

    loadMessages() {
        const msgs = this.store.getAssistantMessages();
        this.router.PostMessage({ type: 'loadMessages', messages: msgs, taskId: '__assistant__', taskType: 'assistant' });
    }

    stopGeneration() {
        this.setGenerationState(false);
        this.agentService.cancel('__assistant__');
        const msgs = this.store.getAssistantMessages();
        this.router.PostMessage({ type: 'loadMessages', messages: msgs, taskId: '__assistant__', taskType: 'assistant' });
    }

    async convertToTask() {
        const messages = this.store.getAssistantMessages().filter(m => m.role !== 'tool');
        const firstUserMsg = messages.find(m => m.role === 'user');
        const context = messages.slice(-10).map(m =>
            `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.substring(0, 200)}`
        ).join('\n');
        const newTask: Task = {
            id: `task_${Date.now()}`,
            title: context ? context.split('\n')[0].replace(/^[^:]*:\s*/, '').substring(0, 50) : '从助手创建',
            goal: context,
            type: 'task',
            status: 'pending',
            phase: 'goal',
            confirmedItems: [],
            pendingItems: [],
            planSteps: [],
            originalRequest: '',
            createdAt: Date.now(),
            pinned: false,
            workspace: this.workspaceRoot,
        };
        this.store.addTask(newTask);
        this.loadTask?.(newTask.id);
        this.refreshSidebar?.();
        const lastTwo = messages.slice(-2).map(m =>
            `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`
        ).join('\n');
        await this.sessionHandler.handleSendMessage(lastTwo, newTask.id);
    }

    showLanding() {
        this._guideStep = -1;
        this._envPhase = '';
        this.router.PostMessage({ type: 'updateNodePanel', nodes: [], taskType: 'assistant' });
        this.router.PostMessage({ type: 'updateTaskInfo', title: '🤖 小助手', taskType: 'assistant', goal: '', status: '', phase: '', phaseLabel: '', confirmedItems: [], pendingItems: [], planSteps: [], hooks: {}, workspaceHooks: {}, messageCount: 0, executeFinished: false });
    }

    // ── Phase 1: 环境检查安装（对话式） ──────────────────────

    async startEnvDetection(isFirstLaunch: boolean, onSetup: () => Promise<void>) {
        this.showLanding();
        this._isFirstLaunch = isFirstLaunch;
        this._envPhase = 'detecting';
        this._onEnvSetupComplete = onSetup;

        const { detectEnv } = await import('./SetupWizard');
        const env = await detectEnv(() => {});

        const content = this._formatEnvMessage(env);
        const msgId = this.store.nextAssistantMessageId();
        this.store.addAssistantMessage({ id: msgId, taskId: '', type: 'text', role: 'agent', content, timestamp: Date.now() });
        this.loadMessages();
        this.router.PostMessage({ type: 'setInputPlaceholder', text: '按回车开始自动安装与配置' });
        this.router.PostMessage({ type: 'setInputPreset', text: '好的，开始安装配置' });
    }

    private _formatEnvMessage(env: SetupResult): string {
        // 判断 Node.js 版本是否满足最低要求
        const nodeMajor = env.nodeVersion ? parseInt(env.nodeVersion.replace(/^v/i, '').trim().split('.')[0], 10) : 0;
        const nodeValid = env.nodeInstalled && nodeMajor >= 22;
        const nodeStatus = !env.nodeInstalled ? '❌ 未安装' : nodeValid ? '✅ 就绪' : '⬆️ 版本过低';

        const lines = [
            '## 📋 环境检测结果',
            '',
            '| 项目 | 状态 | 版本 |',
            '|------|------|------|',
            `| Node.js | ${nodeStatus} | ${env.nodeVersion || '-'} |`,
            `| npm | ${env.npmInstalled ? '✅ 就绪' : '❌ 未安装'} | ${env.npmVersion || '-'} |`,
            `| Claude CLI | ${env.claudeInstalled ? '✅ 就绪' : '❌ 未安装'} | ${env.claudeVersion || '-'} |`,
            `| Kilo CLI | ${env.kiloInstalled ? '✅ 就绪' : '❌ 未安装'} | ${env.kiloVersion || '-'} |`,
            `| OpenCode CLI | ${env.opencodeInstalled ? '✅ 就绪' : '❌ 未安装'} | ${env.opencodeVersion || '-'} |`,
            `| Agent 配置 | ${env.configReady ? '✅ 已配置' : '❌ 未配置'} | - |`,
            '',
        ];

        // 根据 Node.js 情况添加提示
        if (!env.nodeInstalled) {
            lines.push('🔍 未检测到 Node.js，将自动下载 Node.js 24 并配置环境变量。');
        } else if (!nodeValid) {
            lines.push(`🔍 系统 Node.js v${env.nodeVersion} 版本过低 (需 >= v22)，将自动下载 Node.js 24 并配置环境变量。`);
        } else {
            lines.push('✅ Node.js 版本满足要求，将直接使用系统 Node.js。');
        }

        // Agent 情况提示
        const hasAnyAgent = env.kiloInstalled || env.opencodeInstalled || env.claudeInstalled;
        if (!hasAnyAgent) {
            lines.push('🔍 未检测到 Agent CLI，将自动安装 Claude Code。');
            lines.push('', '```bash', 'npm install -g @anthropic-ai/claude-code', '```');
        } else if (env.claudeInstalled) {
            lines.push('✅ 已检测到 Claude CLI，将优先配置 Claude Code。');
        }

        lines.push('', '按回车开始自动安装缺失组件并配置 Agent。');
        return lines.join('\n');
    }

    transitionAfterSetup(configWasMissing?: boolean, setupContent?: string) {
        const shouldGuide = this._isFirstLaunch || configWasMissing;
        this._envPhase = '';
        if (shouldGuide) {
            // 将 setup 流式内容作为首条消息保留，避免"一闪而过"
            this.store.setAssistantMessages([]);
            this._guideMessages = [];
            if (setupContent) {
                const timestamp = Date.now();
                const msgId = this.store.nextAssistantMessageId();
                this._guideMessages.push({ id: msgId, taskId: '', type: 'text', role: 'agent', content: setupContent, timestamp });
            }
            this._guideStep = 0;
            this._sendGuideStep();
        } else {
            this._addAssistantMessage('✅ **环境已就绪**\n\n现在可以开始使用 KCode 了！输入问题或需求即可。');
            this.router.PostMessage({ type: 'setInputPlaceholder', text: '向小助手描述你的问题...' });
        }
    }

    // ── Phase 3: 任务流程引导 ────────────────────────────

    startGuide() {
        this.showLanding();
        this._guideMessages = [];
        this._guideStep = 0;
        this._sendGuideStep();
    }

    private _renderGuideMessages() {
        this.router.PostMessage({ type: 'loadMessages', messages: this._guideMessages, taskId: '__assistant__', taskType: 'assistant' });
    }

    private _sendGuideStep() {
        const step = GUIDE_STEPS[this._guideStep];
        if (!step) return;
        const msgId = this.store.nextAssistantMessageId();
        this._guideMessages.push({ id: msgId, taskId: '', type: 'text', role: 'agent', content: step.agent, timestamp: Date.now() });
        this._renderGuideMessages();
        this.router.PostMessage({ type: 'setInputPlaceholder', text: `按回车发送: "${step.preset}"` });
        this.router.PostMessage({ type: 'setInputPreset', text: step.preset });
    }

    async handleGuideInput(text: string) {
        const step = GUIDE_STEPS[this._guideStep];
        if (!step) return;

        const msgId = this.store.nextAssistantMessageId();
        this._guideMessages.push({ id: msgId, taskId: '', type: 'text', role: 'user', content: text, timestamp: Date.now() });
        this.router.PostMessage({ type: 'addUserMessage', content: text });

        this._guideStep++;

        if (this._guideStep >= GUIDE_STEPS.length) {
            this._guideStep = -1;
            this._guideMessages = [];
            this.router.PostMessage({ type: 'setInputPlaceholder', text: '' });
            this.router.PostMessage({ type: 'setInputPreset', text: '' });
            await this._createSampleTask();
            return;
        }

        this._sendGuideStep();
    }

    private async _createSampleTask() {
        const newId = `onboard_${Date.now()}`;
        const task = { ...SAMPLE_TASK, id: newId, createdAt: Date.now(), workspace: this.workspaceRoot || '' };
        this.store.addTask(task);
        this.loadTask?.(task.id);
        this.refreshSidebar?.();
        await this.sessionHandler.handleSendMessage(task.goal, newId);
    }

    // ── Phase 2: AI 助手对话 ─────────────────────────────

    async handleMessage(text: string) {
        if (this.inGuide) {
            await this.handleGuideInput(text);
            return;
        }
        if (this._envPhase === 'detecting') {
            this._envPhase = '';
            this.router.PostMessage({ type: 'setInputPlaceholder', text: '' });
            this.router.PostMessage({ type: 'setInputPreset', text: '' });
            const msgId = this.store.nextAssistantMessageId();
            this.store.addAssistantMessage({ id: msgId, taskId: '', type: 'text', role: 'user', content: text, timestamp: Date.now() });
            this.router.PostMessage({ type: 'addUserMessage', content: text });
            await this._onEnvSetupComplete?.();
            return;
        }

        const tid = '__assistant__';
        if (this.isGenerating()) {
            this.pushPending(text, tid);
            this.sendPendingQueueUpdate();
            return;
        }

        const msgId = this.store.nextAssistantMessageId();
        this.store.addAssistantMessage({ id: msgId, taskId: '', type: 'text', role: 'user', content: text, timestamp: Date.now() });
        this.router.PostMessage({ type: 'addUserMessage', content: text });

        if (!this.agentService.isConnected) {
            await this.sessionHandler.ensureConnection();
            if (!this.agentService.isConnected) {
                const errDetail = this.agentService.lastError
                    ? `\n\n**错误详情**: ${this.agentService.lastError}`
                    : '';
                this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n---\n⚠️ **Agent 未连接**${errDetail}\n\n\`👉 在 KCode 侧边栏底部齿轮图标 → 设置 → Agent 配置 中检查 agentName\`\n---` });
                this.router.PostMessage({ type: 'stream-done' });
                return;
            }
        }

        if (!this.agentService.hasSession(tid)) {
            const existingSessionId = this.store.getAssistantSessionId();
            const workspacePath = this.workspaceRoot || process.cwd();
            const sessionId = await this.agentService.createSession(tid, workspacePath, existingSessionId);
            if (!sessionId) {
                this.setGenerationState(false);
                this.router.PostMessage({ type: 'agentStreamUpdate', text: `\n\n[错误: ${this.agentService.lastError || 'ACP 会话未就绪'}]` });
                return;
            }
            if (sessionId !== existingSessionId) {
                this.store.setAssistantSessionId(sessionId);
            }

            const handler = this.createResponseHandler();
            this.setGenerationState(true);
            const prompt = ASSISTANT_SYSTEM_PROMPT + '\n\n' + text;
            this.sendAcpLog?.(tid, 'send', prompt);
            await this.agentService.sendPrompt(tid, prompt, handler);
        } else {
            const handler = this.createResponseHandler();
            this.setGenerationState(true);
            this.sendAcpLog?.(tid, 'send', text);
            await this.agentService.sendPrompt(tid, text, handler);
        }
    }

    // ── 工具方法 ─────────────────────────────────────────

    private _addAssistantMessage(content: string) {
        const msgId = this.store.nextAssistantMessageId();
        this.store.addAssistantMessage({
            id: msgId, taskId: '', type: 'text', role: 'agent', content, timestamp: Date.now(),
        });
        this.loadMessages();
    }

    createResponseHandler(): AcpMessageHandler {
        const tid = '__assistant__';
        const handler = new AssistantStreamHandler(
            tid, this.router, this.setGenerationState,
            this.store, () => this.loadMessages(),
            this.sendAcpLog ? (dir, text) => this.sendAcpLog!(tid, dir, text) : undefined,
            this.flushAcpRecvBuffer ? () => this.flushAcpRecvBuffer!(tid) : undefined,
        );
        return handler.create();
    }
}
