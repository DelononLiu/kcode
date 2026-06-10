import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KanbanView } from "./features/kanban/KanbanView";
// import { Sidebar } from "./features/app/components/Sidebar";
import { TabBar } from "./features/app/components/TabBar";
import { ComposerInput } from "./features/composer/components/ComposerInput";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { bridge } from "./services/bridge";
import { MarkdownRenderer } from "./components/MarkdownRenderer";
import type { KnowledgeEntry } from "./types";

type TabKey = "projects" | "codex" | "spec" | "git" | "log";

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
  const [tab, setTab] = useState<TabKey>("codex");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<EngineStatus>({ connected: false });
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [processing, setProcessing] = useState(false);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const msgEnd = useRef<HTMLDivElement>(null);
  const bufRef = useRef("");
  const streamIdRef = useRef<string | null>(null);

  useEffect(() => {
    bridge.invoke<EngineStatus>("engine/status").then(setStatus).catch(() => {});
    bridge.invoke<KnowledgeEntry[]>("knowledge/list").then(setKnowledgeEntries).catch(() => {});
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
    bridge.on("knowledge:updated", (d: any) => { if (d?.entries) setKnowledgeEntries(d.entries); });
  }, []);

  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || processing) return;
    setInput(""); setProcessing(true);
    setMessages((p) => [...p, { id: msgId(), role: "user", content: text, timestamp: Date.now() }]);
    try { await bridge.invoke("engine/sendMessage", { text }); }
    catch { setMessages((p) => [...p, { id: msgId(), role: "system", content: "发送失败", timestamp: Date.now() }]); setProcessing(false); }
  }, [input, processing]);

  const saveKnowledge = useCallback(async () => {
    if (!editing) return;
    const saved = await bridge.invoke<KnowledgeEntry>("knowledge/save", editing);
    setKnowledgeEntries((prev) => {
      const i = prev.findIndex((e) => e.id === saved.id);
      if (i >= 0) { const n = [...prev]; n[i] = saved; return n; }
      return [...prev, saved];
    });
    setEditing(null);
  }, [editing]);

  return (
    <div className="h-full w-full flex flex-col bg-[#0d0f14] text-[#e6e7ea]">
      {/* 顶栏 */}
      <header className="h-9 flex items-center px-3 border-b border-[#252530] shrink-0 gap-3">
        <span className="font-semibold text-sm" style={{ color: "#04d361" }}>KCode AI</span>
        <span className="text-[10px] text-[#04d361] px-1.5 py-0.5 rounded" style={{ border: "1px solid rgba(4,211,97,0.2)", background: "rgba(4,211,97,0.1)" }}>v0.2</span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#808080]">
          <span className={`w-1.5 h-1.5 rounded-full ${status.connected ? "bg-[#04d361]" : "bg-[#ff6e6e]"}`} />
          {status.connected ? (status.modelName || "Connected") : "Disconnected"}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 — desktop-cc-gui Sidebar */}
        <aside className="w-60 shrink-0 border-r border-[#252530] overflow-hidden bg-[#121212]">
          {tab === "codex" && (
            <div className="p-1.5 border-b border-[#252530]">
              <p className="text-[10px] text-[#808080] text-center">AI 对话</p>
            </div>
          )}
          {tab === "projects" && (
            <div className="p-1.5 border-b border-[#252530]">
              <p className="text-[10px] text-[#808080] text-center">任务看板</p>
            </div>
          )}

          <div className="h-full overflow-y-auto">
            {/* Sidebar temporarily disabled for debugging */}
            <p className="text-[10px] text-[#808080] text-center mt-4">侧边栏加载中...</p>
          </div>
        </aside>

        {/* 主区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* desktop-cc-gui TabBar */}
          <TabBar activeTab={tab} onSelect={(t) => setTab(t)} />

          {tab === "projects" && <KanbanView />}

          {tab === "codex" && (
            <>
              {/* 消息列表 */}
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

              {/* ComposerInput */}
              <ComposerInput
                text={input}
                onTextChange={(next) => setInput(next)}
                onSelectionChange={() => {}}
                onKeyDown={() => {}}
                textareaRef={useRef<HTMLTextAreaElement>(null)}
                suggestionsOpen={false}
                suggestions={[]}
                highlightIndex={-1}
                onHighlightIndex={() => {}}
                onSelectSuggestion={() => {}}
                onSend={handleSend}
                canSend={input.trim().length > 0 && !processing}
                isProcessing={processing}
                onStop={() => bridge.invoke("engine/disconnect")}
                disabled={false}
                sendLabel="发送"
              />
            </>
          )}

          {tab === "spec" && editing && (
            <div className="p-3 space-y-2">
              <input className="w-full px-2 py-1.5 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none" placeholder="标题" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              <textarea className="w-full min-h-[120px] px-2 py-1.5 rounded border border-[#30303a] bg-[#1f1f25] text-sm outline-none resize-y" placeholder="内容" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
              <div className="flex gap-2 justify-end">
                <button className="px-3 py-1 rounded text-xs bg-[#1f1f25] border border-[#30303a] text-[#e6e7ea]" onClick={() => setEditing(null)}>取消</button>
                <button className="px-3 py-1 rounded text-xs bg-[#04d361] text-black" onClick={saveKnowledge}>保存</button>
              </div>
            </div>
          )}
          {tab === "spec" && !editing && (
            <div className="p-3"><h2 className="text-sm font-semibold mb-1">知识库</h2><p className="text-xs text-[#808080]">从侧栏选择条目查看</p></div>
          )}
          {(tab === "git" || tab === "log") && (
            <div className="flex-1 flex items-center justify-center text-xs text-[#808080]">
              {tab === "git" ? "Git 面板" : "日志面板"}（开发中）
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
