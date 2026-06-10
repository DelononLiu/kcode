/**
 * Bridge — Webview ↔ Extension Host 双向消息通道
 *
 * Webview 侧：invoke(method, params) = 请求-响应调用
 *            on(event, handler) / off(event, handler) = 监听推送事件
 *
 * 底层使用 VS Code Webview postMessage API
 */

type InvokeCallback = (result: unknown) => void;
type EventHandler = (data: unknown) => void;

class Bridge {
  private _vscodeApi: ReturnType<Window['acquireVsCodeApi']> | null = null;
  private _invokeId = 0;
  private _invokeMap = new Map<string, InvokeCallback>();
  private _eventHandlers = new Map<string, Set<EventHandler>>();
  private _ready = false;
  private _pendingQueue: Array<Record<string, unknown>> = [];

  get api() {
    if (!this._vscodeApi) {
      try { this._vscodeApi = window.acquireVsCodeApi(); }
      catch { return null; }
    }
    return this._vscodeApi;
  }

  init() {
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'bridge:result' && msg.id) {
        const cb = this._invokeMap.get(msg.id);
        if (cb) { cb(msg.result); this._invokeMap.delete(msg.id); }
        return;
      }

      if (msg.type === 'bridge:event' && msg.event) {
        const handlers = this._eventHandlers.get(msg.event);
        if (handlers) handlers.forEach((h) => h(msg.data));
      }
    });

    this._ready = true;
    for (const p of this._pendingQueue) this._send(p);
    this._pendingQueue = [];
  }

  private _send(msg: Record<string, unknown>) {
    if (!this._ready) { this._pendingQueue.push(msg); return; }
    this.api?.postMessage(msg);
  }

  /** 请求-响应调用扩展侧方法 */
  invoke<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `br_${++this._invokeId}`;
      const timeout = setTimeout(() => {
        this._invokeMap.delete(id);
        reject(new Error(`bridge invoke timeout: ${method}`));
      }, 30000);
      this._invokeMap.set(id, (r: unknown) => { clearTimeout(timeout); resolve(r as T); });
      this._send({ type: 'bridge:invoke', id, method, params: params ?? null });
    });
  }

  /** 监听扩展侧推送事件 */
  on(event: string, handler: EventHandler) {
    if (!this._eventHandlers.has(event)) this._eventHandlers.set(event, new Set());
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this._eventHandlers.get(event)?.delete(handler);
  }

  /** 持久化状态（webview 重载后保留） */
  getState<T = unknown>(): T | undefined { return this.api?.getState() as T | undefined; }
  setState(state: Record<string, unknown>) { this.api?.setState(state); }
}

export const bridge = new Bridge();
bridge.init();
