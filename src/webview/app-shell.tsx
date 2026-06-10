import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./features/app/components/Sidebar";
import { TabBar } from "./features/app/components/TabBar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ComposerInput } from "./features/composer/components/ComposerInput";
import { KanbanView } from "./features/kanban/KanbanView";
import { bridge } from "./services/bridge";
import { MarkdownRenderer } from "./components/MarkdownRenderer";

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
  const [processing, setProcessing] = useState(false);
  const msgEnd = useRef<HTMLDivElement>(null);
  const bufRef = useRef("");
  const streamIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bridge.invoke<EngineStatus>("engine/status").then(setStatus).catch(() => {});
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

  const handleNewChat = useCallback(() => {
    setMessages([]);
    bufRef.current = "";
    streamIdRef.current = null;
  }, []);

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
        {/* 侧边栏 */}
        <aside className="w-60 shrink-0 border-r border-[#252530] flex flex-col" style={{ background: 'var(--surface-sidebar)' }}>
          {/* TabBar 在侧边栏顶部 */}
          <TabBar activeTab={tab} onSelect={(t) => setTab(t)} />

          {/* 工作区 + 线程列表 */}
          <div className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Sidebar
                workspaces={[]}
                threadsByWorkspace={{}}
                threadStatusById={{}}
                threadParentById={{}}
                lastAgentMessageByThread={{}}
                latestAgentRuns={[]}
                isLoadingLatestAgents={false}
                workspaceGroups={[]}
                groupedWorkspaces={[]}
                getWorkspaceGroupName={() => ""}
                sidebarWidth={240}
                sidebarCollapsed={false}
                collapseSidebar={() => {}}
                expandSidebar={() => {}}
                onSidebarResizeStart={() => {}}
                appMode={"chat"}
                handleAppModeChange={() => {}}
                handleAddWorkspace={() => {}}
                handleOpenNewWindow={() => {}}
                handleAddWorkspaceFromPath={() => {}}
                handleAddAgent={() => {}}
                handleAddWorktreeAgent={() => {}}
                handleSelectAgent={() => {}}
                selectedAgent={null}
                openSettings={() => {}}
                isCompact={false}
                isTablet={false}
                isPhone={false}
                activeTab={"codex"}
                setActiveTab={() => {}}
                tabletTab={"codex"}
                hasLoaded={true}
                refreshWorkspaces={() => {}}
                connectWorkspace={() => {}}
                addWorkspace={() => {}}
                addWorktreeAgent={() => {}}
                addCloneAgent={() => {}}
                markWorkspaceConnected={() => {}}
                updateWorkspaceSettings={() => {}}
                updateWorkspaceCodexBin={() => {}}
                createWorkspaceGroup={() => {}}
                renameWorkspaceGroup={() => {}}
                moveWorkspaceGroup={() => {}}
                deleteWorkspaceGroup={() => {}}
                assignWorkspaceGroup={() => {}}
                removeWorkspace={() => {}}
                removeWorktree={() => {}}
                renameWorktree={() => {}}
                activeWorkspaceRef={{ current: null }}
                handleOpenDetachedFileExplorer={() => {}}
                handleRenameWorktree={() => {}}
                activeEngine={"claude"}
                setActiveEngine={() => {}}
                availableEngines={[]}
                installedEngines={[]}
                engineStatuses={{}}
                engineModelsAsOptions={[]}
                models={[]}
                modelsReady={true}
                selectedModelId={null}
                setSelectedModelId={() => {}}
                selectedEffort={null}
                setSelectedEffort={() => {}}
                refreshModels={() => {}}
                appSettings={{}}
                setAppSettings={() => {}}
                appSettingsLoading={false}
                reduceTransparency={false}
                setReduceTransparency={() => {}}
                queueSaveSettings={() => {}}
                isThreadPinned={() => false}
                getPinTimestamp={() => 0}
                unpinThread={() => {}}
                pinThread={() => {}}
                activeWorkspaceId={null}
                activeThreadId={null}
                accountByWorkspace={{}}
                activeAccount={null}
                searchPaletteQuery={""}
                setSearchPaletteQuery={() => {}}
                searchResults={[]}
              />
            </ErrorBoundary>
          </div>
        </aside>

        {/* 主区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          {tab === "codex" && (
            <>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#252530]">
                <span className="text-xs font-semibold" style={{ color: '#04d361' }}>AI 对话</span>
                <button onClick={handleNewChat} className="text-[10px] text-[#808080] hover:text-[#e6e7ea] px-2 py-0.5 rounded border border-[#30303a]">+ 新对话</button>
              </div>
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

              <ComposerInput
                text={input}
                onTextChange={(next) => setInput(next)}
                onSelectionChange={() => {}}
                onKeyDown={() => {}}
                textareaRef={textareaRef}
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

          {tab === "projects" && <KanbanView />}
          {tab === "spec" && (
            <div className="flex-1 flex items-center justify-center text-xs text-[#808080]">
              搜索（开发中）
            </div>
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
