/**
 * WebviewBridge — Extension Host 侧 Bridge 实现
 *
 * 管理方法注册、事件推送，与 Webview 侧 bridge.ts 配对。
 * 兼容 WebviewPanel 和 WebviewView。
 */

import type { Webview } from 'vscode';

type HandlerFn = (params: unknown) => unknown | Promise<unknown>;

/** WebviewPanel 和 WebviewView 都暴露 .webview */
interface HasWebview {
  webview: Webview;
  onDidDispose: any;
}

export class WebviewBridge {
  private _handlers = new Map<string, HandlerFn>();
  private _webview: Webview | null = null;

  /** 绑定到任意带 .webview 的对象（Panel 或 View） */
  bind(target: HasWebview) {
    this._webview = target.webview;

    target.webview.onDidReceiveMessage((msg: any) => {
      if (!msg || msg.type !== 'bridge:invoke') return;
      const { id, method, params } = msg;
      const handler = this._handlers.get(method);
      if (!handler) {
        target.webview.postMessage({ type: 'bridge:result', id, error: { message: `unknown method: ${method}` } });
        return;
      }
      Promise.resolve(handler(params))
        .then((result) => target.webview.postMessage({ type: 'bridge:result', id, result }))
        .catch((error) => target.webview.postMessage({
          type: 'bridge:result', id,
          error: { message: error instanceof Error ? error.message : String(error) },
        }));
    });
  }

  /** 便捷方法：绑定 WebviewPanel */
  bindPanel(panel: HasWebview) { this.bind(panel); }

  /** 便捷方法：绑定 WebviewView */
  bindView(view: HasWebview) { this.bind(view); }

  registerHandler(method: string, fn: HandlerFn) {
    this._handlers.set(method, fn);
  }

  emit(event: string, data: unknown) {
    if (!this._webview) return;
    this._webview.postMessage({ type: 'bridge:event', event, data });
  }
}
