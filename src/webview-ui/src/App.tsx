import { useEffect } from 'react'
import { useChatStore } from './stores/chatStore'
import ChatHeader from './components/ChatHeader'
import ChatArea from './components/ChatArea'
import ChatInput from './components/ChatInput'

export default function App() {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data
      const s = useChatStore.getState()
      switch (msg.type) {
        case 'loadMessages':
          s.loadMessages(msg.messages || [], msg.taskId, msg.taskType)
          break
        case 'stream-chunk':
          s.handleStreamChunk(msg.text)
          break
        case 'stream-done':
          s.handleStreamDone()
          break
        case 'thinking-chunk':
          s.handleThinkingChunk(msg)
          break
        case 'tool-chunk':
          s.handleToolChunk(msg)
          break
        case 'messages-sync':
          s.handleMessagesSync(msg.messages || [])
          break
        case 'addUserMessage':
          s.addUserMessage(msg.content)
          break
        case 'state-delta':
          if (msg.activeTaskId) s.setStateDelta(msg)
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <ChatHeader />
      <ChatArea />
      <ChatInput />
    </div>
  )
}
