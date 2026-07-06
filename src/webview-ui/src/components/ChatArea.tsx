import { useEffect, useRef } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import UserMessage from './messages/UserMessage'
import TextMessage from './messages/TextMessage'
import ThinkingCard from './messages/ThinkingCard'
import ToolCallCard from './messages/ToolCallCard'
import PhaseCard from './messages/PhaseCard'
import RoundSummary from './messages/RoundSummary'
import StreamingMessage from './streaming/StreamingMessage'

export default function ChatArea() {
  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <ScrollArea className="flex-1 px-4 py-3">
      {messages.length === 0 && !streaming && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          输入消息开始对话
        </div>
      )}

      {messages.map((msg) => {
        // round summary — 折叠摘要
        if (msg.type === 'round_summary') {
          try {
            const c = JSON.parse(msg.content)
            return (
              <RoundSummary
                key={msg.id}
                roundGroup={msg.roundGroup || ''}
                thinking={c.thinking || 0}
                tools={c.tools || {}}
              />
            )
          } catch {
            return null
          }
        }

        // phase_action — 阶段交互卡片
        if (msg.type === 'phase_action' && msg.phaseAction) {
          return <PhaseCard key={msg.id} {...msg} />
        }

        // 折叠状态 — 隐藏
        if (msg.collapsed && msg.roundGroup) {
          const expanded = useChatStore.getState().expandedRounds[msg.roundGroup]
          if (!expanded) return null
        }

        // thinking — 思考过程
        if (msg.type === 'thinking') {
          return <ThinkingCard key={msg.id} content={msg.content} />
        }

        // tool_call — 工具调用
        if (msg.type === 'tool_call') {
          return <ToolCallCard key={msg.id} {...msg} />
        }

        // user — 用户消息
        if (msg.role === 'user') {
          return (
            <UserMessage
              key={msg.id}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          )
        }

        // agent text — 文本回复
        if (msg.type === 'text') {
          return (
            <TextMessage
              key={msg.id}
              content={msg.content}
              streaming={msg.streaming}
            />
          )
        }

        return null
      })}

      {streaming && <StreamingMessage />}
      <div ref={bottomRef} />
    </ScrollArea>
  )
}
