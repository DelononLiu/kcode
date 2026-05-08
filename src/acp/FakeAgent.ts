import type { AcpMessageHandler, FileChange } from '../types';

export class FakeAgent {
    private handlers: Map<string, AcpMessageHandler> = new Map();

    setHandler(sessionId: string, handler: AcpMessageHandler) {
        this.handlers.set(sessionId, handler);
    }

    removeHandler(sessionId: string) {
        this.handlers.delete(sessionId);
    }

    async prompt(sessionId: string, text: string): Promise<void> {
        console.log('[FakeAgent] prompt called, sessionId:', sessionId, 'text:', text);
        const handler = this.handlers.get(sessionId);
        if (!handler) {
            console.warn('[FakeAgent] No handler for session:', sessionId);
            console.warn('[FakeAgent] Available handlers:', Array.from(this.handlers.keys()));
            return;
        }

        console.log('[FakeAgent] Handler found, starting response simulation');

        const isTaskPrompt = text.startsWith('[System]\n任务目标：');
        const statusMarker = isTaskPrompt ? '\n\n[TASK_STATUS: completed]' : '';

        const fakeResponses = [
            `Received: "${text}"`,
            '',
            'Analyzing your request...',
            '',
            'I understand your requirements. I will help you complete the related tasks.',
            '',
            '---',
            '',
            '已完成以下文件修改：',
            '',
            '- Modified `requirements.txt` — 更新依赖版本',
            '- Modified `template_PRD.md` — 补充功能与非功能需求',
            '- Modified `README.md` — 补充项目文档',
            '',
            '请验收以上更改。',
            '',
            statusMarker
        ];

        for (let i = 0; i < fakeResponses.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const chunk = fakeResponses[i];
            if (chunk) {
                console.log('[FakeAgent] Sending chunk', i + 1, ':', chunk.substring(0, 30));
                handler.onText(chunk);
            }
        }

        console.log('[FakeAgent] All chunks sent, calling onDone');
        handler.onDone();
    }

    hasSession(sessionId: string): boolean {
        return this.handlers.has(sessionId);
    }

    createSession(taskId: string): string {
        return `fake-session-${taskId}`;
    }

    getReviewChanges(_taskId: string): FileChange[] {
        return [
            {
                filePath: 'requirements.txt',
                original: 'flask==2.3.0\nnumpy==1.24.0',
                modified: 'flask==2.3.0\nnumpy==1.26.0\npandas==2.1.0'
            },
            {
                filePath: 'template_PRD.md',
                original: '# PRD Template\n\n## Overview\n\n## Requirements',
                modified: '# PRD Template\n\n## Overview\n\n## Requirements\n\n### Functional\n- User authentication\n- Data export\n\n### Non-functional\n- Response time < 200ms'
            },
            {
                filePath: 'README.md',
                original: '# Project\n\nGetting started...',
                modified: '# Project\n\n## Getting Started\n\n```bash\nnpm install\nnpm run dev\n```\n\n## Features\n\n- Task management\n- AI-powered development'
            }
        ];
    }
}