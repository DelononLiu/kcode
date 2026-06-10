import { ThreadDeleteConfirmBubble } from "./features/threads/components/ThreadDeleteConfirmBubble";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { KanbanView } from "./features/kanban/KanbanView";
import { Sidebar } from "./features/app/components/Sidebar";
import { ComposerInput } from "./features/composer/components/ComposerInput";
import { bridge } from "./services/bridge";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import type { Thread, KnowledgeEntry } from "./types";

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
      {/* Header — kcode 品牌色 #04d361 */}
      <header className="h-9 flex items-center px-3 border-b border-[#252530] shrink-0 gap-3">
        <span className="font-semibold text-sm" style={{ color: "#04d361" }}>KCode AI</span>
        <span className="text-[10px] text-[#04d361] bg-[rgba(4,211,97,0.1)] px-1.5 py-0.5 rounded" style={{ border: "1px solid rgba(4,211,97,0.2)" }}>
          v0.2
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#808080]">
          <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? "bg-[#04d361]" : "bg-[#ff6e6e]"}`} />
          {status.connected ? (status.modelName || "Connected") : "Disconnected"}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 bg-[#121212] border-r border-[#252530] flex flex-col shrink-0">
          <div className="p-2 border-b border-[#252530]">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="kanban" className="flex-1 text-[11px]">📋</TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 text-[11px]">💬</TabsTrigger>
                <TabsTrigger value="knowledge" className="flex-1 text-[11px]">📚</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {tab === "chat" && (
              <>
                <button className="w-full text-xs text-left px-2 py-1.5 rounded bg-[#1f1f25] border border-[#252530] hover:border-[#353540]" onClick={handleNew}>
                  + New Chat
                </button>
                <p className="text-[10px] text-[#808080] text-center mt-4">No conversations yet</p>
              </>
            )}
            {tab === "knowledge" && (
              <>
                <button className="w-full text-xs text-left px-2 py-1.5 rounded bg-[#1f1f25] border border-[#252530] hover:border-[#353540]" onClick={() => setEditing({ id: "", title: "", content: "" } as any)}>
                  + New Entry
                </button>
                {knowledge.map((e) => (
                  <div key={e.id} className="p-1.5 rounded bg-[#1f1f25] border border-[#252530] cursor-pointer hover:border-[#353540] text-xs mt-1" onClick={() => setEditing(e)}>
                    <div className="font-medium truncate">{e.title || "Untitled"}</div>
                  </div>
                ))}
                {knowledge.length === 0 && <p className="text-[10px] text-[#808080] text-center mt-4">No entries</p>}
              </>
            )}
            {tab === "kanban" && (
              <p className="text-[10px] text-[#808080] text-center mt-4">拖拽卡片切换阶段</p>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          {tab === "kanban" && <KanbanView />}

          {tab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h1 className="text-lg font-bold mb-1">KCode AI</h1>
                    <p className="text-xs text-[#808080] max-w-sm">AI-powered coding assistant for VS Code</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`px-3 py-2 rounded-md border ${m.role === "assistant" ? "bg-[#1f1f25] border-[#252530]" : m.role === "user" ? "bg-[#232329] border-[#30303a]" : "bg-[#281c26] border-[#6b3a56]"}`}>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${m.role === "assistant" ? "text-[#78ebbe]" : m.role === "user" ? "text-[#999]" : "text-[#f2c3e2]"}`}>
                        {m.role === "user" ? "You" : m.role === "assistant" ? "AI" : "System"}
                      </div>
                      <div className="text-[13px] leading-relaxed">
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

              <div className="border-t border-[#252530] px-3 py-2 bg-[#0f1118]">
                <div className="flex gap-1.5 items-end">
                  <textarea
                    className="flex-1 min-h-[28px] max-h-[120px] px-2 py-1.5 rounded-md border border-[#30303a] bg-[#1f1f25] text-[13px] text-[#e6e7ea] outline-none resize-none placeholder:text-[#808080] leading-snug"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || processing}
                    className="h-[28px] px-3 rounded-md text-xs font-medium bg-[#04d361] text-black hover:bg-[#00e676] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >{processing ? "⏳" : "Send"}</button>
                </div>
              </div>
            </>
          )}

          {tab === "knowledge" && editing && (
            <div className="p-3 space-y-2">
              <input className="w-full px-2 py-1.5 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none" placeholder="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <textarea className="w-full min-h-[120px] px-2 py-1.5 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none resize-y" placeholder="Content" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 rounded text-xs bg-[#1f1f25] border border-[#30303a] text-[#e6e7ea]" onClick={() => setEditing(null)}>Cancel</button>
                <button className="px-3 py-1 rounded text-xs bg-[#04d361] text-black" onClick={saveKnowledge}>Save</button>
              </div>
            </div>
          )}
          {tab === "knowledge" && !editing && (
            <div className="p-3">
              <h2 className="text-sm font-semibold mb-1">Knowledge Base</h2>
              <p className="text-xs text-[#808080]">Select an entry from sidebar.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// 强制引用测试编译
