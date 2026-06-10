import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { bridge } from "./services/bridge";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import type { Thread, KnowledgeEntry } from "./types";

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
  const [tab, setTab] = useState<"chat" | "knowledge">("chat");
  const [threads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<EngineStatus>({ connected: false });
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [processing, setProcessing] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);
  const bufRef = useRef("");
  const streamIdRef = useRef<string | null>(null);

  // Init
  useEffect(() => {
    bridge.invoke<EngineStatus>("engine/status").then(setStatus).catch(() => {});
    bridge.invoke<Thread[]>("threads/list").then(setThreads).catch(() => {});
    bridge.invoke<KnowledgeEntry[]>("knowledge/list").then(setKnowledge).catch(() => {});

    bridge.on("stream:chunk", (d: any) => {
      if (!d?.text) return;
      const id = streamIdRef.current || (streamIdRef.current = msgId());
      bufRef.current += d.text;
      setMessages((prev) => {
        const i = prev.findIndex((m) => m.id === id && m.role === "assistant");
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], content: bufRef.current };
          return next;
        }
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
    setInput("");
    setProcessing(true);
    setMessages((prev) => [...prev, { id: msgId(), role: "user", content: text, timestamp: Date.now() }]);
    try { await bridge.invoke("engine/sendMessage", { text }); }
    catch (e) {
      setMessages((prev) => [...prev, { id: msgId(), role: "system", content: `Error: ${e}`, timestamp: Date.now() }]);
      setProcessing(false);
    }
  }, [input, processing]);

  const handleNew = useCallback(() => { setMessages([]); bufRef.current = ""; streamIdRef.current = null; }, []);

  const saveKnowledge = useCallback(async () => {
    if (!editing) return;
    const saved = await bridge.invoke<KnowledgeEntry>("knowledge/save", editing);
    setKnowledge((prev) => {
      const i = prev.findIndex((e) => e.id === saved.id);
      if (i >= 0) { const n = [...prev]; n[i] = saved; return n; }
      return [...prev, saved];
    });
    setEditing(null);
  }, [editing]);

  return (
    <div className="h-full w-full flex flex-col bg-[#0d0f14] text-[#e6e7ea]">
      {/* Header */}
      <header className="h-11 flex items-center px-3 border-b border-[#252530] shrink-0 gap-2">
        <span className="font-semibold text-sm">KCode AI</span>
        <div className="ml-auto flex items-center gap-2 text-xs text-[#808080]">
          <span className={`w-2 h-2 rounded-full ${status.connected ? "bg-[#78ebbe]" : "bg-[#ff6e6e]"}`} />
          {status.connected ? (status.modelName || "Connected") : "Disconnected"}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-[#121212] border-r border-[#252530] flex flex-col shrink-0">
          <div className="p-3 border-b border-[#252530]">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="chat" className="flex-1 text-xs">💬 Chat</TabsTrigger>
                <TabsTrigger value="knowledge" className="flex-1 text-xs">📚 Knowledge</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {tab === "chat" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <Button variant="outline" size="sm" className="w-full justify-center text-xs" onClick={handleNew}>+ New Chat</Button>
              {threads.length === 0 && <p className="text-xs text-[#808080] text-center mt-8">No conversations yet</p>}
            </div>
          )}

          {tab === "knowledge" && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <Button variant="outline" size="sm" className="w-full justify-center text-xs" onClick={() => setEditing({ id: "", title: "", content: "" } as any)}>+ New Entry</Button>
              {knowledge.map((e) => (
                <div key={e.id} className="p-2 rounded bg-[#1f1f25] border border-[#252530] cursor-pointer hover:border-[#353540] text-xs" onClick={() => setEditing(e)}>
                  <div className="font-medium mb-0.5">{e.title || "Untitled"}</div>
                  <div className="text-[#999] line-clamp-2">{e.content}</div>
                </div>
              ))}
              {knowledge.length === 0 && <p className="text-xs text-[#808080] text-center mt-8">No entries yet</p>}
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h1 className="text-2xl font-bold mb-2">Welcome to KCode AI</h1>
                    <p className="text-sm text-[#808080] max-w-sm">AI-powered coding assistant for VS Code</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`p-3 rounded-lg border ${m.role === "assistant" ? "bg-[#1f1f25] border-[#252530]" : m.role === "user" ? "bg-[#232329] border-[#30303a]" : "bg-[#281c26] border-[#6b3a56]"}`}>
                      <div className={`text-xs font-semibold uppercase tracking-wider mb-1 ${m.role === "assistant" ? "text-[#78ebbe]" : m.role === "user" ? "text-[#999]" : "text-[#f2c3e2]"}`}>
                        {m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "System"}
                      </div>
                      <div className="text-sm leading-relaxed">
                        {m.role === "assistant" ? <MarkdownRenderer content={m.content} /> : m.content}
                      </div>
                    </div>
                  ))
                )}
                {processing && (
                  <div className="flex items-center gap-1.5 text-sm text-[#78ebbe] px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#78ebbe] animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                )}
                <div ref={msgEnd} />
              </div>

              <div className="border-t border-[#252530] p-3 bg-[#0f1118]">
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 min-h-[40px] max-h-[200px] p-2.5 rounded-lg border border-[#30303a] bg-[#1f1f25] text-sm text-[#e6e7ea] outline-none resize-none placeholder:text-[#808080]"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                  />
                  <Button onClick={handleSend} disabled={!input.trim() || processing} className="self-end">
                    {processing ? "⏳" : "Send"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {tab === "knowledge" && editing && (
            <div className="p-4 space-y-3">
              <input className="w-full p-2 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none" placeholder="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <textarea className="w-full min-h-[150px] p-2 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none resize-y" placeholder="Content" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={saveKnowledge}>Save</Button>
              </div>
            </div>
          )}
          {tab === "knowledge" && !editing && (
            <div className="p-4">
              <h2 className="text-base font-semibold mb-2">Knowledge Base</h2>
              <p className="text-sm text-[#808080]">Store project knowledge and conventions.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function setThreads(threads: Thread[]) {
  // placeholder — will be wired to real thread data
}
