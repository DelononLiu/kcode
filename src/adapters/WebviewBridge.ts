/**
 * WebviewBridge — Extension Host 侧 Bridge 实现
 *
 * 管理方法注册、事件推送，与 Webview 侧 bridge.ts 配对。
 */

import type { WebviewPanel } from 'vscode';

type HandlerFn = (params: unknown) => unknown | Promise<unknown>;

export class WebviewBridge {
  private _handlers = new Map<string, HandlerFn>();
  private _panel: WebviewPanel | null = null;

  bind(panel: WebviewPanel) {
    this._panel = panel;

    panel.webview.onDidReceiveMessage((msg) => {
      if (!msg || msg.type !== 'bridge:invoke') return;
      const { id, method, params } = msg;
      const handler = this._handlers.get(method);
      if (!handler) {
        panel.webview.postMessage({ type: 'bridge:result', id, error: { message: `unknown method: ${method}` } });
        return;
      }
      Promise.resolve(handler(params))
        .then((result) => panel.webview.postMessage({ type: 'bridge:result', id, result }))
        .catch((error) => panel.webview.postMessage({
          type: 'bridge:result', id,
          error: { message: error instanceof Error ? error.message : String(error) },
        }));
    });
  }

  registerHandler(method: string, fn: HandlerFn) {
    this._handlers.set(method, fn);
  }

  emit(event: string, data: unknown) {
    if (!this._panel) return;
    this._panel.webview.postMessage({ type: 'bridge:event', event, data });
  }
}
