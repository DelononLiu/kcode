// 消息类型（与 Domain Model 一致，补充 UI 字段）
export interface Message {
  id: string
  taskId: string
  role: 'user' | 'agent' | 'tool'
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'phase_action'
  content: string
  toolCall?: {
    toolCallId: string
    title: string
    kind: string
    status: string
  }
  toolResult?: {
    toolCallId: string
    output: string
  }
  phaseAction?: {
    phase: string
    status: 'pending' | 'confirmed' | 'rejected'
  }
  timestamp: number
  // UI 状态
  streaming?: boolean
  collapsed?: boolean
  roundGroup?: string | null
}

export interface ToolChunkData {
  toolCallId: string
  title: string
  kind: string
  status: string
  content: string
}
