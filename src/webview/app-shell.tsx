import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "./features/app/components/Sidebar";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TabBar } from "./features/app/components/TabBar";
import { ComposerInput } from "./features/composer/components/ComposerInput";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        {/* 侧边栏 — ThreadList */}
        <aside className="w-60 shrink-0 border-r border-[#252530] bg-[#121212] flex flex-col">
          <div className="flex p-1.5 gap-1 border-b border-[#252530]">
            {(["codex", "projects", "spec"] as TabKey[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 text-[10px] font-medium py-1 rounded ${tab === t ? "bg-[#04d361] text-black" : "text-[#808080] hover:text-[#e6e7ea]"}`}>
                {t === "codex" ? "💬 对话" : t === "projects" ? "📋 项目" : "📚 知识"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface-sidebar)' }}>
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
                renameWorktreeUpstream={() => {}}
                deletingWorktreeIds={[]}
                branches={[]}
                checkoutBranch={() => {}}
                createBranch={() => {}}
                activeWorkspaceRef={{ current: null }}
                handleOpenDetachedFileExplorer={() => {}}
                handleRenameWorktree={() => {}}
                openWorktreePrompt={() => {}}
                openClonePrompt={() => {}}
                worktreePrompt={null}
                clonePrompt={null}
                confirmWorktreePrompt={() => {}}
                cancelWorktreePrompt={() => {}}
                confirmClonePrompt={() => {}}
                cancelClonePrompt={() => {}}
                updateCloneCopyName={() => {}}
                chooseCloneCopiesFolder={() => {}}
                useSuggestedCloneCopiesFolder={() => {}}
                clearCloneCopiesFolder={() => {}}
                persistProjectCopiesFolder={() => {}}
                handleOpenClaudeTui={() => {}}
                handleSelectStatusPanelSubagent={() => {}}
                navigateToThread={() => {}}
                handleArchiveActiveThread={() => {}}
                ensureLaunchTerminal={() => {}}
                ensureTerminalWithTitle={() => {}}
                restartTerminalSession={() => {}}
                launchScriptState={null}
                launchScriptsState={{}}
                runtimeRunState={null}
                handleToggleRuntimeConsole={() => {}}
                handleToggleTerminalPanel={() => {}}
                worktreeSetupScriptState={{}}
                handleWorktreeCreated={() => {}}
                resolveCloneProjectContext={() => null}
                handleSelectOpenAppId={() => {}}
                openAppIconById={{}}
                handleSetGitRoot={() => {}}
                handlePickGitRoot={() => {}}
                activeGitRoot={null}
                gitRootCandidates={[]}
                gitRootScanLoading={false}
                gitRootScanError={null}
                gitRootScanDepth={0}
                gitRootScanHasScanned={false}
                scanGitRoots={() => {}}
                setGitRootScanDepth={() => {}}
                clearGitRootCandidates={() => {}}
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
                globalSelectionReady={true}
                collaborationModes={[]}
                collaborationModesEnabled={false}
                selectedCollaborationMode={null}
                selectedCollaborationModeId={null}
                setSelectedCollaborationModeId={() => {}}
                skills={[]}
                commands={[]}
                prompts={[]}
                files={[]}
                directories={[]}
                directoryMetadata={{}}
                isFilesLoading={false}
                refreshFiles={() => {}}
                appSettings={{}}
                setAppSettings={() => {}}
                appSettingsLoading={false}
                doctor={null}
                claudeDoctor={null}
                reduceTransparency={false}
                setReduceTransparency={() => {}}
                windowTransparencyEnabled={false}
                setWindowTransparencyEnabled={() => {}}
                windowOpacity={1}
                setWindowOpacity={() => {}}
                scaleShortcutTitle={() => ""}
                scaleShortcutText={() => ""}
                queueSaveSettings={() => {}}
                isSearchPaletteOpen={false}
                setIsSearchPaletteOpen={() => {}}
                searchScope={"active-workspace"}
                setSearchScope={() => {}}
                searchContentFilters={["all"]}
                setSearchContentFilters={() => {}}
                searchPaletteQuery={""}
                setSearchPaletteQuery={() => {}}
                searchPaletteSelectedIndex={0}
                setSearchPaletteSelectedIndex={() => {}}
                globalSearchFilesByWorkspace={{}}
                setGlobalSearchFilesByWorkspace={() => {}}
                searchResults={[]}
                historySearchItems={[]}
                activeWorkspaceId={null}
                activeThreadId={null}
                accountByWorkspace={{}}
                activeAccount={null}
                activeRateLimits={null}
                pinnedThreadsVersion={0}
                isThreadPinned={() => false}
                getPinTimestamp={() => 0}
                unpinThread={() => {}}
                pinThread={() => {}}
              />
            </ErrorBoundary>
          </div>
        </aside>

        {/* 主区域 */}
        <main className="flex-1 flex flex-col min-w-0">
          <TabBar activeTab={tab} onSelect={(t) => setTab(t)} />

          {tab === "projects" && (
            <div className="flex-1 flex items-center justify-center text-xs text-[#808080]">
              项目视图（开发中）
            </div>
          )}

          {tab === "codex" && (
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
