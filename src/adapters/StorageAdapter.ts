/**
 * StorageAdapter — desktop-cc-gui clientStorage → VS Code context.state
 *
 * desktop-cc-gui 的 clientStorage.ts 使用 Tauri invoke('client_store_read/write')，
 * 改为 VS Code ExtensionContext.workspaceState (Memento 接口)。
 */

import type { ExtensionContext, Memento } from 'vscode';

export class StorageAdapter {
  private _state: Memento | null = null;

  /** 绑定到 VS Code ExtensionContext */
  bind(context: ExtensionContext) {
    this._state = context.workspaceState;
  }

  /** 绑定到指定的 Memento（测试用） */
  bindState(state: Memento) {
    this._state = state;
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this._state?.get<T>(key) ?? defaultValue;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this._state?.update(key, value);
  }

  async delete(key: string): Promise<void> {
    await this._state?.update(key, undefined);
  }

  /** 批量读取 */
  getMany<T>(keys: string[]): Record<string, T | undefined> {
    const result: Record<string, T | undefined> = {};
    for (const key of keys) {
      result[key] = this.get<T>(key);
    }
    return result;
  }

  /** 批量写入 */
  async setMany(entries: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      await this.set(key, value);
    }
  }
}

/** 全局单例 */
export const storageAdapter = new StorageAdapter();
