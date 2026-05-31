type MessageHandler = (message: any) => void;

export class MessageRouter {
    private handlers = new Map<string, Set<MessageHandler>>();
    PostMessage: (message: any) => void = () => {};

    on(type: string, handler: MessageHandler): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        this.handlers.get(type)!.add(handler);
    }

    off(type: string, handler: MessageHandler): void {
        this.handlers.get(type)?.delete(handler);
    }

    dispatch(type: string, message: any): void {
        const typeHandlers = this.handlers.get(type);
        if (typeHandlers) {
            for (const handler of typeHandlers) {
                handler(message);
            }
        }
    }

    reset(): void {
        this.handlers.clear();
    }
}
