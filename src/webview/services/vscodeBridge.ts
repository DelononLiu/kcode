/**
 * vscodeBridge — @tauri-apps/api 兼容层
 *
 * 暴露与以下 Tauri 模块相同的接口签名，底层用 VS Code postMessage：
 *   @tauri-apps/api/core         → invoke, convertFileSrc, isTauri
 *   @tauri-apps/api/window       → getCurrentWindow
 *   @tauri-apps/plugin-opener    → openPath, openUrl, revealItemInDir
 *
 * desktop-cc-gui 的 UI 代码通过 sed 替换 import 路径指向此文件。
 */

import { bridge } from './bridge';

// ═══════════════ @tauri-apps/api/core ═══════════════

export async function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return bridge.invoke<T>(cmd, args ?? {});
}

export function convertFileSrc(path: string): string {
  // VS Code webview 中不需要 convertFileSrc，直接返回路径
  return path;
}

export function isTauri(): boolean {
  return false;
}

// ═══════════════ @tauri-apps/api/event ═══════════════

export function listen(event: string, handler: (payload: any) => void): Promise<() => void> {
  bridge.on(event, handler);
  return Promise.resolve(() => bridge.off(event, handler));
}

// ═══════════════ @tauri-apps/api/window ═══════════════

export function getCurrentWindow() {
  return {
    setTitle: async (_title: string) => {},
    setFocus: async () => {},
    minimize: async () => {},
    maximize: async () => {},
    unmaximize: async () => {},
    isMaximized: async () => false,
    center: async () => {},
    close: async () => {},
    onDragDropEvent: () => {},
    onFileDropEvent: () => {},
    onResized: () => {},
    onMoved: () => {},
    onCloseRequested: () => {},
    onFocus: () => {},
    onBlur: () => {},
    innerPosition: () => Promise.resolve({ x: 0, y: 0 }),
    outerPosition: () => Promise.resolve({ x: 0, y: 0 }),
    scaleFactor: () => Promise.resolve(1),
    listen: () => Promise.resolve(() => {}),
  };
}

// ═══════════════ @tauri-apps/plugin-opener ═══════════════

export async function openPath(path: string): Promise<void> {
  await bridge.invoke('__openPath', { path });
}

export async function openUrl(url: string): Promise<void> {
  await bridge.invoke('__openUrl', { url });
}

export async function revealItemInDir(path: string): Promise<void> {
  await bridge.invoke('__revealInDir', { path });
}

// ═══════════════ @tauri-apps/plugin-dialog ═══════════════

export async function ask(message: string, options?: Record<string, unknown>): Promise<boolean> {
  return window.confirm(message);
}
