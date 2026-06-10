import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KanbanView } from "./features/kanban/KanbanView";
import { Sidebar } from "./features/app/components/Sidebar";
import { ComposerInput } from "./features/composer/components/ComposerInput";
import { bridge } from "./services/bridge";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import type { KnowledgeEntry } from "./types";

type Tab = "chat" | "knowledge" | "kanban";

interface EngineStatus {
  connected: boolean;
  agentName?: string;
  modelName?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

let msgIdSeq = 0;
const msgId = () => `m_${Date.now()}_${++msgIdSeq}`;

export function AppShell() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("kanban");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<EngineStatus>({ connected: false });
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [processing, setProcessing] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);
  const bufRef = useRef("");
  const streamIdRef = useRef<string | null>(null);

  useEffect(() => {
    bridge.invoke<EngineStatus>("engine/status").then(setStatus).catch(() => {});
    bridge.invoke<KnowledgeEntry[]>("knowledge/list").then(setKnowledge).catch(() => {});
    bridge.on("stream:chunk", (d: any) => {
      if (!d?.text) return;
      const id = streamIdRef.current || (streamIdRef.current = msgId());
      bufRef.current += d.text;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === id && m.role === "assistant");
        if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], content: bufRef.current }; return n; }
        return [...prev, { id, role: "assistant", content: bufRef.current, timestamp: Date.now() }];
      });
    });
    bridge.on("stream:done", () => { setProcessing(false); bufRef.current = ""; streamIdRef.current = null; });
    bridge.on("stream:error", () => { setProcessing(false); bufRef.current = ""; streamIdRef.current = null; });
    bridge.on("engine:status", (d: any) => { if (d) setStatus(d); });
    bridge.on("knowledge:updated", (d: any) => { if (d?.entries) setKnowledge(d.entries); });
  }, []);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || processing) return;
    setInput(""); setProcessing(true);
    setMessages((p) => [...p, { id: msgId(), role: "user", content: text, timestamp: Date.now() }]);
    try { await bridge.invoke("engine/sendMessage", { text }); }
    catch { setMessages((p) => [...p, { id: msgId(), role: "system", content: "Error", timestamp: Date.now() }]); setProcessing(false); }
  }, [input, processing]);

  return (
    <div className="h-full w-full flex flex-col bg-[#0d0f14] text-[#e6e7ea]">
      <header className="h-9 flex items-center px-3 border-b border-[#252530] shrink-0 gap-3">
        <span className="font-semibold text-sm" style={{ color: "#04d361" }}>KCode AI</span>
        <span className="text-[10px] text-[#04d361] px-1.5 py-0.5 rounded" style={{ border: "1px solid rgba(4,211,97,0.2)", background: "rgba(4,211,97,0.1)" }}>v0.2</span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#808080]">
          <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? "bg-[#04d361]" : "bg-[#ff6e6e]"}`} />
          {status.connected ? (status.modelName || "Connected") : "Disconnected"}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* sidebar — desktop-cc-gui Sidebar 组件 */}
        <div className="w-60 shrink-0 border-r border-[#252530] overflow-hidden">
          <Sidebar {...({} as any)} />
        </div>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex gap-4 px-4 py-1.5 border-b border-[#252530] bg-[#121212]">
            {(["kanban", "chat", "knowledge"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`text-xs font-medium px-2 py-1 rounded ${tab === t ? "bg-[#04d361] text-black" : "text-[#808080] hover:text-[#e6e7ea]"}`}>
                {t === "kanban" ? "📋 管线" : t === "chat" ? "💬 对话" : "📚 知识"}
              </button>
            ))}
          </div>

          {tab === "kanban" && <KanbanView />}

          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h1 className="text-lg font-bold mb-1">KCode AI</h1>
                    <p className="text-xs text-[#808080] max-w-sm">VS Code AI 编码助手</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`px-3 py-2 rounded-md border ${m.role === "assistant" ? "bg-[#1f1f25] border-[#252530]" : m.role === "user" ? "bg-[#232329] border-[#30303a]" : "bg-[#281c26] border-[#6b3a56]"}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${m.role === "assistant" ? "text-[#78ebbe]" : m.role === "user" ? "text-[#999]" : "text-[#f2c3e2]"}`}>
                        {m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "System"}
                      </div>
                      <div className="text-[13px] leading-relaxed">{m.role === "assistant" ? <MarkdownRenderer content={m.content} /> : m.content}</div>
                    </div>
                  ))
                )}
                {processing && <div className="flex items-center gap-1.5 text-sm text-[#78ebbe] px-1"><span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" /><span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" style={{ animationDelay: "0.2s" }} /><span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" style={{ animationDelay: "0.4s" }} /></div>}
                <div ref={msgEnd} />
              </div>

              {/* composer — desktop-cc-gui ComposerInput */}
              <div className="border-t border-[#252530] bg-[#0f1118]">
                <ComposerInput {...({} as any)} />
              </div>
            </>
          )}

          {tab === "knowledge" && (
            <div className="p-3"><h2 className="text-sm font-semibold mb-1">Knowledge Base</h2><p className="text-xs text-[#808080]">知识库功能开发中...</p></div>
          )}
        </main>
      </div>
    </div>
  );
}
