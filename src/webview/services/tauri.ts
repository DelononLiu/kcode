/**
 * services/tauri.ts — desktop-cc-gui 后端服务 shim
 *
 * 所有函数签名与 desktop-cc-gui/src/services/tauri.ts 一致，
 * 但实现转发到 VS Code Bridge。
 *
 * desktop-cc-gui 的 UI 组件 import 此文件（路径不变），实际走 bridge。
 */

import { bridge } from './bridge';
import * as vscodeBridge from './vscodeBridge';

// 重新导出 vscodeBridge 的通用函数
export const { invoke, convertFileSrc, isTauri } = vscodeBridge;
export const { getCurrentWindow } = vscodeBridge;
export const { openPath, openUrl, revealItemInDir } = vscodeBridge;

// ═══════════════ 类型导出 ═══════════════
export type { AutoSessionMetadata } from '../types';

// ═══════════════ Thread / Session ═══════════════
export async function sendUserMessage(workspaceId: string, threadId: string, text: string, options?: Record<string, unknown>) {
  return bridge.invoke('threads/sendMessage', { workspaceId, threadId, text, options });
}
export async function interruptTurn(workspaceId: string, threadId: string, turnId: string) {
  return bridge.invoke('threads/interrupt', { workspaceId, threadId, turnId });
}
export async function engineInterrupt(workspaceId: string) {
  return bridge.invoke('engine/interrupt', { workspaceId });
}
export async function engineInterruptTurn(workspaceId: string, turnId: string) {
  return bridge.invoke('engine/interruptTurn', { workspaceId, turnId });
}
export async function listThreads(workspaceId: string) {
  return bridge.invoke('threads/list', { workspaceId });
}
export async function resumeThread(workspaceId: string, threadId: string) {
  return bridge.invoke('threads/resume', { workspaceId, threadId });
}
export async function archiveThread(workspaceId: string, threadId: string) {
  return bridge.invoke('threads/archive', { workspaceId, threadId });
}
export async function compactThreadContext(workspaceId: string, threadId: string) {
  return bridge.invoke('threads/compact', { workspaceId, threadId });
}

// ═══════════════ Agent / Engine ═══════════════
export async function getAccountInfo(workspaceId: string) { return null; }
export async function getAccountRateLimits(workspaceId: string) { return null; }
export async function getCurrentClaudeConfig() { return null; }

// ═══════════════ Git ═══════════════
export async function getGitLog(workspaceId: string) { return null; }
export async function listGitBranches(workspaceId: string) { return []; }

// ═══════════════ Knowledge / Memory ═══════════════
export async function projectMemoryList(workspaceId: string) { return []; }
export async function projectMemoryCreate(workspaceId: string, entry: any) { return entry; }
export async function projectMemoryUpdate(workspaceId: string, id: string, entry: any) { return entry; }
export async function projectMemoryDelete(workspaceId: string, id: string) {}
export async function projectMemoryGet(workspaceId: string, id: string) { return null; }

// ═══════════════ Workspace ═══════════════
export async function listWorkspaces() { return []; }
export async function connectWorkspace(workspaceId: string) {}
export async function ensureWorkspacePathDir(path: string) { return true; }
export async function isWorkspacePathDir(path: string) { return false; }
export async function pickWorkspacePath() { return null; }
export async function pickImageFiles() { return []; }
export async function pickFiles() { return []; }
export async function localUsageSnapshot() { return null; }
export async function ensureRuntimeReady() { return { ready: true }; }
export async function getOpenAppIcon() { return null; }
export async function openWorkspaceIn() {}
export async function isWebServiceRuntime() { return false; }

// ═══════════════ Models ═══════════════
export async function getModelList(workspaceId: string) { return []; }
export async function getConfigModel(workspaceId: string) { return null; }
export async function getCollaborationModes(workspaceId: string) { return { data: [] }; }
export async function getSkillsList(workspaceId: string) { return []; }
export async function detectEngines() { return []; }
export async function getActiveEngine() { return 'claude'; }
export async function getEngineStatus() { return null; }
export async function getEngineModels() { return []; }
export async function engineSendMessage() { return {}; }
export async function engineSendMessageSync() { return { text: '' }; }
export async function getClaudeCommandsList() { return []; }
export async function getOpenCodeCommandsList() { return []; }
export async function getOpenCodeAgentsList() { return []; }
export async function getOpenCodeStatusSnapshot() { return null; }
export async function getOpenCodeProviderHealth() { return null; }
export async function listAgentConfigs() { return []; }

// ═══════════════ Prompts ═══════════════
export async function getPromptsList(workspaceId: string) { return []; }
export async function createPrompt(...args: any[]) { return null; }
export async function updatePrompt(...args: any[]) { return null; }
export async function deletePrompt(...args: any[]) {}
export async function movePrompt(...args: any[]) {}

// ═══════════════ App Settings ═══════════════
export async function getAppSettings() { return {}; }
export async function updateAppSettings(settings: any) { return settings; }

// ═══════════════ Session Management ═══════════════
export async function listWorkspaceSessions(workspaceId: string) { return []; }
export async function listWorkspaceSessionFolders(workspaceId: string) { return []; }
export async function createWorkspaceSessionFolder(workspaceId: string, name: string) { return { id: '', name: '' }; }
export async function deleteWorkspaceSessionFolder(workspaceId: string, folderId: string) {}
export async function renameWorkspaceSessionFolder(workspaceId: string, folderId: string, name: string) {}
export async function assignWorkspaceSessionFolders(workspaceId: string, sessionIds: string[], folderId: string) { return {}; }
export async function assignWorkspaceSessionFolder(workspaceId: string, sessionId: string, folderId: string | null) { return {}; }
export async function listGlobalCodexSessions() { return []; }
export async function listProjectRelatedCodexSessions() { return []; }
export async function deleteCodexSession(...args: any[]) { return {}; }
export async function deleteCodexSessions(...args: any[]) { return { results: [] }; }
export async function loadCodexSession(...args: any[]) { return null; }

// ═══════════════ Claude Sessions ═══════════════
export async function listClaudeSessions(...args: any[]) { return []; }
export async function loadClaudeSession(...args: any[]) { return null; }
export async function forkClaudeSession(...args: any[]) { return null; }
export async function forkClaudeSessionFromMessage(...args: any[]) { return null; }
export async function deleteClaudeSession(...args: any[]) {}

// ═══════════════ OpenCode ═══════════════
export async function getOpenCodeSessionList(...args: any[]) { return []; }
export async function exportOpenCodeSession(...args: any[]) { return {}; }
export async function importOpenCodeSession(...args: any[]) { return {}; }
export async function shareOpenCodeSession(...args: any[]) { return {}; }
export async function getOpenCodeMcpStatus(...args: any[]) { return {}; }
export async function getOpenCodeStats(...args: any[]) { return ''; }
export async function getOpenCodeLspDiagnostics(...args: any[]) { return {}; }
export async function getOpenCodeLspSymbols(...args: any[]) { return {}; }

// ═══════════════ Content / Files ═══════════════
export async function readWorkspaceFile(...args: any[]) { return { content: '', truncated: false }; }
export async function writeWorkspaceFile(...args: any[]) {}
export async function getWorkspaceFiles(...args: any[]) { return { files: [], directories: [] }; }
export async function searchWorkspaceText(...args: any[]) { return { files: [], file_count: 0, match_count: 0, limit_hit: false }; }

// ═══════════════ Other ═══════════════
export async function respondToServerRequest(...args: any[]) { return {}; }
export async function respondToUserInputRequest(...args: any[]) { return {}; }
export async function queryTurnReconciliationStatus(...args: any[]) { return null; }
export async function sendConversationCompletionEmail(...args: any[]) { return {}; }
export async function getGitStatus(...args: any[]) { return {}; }
export async function getGitDiffs(...args: any[]) { return []; }
export async function getGitRemote(...args: any[]) { return null; }
export async function stageGitFile(...args: any[]) {}
export async function unstageGitFile(...args: any[]) {}
export async function revertGitFile(...args: any[]) {}
export async function runCodexLogin(...args: any[]) { return {}; }
export async function cancelCodexLogin(...args: any[]) { return {}; }
export async function appendClientErrorLog(...args: any[]) {}
export async function getRuntimePoolSnapshot(...args: any[]) { return null; }
export async function mutateRuntimePool(...args: any[]) {}
export async function generateRunMetadata(...args: any[]) { return { title: '', worktreeName: '' }; }
export async function readLocalImageDataUrl(...args: any[]) { return null; }
export async function hydrateClaudeDeferredImage(...args: any[]) { return null; }
export async function getDaemonStatus() { return { running: false, host: '' }; }
export async function startDaemon() { return { running: false, host: '' }; }
export async function readGlobalCodexAuthJson() { return null; }
export async function getCommitMessagePrompt(...args: any[]) { return ''; }
export async function generateCommitMessage(...args: any[]) { return ''; }
export async function generateThreadTitle(...args: any[]) { return ''; }
export async function setThreadTitle(...args: any[]) { return ''; }
export async function listThreadTitles(...args: any[]) { return {}; }
export async function getRendererStabilitySnapshot() { return null; }
export async function recordRendererHeartbeat() {}
export async function setMenuAccelerators(...args: any[]) {}
export async function updateMenuLabels(...args: any[]) {}
