import type { AcpMessageHandler } from '../types';

interface OpenAIConfig {
    apiKey: string;
    model: string;
    baseURL: string;
}

export class OpenAIAgent {
    private handlers: Map<string, AcpMessageHandler> = new Map();
    private config: OpenAIConfig;

    constructor() {
        const apiKey = process.env['OPENAI_API_KEY'] || '';
        const model = process.env['OPENAI_MODEL'] || 'deepseek-v4-flash';
        let baseURL = process.env['OPENAI_BASE_URL'] || 'https://api.deepseek.com';
        baseURL = baseURL.replace(/\/+$/, '');
        this.config = { apiKey, model, baseURL };
    }

    setHandler(sessionId: string, handler: AcpMessageHandler) {
        this.handlers.set(sessionId, handler);
    }

    removeHandler(sessionId: string) {
        this.handlers.delete(sessionId);
    }

    async prompt(sessionId: string, text: string): Promise<void> {
        const handler = this.handlers.get(sessionId);
        if (!handler) return;

        if (!this.config.apiKey) {
            handler.onError('OPENAI_API_KEY 未设置');
            return;
        }

        try {
            const url = this.config.baseURL.endsWith('/chat/completions')
                ? this.config.baseURL
                : `${this.config.baseURL}/chat/completions`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [{ role: 'user', content: text }],
                    stream: true,
                }),
            });

            if (!response.ok) {
                const errText = await response.text().catch(() => '');
                handler.onError(`OpenAI API 错误 (${response.status}): ${errText}`);
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                handler.onError('无法读取响应流');
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const content = json.choices?.[0]?.delta?.content || '';
                        if (content) {
                            handler.onText(content);
                        }
                    } catch {
                        // skip malformed SSE lines
                    }
                }
            }

            handler.onDone();
        } catch (err: any) {
            handler.onError(err?.message || 'OpenAI 请求失败');
        }
    }

    hasSession(sessionId: string): boolean {
        return this.handlers.has(sessionId);
    }

    createSession(taskId: string): string {
        return `openai-session-${taskId}`;
    }
}
