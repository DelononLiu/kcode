import type { AcpMessageHandler, FileChange } from '../types';

interface OpenAIConfig {
    apiKey: string;
    model: string;
    baseURL: string;
}

export class OpenAIAgent {
    private handlers: Map<string, AcpMessageHandler> = new Map();
    private abortControllers: Map<string, AbortController> = new Map();
    private sessionChanges: Map<string, FileChange[]> = new Map();
    private messages: Map<string, { role: string; content: string }[]> = new Map();
    private config: OpenAIConfig;

    constructor(overrides?: Partial<OpenAIConfig>) {
        const apiKey = overrides?.apiKey || process.env['OPENAI_API_KEY'] || '';
        const model = overrides?.model || process.env['OPENAI_MODEL'] || 'deepseek-v4-flash';
        let baseURL = overrides?.baseURL || process.env['OPENAI_BASE_URL'] || 'https://api.deepseek.com';
        baseURL = baseURL.replace(/\/+$/, '');
        this.config = { apiKey, model, baseURL };
    }

    setHandler(sessionId: string, handler: AcpMessageHandler) {
        this.handlers.set(sessionId, handler);
    }

    removeHandler(sessionId: string) {
        this.handlers.delete(sessionId);
    }

    cancel(sessionId: string) {
        const controller = this.abortControllers.get(sessionId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(sessionId);
        }
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

            const controller = new AbortController();
            this.abortControllers.set(sessionId, controller);
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const history = this.messages.get(sessionId) || [];
            history.push({ role: 'user', content: text });
            this.messages.set(sessionId, history);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: history,
                    stream: true,
                }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            this.abortControllers.delete(sessionId);

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
            let reply = '';

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
                        if (json.error) {
                            handler.onError(json.error.message || JSON.stringify(json.error));
                            return;
                        }
                        const delta = json.choices?.[0]?.delta;
                        const reasonText = delta?.reasoning_content || delta?.reasoning || delta?.thinking || '';
                        if (reasonText) {
                            handler.onReasoning?.(reasonText);
                        }
                        const content = delta?.content || '';
                        if (content) {
                            reply += content;
                            handler.onText(content);
                        }
                    } catch {
                        // skip malformed SSE lines
                    }
                }
            }

            if (reply) {
                history.push({ role: 'assistant', content: reply });
                this.messages.set(sessionId, history);
            }

            handler.onDone('end_turn');
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                if (!this.abortControllers.has(sessionId)) {
                    handler.onDone('cancelled');
                } else {
                    this.abortControllers.delete(sessionId);
                    handler.onError('请求超时');
                }
            } else {
                handler.onError(err?.message || 'OpenAI 请求失败');
            }
        }
    }

    hasSession(sessionId: string): boolean {
        return this.handlers.has(sessionId);
    }

    createSession(taskId: string): string {
        this.sessionChanges.set(taskId, []);
        this.messages.set(taskId, []);
        return `openai-session-${taskId}`;
    }

    getReviewChanges(taskId: string): FileChange[] {
        return this.sessionChanges.get(taskId) || [];
    }
}
