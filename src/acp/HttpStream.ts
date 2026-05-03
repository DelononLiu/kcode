import type { Stream } from '@agentclientprotocol/sdk';
import type { AnyMessage } from '@agentclientprotocol/sdk/dist/jsonrpc.js';

function isRequest(msg: unknown): boolean {
    return typeof msg === 'object' && msg !== null && 'id' in msg && 'method' in msg;
}

function parseNdJson(buffer: string): { messages: unknown[]; remainder: string } {
    const messages: unknown[] = [];
    const lines = buffer.split('\n');
    const remainder = lines.pop() || '';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            messages.push(JSON.parse(trimmed));
        } catch {
            // skip malformed lines
        }
    }

    return { messages, remainder };
}

type Controller = { enqueue(msg: unknown): void; error(e: Error): void };

export function createHttpStream(agentUrl: string): Stream {
    let controller: Controller | null = null;

    const readable = new ReadableStream<unknown>({
        start(c) {
            controller = c as Controller;
        },
        cancel() {
            controller = null;
        }
    });

    const writable = new WritableStream<unknown>({
        async write(message) {
            try {
                const response = await fetch(agentUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message),
                });

                if (!response.ok) {
                    const errText = await response.text().catch(() => '');
                    controller?.error(new Error(`HTTP ${response.status}: ${errText}`));
                    return;
                }

                const body = response.body;
                if (!body) {
                    if (isRequest(message)) {
                        controller?.error(new Error('Empty response body'));
                    }
                    return;
                }

                const reader = body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const result = parseNdJson(buffer);
                    buffer = result.remainder;

                    for (const msg of result.messages) {
                        controller?.enqueue(msg);
                    }
                }

                // Process remaining buffer
                if (buffer.trim()) {
                    const result = parseNdJson(buffer + '\n');
                    for (const msg of result.messages) {
                        controller?.enqueue(msg);
                    }
                }
            } catch (err) {
                if (isRequest(message)) {
                    controller?.error(err instanceof Error ? err : new Error(String(err)));
                }
            }
        },
    });

    return { writable, readable } as unknown as Stream;
}
