import type * as acp from '@agentclientprotocol/sdk';
import type { AcpMessageHandler } from './types';

export class AcpClientHandler implements acp.Client {
  private handlers: Map<string, AcpMessageHandler> = new Map();

  setHandler(sessionId: string, handler: AcpMessageHandler) {
    this.handlers.set(sessionId, handler);
  }

  removeHandler(sessionId: string) {
    this.handlers.delete(sessionId);
  }

  async requestPermission(params: acp.RequestPermissionRequest): Promise<acp.RequestPermissionResponse> {
    console.log(`[Client] Permission requested for tool ${params.toolCall.toolCallId}: ${params.toolCall.title}`);
    return {
      outcome: {
        outcome: 'selected',
        optionId: params.options[0]?.optionId || 'allow-once',
      },
    };
  }

  async sessionUpdate(params: acp.SessionNotification): Promise<void> {
    const update = params.update;
    const handler = this.handlers.get(params.sessionId);
    if (!handler) return;

    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        if (update.content.type === 'text') {
          handler.onText(update.content.text);
        }
        break;
      }
      case 'tool_call': {
        handler.onToolCall(
          update.toolCallId,
          update.title ?? '',
          update.kind ?? 'other',
          update.status ?? 'pending'
        );
        break;
      }
      case 'tool_call_update': {
        const item = update.content?.[0];
        const textContent =
          item?.type === 'content' && item.content.type === 'text'
            ? item.content.text
            : undefined;
        handler.onToolCallUpdate(update.toolCallId, update.status ?? 'pending', textContent);
        break;
      }
      case 'plan': {
        handler.onPlan(update.entries);
        break;
      }
      case 'agent_thought_chunk': {
        break;
      }
    }
  }
}
