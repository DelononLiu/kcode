import { StateGraph, Annotation, MessagesAnnotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { StreamAdapter } from './StreamAdapter';
import type { AcpMessageHandler } from '../types';

const GraphState = Annotation.Root({
    messages: MessagesAnnotation.spec.messages,
    phase: Annotation<string>({
        reducer: (a: string, b: string) => b,
        default: () => 'goal',
    }),
});

export class LocalAgentProvider {
    private app: any;
    private config: { model: string; apiKey: string; baseUrl: string };
    private threads: Map<string, string> = new Map();

    constructor(config: { model: string; apiKey: string; baseUrl: string }) {
        this.config = config;
    }

    async compile() {
        const llm = new ChatOpenAI({
            model: this.config.model,
            apiKey: this.config.apiKey,
            configuration: {
                baseURL: this.config.baseUrl,
            },
        });

        const graph = new StateGraph(GraphState)
            .addNode('goal', async (state: typeof GraphState.State) => {
                const response = await llm.invoke(state.messages);
                return { messages: [response], phase: 'goal' };
            })
            .addEdge('__start__', 'goal');

        this.app = graph.compile();
    }

    async invoke(taskId: string, messages: { role: string; content: string }[], handler: AcpMessageHandler): Promise<void> {
        const adapter = new StreamAdapter(handler);
        try {
            const result = await this.app.invoke({
                messages: messages.map(m => ({
                    type: m.role === 'user' ? 'human' : 'ai',
                    content: m.content,
                })),
            });
            const lastMsg = result.messages?.[result.messages.length - 1];
            if (lastMsg?.content) {
                handler.onText(lastMsg.content as string);
            }
            adapter.complete('end_turn');
        } catch (err: any) {
            adapter.error(err?.message || 'LangGraph 执行失败');
        }
    }

    async disconnect(): Promise<void> {
        this.threads.clear();
    }
}
