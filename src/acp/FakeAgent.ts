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
            '- Created `src/utils/helper.ts` — 添加了辅助函数',
            '- Modified `src/index.ts` — 更新了导入路径',
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
                filePath: 'src/utils/helper.ts',
                original: '// helper.ts (empty)',
                modified: 'export function average(nums: number[]): number {\n  return nums.reduce((a, b) => a + b, 0) / nums.length;\n}\n\nexport function median(nums: number[]): number {\n  const sorted = [...nums].sort((a, b) => a - b);\n  const mid = Math.floor(sorted.length / 2);\n  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;\n}'
            },
            {
                filePath: 'src/index.ts',
                original: '// Empty index',
                modified: 'import { average, median } from "./utils/helper";\n\nconst data = [1, 2, 3, 4, 5];\nconsole.log(average(data));\nconsole.log(median(data));'
            }
        ];
    }
}