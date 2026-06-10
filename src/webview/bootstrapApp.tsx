import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorBoundary } from "./components/ErrorBoundary";

function renderBootstrapFallback(error: unknown) {
  const root = document.getElementById("root");
  if (!root) return;

  const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <div style={{ padding: 32, color: "#f87171", fontFamily: "monospace", fontSize: 13 }}>
        <h2 style={{ margin: "0 0 12px", color: "#f87171", fontSize: 18 }}>Startup Error</h2>
        <p style={{ color: "#94a3b8", marginBottom: 16 }}>App failed to initialize.</p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {errorMessage}
        </pre>
      </div>
    </React.StrictMode>,
  );
}

export async function startApp() {
  try {
    const { default: App } = await import("./App");
    const rootEl = document.getElementById("root");
    if (!rootEl) throw new Error("#root missing");

    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (error) {
    console.error("startup failed:", error);
    renderBootstrapFallback(error);
  }
}
