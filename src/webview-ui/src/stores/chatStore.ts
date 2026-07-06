import { create } from 'zustand'
import type { Message, ToolChunkData } from '../lib/types'

interface ChatState {
  messages: Message[]
  streaming: boolean
  activeTaskId: string | null
  activePhase: string
  activeStatus: string
  taskTitle: string
  agentConnected: boolean
  agentName: string
  viewMode: 'task' | 'assistant'
  expandedRounds: Record<string, boolean>

  loadMessages: (messages: Message[], taskId: string, taskType?: string) => void
  handleStreamChunk: (text: string) => void
  handleStreamDone: () => void
  handleThinkingChunk: (data: { text: string; status: string }) => void
  handleToolChunk: (data: ToolChunkData) => void
  handleMessagesSync: (messages: Message[]) => void
  addUserMessage: (content: string) => void
  setStateDelta: (d: Partial<ChatState>) => void
  toggleRound: (roundGroup: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  activeTaskId: null,
  activePhase: '',
  activeStatus: '',
  taskTitle: '',
  agentConnected: false,
  agentName: '',
  viewMode: 'task',
  expandedRounds: {},

  loadMessages: (messages, taskId, taskType) =>
    set({
      messages,
      activeTaskId: taskId,
      viewMode: taskType === 'assistant' ? 'assistant' : 'task',
      streaming: false,
    }),

  handleStreamChunk: (text) =>
    set((state) => {
      const msgs = [...state.messages]
      let idx = msgs.findIndex((m) => m.role === 'agent' && m.streaming)
      if (idx < 0) {
        msgs.push({
          id: 'msg_' + Date.now(),
          taskId: state.activeTaskId || '',
          role: 'agent',
          type: 'text',
          content: '',
          timestamp: Date.now(),
          streaming: true,
          collapsed: false,
          roundGroup: null,
        })
        idx = msgs.length - 1
      }
      msgs[idx] = { ...msgs[idx], content: text }
      return { messages: msgs, streaming: true }
    }),

  handleStreamDone: () =>
    set((state) => {
      let msgs = state.messages.map((m) =>
        m.streaming ? { ...m, streaming: false } : m,
      )

      // 按 user 边界分组并折叠中间消息
      const cleaned = msgs.filter((m) => m.type !== 'round_summary')
      const userIdx: number[] = []
      cleaned.forEach((m, i) => {
        if (m.role === 'user') userIdx.push(i)
      })

      if (userIdx.length > 0) {
        const result = [...cleaned]
        for (let ri = 0; ri < userIdx.length; ri++) {
          const start = userIdx[ri] + 1
          const end =
            ri + 1 < userIdx.length
              ? userIdx[ri + 1] - 1
              : result.length - 1
          if (start > end) continue

          const rg = 'rg_' + result[start].id
          if (state.expandedRounds[rg]) continue

          let finalAgent = -1
          for (let i = start; i <= end; i++) {
            if (result[i].role === 'agent' && !result[i].phaseAction)
              finalAgent = i
          }
          for (let i = start; i <= end; i++) {
            if (i !== finalAgent)
              result[i] = { ...result[i], collapsed: true }
          }
        }
        msgs = result
      }

      return { messages: msgs, streaming: false }
    }),

  handleThinkingChunk: (data) =>
    set((state) => {
      const msgs = [...state.messages]
      const idx = msgs.findIndex(
        (m) => m.type === 'thinking' && m.streaming,
      )
      if (idx >= 0) {
        msgs[idx] = {
          ...msgs[idx],
          content: data.text,
          streaming: data.status !== 'completed',
        }
      } else {
        msgs.push({
          id: 'thinking_' + Date.now(),
          taskId: state.activeTaskId || '',
          role: 'agent',
          type: 'thinking',
          content: data.text,
          timestamp: Date.now(),
          streaming: data.status !== 'completed',
          collapsed: false,
          roundGroup: null,
        })
      }
      return { messages: msgs }
    }),

  handleToolChunk: (data) =>
    set((state) => {
      const msgs = [...state.messages]
      const ci = {
        toolCallId: data.toolCallId,
        title: data.title,
        kind: data.kind,
        status: data.status,
      }
      const idx = msgs.findIndex(
        (m) =>
          m.type === 'tool_call' &&
          m.toolCall?.toolCallId === data.toolCallId,
      )
      if (idx >= 0) {
        const existing = msgs[idx]
        msgs[idx] = {
          ...existing,
          toolCall: { ...existing.toolCall, ...ci },
        }
        if (data.content) {
          msgs[idx] = {
            ...msgs[idx],
            toolResult: {
              toolCallId: data.toolCallId,
              output: data.content,
            },
          }
        }
      } else {
        msgs.push({
          id: 'tool_' + data.toolCallId,
          taskId: state.activeTaskId || '',
          role: 'tool',
          type: 'tool_call',
          content: '',
          timestamp: Date.now(),
          streaming: false,
          collapsed: false,
          roundGroup: null,
          toolCall: ci,
        })
      }
      return { messages: msgs }
    }),

  handleMessagesSync: (messages) => set({ messages }),

  addUserMessage: (content) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id: 'user_' + Date.now(),
          taskId: s.activeTaskId || '',
          role: 'user' as const,
          type: 'text' as const,
          content,
          timestamp: Date.now(),
          streaming: false,
          collapsed: false,
          roundGroup: null,
        },
      ],
    })),

  setStateDelta: (d) => set(d),

  toggleRound: (rg) =>
    set((s) => {
      const next = { ...s.expandedRounds }
      if (next[rg]) {
        delete next[rg]
        return { expandedRounds: next }
      }
      next[rg] = true
      return { expandedRounds: next }
    }),
}))
