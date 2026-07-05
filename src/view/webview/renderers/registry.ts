import type { Message } from '../taskv3/types';
import type { MsgStateAccess } from '../taskv3/msgRenderer';

export interface MessageRenderer {
    type: string;
    render: (msg: Message, sm: MsgStateAccess) => HTMLElement | null;
    update?: (el: HTMLElement, msg: Message, sm: MsgStateAccess) => void;
}

const registry = new Map<string, MessageRenderer>();

export function registerRenderer(renderer: MessageRenderer): void {
    registry.set(renderer.type, renderer);
}

export function getRenderer(type: string): MessageRenderer | undefined {
    return registry.get(type);
}

export function getAllRenderers(): MessageRenderer[] {
    return Array.from(registry.values());
}
