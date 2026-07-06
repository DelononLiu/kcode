import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Square } from 'lucide-react'
import { useChatStore } from '@/stores/chatStore'

const vsCode = (window as any).vscode

export default function ChatInput() {
  const streaming = useChatStore((s) => s.streaming)
  const viewMode = useChatStore((s) => s.viewMode)
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim() || streaming) return
    const msgType =
      viewMode === 'assistant' ? 'sendAssistantMessage' : 'stageInput'
    vsCode?.postMessage({
      type: msgType,
      text: text.trim(),
      taskId: useChatStore.getState().activeTaskId,
    })
    setText('')
  }

  const stop = () => {
    vsCode?.postMessage({ type: 'stopGeneration' })
  }

  return (
    <div className="border-t border-border p-3 flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) =>
          e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())
        }
        placeholder={streaming ? '正在生成...' : '输入消息，Enter 发送'}
        disabled={streaming}
      />
      {streaming ? (
        <Button size="icon" variant="destructive" onClick={stop}>
          <Square className="w-4 h-4" />
        </Button>
      ) : (
        <Button size="icon" onClick={send}>
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}
