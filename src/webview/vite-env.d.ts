/// <reference types="vite/client" />

interface Window {
  acquireVsCodeApi(): {
    postMessage(message: unknown): void;
    getState(): Record<string, unknown> | undefined;
    setState(state: Record<string, unknown>): void;
  };
}
